import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, ImageIcon, ShieldCheck, Loader2, Sparkles, AlertTriangle, CheckCircle2, Info, Scale, BookOpen, ExternalLink, TriangleAlert, Cpu, FlaskConical, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import AppNav from "@/components/AppNav";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];

export default function Home() {
  const [, navigate] = useLocation();
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const analyzeMutation = trpc.compliance.analyze.useMutation();

  const handleFile = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("対応していないファイル形式です", {
        description: "JPEG・PNG・WebP・GIF・MP4・MOV・WebM形式をアップロードしてください。",
      });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("ファイルサイズが大きすぎます", {
        description: "100MB以下のファイルをアップロードしてください。",
      });
      return;
    }
    setSelectedFile(file);
    setIsVideo(ACCEPTED_VIDEO_TYPES.includes(file.type));
    const url = URL.createObjectURL(file);
    setPreview(url);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    let checkId: number | null = null;
    try {
      setAnalysisStep(
        isVideo
          ? "動画をアップロード中（時間がかかる場合があります）..."
          : "画像をアップロード中..."
      );

      // FormData でファイルをアップロード（画像・動画共通）
      const formData = new FormData();
      formData.append("file", selectedFile);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({ error: "アップロードに失敗しました" })) as { error?: string };
        throw new Error(errData.error ?? `Upload failed: ${uploadRes.status}`);
      }

      const uploadData = (await uploadRes.json()) as { checkId: number; imageUrl: string };
      checkId = uploadData.checkId;

      setAnalysisStep("OCRでテキストを抽出中...");
      await new Promise(r => setTimeout(r, 800));

      setAnalysisStep("AIが広告規制をチェック中...");
      await analyzeMutation.mutateAsync({ checkId });

      toast.success("チェック完了", { description: "結果ページに移動します。" });
      navigate(`/result/${checkId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "しばらく時間をおいて再試行してください。";
      if (checkId !== null) {
        toast.error("解析に失敗しました。結果ページで再試できます。", { description: message });
        navigate(`/result/${checkId}`);
      } else {
        toast.error("アップロードに失敗しました", { description: message });
      }
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep("");
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreview(null);
    setIsVideo(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-background">
      <AppNav />

      <main className="container py-12">
        {/* ヒーローセクション */}
        <div className="mx-auto max-w-3xl text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/8 px-4 py-1.5 text-xs font-medium text-primary mb-6 border border-primary/15">
            <Sparkles className="h-3.5 w-3.5" />
            AI搭載・広告規制コンプライアンスチェック
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4 leading-tight">
            広告バナーの規制違反を<br />
            <span className="text-primary">AIが瞬時に検出</span>
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">
            薬機法・景品表示法・医療広告ガイドラインに照らし合わせ、<br />
            違反箇所とリスクレベルを分かりやすくレポートします。
          </p>

          {/* スクリーニングツール注意書き */}
          <div className="mt-6 inline-flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-left max-w-xl mx-auto">
            <Info className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              <span className="font-semibold">本ツールはAIによる一次スクリーニングです。</span>チェック結果は「確認すべき箇所の候補」として活用し、最終的な適法性の判断は必ず弁護士・薬事コンサルタント等の専門家にご確認ください。
            </p>
          </div>
        </div>

        {/* アップロードエリア */}
        <div className="mx-auto max-w-2xl">
          {!preview ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 min-h-[320px] group",
                isDragging
                  ? "border-primary bg-primary/5 drop-zone-active scale-[1.01]"
                  : "border-border hover:border-primary/50 hover:bg-muted/40 bg-card"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                onChange={handleInputChange}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-4 p-8 text-center">
                <div className={cn(
                  "flex h-20 w-20 items-center justify-center rounded-2xl transition-all duration-200",
                  isDragging ? "bg-primary/15 scale-110" : "bg-muted group-hover:bg-primary/10"
                )}>
                  {isDragging ? (
                    <Upload className="h-10 w-10 text-primary animate-bounce" />
                  ) : (
                    <ImageIcon className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
                  )}
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground mb-1">
                    {isDragging ? "ここにドロップ" : "画像・動画をドラッグ&ドロップ"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    またはクリックしてファイルを選択
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-2">
                    画像: JPEG・PNG・WebP・GIF ／ 動画: MP4・MOV・WebM ／ 最大100MB
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              {/* プレビュー */}
              <div className="relative bg-muted/30 flex items-center justify-center min-h-[280px] p-4">
                {isVideo ? (
                  <video
                    src={preview}
                    controls
                    className="max-h-[400px] max-w-full rounded-lg shadow-md"
                  />
                ) : (
                  <img
                    src={preview}
                    alt="プレビュー"
                    className="max-h-[400px] max-w-full object-contain rounded-lg shadow-md"
                  />
                )}
              </div>

              {/* ファイル情報 */}
              <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    {isVideo ? (
                      <Video className="h-4 w-4 text-primary" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{selectedFile?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedFile
                        ? selectedFile.size >= 1024 * 1024
                          ? (selectedFile.size / 1024 / 1024).toFixed(1) + " MB"
                          : (selectedFile.size / 1024).toFixed(1) + " KB"
                        : ""}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  disabled={isAnalyzing}
                  className="text-muted-foreground hover:text-foreground flex-shrink-0"
                >
                  変更
                </Button>
              </div>
            </div>
          )}

          {/* 解析ボタン */}
          {preview && (
            <div className="mt-4">
              {isAnalyzing ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>{analysisStep}</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full animate-pulse w-2/3" />
                  </div>
                  {isVideo && (
                    <p className="text-xs text-muted-foreground/70 text-center">
                      動画の場合、アップロードと解析に数分かかる場合があります。
                    </p>
                  )}
                </div>
              ) : (
                <Button
                  onClick={handleAnalyze}
                  size="lg"
                  className="w-full h-12 text-base font-semibold shadow-sm transition-transform duration-150 active:scale-[0.98]"
                >
                  <ShieldCheck className="h-5 w-5 mr-2" />
                  広告規制チェックを開始
                </Button>
              )}
            </div>
          )}
        </div>

        {/* 機能説明 */}
        <div className="mx-auto max-w-3xl mt-16">
          <h2 className="text-center text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-8">
            チェック対象の規制
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: AlertTriangle,
                color: "text-red-500",
                bg: "bg-red-50",
                title: "薬機法",
                desc: "医薬品・化粧品・健康食品の効能効果に関する誇大表現・未承認効果の標榜を検出",
              },
              {
                icon: Info,
                color: "text-amber-500",
                bg: "bg-amber-50",
                title: "景品表示法",
                desc: "優良誤認・有利誤認表示、根拠のない最上級表現・割引表示などを検出",
              },
              {
                icon: CheckCircle2,
                color: "text-blue-500",
                bg: "bg-blue-50",
                title: "医療広告ガイドライン",
                desc: "医療機関の比較広告・誇大広告・体験談使用・根拠のない専門性の標榜を検出",
              },
              {
                icon: Scale,
                color: "text-purple-500",
                bg: "bg-purple-50",
                title: "行政書士法・士業法",
                desc: "行政書士・弁護士・司法書士等の無資格業務標榜・非弁行為・業務範囲超過の広告を検出",
              },
            ].map(({ icon: Icon, color, bg, title, desc }) => (
              <div key={title} className="rounded-xl border border-border bg-card p-5 hover:shadow-sm transition-shadow duration-200">
                <div className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg mb-3", bg)}>
                  <Icon className={cn("h-4.5 w-4.5", color)} />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1.5">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      {/* ナレッジベース・精度情報セクション */}
      <section className="border-t border-border bg-muted/30 mt-0">
        <div className="mx-auto max-w-5xl px-4 py-16">

          {/* 精度・AIの仕組み */}
          <div className="mb-14">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Cpu className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-base font-semibold text-foreground">AIチェックの仕組みと精度について</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  icon: FlaskConical,
                  color: "text-indigo-600",
                  bg: "bg-indigo-50",
                  title: "OCRテキスト抽出",
                  body: "大規模言語モデル（LLM）のVision機能を使用し、画像・動画内のテキストを高精度で抽出します。日本語・英語混在の広告バナーに対応しています。",
                  note: "手書き・装飾フォント・極小文字は精度が下がる場合があります",
                },
                {
                  icon: ShieldCheck,
                  color: "text-emerald-600",
                  bg: "bg-emerald-50",
                  title: "規制チェック精度",
                  body: "各法令の主要な禁止表現・グレーゾーン表現をプロンプトに組み込み、AIが文脈を考慮して判定します。明らかな違反表現の検出精度は高い水準です。",
                  note: "文脈・業種・商品カテゴリによって判定が変わる場合があります",
                },
                {
                  icon: TriangleAlert,
                  color: "text-amber-600",
                  bg: "bg-amber-50",
                  title: "免責事項",
                  body: "本ツールはAIによる参考情報の提供を目的としており、法的アドバイスではありません。最終的な判断は必ず専門家（弁護士・薬事コンサルタント等）にご確認ください。",
                  note: "本ツールの利用により生じた損害について責任を負いかねます",
                },
              ].map(({ icon: Icon, color, bg, title, body, note }) => (
                <div key={title} className="rounded-xl border border-border bg-card p-5">
                  <div className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg mb-3", bg)}>
                    <Icon className={cn("h-4 w-4", color)} />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">{body}</p>
                  <p className="text-xs text-muted-foreground/70 leading-relaxed border-t border-border pt-2.5">
                    ⚠ {note}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 参照法令・ガイドライン一覧 */}
          <div>
            <div className="flex items-center gap-2.5 mb-6">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-base font-semibold text-foreground">参照している法令・ガイドライン</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  category: "薬機法",
                  categoryColor: "text-red-600",
                  categoryBg: "bg-red-50 border-red-100",
                  items: [
                    {
                      name: "医薬品、医療機器等の品質、有効性及び安全性の確保等に関する法律（薬機法）",
                      articles: "第66条（誇大広告等の禁止）、第68条（承認前の医薬品等の広告の禁止）",
                      url: "https://laws.e-gov.go.jp/law/335AC0000000145",
                      checks: ["効能効果の誇大表現", "未承認医薬品の効果標榜", "断定的表現・最大級表現", "副作用なし等の安全性断定"],
                    },
                    {
                      name: "薬機法における医薬品等の広告の適正化に関する通知（厚生労働省）",
                      articles: "令和元年9月25日薬生発0925第1号",
                      url: "https://www.mhlw.go.jp/content/000547597.pdf",
                      checks: ["体験談・ビフォーアフターの使用", "医師・専門家の推薦を装った表現"],
                    },
                  ],
                },
                {
                  category: "景品表示法",
                  categoryColor: "text-amber-600",
                  categoryBg: "bg-amber-50 border-amber-100",
                  items: [
                    {
                      name: "不当景品類及び不当表示防止法（景品表示法）",
                      articles: "第5条第1号（優良誤認表示の禁止）、第5条第2号（有利誤認表示の禁止）",
                      url: "https://laws.e-gov.go.jp/law/337AC0000000134",
                      checks: ["根拠のない最上級表現（No.1・日本一等）", "不当な価格表示・割引表示", "期間限定・数量限定の虚偽表示"],
                    },
                    {
                      name: "打消し表示に関する実態調査報告書（消費者庁）",
                      articles: "令和3年3月 消費者庁",
                      url: "https://www.caa.go.jp/policies/policy/representation/fair_labeling/pdf/fair_labeling_210330_0001.pdf",
                      checks: ["打消し表示の不備", "条件・例外の不明瞭な表示"],
                    },
                  ],
                },
                {
                  category: "医療広告ガイドライン",
                  categoryColor: "text-blue-600",
                  categoryBg: "bg-blue-50 border-blue-100",
                  items: [
                    {
                      name: "医業若しくは歯科医業又は病院若しくは診療所に関する広告等に関する指針",
                      articles: "（医療広告ガイドライン）平成30年5月 厚生労働省",
                      url: "https://www.mhlw.go.jp/file/06-Seisakujouhou-10800000-Iseikyoku/0000209841.pdf",
                      checks: ["比較広告・誇大広告", "患者体験談・ビフォーアフター写真", "根拠のない専門性・成功率の標榜", "虚偽の学会認定表示"],
                    },
                    {
                      name: "医療法（昭和23年法律第205号）",
                      articles: "第6条の5（広告の制限）",
                      url: "https://laws.e-gov.go.jp/law/323AC0000000205",
                      checks: ["医療機関の広告規制全般"],
                    },
                  ],
                },
                {
                  category: "行政書士法・士業法",
                  categoryColor: "text-purple-600",
                  categoryBg: "bg-purple-50 border-purple-100",
                  items: [
                    {
                      name: "行政書士法（昭和26年法律第4号）",
                      articles: "第1条の3（業務範囲）、第19条第1項（業務の制限・令和8年1月改正施行）",
                      url: "https://laws.e-gov.go.jp/law/326AC1000000004",
                      checks: ["無資格者による許認可申請代行の標榜", "官公署提出書類作成の無資格業務広告"],
                    },
                    {
                      name: "弁護士法（昭和24年法律第205号）",
                      articles: "第72条（非弁護士の法律事務の取扱い等の禁止）",
                      url: "https://laws.e-gov.go.jp/law/324AC0000000205",
                      checks: ["非弁行為（示談交渉・訴訟代理・法律相談の無資格業務）", "行政書士による非弁行為の広告"],
                    },
                    {
                      name: "司法書士法（昭和25年法律第197号）・税理士法（昭和26年法律第237号）",
                      articles: "司法書士法第73条、税理士法第52条",
                      url: "https://laws.e-gov.go.jp/law/325AC1000000197",
                      checks: ["無資格者による登記申請代理・税務申告代理の標榜"],
                    },
                  ],
                },
                {
                  category: "インフルエンサー広告ガイドライン",
                  categoryColor: "text-teal-600",
                  categoryBg: "bg-teal-50 border-teal-100",
                  items: [
                    {
                      name: "ステルスマーケティング規制（消費者庁告示）",
                      articles: "景品表示法 第5条第3号・令和5年10月施行",
                      url: "https://www.caa.go.jp/policies/policy/representation/fair_labeling/stealth_marketing/",
                      checks: ["#PRなしの案件投稿", "企業案件を口コミ・体験談に偽装した表現", "ハッシュタグでの広告表示の不備"],
                    },
                    {
                      name: "インフルエンサーマーケティングプラットフォーム ガイドライン（業界事例）",
                      articles: "健康食品・化粧品・金融・アルコール・ギャンブル等カテゴリ別規制",
                      url: "",
                      checks: [
                        "健康食品の疾病予防・治療効果の標榜",
                        "化粧品の56効能範囲外の効果表現",
                        "美容機器の医療的効果標榜（認証なし）",
                        "金融商品のリスク未開示・断定的利益表現",
                        "アルコール広告の未成年禁止表記の欠如",
                        "ギャンブルの高額当選・勝率の強調",
                        "人材紹介の許可番号未表示・求職者費用請求示唆",
                      ],
                    },
                  ],
                },
              ].map((group) => (
                <div key={group.category} className={cn("rounded-xl border p-5", group.categoryBg)}>
                  <span className={cn("text-xs font-semibold uppercase tracking-wider", group.categoryColor)}>
                    {group.category}
                  </span>
                  <div className="mt-3 space-y-4">
                    {group.items.map((item) => (
                      <div key={item.name}>
                        <div className="flex items-start gap-1.5 mb-1.5">
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-foreground hover:underline underline-offset-2 flex items-center gap-1 leading-snug"
                            >
                              {item.name}
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                            </a>
                          ) : (
                            <span className="text-xs font-medium text-foreground leading-snug">
                              {item.name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{item.articles}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {item.checks.map((check) => (
                            <span
                              key={check}
                              className="inline-block rounded-md bg-white/70 border border-border px-2 py-0.5 text-xs text-muted-foreground"
                            >
                              {check}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 注意書き */}
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 px-5 py-4">
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-semibold">【重要】</span>
                本ツールのAIチェックは、上記の法令・ガイドラインに基づいて学習・設計されたプロンプトによる参考判定です。
                法令の解釈は業種・商品カテゴリ・文脈によって異なり、AIが見落とす可能性もあります。
                広告の最終的な適法性判断は、必ず弁護士・薬事コンサルタント・行政書士等の専門家にご確認ください。
                また、法令は改正されることがあるため、常に最新の情報をご確認ください。
              </p>
            </div>
          </div>

        </div>
      </section>

      </main>
    </div>
  );
}
