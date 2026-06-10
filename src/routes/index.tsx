import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight, GraduationCap } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Revisão Ensino Jurídico — Plataforma de Simulados" },
      { name: "description", content: "Plataforma de simulados da Revisão Ensino Jurídico para concursos, OAB e certificações jurídicas." },
      { property: "og:title", content: "Revisão Ensino Jurídico — Plataforma de Simulados" },
      { property: "og:description", content: "Avaliações online com controle de tempo, anti-fraude e auditoria completa." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Decorative background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[32rem] w-[32rem] rounded-full bg-accent/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <svg
          className="absolute inset-x-0 top-1/4 w-full opacity-[0.06]"
          viewBox="0 0 1200 200"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M0,120 C300,40 600,200 900,80 C1050,30 1150,90 1200,60"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-primary"
          />
        </svg>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 h-20 border-b border-border/40 backdrop-blur-xl bg-background/55">
        <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 animate-soft-pop">
            <LogoMark className="h-10 w-10" />
            <div className="leading-tight">
              <span className="block font-bold text-primary tracking-tight">Revisão</span>
              <span className="block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Ensino Jurídico</span>
            </div>
          </div>
          <Link
            to="/auth"
            className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-soft transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-glow active:translate-y-0 active:scale-[0.98]"
          >
            Acesso administrativo
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-start justify-center px-6">
        <section className="w-full max-w-3xl text-center pt-16 md:pt-24 lg:pt-28 pb-16">
          {/* Selo */}
          <span
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-accent/40 to-accent/25 text-accent-foreground text-xs font-semibold border border-accent/40 shadow-soft"
            style={{ animation: "page-fade 500ms cubic-bezier(0.22,1,0.36,1) both" }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Plataforma de Simulados
          </span>

          {/* Título */}
          <h1
            className="mt-7 text-5xl md:text-6xl lg:text-7xl font-extrabold text-primary leading-[1.04] tracking-tight"
            style={{ animation: "page-fade 600ms cubic-bezier(0.22,1,0.36,1) 80ms both" }}
          >
            Revisão Ensino Jurídico
          </h1>

          {/* Descrição */}
          <p
            className="mt-6 mx-auto text-lg md:text-xl text-muted-foreground leading-relaxed max-w-[780px]"
            style={{ animation: "page-fade 600ms cubic-bezier(0.22,1,0.36,1) 160ms both" }}
          >
            Avaliações com controle de tempo, recuperação de sessão, anti-fraude e
            auditoria completa — projetada para milhares de estudantes simultâneos.
          </p>

          {/* Botões */}
          <div
            className="mt-10 flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-4"
            style={{ animation: "page-fade 600ms cubic-bezier(0.22,1,0.36,1) 240ms both" }}
          >
            <Link
              to="/auth"
              className="group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-[color-mix(in_oklab,var(--primary)_75%,var(--secondary))] px-8 text-sm font-semibold text-primary-foreground shadow-elevated transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-glow active:translate-y-0 active:scale-[0.98]"
            >
              Entrar como administrador
              <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-in-out group-hover:translate-x-1" />
            </Link>
            <Link
              to="/auth"
              className="group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-secondary to-[color-mix(in_oklab,var(--secondary)_70%,var(--accent))] px-8 text-sm font-semibold text-secondary-foreground shadow-soft transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-elevated active:translate-y-0 active:scale-[0.98]"
            >
              <GraduationCap className="h-4 w-4" />
              Sou estudante (em teste)
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
