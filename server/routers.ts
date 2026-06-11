import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { analyzeAdImage } from "./compliance";
import { generateCompliancePdf } from "./pdfExport";
import {
  createCheck,
  updateCheck,
  createCheckItems,
  getCheckById,
  getCheckItemsByCheckId,
  getChecksByUserId,
  deleteCheck,
} from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  compliance: router({
    /**
     * 画像をアップロードしてDBに保存し、IDを返す
     * フロントエンドからbase64エンコードされた画像を受け取る
     */
    uploadImage: publicProcedure
      .input(
        z.object({
          base64: z.string(),
          mimeType: z.string(),
          fileName: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { base64, mimeType, fileName } = input;
        const userId = ctx.user?.id ?? null;

        // Create check record with placeholder URL (updated after we get the ID)
        const checkId = await createCheck({
          userId,
          imageUrl: "/api/image/0",
          imageKey: "",
          fileName: fileName ?? null,
          imageBase64: base64,
          imageMimeType: mimeType,
          extractedText: null,
          overallRisk: "safe",
          totalViolations: 0,
          summary: null,
        });

        // Update URL to point to this specific check's image
        const imageUrl = `/api/image/${checkId}`;
        await updateCheck(checkId, { imageUrl, imageKey: String(checkId) });

        return { checkId, imageUrl };
      }),

    /**
     * 指定のcheckIdに対してAI規制チェックを実行する
     */
    analyze: publicProcedure
      .input(z.object({ checkId: z.number() }))
      .mutation(async ({ input }) => {
        const check = await getCheckById(input.checkId);
        if (!check) throw new Error("Check not found");

        // Use base64 stored in DB directly
        if (!check.imageBase64 || !check.imageMimeType) {
          throw new Error("Image data not found");
        }
        const imageForOcr = {
          type: "base64" as const,
          data: check.imageBase64,
          mimeType: check.imageMimeType,
        };

        const result = await analyzeAdImage(imageForOcr);

        await updateCheck(input.checkId, {
          extractedText: result.extractedText,
          overallRisk: result.overallRisk,
          totalViolations: result.violations.length,
          summary: result.summary,
        });

        if (result.violations.length > 0) {
          await createCheckItems(
            result.violations.map(v => ({
              checkId: input.checkId,
              category: v.category,
              riskLevel: v.riskLevel,
              violationText: v.violationText,
              reason: v.reason,
              suggestion: v.suggestion,
              legalBasis: v.legalBasis,
            }))
          );
        }

        return { success: true, checkId: input.checkId };
      }),

    /**
     * チェック結果の詳細を取得する
     */
    getResult: publicProcedure
      .input(z.object({ checkId: z.number() }))
      .query(async ({ input }) => {
        const check = await getCheckById(input.checkId);
        if (!check) throw new Error("Check not found");
        const items = await getCheckItemsByCheckId(input.checkId);
        return { check, items };
      }),

    /**
     * チェック履歴一覧を取得する
     */
    getHistory: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const userId = ctx.user?.id ?? null;
        return getChecksByUserId(userId, input?.limit ?? 20);
      }),

    /**
     * チェック履歴を削除する
     */
    deleteCheck: publicProcedure
      .input(z.object({ checkId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCheck(input.checkId);
        return { success: true };
      }),

    /**
     * チェック結果をPDFとして返す（base64エンコード済み）
     */
    exportPdf: publicProcedure
      .input(z.object({ checkId: z.number() }))
      .mutation(async ({ input }) => {
        const check = await getCheckById(input.checkId);
        if (!check) throw new Error("Check not found");
        const items = await getCheckItemsByCheckId(input.checkId);
        const pdfBytes = await generateCompliancePdf(check, items);
        const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
        return {
          pdfBase64,
          fileName: `ad-compliance-report-${check.id}.pdf`,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
