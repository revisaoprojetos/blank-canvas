import { useEffect, useState } from "react";
import { LogoFull } from "./Logo";

/**
 * Splash inicial do sistema — logo + barra de progresso animada
 * com a paleta institucional (roxo + dourado).
 */
export function SplashScreen({ onDone }: { onDone?: () => void }) {
  const [progress, setProgress] = useState(8);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          window.clearInterval(id);
          window.setTimeout(() => setLeaving(true), 180);
          window.setTimeout(() => onDone?.(), 520);
          return 100;
        }
        // easing-like increment
        const remaining = 100 - p;
        return Math.min(100, p + Math.max(2, remaining * 0.12));
      });
    }, 90);
    return () => window.clearInterval(id);
  }, [onDone]);

  return (
    <div
      className={
        "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-primary text-primary-foreground transition-opacity duration-500 " +
        (leaving ? "opacity-0 pointer-events-none" : "opacity-100")
      }
      aria-hidden={leaving}
    >
      <div className="flex flex-col items-center gap-8">
        <div className="animate-soft-pop">
          <LogoFull className="h-32 w-32 shadow-modal" />
        </div>
        <div className="w-64">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-accent shadow-glow transition-[width] duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs opacity-80">
            <span>Carregando plataforma</span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
