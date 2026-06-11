import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import AppNav from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Trash2,
  ExternalLink,
  History,
  Loader2,
  ImageIcon,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

type OverallRisk = "high" | "medium" | "low" | "safe";

const RISK_CONFIG: Record<OverallRisk, {
  label: string; icon: typeof ShieldCheck;
  iconColor: string; bg: string; border: string; badgeClass: string;
}> = {
  safe: { label: "問題なし", icon: ShieldCheck, iconColor: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  low: { label: "低リスク", icon: ShieldCheck, iconColor: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", badgeClass: "bg-blue-100 text-blue-700 border-blue-200" },
  medium: { label: "中リスク", icon: ShieldAlert, iconColor: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", badgeClass: "bg-amber-100 text-amber-700 border-amber-200" },
  high: { label: "高リスク", icon: ShieldX, iconColor: "text-red-600", bg: "bg-red-50", border: "border-red-200", badgeClass: "bg-red-100 text-red-700 border-red-200" },
};

export default function HistoryPage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: history, isLoading } = trpc.compliance.getHistory.useQuery({});

  const deleteMutation = trpc.compliance.deleteCheck.useMutation({
    onSuccess: () => {
      utils.compliance.getHistory.invalidate();
      toast.success("削除しました");
    },
    onError: () => {
      toast.error("削除に失敗しました");
    },
  });

  const handleDelete = (checkId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("このチェック結果を削除しますか？")) {
      deleteMutation.mutate({ checkId });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppNav />

      <main className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <History className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">チェック履歴</h1>
              <p className="text-xs text-muted-foreground">過去の広告規制チェック結果</p>
            </div>
          </div>
          <Button
            onClick={() => navigate("/")}
            size="sm"
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            新しいチェック
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          </div>
        ) : !history || history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <History className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground mb-1">チェック履歴がありません</p>
              <p className="text-sm text-muted-foreground">広告バナーをアップロードしてチェックを開始してください。</p>
            </div>
            <Button onClick={() => navigate("/")} className="mt-2">
              <Plus className="h-4 w-4 mr-1.5" />
              最初のチェックを開始
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {history.map(check => {
              const riskConfig = RISK_CONFIG[check.overallRisk as OverallRisk] ?? RISK_CONFIG.safe;
              const RiskIcon = riskConfig.icon;
              return (
                <div
                  key={check.id}
                  onClick={() => navigate(`/result/${check.id}`)}
                  className="group relative rounded-xl border border-border bg-card overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/30"
                >
                  {/* 画像サムネイル */}
                  <div className="relative bg-muted/30 flex items-center justify-center h-40 overflow-hidden">
                    <img
                      src={check.imageUrl}
                      alt={check.fileName ?? "広告画像"}
                      className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                      onError={e => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    {/* リスクバッジ（オーバーレイ） */}
                    <div className="absolute top-2 right-2">
                      <span className={cn(
                        "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border backdrop-blur-sm",
                        riskConfig.badgeClass
                      )}>
                        <RiskIcon className="h-3 w-3" />
                        {riskConfig.label}
                      </span>
                    </div>
                  </div>

                  {/* 情報 */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {check.fileName ?? `チェック #${check.id}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(check.createdAt), "yyyy年M月d日 HH:mm", { locale: ja })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                          onClick={e => {
                            e.stopPropagation();
                            navigate(`/result/${check.id}`);
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                          onClick={e => handleDelete(check.id, e)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* 違反件数 */}
                    <div className="flex items-center gap-2">
                      {check.totalViolations > 0 ? (
                        <Badge variant="secondary" className="text-xs">
                          {check.totalViolations}件の違反
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs text-emerald-600 bg-emerald-50 border-emerald-200">
                          違反なし
                        </Badge>
                      )}
                    </div>

                    {/* サマリー */}
                    {check.summary && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                        {check.summary}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
