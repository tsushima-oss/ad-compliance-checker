import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createReadStream, readFileSync, statSync, unlinkSync } from "fs";
import { Readable } from "stream";
import { tmpdir } from "os";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import multer from "multer";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getCheckById, createCheck, updateCheck } from "../db";
import { ENV } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => { server.close(() => resolve(true)); });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// ─── Gemini Files API ──────────────────────────────────────────────────────────

async function uploadToGeminiFiles(filePath: string, mimeType: string, displayName: string): Promise<string> {
  const apiKey = ENV.googleAiApiKey;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY is not configured");

  // ファイルサイズのみ取得（ファイル全体をメモリに読み込まない）
  const fileSize = statSync(filePath).size;

  // Step 1: Start resumable upload session
  const initRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(fileSize),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: displayName } }),
    }
  );

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`Gemini Files API init failed: ${initRes.status} – ${errText}`);
  }

  const uploadUrl = initRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini Files API: upload URL not returned");

  // Step 2: ファイルをストリーミングで送信（メモリに全展開しない）
  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(fileSize),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: webStream,
    // @ts-ignore Node.js fetch requires duplex for streaming bodies
    duplex: "half",
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Gemini Files API upload failed: ${uploadRes.status} – ${errText}`);
  }

  const uploadResult = (await uploadRes.json()) as {
    file: { name: string; uri: string; state: string };
  };

  if (!uploadResult.file?.uri) throw new Error("Gemini Files API: no URI in response");

  const { name: fileName, uri: fileUri } = uploadResult.file;

  // Step 3: Wait for file state to become ACTIVE (up to 30s)
  for (let i = 0; i < 15; i++) {
    const pollRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`
    );
    const pollData = (await pollRes.json()) as { state: string };
    if (pollData.state === "ACTIVE") return fileUri;
    if (pollData.state === "FAILED") throw new Error("Gemini file processing failed");
    await new Promise(r => setTimeout(r, 2000));
  }

  // Return URI anyway — Gemini usually marks ACTIVE before we time out
  return fileUri;
}

// ─── Server ────────────────────────────────────────────────────────────────────

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ── File upload endpoint (images + videos via multipart FormData) ────────────
  const multerStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpdir()),
    filename: (_req, _file, cb) =>
      cb(null, `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`),
  });
  const uploadMiddleware = multer({
    storage: multerStorage,
    limits: { fileSize: 110 * 1024 * 1024 }, // 110 MB hard limit
  }).single("file");

  app.post(
    "/api/upload",
    (req, res, next) => {
      uploadMiddleware(req, res, err => {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            res.status(413).json({ error: "ファイルサイズが大きすぎます（最大100MB）" });
            return;
          }
          res.status(400).json({ error: err.message });
          return;
        }
        if (err) {
          res.status(500).json({ error: String(err) });
          return;
        }
        next();
      });
    },
    async (req, res) => {
      const file = (req as express.Request & { file?: Express.Multer.File }).file;
      if (!file) {
        res.status(400).json({ error: "ファイルが提供されていません" });
        return;
      }

      const isVideo = file.mimetype.startsWith("video/");

      try {
        if (isVideo) {
          // Upload video to Gemini Files API and store the URI
          const videoUri = await uploadToGeminiFiles(file.path, file.mimetype, file.originalname);

          const checkId = await createCheck({
            userId: null,
            imageUrl: videoUri,
            imageKey: videoUri.slice(-256), // trim to fit varchar(512) if needed
            fileName: file.originalname,
            imageBase64: null,
            imageMimeType: file.mimetype,
            extractedText: null,
            overallRisk: "safe",
            totalViolations: 0,
            summary: null,
          });

          try { unlinkSync(file.path); } catch { /* ignore */ }
          res.json({ checkId, imageUrl: videoUri, fileType: "video" });
        } else {
          // Image: read as base64 and store in DB
          const base64 = readFileSync(file.path).toString("base64");

          const checkId = await createCheck({
            userId: null,
            imageUrl: "/api/image/0",
            imageKey: "",
            fileName: file.originalname,
            imageBase64: base64,
            imageMimeType: file.mimetype,
            extractedText: null,
            overallRisk: "safe",
            totalViolations: 0,
            summary: null,
          });

          await updateCheck(checkId, {
            imageUrl: `/api/image/${checkId}`,
            imageKey: String(checkId),
          });

          try { unlinkSync(file.path); } catch { /* ignore */ }
          res.json({ checkId, imageUrl: `/api/image/${checkId}`, fileType: "image" });
        }
      } catch (err: unknown) {
        try { unlinkSync(file.path); } catch { /* ignore */ }
        const message = err instanceof Error ? err.message : "アップロードに失敗しました";
        res.status(500).json({ error: message });
      }
    }
  );

  // ── Serve stored images from DB (base64) ────────────────────────────────────
  app.get("/api/image/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) { res.status(400).send("Invalid ID"); return; }
      const check = await getCheckById(id);
      if (!check?.imageBase64) { res.status(404).send("Not found"); return; }
      const mimeType = check.imageMimeType || "image/png";
      const buffer = Buffer.from(check.imageBase64, "base64");
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Cache-Control", "public, max-age=31536000");
      res.send(buffer);
    } catch {
      res.status(500).send("Error");
    }
  });

  // ── tRPC API ─────────────────────────────────────────────────────────────────
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
