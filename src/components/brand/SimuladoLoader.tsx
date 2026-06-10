import { useEffect, useState } from "react";
import { LogoFull } from "./Logo";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loader dedicado ao carregamento de simulados.
 */
export function SimuladoLoader({ label = "Preparando Simulado..." }: { label?: string }) {
  const [progress, setProgress] = useState(10);
  useEffect(() => {
    const id = window.setInterval(() => {
      setProgress((p) => (p >= 92 ? p : Math.min(92, p + Math.max(1.5, (100 - p) * 0.08))));
    }, 140);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 px-6 py-10">
      <div className="flex flex-col items-center gap-5 animate-soft-pop">
        <LogoFull className="h-24 w-24 shadow-elevated" />
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="w-64">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent shadow-glow transition-[width] duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid w-full max-w-2xl gap-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
