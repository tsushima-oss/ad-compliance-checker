import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import AppNav from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp,
  FileText,
  Lightbulb,
  Scale,
  ImageIcon,
  Loader2,
  Video,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type RiskLevel = "high" | "medium" | "low";
type Category = "yakujiho" | "keihyo" | "iryokokoku" | "gyoseishoshi" | "other";
type OverallRisk = "high" | "medium" | "low" | "safe";

const CATEGORY_LABELS: Record<Category, { label: string; color: string; bg: string; icon: typeof AlertTriangle }> = {
  yakujiho: { label: "薬機法", color: "text-red-600", bg: "bg-red-50 border-red-200", icon: ShieldX },
  keihyo: { label: "景品表示法", color: "text-amber-600", bg: "bg-amber-50 border-amber-200", icon: AlertTriangle },
  iryokokoku: { label: "医療広告GL", color: "text-blue-600", bg: "bg-blue-50 border-blue-200", icon: Info },
  gyoseishoshi: { label: "行政書士法・士業法", color: "text-purple-600", bg: "bg-purple-50 border-purple-200", icon: Scale },
  other: { label: "その他", color: "text-slate-600", bg: "bg-slate-50 border-slate-200", icon: ShieldAlert },
};

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; border: string; dot: string }> = {
  high: { label: "高リスク", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500" },
  medium: { label: "中リスク", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500" },
  low: { label: "低リスク", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
};

const OVERALL_RISK_CONFIG: Record<OverallRisk, {
  label: string; sublabel: string; icon: typeof ShieldCheck;
  iconColor: string; bgGradient: string; border: string; cssClass: string;
}> = {
  safe: {
    label: "問題なし", sublabel: "規制違反の可能性は検出されませんでした",
    icon: ShieldCheck, iconColor: "text-emerald-600",
    bgGradient: "from-emerald-50 to-teal-50", border: "border-emerald-200", cssClass: "risk-safe",
  },
  low: {
    label: "低リスク", sublabel: "軽微な懸念が検出されました",
    icon: ShieldCheck, iconColor: "text-blue-600",
    bgGradient: "from-blue-50 to-indigo-50", border: "border-blue-200", cssClass: "risk-low",
  },
  medium: {
    label: "中リスク", sublabel: "注意が必要な表現が検出されました",
    icon: ShieldAlert, iconColor: "text-amber-600",
    bgGradient: "from-amber-50 to-yellow-50", border: "border-amber-200", cssClass: "risk-medium",
  },
  high: {
    label: "高リスク", sublabel: "法令違反の可能性がある表現が検出されました",
    icon: ShieldX, iconColor: "text-red-600",
    bgGradient: "from-red-50 to-rose-50", border: "border-red-200", cssClass: "risk-high",
  },
};

function ViolationCard({ item }: { item: any }) {
  const [expanded, setExpanded] = useState(true);
  const cat = CATEGORY_LABELS[item.category as Category] ?? CATEGORY_LABELS.other;
  const risk = RISK_CONFIG[item.riskLevel as RiskLevel] ?? RISK_CONFIG.low;
  const CatIcon = cat.icon;

  return (
    <div data-violation-card className={cn("rounded-xl border bg-card overflow-hidden transition-shadow duration-200 hover:shadow-sm", risk.border)}>
      {/* ヘッダー */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/30 transition-colors duration-150"
      >
        <div className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg mt-0.5", cat.bg)}>
          <CatIcon className={cn("h-4 w-4", cat.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", cat.bg, cat.color)}>
              {cat.label}
            </span>
            <span className={cn("flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border", risk.bg, risk.color, risk.border)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", risk.dot)} />
              {risk.label}
            </span>
          </div>
          {item.violationText && (
            <p className="text-sm font-medium text-foreground line-clamp-2">
              「{item.violationText}」
            </p>
          )}
        </div>
        <div className="flex-shrink-0 text-muted-foreground mt-1">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* 詳細 */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50">
          <div className="pt-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              <AlertTriangle className="h-3 w-3" />
              NG理由
            </div>
            <p className="text-sm text-foreground leading-relaxed">{item.reason}</p>
          </div>

          {item.legalBasis && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                <Scale className="h-3 w-3" />
                根拠法令
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 leading-relaxed">{item.legalBasis}</p>
            </div>
          )}

          {item.suggestion && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1.5">
                <Lightbulb className="h-3 w-3" />
                改善提案
              </div>
              <p className="text-sm text-emerald-800 leading-relaxed">{item.suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResultPage() {
  const params = useParams<{ checkId: string }>();
  const [, navigate] = useLocation();
  const checkId = parseInt(params.checkId ?? "0", 10);

  const { data, isLoading, error } = trpc.compliance.getResult.useQuery(
    { checkId },
    { enabled: !!checkId }
  );

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppNav />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">結果を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <AppNav />
        <div className="container py-12 text-center">
          <p className="text-muted-foreground">結果が見つかりませんでした。</p>
          <Button variant="outline" onClick={() => navigate("/")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            ホームに戻る
          </Button>
        </div>
      </div>
    );
  }

  const { check, items } = data ?? { check: null, items: [] };
  const overallConfig = OVERALL_RISK_CONFIG[(check?.overallRisk ?? "safe") as OverallRisk] ?? OVERALL_RISK_CONFIG.safe;
  const OverallIcon = overallConfig.icon;

  // NGカードを html2canvas でキャプチャして jsPDF にまとめる
  const handlePrintPdf = async () => {
    const violationCards = document.querySelectorAll<HTMLElement>("[data-violation-card]");
    if (violationCards.length === 0) {
      toast.info("NG項目がないためPDFレポートはありません。");
      return;
    }

    setIsGeneratingPdf(true);
    toast.info("PDFを生成中...");

    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentW = pageW - margin * 2;
      let yPos = margin;
      let isFirstPage = true;

      // ヘッダー（ASCII テキスト）
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Ad Compliance Report  #${checkId}`, margin, yPos);
      yPos += 6;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        `Overall Risk: ${overallConfig.label}  |  Violations: ${violationCards.length}`,
        margin,
        yPos
      );
      yPos += 8;

      for (const card of Array.from(violationCards)) {
        const canvas = await html2canvas(card, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        const ratio = canvas.height / canvas.width;
        const imgH = contentW * ratio;

        if (!isFirstPage && yPos + imgH > pageH - margin) {
          pdf.addPage();
          yPos = margin;
        }
        isFirstPage = false;

        if (yPos + imgH > pageH - margin) {
          pdf.addPage();
          yPos = margin;
        }

        pdf.addImage(imgData, "JPEG", margin, yPos, contentW, imgH);
        yPos += imgH + 4;
      }

      pdf.save(`ad-compliance-report-${checkId}.pdf`);
      toast.success("PDFを保存しました");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "不明なエラー";
      toast.error("PDF生成に失敗しました", { description: message });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // カテゴリ別に分類
  const byCategory = items.reduce<Record<string, typeof items>>((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // リスク別カウント
  const highCount = items.filter(i => i.riskLevel === "high").length;
  const mediumCount = items.filter(i => i.riskLevel === "medium").length;
  const lowCount = items.filter(i => i.riskLevel === "low").length;

  return (
    <div className="min-h-screen bg-background">
      <AppNav />

      <main className="container py-8">
        {/* 戻るボタン + PDFダウンロードボタン */}
        <div className="flex items-center justify-between mb-6 no-print">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            新しいチェック
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintPdf}
            disabled={isGeneratingPdf}
            className="gap-2 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
          >
            {isGeneratingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            {isGeneratingPdf ? "生成中..." : "PDFレポートをDL"}
          </Button>
        </div>


        {/* スクリーニング注意書き */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-6 no-print">
          <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-semibold">このチェック結果はAIによる一次スクリーニングです。</span>
            「確認すべき箇所の候補」として活用し、最終的な適法性の判断は弁護士・薬事コンサルタント等の専門家にご確認ください。
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左カラム：画像・総合評価 */}
          <div className="lg:col-span-1 space-y-4">
            {/* ファイルプレビュー */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="bg-muted/30 flex items-center justify-center min-h-[200px] p-4">
                {check.imageMimeType?.startsWith("video/") ? (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Video className="h-16 w-16 opacity-40" />
                    <span className="text-xs">{check.fileName ?? "動画ファイル"}</span>
                  </div>
                ) : (
                  <img
                    src={check.imageUrl}
                    alt="チェック対象"
                    className="max-h-[300px] max-w-full object-contain rounded-lg"
                    onError={e => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
              </div>
              {check.fileName && (
                <div className="px-4 py-3 border-t border-border flex items-center gap-2">
                  {check.imageMimeType?.startsWith("video/") ? (
                    <Video className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="text-xs text-muted-foreground truncate">{check.fileName}</span>
                </div>
              )}
            </div>

            {/* 総合リスク評価 */}
            <div className={cn(
              "rounded-xl border p-5 bg-gradient-to-br",
              overallConfig.bgGradient,
              overallConfig.border,
              overallConfig.cssClass
            )}>
              <div className="flex items-center gap-3 mb-3">
                <OverallIcon className={cn("h-7 w-7", overallConfig.iconColor)} />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">総合リスク評価</p>
                  <p className={cn("text-xl font-bold", overallConfig.iconColor)}>{overallConfig.label}</p>
                </div>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{overallConfig.sublabel}</p>
            </div>

            {/* リスク内訳 */}
            {items.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">違反件数内訳</p>
                <div className="space-y-2">
                  {[
                    { label: "高リスク", count: highCount, color: "bg-red-500", textColor: "text-red-700" },
                    { label: "中リスク", count: mediumCount, color: "bg-amber-500", textColor: "text-amber-700" },
                    { label: "低リスク", count: lowCount, color: "bg-emerald-500", textColor: "text-emerald-700" },
                  ].map(({ label, count, color, textColor }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full flex-shrink-0", color)} />
                      <span className="text-xs text-muted-foreground flex-1">{label}</span>
                      <span className={cn("text-sm font-bold tabular-nums", textColor)}>{count}件</span>
                    </div>
                  ))}
                  <Separator className="my-1" />
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-400 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground flex-1">合計</span>
                    <span className="text-sm font-bold tabular-nums text-foreground">{items.length}件</span>
                  </div>
                </div>
              </div>
            )}

            {/* 抽出テキスト */}
            {check.extractedText && check.extractedText !== "テキストなし" && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  <FileText className="h-3 w-3" />
                  OCR抽出テキスト
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {check.extractedText}
                </p>
              </div>
            )}
          </div>

          {/* 右カラム：チェック結果 */}
          <div className="lg:col-span-2 space-y-6">
            {/* サマリー */}
            {check.summary && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground mb-2">審査サマリー</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{check.summary}</p>
              </div>
            )}

            {/* 違反なし */}
            {items.length === 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-emerald-800 mb-1">違反は検出されませんでした</h3>
                <p className="text-sm text-emerald-700/80">
                  チェック対象の広告テキストに、薬機法・景品表示法・医療広告ガイドラインへの違反は見つかりませんでした。
                </p>
              </div>
            )}

            {/* カテゴリ別違反一覧 */}
            {Object.entries(byCategory).map(([category, catItems]) => {
              const catConfig = CATEGORY_LABELS[category as Category] ?? CATEGORY_LABELS.other;
              const CatIcon = catConfig.icon;
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", catConfig.bg)}>
                      <CatIcon className={cn("h-3.5 w-3.5", catConfig.color)} />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">{catConfig.label}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {catItems.length}件
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {catItems.map(item => (
                      <ViolationCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
