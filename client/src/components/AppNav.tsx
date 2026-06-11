import { Link, useLocation } from "wouter";
import { ShieldCheck, History, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AppNav() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "チェック", icon: Home },
    { href: "/history", label: "履歴", icon: History },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-sm no-print">
      <div className="container flex h-16 items-center justify-between">
        {/* ロゴ */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-sm transition-transform duration-150 group-hover:scale-105">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-tight text-foreground">広告規制チェッカー</span>
            <span className="text-[10px] text-muted-foreground tracking-wider">AD COMPLIANCE AI</span>
          </div>
        </Link>

        {/* ナビゲーション */}
        <nav className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
                location === href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
