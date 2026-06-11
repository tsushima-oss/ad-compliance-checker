import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { Check, CheckItem } from "../drizzle/schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_PATH = path.resolve(__dirname, "fonts/NotoSansCJKjp-Regular.otf");

// ─── 色定義 ──────────────────────────────────────────────────────────────────
const COLOR = {
  navy:       rgb(0.10, 0.15, 0.30),
  navyLight:  rgb(0.15, 0.22, 0.42),
  white:      rgb(1, 1, 1),
  gray50:     rgb(0.97, 0.97, 0.98),
  gray100:    rgb(0.93, 0.93, 0.95),
  gray300:    rgb(0.80, 0.80, 0.83),
  gray600:    rgb(0.45, 0.45, 0.50),
  gray800:    rgb(0.18, 0.18, 0.22),
  red:        rgb(0.85, 0.15, 0.15),
  redLight:   rgb(1.00, 0.93, 0.93),
  orange:     rgb(0.90, 0.45, 0.05),
  orangeLight:rgb(1.00, 0.96, 0.88),
  yellow:     rgb(0.75, 0.60, 0.00),
  yellowLight:rgb(1.00, 0.98, 0.88),
  green:      rgb(0.10, 0.60, 0.30),
  greenLight: rgb(0.90, 0.97, 0.92),
  blue:       rgb(0.15, 0.40, 0.80),
  blueLight:  rgb(0.90, 0.94, 1.00),
  purple:     rgb(0.50, 0.20, 0.80),
  purpleLight:rgb(0.95, 0.90, 1.00),
  teal:       rgb(0.05, 0.55, 0.55),
  tealLight:  rgb(0.88, 0.97, 0.97),
};

type RiskLevel = "high" | "medium" | "low";
type Category  = "yakujiho" | "keihyo" | "iryokokoku" | "gyoseishoshi" | "other";
type OverallRisk = "high" | "medium" | "low" | "safe";

const CATEGORY_LABELS: Record<Category, string> = {
  yakujiho:     "薬機法",
  keihyo:       "景品表示法",
  iryokokoku:   "医療広告ガイドライン",
  gyoseishoshi: "行政書士法・士業法",
  other:        "その他",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  high:   "高リスク",
  medium: "中リスク",
  low:    "低リスク",
};

const OVERALL_RISK_LABELS: Record<OverallRisk, string> = {
  high:   "高リスク",
  medium: "中リスク",
  low:    "低リスク",
  safe:   "問題なし",
};

// ─── フォント読み込み ─────────────────────────────────────────────────────────
async function loadJapaneseFont(): Promise<Uint8Array> {
  try {
    const buf = await readFile(FONT_PATH);
    return new Uint8Array(buf);
  } catch {
    // フォントなし → 空のUint8Arrayを返してフォールバック
    throw new Error(`Japanese font not found at ${FONT_PATH}. Please ensure the font file exists.`);
  }
}

// ─── テキスト折り返し ─────────────────────────────────────────────────────────
function wrapText(text: string, maxChars: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    if (para.length === 0) { lines.push(""); continue; }
    let current = "";
    for (const char of para) {
      current += char;
      if (current.length >= maxChars) {
        lines.push(current);
        current = "";
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

// ─── PDF生成本体 ──────────────────────────────────────────────────────────────
export async function generateCompliancePdf(
  check: Check,
  items: CheckItem[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit as any);

  // フォント読み込み
  let jpFont: Awaited<ReturnType<typeof pdfDoc.embedFont>>;
  try {
    const fontBytes = await loadJapaneseFont();
    jpFont = await pdfDoc.embedFont(fontBytes);
  } catch {
    // フォールバック：標準フォント（日本語は文字化けするが最低限動作）
    jpFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  // A4サイズ
  const W = 595.28;
  const H = 841.89;
  const MARGIN = 48;
  const CONTENT_W = W - MARGIN * 2;

  // ─── ページ管理 ────────────────────────────────────────────────────────────
  let page = pdfDoc.addPage([W, H]);
  let y = H;

  function newPage() {
    page = pdfDoc.addPage([W, H]);
    y = H;
    // ページヘッダー（細いバー）
    page.drawRectangle({ x: 0, y: H - 28, width: W, height: 28, color: COLOR.navy });
    page.drawText("広告規制コンプライアンスチェック レポート", {
      x: MARGIN, y: H - 20, size: 9, font: jpFont, color: COLOR.white,
    });
    const pageCount = pdfDoc.getPageCount();
    page.drawText(`${pageCount}ページ`, {
      x: W - MARGIN - 40, y: H - 20, size: 9, font: jpFont, color: COLOR.gray300,
    });
    y = H - 28 - 20;
  }

  function ensureSpace(needed: number) {
    if (y - needed < 60) { newPage(); }
  }

  // ─── ヘッダーセクション ────────────────────────────────────────────────────
  // 濃紺グラデーション風ヘッダー
  page.drawRectangle({ x: 0, y: H - 100, width: W, height: 100, color: COLOR.navy });
  // アクセントライン
  page.drawRectangle({ x: 0, y: H - 103, width: W, height: 3, color: COLOR.blue });

  page.drawText("広告規制コンプライアンスチェック レポート", {
    x: MARGIN, y: H - 42, size: 18, font: jpFont, color: COLOR.white,
  });
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日  ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  page.drawText(`出力日時: ${dateStr}`, {
    x: MARGIN, y: H - 66, size: 10, font: jpFont, color: COLOR.gray300,
  });
  page.drawText("AD COMPLIANCE AI", {
    x: W - MARGIN - 120, y: H - 55, size: 11, font: jpFont, color: COLOR.gray300,
  });

  y = H - 100 - 24;

  // ─── チェック対象情報カード ────────────────────────────────────────────────
  ensureSpace(90);
  const infoCardH = 80;
  page.drawRectangle({ x: MARGIN, y: y - infoCardH, width: CONTENT_W, height: infoCardH, color: COLOR.gray50, borderColor: COLOR.gray100, borderWidth: 1 });
  // 左アクセントバー
  page.drawRectangle({ x: MARGIN, y: y - infoCardH, width: 4, height: infoCardH, color: COLOR.navy });

  page.drawText("■  チェック対象情報", { x: MARGIN + 14, y: y - 18, size: 11, font: jpFont, color: COLOR.navy });

  const checkDate = new Date(check.createdAt);
  const checkDateStr = `${checkDate.getFullYear()}/${checkDate.getMonth()+1}/${checkDate.getDate()}  ${String(checkDate.getHours()).padStart(2,"0")}:${String(checkDate.getMinutes()).padStart(2,"0")}`;

  page.drawText(`ファイル名:`, { x: MARGIN + 14, y: y - 36, size: 9, font: jpFont, color: COLOR.gray600 });
  page.drawText(check.fileName ?? "不明", { x: MARGIN + 80, y: y - 36, size: 9, font: jpFont, color: COLOR.gray800 });

  page.drawText(`チェック日時:`, { x: MARGIN + 14, y: y - 50, size: 9, font: jpFont, color: COLOR.gray600 });
  page.drawText(checkDateStr, { x: MARGIN + 80, y: y - 50, size: 9, font: jpFont, color: COLOR.gray800 });

  page.drawText(`チェックID:`, { x: MARGIN + 14, y: y - 64, size: 9, font: jpFont, color: COLOR.gray600 });
  page.drawText(`#${String(check.id).padStart(5, "0")}`, { x: MARGIN + 80, y: y - 64, size: 9, font: jpFont, color: COLOR.gray800 });

  y -= infoCardH + 20;

  // ─── 総合リスク評価 ────────────────────────────────────────────────────────
  ensureSpace(90);

  const riskColors: Record<OverallRisk, { bg: typeof COLOR.redLight; border: typeof COLOR.red; text: typeof COLOR.red }> = {
    high:   { bg: COLOR.redLight,    border: COLOR.red,    text: COLOR.red    },
    medium: { bg: COLOR.orangeLight, border: COLOR.orange, text: COLOR.orange },
    low:    { bg: COLOR.yellowLight, border: COLOR.yellow, text: COLOR.yellow },
    safe:   { bg: COLOR.greenLight,  border: COLOR.green,  text: COLOR.green  },
  };
  const rc = riskColors[check.overallRisk as OverallRisk] ?? riskColors.safe;

  page.drawText("■  総合リスク評価", { x: MARGIN, y: y, size: 12, font: jpFont, color: COLOR.navy });
  y -= 14;

  const riskCardH = 52;
  page.drawRectangle({ x: MARGIN, y: y - riskCardH, width: CONTENT_W, height: riskCardH, color: rc.bg, borderColor: rc.border, borderWidth: 1.5 });

  // リスクバッジ
  const riskLabel = OVERALL_RISK_LABELS[check.overallRisk as OverallRisk] ?? "不明";
  page.drawRectangle({ x: MARGIN + 12, y: y - riskCardH + 12, width: 72, height: 28, color: rc.border });
  page.drawText(riskLabel, { x: MARGIN + 16, y: y - riskCardH + 22, size: 12, font: jpFont, color: COLOR.white });

  page.drawText(`検出された違反項目数: ${items.length}件`, {
    x: MARGIN + 100, y: y - riskCardH + 28, size: 11, font: jpFont, color: rc.text,
  });
  page.drawText(`総合評価: ${riskLabel}`, {
    x: MARGIN + 100, y: y - riskCardH + 14, size: 9, font: jpFont, color: COLOR.gray600,
  });

  y -= riskCardH + 16;

  // ─── 審査サマリー ──────────────────────────────────────────────────────────
  if (check.summary) {
    ensureSpace(60);
    page.drawText("■  審査サマリー", { x: MARGIN, y: y, size: 12, font: jpFont, color: COLOR.navy });
    y -= 14;

    const summaryLines = wrapText(check.summary, 48);
    const summaryH = summaryLines.length * 14 + 20;
    ensureSpace(summaryH + 10);

    page.drawRectangle({ x: MARGIN, y: y - summaryH, width: CONTENT_W, height: summaryH, color: COLOR.gray50, borderColor: COLOR.gray100, borderWidth: 1 });
    page.drawRectangle({ x: MARGIN, y: y - summaryH, width: 4, height: summaryH, color: COLOR.blue });

    let sy = y - 14;
    for (const line of summaryLines) {
      page.drawText(line, { x: MARGIN + 14, y: sy, size: 10, font: jpFont, color: COLOR.gray800 });
      sy -= 14;
    }
    y -= summaryH + 20;
  }

  // ─── OCR抽出テキスト ───────────────────────────────────────────────────────
  if (check.extractedText && check.extractedText !== "テキストなし" && check.extractedText !== "テキスト抽出に失敗しました") {
    ensureSpace(60);
    page.drawText("■  OCR抽出テキスト", { x: MARGIN, y: y, size: 12, font: jpFont, color: COLOR.navy });
    y -= 14;

    const ocrLines = wrapText(check.extractedText, 50).slice(0, 25);
    const ocrH = ocrLines.length * 13 + 20;
    ensureSpace(ocrH + 10);

    page.drawRectangle({ x: MARGIN, y: y - ocrH, width: CONTENT_W, height: ocrH, color: COLOR.gray50, borderColor: COLOR.gray100, borderWidth: 1 });

    let oy = y - 14;
    for (const line of ocrLines) {
      page.drawText(line || " ", { x: MARGIN + 12, y: oy, size: 9, font: jpFont, color: COLOR.gray600 });
      oy -= 13;
    }
    if (check.extractedText.length > 1000) {
      page.drawText("（以下省略）", { x: MARGIN + 12, y: oy, size: 9, font: jpFont, color: COLOR.gray300 });
    }
    y -= ocrH + 20;
  }

  // ─── 違反項目一覧 ──────────────────────────────────────────────────────────
  ensureSpace(40);
  page.drawText("■  違反項目一覧", { x: MARGIN, y: y, size: 12, font: jpFont, color: COLOR.navy });
  y -= 8;
  // 区切り線
  page.drawLine({ start: { x: MARGIN, y: y }, end: { x: MARGIN + CONTENT_W, y: y }, thickness: 1, color: COLOR.gray100 });
  y -= 16;

  if (items.length === 0) {
    ensureSpace(50);
    page.drawRectangle({ x: MARGIN, y: y - 44, width: CONTENT_W, height: 44, color: COLOR.greenLight, borderColor: COLOR.green, borderWidth: 1 });
    page.drawText("規制違反の可能性は検出されませんでした", {
      x: MARGIN + 20, y: y - 26, size: 11, font: jpFont, color: COLOR.green,
    });
    y -= 44 + 20;
  } else {
    // カテゴリ別グループ化
    const grouped: Record<string, CheckItem[]> = {};
    for (const item of items) {
      const cat = item.category as Category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    }

    const catColors: Record<Category, { bg: typeof COLOR.redLight; border: typeof COLOR.red; label: typeof COLOR.red }> = {
      yakujiho:     { bg: COLOR.redLight,    border: COLOR.red,    label: COLOR.red    },
      keihyo:       { bg: COLOR.orangeLight, border: COLOR.orange, label: COLOR.orange },
      iryokokoku:   { bg: COLOR.blueLight,   border: COLOR.blue,   label: COLOR.blue   },
      gyoseishoshi: { bg: COLOR.purpleLight, border: COLOR.purple, label: COLOR.purple },
      other:        { bg: COLOR.tealLight,   border: COLOR.teal,   label: COLOR.teal   },
    };

    let violationIndex = 0;
    for (const [cat, catItems] of Object.entries(grouped)) {
      const cc = catColors[cat as Category] ?? catColors.other;
      const catLabel = CATEGORY_LABELS[cat as Category] ?? cat;

      // カテゴリヘッダー
      ensureSpace(30);
      page.drawRectangle({ x: MARGIN, y: y - 24, width: CONTENT_W, height: 24, color: cc.bg, borderColor: cc.border, borderWidth: 1 });
      page.drawText(`${catLabel}  （${catItems.length}件）`, {
        x: MARGIN + 12, y: y - 17, size: 10, font: jpFont, color: cc.label,
      });
      y -= 24 + 8;

      for (const item of catItems) {
        violationIndex++;
        const riskLabel = RISK_LABELS[item.riskLevel as RiskLevel] ?? item.riskLevel;
        const riskColor = item.riskLevel === "high" ? COLOR.red : item.riskLevel === "medium" ? COLOR.orange : COLOR.yellow;

        // 各フィールドのテキスト折り返し
        const violationLines = wrapText(item.violationText ?? "（不明）", 44);
        const reasonLines    = wrapText(item.reason ?? "", 44);
        const suggestionLines= wrapText(item.suggestion ?? "", 44);
        const legalLines     = wrapText(item.legalBasis ?? "", 44);

        const cardH =
          20 +                              // 番号・リスクバッジ行
          violationLines.length * 13 + 6 +  // 問題表現
          reasonLines.length * 13 + 6 +     // 指摘理由
          (suggestionLines.length > 0 ? suggestionLines.length * 13 + 6 : 0) + // 改善提案
          (legalLines.length > 0 ? legalLines.length * 13 + 6 : 0) +           // 根拠法令
          16;                               // 下パディング

        ensureSpace(cardH + 12);

        // カードの背景
        page.drawRectangle({ x: MARGIN, y: y - cardH, width: CONTENT_W, height: cardH, color: COLOR.white, borderColor: COLOR.gray100, borderWidth: 1 });
        // 左アクセントバー
        page.drawRectangle({ x: MARGIN, y: y - cardH, width: 4, height: cardH, color: riskColor });

        let cy = y - 14;

        // 番号 + リスクバッジ
        page.drawText(`${violationIndex}.`, { x: MARGIN + 12, y: cy, size: 10, font: jpFont, color: COLOR.gray800 });
        const badgeW = 52;
        page.drawRectangle({ x: MARGIN + 30, y: cy - 3, width: badgeW, height: 15, color: riskColor });
        page.drawText(riskLabel, { x: MARGIN + 34, y: cy, size: 8, font: jpFont, color: COLOR.white });
        cy -= 18;

        // 問題表現
        page.drawText("問題表現:", { x: MARGIN + 12, y: cy, size: 8, font: jpFont, color: COLOR.gray600 });
        cy -= 12;
        for (const line of violationLines) {
          page.drawText(line, { x: MARGIN + 20, y: cy, size: 9, font: jpFont, color: COLOR.gray800 });
          cy -= 13;
        }
        cy -= 4;

        // 指摘理由
        if (reasonLines.length > 0) {
          page.drawText("指摘理由:", { x: MARGIN + 12, y: cy, size: 8, font: jpFont, color: COLOR.gray600 });
          cy -= 12;
          for (const line of reasonLines) {
            page.drawText(line, { x: MARGIN + 20, y: cy, size: 9, font: jpFont, color: COLOR.gray800 });
            cy -= 13;
          }
          cy -= 4;
        }

        // 改善提案
        if (suggestionLines.length > 0) {
          page.drawText("改善提案:", { x: MARGIN + 12, y: cy, size: 8, font: jpFont, color: COLOR.green });
          cy -= 12;
          for (const line of suggestionLines) {
            page.drawText(line, { x: MARGIN + 20, y: cy, size: 9, font: jpFont, color: COLOR.green });
            cy -= 13;
          }
          cy -= 4;
        }

        // 根拠法令
        if (legalLines.length > 0) {
          page.drawText("根拠法令:", { x: MARGIN + 12, y: cy, size: 8, font: jpFont, color: COLOR.gray600 });
          cy -= 12;
          for (const line of legalLines) {
            page.drawText(line, { x: MARGIN + 20, y: cy, size: 9, font: jpFont, color: COLOR.gray600 });
            cy -= 13;
          }
        }

        y -= cardH + 8;
      }

      y -= 8;
    }
  }

  // ─── フッター（全ページ） ──────────────────────────────────────────────────
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    p.drawRectangle({ x: 0, y: 0, width: W, height: 36, color: COLOR.gray50 });
    p.drawLine({ start: { x: 0, y: 36 }, end: { x: W, y: 36 }, thickness: 1, color: COLOR.gray100 });
    p.drawText(
      "※ 本レポートはAIによる参考情報です。法的アドバイスではありません。最終判断は専門家にご相談ください。",
      { x: MARGIN, y: 14, size: 7, font: jpFont, color: COLOR.gray600 }
    );
    p.drawText(`${i + 1} / ${pages.length}`, {
      x: W - MARGIN - 30, y: 14, size: 8, font: jpFont, color: COLOR.gray600,
    });
  }

  return pdfDoc.save();
}
