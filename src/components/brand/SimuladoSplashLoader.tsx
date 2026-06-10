import { useEffect, useState } from "react";
import simboloAsset from "@/assets/simbolo-r.png.asset.json";

/**
 * Tela de carregamento premium do simulado.
 * - Fundo creme/gradiente da plataforma
 * - Símbolo "R" da Revisão dentro de um quadrado com bordas arredondadas (com pulse)
 * - Barra de progresso roxa + percentual em tempo real
 * - Fade-in na entrada, fade-out apenas depois que a barra atinge 100%
 *
 * Sincronização:
 *  - Enquanto `ready` for false, a barra avança suavemente até ~92%.
 *  - Quando `ready` vira true, acelera até 100% e SÓ ENTÃO dispara `onComplete`
 *    (e o fade-out), garantindo que a próxima tela só apareça quando o
 *    carregamento estiver visualmente concluído.
 */
export function SimuladoSplashLoader({
  ready = false,
  onComplete,
  label = "Preparando seu simulado...",
  sublabel = "Aguarde alguns instantes",
}: {
  ready?: boolean;
  onComplete?: () => void;
  label?: string;
  sublabel?: string;
}) {
  const [progress, setProgress] = useState(6);
  const [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Progresso simulado: avança suavemente em direção a um teto (~92%)
  // enquanto os dados reais carregam. Quando `ready` vira true, completa
  // até 100%.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setProgress((p) => {
        if (ready) {
          if (p >= 100) return 100;
          // Acelera até 100 em ~350ms
          const step = Math.max(35 * dt, (100 - p) * dt * 6);
          return Math.min(100, p + step);
        }
        if (p >= 92) return p;
        const gap = 92 - p;
        const step = Math.max(0.4, gap * dt * 0.7);
        return Math.min(92, p + step);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  // Quando o progresso atinge 100%, dispara onComplete + fade-out.
  useEffect(() => {
    if (progress < 100) return;
    onComplete?.();
    const t1 = window.setTimeout(() => setLeaving(true), 220);
    const t2 = window.setTimeout(() => setHidden(true), 700);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [progress, onComplete]);

  if (hidden) return null;

  const pct = Math.round(progress);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={[
        "fixed inset-0 z-[60] w-screen h-screen",
        "flex items-center justify-center",
        "bg-background",
        "transition-opacity duration-500 ease-out",
        leaving ? "opacity-0 pointer-events-none" : "opacity-100",
      ].join(" ")}
      style={{
        backgroundImage:
          "radial-gradient(1200px 600px at 50% -10%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 60%), radial-gradient(800px 500px at 50% 110%, color-mix(in oklab, var(--accent) 14%, transparent), transparent 60%)",
      }}
    >
      <div
        className="flex flex-col items-center px-6"
        style={{ animation: "splash-fade-in 480ms cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {/* Símbolo "R" — quadrado com bordas arredondadas */}
        <div
          className="relative mb-10 sm:mb-12"
          style={{ animation: "splash-pulse 2.6s ease-in-out infinite" }}
        >
          <div
            aria-hidden
            className="absolute inset-0 rounded-[28%] blur-2xl opacity-60"
            style={{
              background:
                "radial-gradient(closest-side, color-mix(in oklab, var(--primary) 55%, transparent), transparent 70%)",
            }}
          />
          <div
            className="relative flex items-center justify-center text-primary-foreground shadow-2xl ring-1 ring-white/10"
            style={{
              width: "clamp(88px, 12vw, 124px)",
              height: "clamp(88px, 12vw, 124px)",
              borderRadius: "26%",
              background:
                "linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary) 75%, white))",
            }}
          >
            <img
              src={simboloAsset.url}
              alt="Revisão Ensino Jurídico"
              draggable={false}
              className="select-none"
              style={{
                width: "62%",
                height: "62%",
                objectFit: "contain",
                filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.15))",
              }}
            />
          </div>
        </div>

        {/* Texto */}
        <h2
          className="text-primary font-medium tracking-tight"
          style={{ fontSize: "clamp(1.05rem, 1.6vw, 1.25rem)", fontWeight: 500 }}
        >
          {label}
        </h2>
        <p
          className="mt-1 text-muted-foreground"
          style={{ fontSize: "clamp(0.85rem, 1.1vw, 0.95rem)" }}
        >
          {sublabel}
        </p>

        {/* Barra de progresso */}
        <div className="mt-8 w-[90vw] sm:w-[400px] md:w-[440px] lg:w-[460px] max-w-[500px]">
          <div
            className="relative h-2.5 sm:h-3 w-full overflow-hidden rounded-full bg-muted/70 ring-1 ring-border/60"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${pct}%`,
                background:
                  "linear-gradient(90deg, var(--primary), color-mix(in oklab, var(--primary) 55%, white))",
                boxShadow:
                  "0 0 18px color-mix(in oklab, var(--primary) 45%, transparent)",
                transition: "width 220ms cubic-bezier(0.22,1,0.36,1)",
              }}
            />
            <div
              aria-hidden
              className="absolute inset-y-0 left-0 w-1/3 rounded-full opacity-40"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
                animation: "splash-shimmer 1.6s linear infinite",
              }}
            />
          </div>
          <div
            className="mt-3 text-center text-primary"
            style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
          >
            {pct}%
          </div>
        </div>
      </div>

      <style>{`
        @keyframes splash-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splash-pulse {
          0%, 100% { transform: scale(1);    filter: brightness(1); }
          50%      { transform: scale(1.05); filter: brightness(1.06); }
        }
        @keyframes splash-shimmer {
          from { transform: translateX(-100%); }
          to   { transform: translateX(400%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [role="status"] * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}
