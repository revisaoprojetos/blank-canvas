import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, BookOpen, Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Markdown } from "@/components/ui/markdown";
import { Toaster } from "@/components/ui/sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { SimuladoSplashLoader } from "@/components/brand/SimuladoSplashLoader";

import { formatBrasilia } from "@/lib/datetime";
import { getSimuladoPublico, iniciarSessaoPublica } from "@/lib/simulados-publico.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/simulado/$token/")({
  head: () => ({
    meta: [
      { title: "Acessar simulado" },
      { name: "description", content: "Página de acesso ao simulado." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AcessoSimulado,
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle size={20} /> Erro ao carregar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </CardContent>
      </Card>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <p className="text-muted-foreground">Simulado não encontrado.</p>
    </div>
  ),
});

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  agendado: { label: "Agendado", className: "bg-secondary text-secondary-foreground" },
  em_andamento: { label: "Em andamento", className: "bg-accent text-accent-foreground" },
  encerrado: { label: "Encerrado", className: "bg-muted text-muted-foreground" },
};

function AcessoSimulado() {
  const { token } = Route.useParams();
  const fetchSimulado = useServerFn(getSimuladoPublico);
  const iniciar = useServerFn(iniciarSessaoPublica);

  const { data, isLoading } = useQuery({
    queryKey: ["simulado_publico", token],
    queryFn: () => fetchSimulado({ data: { token } }),
  });

  const [form, setForm] = useState({ email: "", nome: "", cpf: "", telefone: "" });
  const [splashDone, setSplashDone] = useState(false);

  function cpfValido(cpf: string): boolean {
    const c = cpf.replace(/\D/g, "");
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    const calc = (base: string, fator: number) => {
      let soma = 0;
      for (let i = 0; i < base.length; i++) soma += parseInt(base[i], 10) * (fator - i);
      const r = (soma * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return (
      calc(c.slice(0, 9), 10) === parseInt(c[9], 10) &&
      calc(c.slice(0, 10), 11) === parseInt(c[10], 10)
    );
  }

  function formatCpf(v: string): string {
    const d = v.replace(/\D/g, "").slice(0, 11);
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function formatTelefone(v: string): string {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 10) {
      return d.replace(/(\d{2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
        [a && `(${a})`, b && ` ${b}`, c && `-${c}`].filter(Boolean).join(""),
      );
    }
    return d.replace(/(\d{2})(\d{5})(\d{0,4}).*/, (_, a, b, c) =>
      [`(${a})`, ` ${b}`, c && `-${c}`].filter(Boolean).join(""),
    );
  }

  const mut = useMutation({
    mutationFn: async () => iniciar({ data: { token, ...form } }),
    onSuccess: (r) => {
      const sessaoId = (r as { sessao_id?: string })?.sessao_id;
      if (!sessaoId) {
        toast.error("Resposta inesperada do servidor ao iniciar a sessão.");
        return;
      }
      toast.success("Sessão iniciada! Redirecionando para a prova...");
      window.location.assign(`/simulado/${token}/sessao/${sessaoId}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !splashDone) {
    return (
      <SimuladoSplashLoader
        ready={!isLoading}
        onComplete={() => setSplashDone(true)}
      />
    );
  }



  if (!data?.found) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Simulado indisponível</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {data?.motivo ?? "O link informado não corresponde a um simulado disponível."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = data.simulado as typeof data.simulado & {
    solicitar_nome?: boolean;
    solicitar_cpf?: boolean;
    solicitar_telefone?: boolean;
    permitir_atraso_entrada?: boolean;
    tempo_maximo_atraso_minutos?: number;
  };
  const status = STATUS_LABELS[s.status] ?? { label: s.status, className: "bg-muted" };
  const serverNowMs = data.server_now ? new Date(data.server_now).getTime() : Date.now();
  const tempoEsgotado = !!s.data_fim && new Date(s.data_fim).getTime() <= serverNowMs;
  const inicioMs = s.data_inicio ? new Date(s.data_inicio).getTime() : 0;
  const permitirAtraso = s.permitir_atraso_entrada !== false;
  const tempoMaxAtrasoMin = Number(s.tempo_maximo_atraso_minutos ?? 30);
  const limiteEntradaMs = inicioMs
    ? inicioMs + (permitirAtraso ? tempoMaxAtrasoMin * 60_000 : 0)
    : 0;
  const atrasoBloqueado =
    inicioMs > 0 && limiteEntradaMs > 0 && serverNowMs > limiteEntradaMs;
  const podeIniciar = s.status === "em_andamento" && !tempoEsgotado && !atrasoBloqueado;
  const askNome = s.solicitar_nome !== false;
  const askCpf = s.solicitar_cpf !== false;
  const askTelefone = !!s.solicitar_telefone;

  return (
    <div className="min-h-screen bg-background p-6">
      <Toaster />
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <Badge className={status.className}>{status.label}</Badge>
            <ThemeToggle />
          </div>
          <h1 className="text-3xl font-bold text-primary">{s.titulo}</h1>
          {s.descricao && <p className="text-muted-foreground">{s.descricao}</p>}
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen size={18} /> Informações da prova
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-muted-foreground" />
              <span>Duração: <strong>{s.duracao_minutos} minutos</strong></span>
            </div>
            {s.data_inicio && (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-muted-foreground" />
                <span>Início: {formatBrasilia(s.data_inicio, "dd/MM/yyyy 'às' HH:mm")}</span>
              </div>
            )}
            {s.data_fim && (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-muted-foreground" />
                <span>Encerramento: {formatBrasilia(s.data_fim, "dd/MM/yyyy 'às' HH:mm")}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {s.instrucoes && (
          <Card>
            <CardHeader><CardTitle className="text-base">Instruções</CardTitle></CardHeader>
            <CardContent><Markdown>{s.instrucoes}</Markdown></CardContent>
          </Card>
        )}

        {podeIniciar ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identifique-se para iniciar</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (askCpf && !cpfValido(form.cpf)) {
                    toast.error("CPF inválido. Verifique os dígitos informados.");
                    return;
                  }
                  if (askTelefone && form.telefone.replace(/\D/g, "").length < 10) {
                    toast.error("Telefone inválido. Informe DDD + número.");
                    return;
                  }
                  mut.mutate();
                }}
              >
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="email">E-mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      maxLength={255}
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  {askNome && (
                    <div className="space-y-1">
                      <Label htmlFor="nome">Nome completo *</Label>
                      <Input
                        id="nome"
                        required
                        minLength={2}
                        maxLength={120}
                        value={form.nome}
                        onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                      />
                    </div>
                  )}
                  {askCpf && (
                    <div className="space-y-1">
                      <Label htmlFor="cpf">CPF *</Label>
                      <Input
                        id="cpf"
                        required
                        inputMode="numeric"
                        minLength={14}
                        maxLength={14}
                        placeholder="000.000.000-00"
                        value={form.cpf}
                        onChange={(e) => setForm((f) => ({ ...f, cpf: formatCpf(e.target.value) }))}
                      />
                    </div>
                  )}
                  {askTelefone && (
                    <div className="space-y-1">
                      <Label htmlFor="telefone">Telefone *</Label>
                      <Input
                        id="telefone"
                        required
                        inputMode="tel"
                        minLength={14}
                        maxLength={16}
                        placeholder="(65) 99999-9999"
                        value={form.telefone}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, telefone: formatTelefone(e.target.value) }))
                        }
                      />
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={mut.isPending}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {mut.isPending ? "Iniciando..." : "Iniciar simulado"}
                </Button>
              </form>

            </CardContent>
          </Card>
        ) : atrasoBloqueado ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-destructive">Prazo de Entrada Encerrado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                O período permitido para ingresso neste simulado já foi encerrado conforme as regras de aplicação definidas pela instituição.
              </p>
              {s.data_inicio && (
                <p>
                  Horário de início: <strong>{formatBrasilia(s.data_inicio, "HH:mm")}</strong>
                </p>
              )}
              {permitirAtraso && (
                <p>
                  Tempo máximo de atraso: <strong>{tempoMaxAtrasoMin} minutos</strong>
                </p>
              )}
              <div className="rounded-md border border-border bg-muted/40 p-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Se você já iniciou este simulado antes, informe seu e-mail para retomar sua sessão.
                </p>
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    mut.mutate();
                  }}
                >
                  <Label htmlFor="email-recuperar">E-mail</Label>
                  <Input
                    id="email-recuperar"
                    type="email"
                    required
                    placeholder="seu@email.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={mut.isPending || !form.email}
                    className="w-full"
                  >
                    {mut.isPending ? "Verificando..." : "Retomar sessão existente"}
                  </Button>
                </form>
              </div>
              <div>
                <Button variant="outline" size="sm" onClick={() => window.history.back()}>
                  Voltar
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : tempoEsgotado ? (
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              O tempo limite deste simulado já foi atingido. Não é mais possível iniciar.
            </CardContent>
          </Card>
        ) : s.status === "agendado" ? (
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Este simulado ainda não foi liberado. Aguarde a data de início informada acima.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Este simulado já foi encerrado e não está mais disponível para acesso.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}