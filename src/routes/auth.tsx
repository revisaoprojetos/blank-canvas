import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { LogoFull } from "@/components/brand/Logo";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acesso Administrativo — Plataforma de Simulados" },
      { name: "description", content: "Login de administradores da plataforma." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Login realizado");
    navigate({ to: "/admin", replace: true });
  }


  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* decorative blurs */}
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-secondary/30 blur-3xl animate-float-slow" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/30 blur-3xl animate-float-slow" />
      <Toaster />
      <Card className="w-full max-w-md border-secondary/20 shadow-modal backdrop-blur-sm bg-card/90 animate-soft-pop relative">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 animate-soft-pop">
            <LogoFull className="h-20 w-20 shadow-elevated" />
          </div>
          <CardTitle className="text-2xl text-primary animate-page-enter" style={{ animationDelay: "60ms" }}>
            Painel Administrativo
          </CardTitle>
          <CardDescription className="animate-page-enter" style={{ animationDelay: "120ms" }}>
            Plataforma de Simulados Online
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2 animate-page-enter" style={{ animationDelay: "180ms" }}>
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2 animate-page-enter" style={{ animationDelay: "240ms" }}>
              <Label htmlFor="login-password">Senha</Label>
              <Input id="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full animate-page-enter" style={{ animationDelay: "300ms" }} disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
            <p className="text-xs text-muted-foreground text-center animate-page-enter" style={{ animationDelay: "360ms" }}>
              O cadastro público está desativado. Solicite acesso ao administrador da plataforma.
            </p>
          </form>

          <div className="mt-6 text-center text-sm animate-page-enter" style={{ animationDelay: "420ms" }}>
            <Link to="/" className="text-secondary hover:underline story-link">← Voltar ao início</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
