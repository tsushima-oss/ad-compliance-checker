import { describe, expect, it, vi, beforeEach } from "vitest";

// LLMモジュールをモック
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
import { analyzeAdImage } from "./compliance";

const mockInvokeLLM = vi.mocked(invokeLLM);

function makeLLMResponse(content: string) {
  return {
    id: "test",
    created: Date.now(),
    model: "test-model",
    choices: [{ index: 0, message: { role: "assistant" as const, content }, finish_reason: "stop" }],
  };
}

describe("analyzeAdImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("違反なしの場合はsafeを返す", async () => {
    // OCRレスポンス
    mockInvokeLLM.mockResolvedValueOnce(
      makeLLMResponse("本製品は食品です。健康的な生活をサポートします。")
    );
    // 規制チェックレスポンス
    mockInvokeLLM.mockResolvedValueOnce(
      makeLLMResponse(
        JSON.stringify({
          violations: [],
          overallRisk: "safe",
          summary: "規制違反は検出されませんでした。",
        })
      )
    );

    const result = await analyzeAdImage("https://example.com/test.jpg");

    expect(result.overallRisk).toBe("safe");
    expect(result.violations).toHaveLength(0);
    expect(result.extractedText).toBe("本製品は食品です。健康的な生活をサポートします。");
  });

  it("薬機法違反が検出された場合はhighリスクを返す", async () => {
    mockInvokeLLM.mockResolvedValueOnce(
      makeLLMResponse("この薬で癌が完治します！副作用なし！")
    );
    mockInvokeLLM.mockResolvedValueOnce(
      makeLLMResponse(
        JSON.stringify({
          violations: [
            {
              category: "yakujiho",
              riskLevel: "high",
              violationText: "癌が完治します",
              reason: "未承認医薬品の効能効果の標榜に該当します。薬機法第68条違反の可能性があります。",
              suggestion: "「健康維持をサポートします」などの表現に変更してください。",
              legalBasis: "薬機法第68条（承認前の医薬品等の広告の禁止）",
            },
            {
              category: "yakujiho",
              riskLevel: "high",
              violationText: "副作用なし",
              reason: "安全性の断定的表現は薬機法第66条の誇大広告に該当します。",
              suggestion: "安全性に関する断定的表現は削除してください。",
              legalBasis: "薬機法第66条（誇大広告等の禁止）",
            },
          ],
          overallRisk: "high",
          summary: "重大な薬機法違反の可能性があります。",
        })
      )
    );

    const result = await analyzeAdImage("https://example.com/test.jpg");

    expect(result.overallRisk).toBe("high");
    expect(result.violations).toHaveLength(2);
    expect(result.violations[0].category).toBe("yakujiho");
    expect(result.violations[0].riskLevel).toBe("high");
  });

  it("景品表示法違反が検出された場合は正しいカテゴリを返す", async () => {
    mockInvokeLLM.mockResolvedValueOnce(
      makeLLMResponse("業界No.1！今だけ90%OFF！")
    );
    mockInvokeLLM.mockResolvedValueOnce(
      makeLLMResponse(
        JSON.stringify({
          violations: [
            {
              category: "keihyo",
              riskLevel: "high",
              violationText: "業界No.1",
              reason: "根拠のない最上級表現は景品表示法第5条1号の優良誤認表示に該当します。",
              suggestion: "「業界No.1」は根拠となる調査データが必要です。根拠がない場合は削除してください。",
              legalBasis: "景品表示法第5条第1号（優良誤認表示の禁止）",
            },
          ],
          overallRisk: "high",
          summary: "景品表示法違反の可能性があります。",
        })
      )
    );

    const result = await analyzeAdImage("https://example.com/test.jpg");

    expect(result.violations[0].category).toBe("keihyo");
    expect(result.violations[0].violationText).toBe("業界No.1");
  });

  it("LLMがJSONパースエラーを返した場合は安全にフォールバックする", async () => {
    mockInvokeLLM.mockResolvedValueOnce(makeLLMResponse("テキストなし"));
    mockInvokeLLM.mockResolvedValueOnce(makeLLMResponse("invalid json {{{"));

    const result = await analyzeAdImage("https://example.com/test.jpg");

    expect(result.overallRisk).toBe("safe");
    expect(result.violations).toHaveLength(0);
  });

  it("行政書士法違反が検出された場合は正しいカテゴリを返す", async () => {
    mockInvokeLLM.mockResolvedValueOnce(
      makeLLMResponse("許認可申請代行、示談交渉も対応！行政書士が何でも解決します。")
    );
    mockInvokeLLM.mockResolvedValueOnce(
      makeLLMResponse(
        JSON.stringify({
          violations: [
            {
              category: "gyoseishoshi",
              riskLevel: "high",
              violationText: "示談交渉も対応",
              reason: "示談交渉の代理は弁護士の独占業務であり、行政書士が広告することは弁護士法第72条違反（非弁行為）に該当します。",
              suggestion: "「示談交渉」の文言を削除し、行政書士の業務範囲内の許認可申請代行のみ記載してください。",
              legalBasis: "弁護士法第72条（非弁護士の法律事務の取扱い等の禁止）",
            },
            {
              category: "gyoseishoshi",
              riskLevel: "medium",
              violationText: "行政書士が何でも解決",
              reason: "行政書士の業務範囲を超えた万能性の標榜は誤認を招く表現です。",
              suggestion: "「行政書士が何でも解決」の表現を削除し、具体的な業務内容を明示してください。",
              legalBasis: "行政書士法第1条の3（業務範囲）、景品表示法第5条（優良誤認表示の禁止）",
            },
          ],
          overallRisk: "high",
          summary: "行政書士法および弁護士法違反の可能性があります。",
        })
      )
    );

    const result = await analyzeAdImage("https://example.com/test.jpg");

    expect(result.overallRisk).toBe("high");
    expect(result.violations).toHaveLength(2);
    expect(result.violations[0].category).toBe("gyoseishoshi");
    expect(result.violations[0].riskLevel).toBe("high");
    expect(result.violations[1].category).toBe("gyoseishoshi");
    expect(result.violations[1].riskLevel).toBe("medium");
  });

  it("invokeLLMが2回呼ばれる（OCR + 規制チェック）", async () => {
    mockInvokeLLM.mockResolvedValueOnce(makeLLMResponse("テキスト"));
    mockInvokeLLM.mockResolvedValueOnce(
      makeLLMResponse(JSON.stringify({ violations: [], overallRisk: "safe", summary: "問題なし" }))
    );

    await analyzeAdImage("https://example.com/test.jpg");

    expect(mockInvokeLLM).toHaveBeenCalledTimes(2);
  });
});
