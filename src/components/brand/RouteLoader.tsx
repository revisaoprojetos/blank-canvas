import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

/**
 * Indicador global de carregamento entre páginas.
 * Pílula compacta no topo: spinner + "Carregando...".
 * Só aparece se a transição demorar mais que `delayMs` para evitar piscadas.
 */
export function RouteLoader({ delayMs = 140 }: { delayMs?: number }) {
  const isLoading = useRouterState({ select: (s) => s.isLoading || s.isTransitioning });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setVisible(false);
      return;
    }
    const t = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(t);
  }, [isLoading, delayMs]);

  return (
    <div
      className={
        "pointer-events-none fixed left-1/2 top-5 z-[90] -translate-x-1/2 transition-all duration-300 ease-in-out " +
        (visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3")
      }
      aria-hidden={!visible}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card/85 px-3.5 py-1.5 shadow-modal backdrop-blur-md">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
        <span className="text-xs font-medium text-muted-foreground tracking-wide">
          Carregando...
        </span>
      </div>
    </div>
  );
}
