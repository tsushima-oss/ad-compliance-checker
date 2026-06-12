import { invokeLLM, type Message } from "./_core/llm";
import { ENV } from "./_core/env";

export type RiskLevel = "high" | "medium" | "low";
export type Category = "yakujiho" | "keihyo" | "iryokokoku" | "gyoseishoshi" | "other";
export type OverallRisk = "high" | "medium" | "low" | "safe";

export interface ViolationItem {
  category: Category;
  riskLevel: RiskLevel;
  violationText: string;
  reason: string;
  suggestion: string;
  legalBasis: string;
}

export interface ComplianceResult {
  extractedText: string;
  violations: ViolationItem[];
  overallRisk: OverallRisk;
  summary: string;
}

const SYSTEM_PROMPT = `あなたは日本の広告規制の専門家です。
以下の法令・ガイドラインに精通しており、広告・バナー画像に含まれるテキストを厳密に審査します。

【審査対象の法令・ガイドライン】

1. 薬機法（医薬品、医療機器等の品質、有効性及び安全性の確保等に関する法律）
   - 未承認医薬品・医療機器の効能効果を標榜することの禁止
   - 誇大広告の禁止（第66条）：虚偽・誇大な記事・広告の禁止
   - 「治る」「治療」「完治」「根治」「病気が治る」などの医薬品的効能効果の標榜
   - 「効果がある」「効く」「改善する」などの断定的表現
   - 体験談・ビフォーアフターを用いた効果の断定
   - 最大級表現（「最も」「一番」「No.1」等）の使用
   - 「副作用なし」「安全」「無害」などの安全性の断定
   - 医師・専門家の推薦を装った表現

2. 景品表示法（不当景品類及び不当表示防止法）
   - 優良誤認表示の禁止（第5条1号）：実際より著しく優良であると示す表現
   - 有利誤認表示の禁止（第5条2号）：実際より著しく有利であると示す表現
   - 「日本一」「世界一」「業界No.1」などの最上級表現（根拠なし）
   - 「完全無料」「0円」などの不当な価格表示
   - 「期間限定」「数量限定」の虚偽表示
   - 「〇〇%OFF」「半額」などの根拠のない割引表示
   - 打消し表示が不十分な場合
   - 「お客様の声」「口コミ」の捏造・誇張

3. 医療広告ガイドライン（医業若しくは歯科医業又は病院若しくは診療所に関する広告等に関する指針）
   - 比較広告・誇大広告の禁止
   - 「専門医」「名医」「権威ある」などの根拠のない優良性の標榜
   - 治療実績・成功率の根拠のない掲載
   - 患者の体験談・ビフォーアフター写真の使用（原則禁止）
   - 費用に関する誤解を招く表示
   - 「最先端」「最新」「画期的」などの根拠のない表現
   - 「〇〇学会認定」などの虚偽の認定表示

5. インフルエンサーマーケティングプラットフォームガイドライン（業界基準）
   【PR表示・ステルスマーケティング規制】
   - 企業案件・PR投稿には「#PR」「#広告」「#プロモーション」のいずれかの明示が必須（景品表示法ステルスマーケティング規制・令和5年10月施行）
   - 案件であることを隠した「口コミ」「体験談」風の表現は禁止
   - ハッシュタグに競合他社のブランド名を含めることの禁止
   【健康食品・サプリメント】
   - 疾病の予防・治療・身体の構造機能への効果の標榜禁止（例：「〇〇病が治る」「体質改善」）
   - 許容表現：「日々の健康習慣に」「活力をサポート」程度に限定
   【化粧品】
   - 化粧品として認められた56効能の範囲内のみ表現可（薬機法の化粧品効能の範囲）
   - 浸透・作用の表現は「角質層まで」に限定。真皮・皮下への効果標榜は禁止
   【美容機器】
   - 医療機器認証なき美容機器は化粧品レベルの効果表現のみ許容
   - 「たるみ解消」「シワが消える」など医療的効果の標榜は禁止
   【金融・FX・暗号資産】
   - 登録業者情報・手数料・リスクの開示が必須
   - 「確実に儲かる」「損しない」などの断定的表現は禁止
   - 暗号資産の価格変動リスクの明示義務
   【アルコール】
   - 「20歳未満の飲酒は法律で禁止」等の未成年禁止表記が必須
   - 未成年者・飲酒運転を想起させる表現禁止
   【ギャンブル・公営競技】
   - 高額当選・配当・勝率の強調禁止
   - 「責任ある遊び方」等のメッセージの掲載義務
   【人材紹介・求人】
   - 広告主が有料職業紹介事業の許可を保有していることが前提
   - 求職者への費用請求を示唆する表現禁止
   【マッチング・出会い系サービス】
   - 18歳未満利用禁止の明示が必須
   - 運営者の連絡先・利用料金の明示義務

4. 行政書士法（昭和26年法律第4号）および弁護士法（昭和24年法律第205号）
   【無資格業務の標榜・非弁行為の禁止】
   - 行政書士でない者が「許認可申請代行」「官公署提出書類作成」を報酬を得て行う旨の広告（行政書士法第19条第1項違反）
   - 弁護士でない者が「法律相談」「訴訟代理」「示談交渉」「紛争解決」「法的手続き代行」などを業として行う旨の広告（弁護士法第72条違反・非弁行為）
   - 司法書士でない者が「登記申請代理」「裁判書類作成」を業として行う旨の広告（司法書士法第73条違反）
   - 税理士でない者が「税務申告代理」「税務書類作成」「税務相談」を業として行う旨の広告（税理士法第52条違反）
   - 社会保険労務士でない者が「労働保険・社会保険手続き代理」を業として行う旨の広告（社会保険労務士法第27条違反）
   【行政書士が行えない業務の標榜】
   - 行政書士が「法律相談」「訴訟代理」「示談交渉の代理」「遺産分割協議の代理交渉」を行う旨の広告（弁護士法第72条違反となる非弁行為）
   - 行政書士が「登記申請の代理」を行う旨の広告（司法書士法違反）
   - 行政書士が「税務申告の代理」を行う旨の広告（税理士法違反）
   - 「行政書士が何でも解決」「法的問題すべて対応」など業務範囲を超えた万能性の標榜
   【誇大広告・誤認を招く表現】
   - 「確実に許可が取れる」「必ず申請が通る」などの成功を断定する表現
   - 「最速」「最安値」「業界No.1」などの根拠のない最上級表現
   - 資格・登録番号の虚偽表示または未記載による無資格業者の誤認誘導
   - 「無料相談」を謳いつつ実質的に有料となる不当表示
   - 「〇〇士監修」「〇〇士推薦」などの虚偽の資格者関与の表示

【リスクレベルの定義】
- high（高リスク）：法令違反の可能性が高く、行政処分・罰則の対象になりうる表現
- medium（中リスク）：グレーゾーンだが問題になりやすい表現、要注意
- low（低リスク）：軽微な懸念、改善が望ましい表現

【カテゴリ定義】
- yakujiho：薬機法違反の可能性がある表現
- keihyo：景品表示法違反の可能性がある表現
- iryokokoku：医療広告ガイドライン違反の可能性がある表現
- gyoseishoshi：行政書士法・弁護士法・司法書士法等の士業法違反の可能性がある表現
- other：その他の広告規制上の懸念

指示に従い、提供されたテキストを厳密に審査してください。`;

export type ImageInput =
  | { type: "base64"; data: string; mimeType: string }
  | { type: "url"; url: string }
  | { type: "video-uri"; uri: string; mimeType: string };

/**
 * 動画ファイル（Gemini Files API URI）からテキストを抽出する
 */
async function extractTextFromVideo(fileUri: string, mimeType: string): Promise<string> {
  const apiKey = ENV.googleAiApiKey;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY is not configured");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                file_data: {
                  mime_type: mimeType,
                  file_uri: fileUri,
                },
              },
              {
                text: "この動画広告に表示されるすべてのテキストを正確に抽出してください。すべてのフレームに表示されるテキスト・字幕・テロップを漏れなく抽出し、テキストのみを返してください。説明は不要です。テキストが存在しない場合は「テキストなし」と返してください。",
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini video OCR failed: ${response.status} – ${errText}`);
  }

  const result = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  return result.candidates?.[0]?.content?.parts?.[0]?.text ?? "テキスト抽出に失敗しました";
}

/**
 * 画像または動画からOCRでテキストを抽出し、広告規制チェックを行う
 */
export async function analyzeAdImage(image: ImageInput): Promise<ComplianceResult> {
  // Step 1: OCR - ファイルからテキストを抽出
  let extractedText: string;

  if (image.type === "video-uri") {
    // 動画: Gemini Files API URI を使って直接解析
    extractedText = await extractTextFromVideo(image.uri, image.mimeType);
  } else {
    // 画像: data URI または URL で Gemini に渡す
    const imageUrl = image.type === "base64"
      ? `data:${image.mimeType};base64,${image.data}`
      : image.url;

    const ocrMessages: Message[] = [
      {
        role: "system",
        content: "あなたは高精度OCRシステムです。画像に含まれるすべてのテキストを正確に抽出してください。テキストの位置関係・改行を保持し、画像内のすべての文字を漏れなく抽出してください。テキストのみを返し、説明は不要です。テキストが存在しない場合は「テキストなし」と返してください。",
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
              detail: "high",
            },
          },
          {
            type: "text",
            text: "この画像に含まれるすべてのテキストを抽出してください。",
          },
        ],
      },
    ];
    const ocrResponse = await invokeLLM({ model: "gemini-2.5-flash", messages: ocrMessages });

    const rawContent = ocrResponse.choices?.[0]?.message?.content;
    extractedText = typeof rawContent === "string"
      ? rawContent
      : Array.isArray(rawContent)
        ? rawContent.map(p => (p.type === "text" ? p.text : "")).join("")
        : "テキスト抽出に失敗しました";
  }

  // Step 2: 規制チェック
  const checkResponse = await invokeLLM({ model: "claude-sonnet-4-6",
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `以下の広告テキストを審査し、JSON形式で結果を返してください。

【広告テキスト】
${extractedText}

【出力形式】
以下のJSON形式で厳密に返してください（マークダウンコードブロックなし）：
{
  "violations": [
    {
      "category": "yakujiho" | "keihyo" | "iryokokoku" | "gyoseishoshi" | "other",
      "riskLevel": "high" | "medium" | "low",
      "violationText": "問題のある具体的なテキスト部分",
      "reason": "なぜ問題なのかの詳細説明（法令条文・ガイドラインを引用）",
      "suggestion": "改善提案（代替表現の具体例）",
      "legalBasis": "根拠となる法令・条文・ガイドライン名"
    }
  ],
  "overallRisk": "high" | "medium" | "low" | "safe",
  "summary": "全体的な審査結果の要約（200字以内）"
}

違反が見つからない場合は violations を空配列にし、overallRisk を "safe" にしてください。
テキストが「テキストなし」の場合も violations を空配列にしてください。`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "compliance_result",
        strict: true,
        schema: {
          type: "object",
          properties: {
            violations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string", enum: ["yakujiho", "keihyo", "iryokokoku", "gyoseishoshi", "other"] },
                  riskLevel: { type: "string", enum: ["high", "medium", "low"] },
                  violationText: { type: "string" },
                  reason: { type: "string" },
                  suggestion: { type: "string" },
                  legalBasis: { type: "string" },
                },
                required: ["category", "riskLevel", "violationText", "reason", "suggestion", "legalBasis"],
                additionalProperties: false,
              },
            },
            overallRisk: { type: "string", enum: ["high", "medium", "low", "safe"] },
            summary: { type: "string" },
          },
          required: ["violations", "overallRisk", "summary"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = checkResponse.choices?.[0]?.message?.content ?? "{}";
  let parsed: { violations: ViolationItem[]; overallRisk: OverallRisk; summary: string };

  try {
    parsed = typeof content === "string" ? JSON.parse(content) : content;
  } catch {
    parsed = {
      violations: [],
      overallRisk: "safe",
      summary: "解析に失敗しました。",
    };
  }

  return {
    extractedText,
    violations: parsed.violations ?? [],
    overallRisk: parsed.overallRisk ?? "safe",
    summary: parsed.summary ?? "",
  };
}
