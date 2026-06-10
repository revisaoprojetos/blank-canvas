import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, ChevronLeft, Eye, Info, Clock } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";

export const Route = createFileRoute("/_authenticated/admin/simulados/$id/previa")({
  head: () => ({ meta: [{ title: "Prévia do simulado — Painel Admin" }] }),
  component: PreviaSimulado,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">Erro: {error.message}</div>,
  notFoundComponent: () => <div className="p-8">Simulado não encontrado.</div>,
});

type Simulado = {
  id: string;
  titulo: string;
  descricao: string | null;
  instrucoes: string | null;
  duracao_minutos: number;
  embaralhar_questoes: boolean;
  embaralhar_alternativas: boolean;
  mostrar_gabarito: boolean;
};

type Vinculo = {
  ordem: number;
  peso: number;
  questoes: {
    id: string;
    enunciado: string;
    disciplina: string | null;
    topico: string | null;
    explicacao: string | null;
    alternativas: { id: string; letra: string; texto: string; correta: boolean }[];
  } | null;
};

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function PreviaSimulado() {
  const { id } = Route.useParams();
  const [embaralhar, setEmbaralhar] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["previa_simulado", id],
    queryFn: async () => {
      const { data: s, error: e1 } = await supabase
        .from("simulados").select("*").eq("id", id).maybeSingle();
      if (e1) throw e1;
      if (!s) throw notFound();

      const { data: v, error: e2 } = await supabase
        .from("questao_simulado")
        .select("ordem, peso, questoes(id, enunciado, disciplina, topico, explicacao, alternativas(id, letra, texto, correta))")
        .eq("simulado_id", id)
        .order("ordem");
      if (e2) throw e2;
      return { simulado: s as Simulado, vinculos: (v ?? []) as unknown as Vinculo[] };
    },
  });

  const questoesOrdenadas = useMemo(() => {
    if (!data) return [];
    const lista = data.vinculos.filter((v) => v.questoes);
    const aplicarShuffle = embaralhar || data.simulado.embaralhar_questoes;
    const base = aplicarShuffle ? shuffle(lista) : lista;
    return base.map((v) => ({
      ...v,
      questoes: v.questoes
        ? {
            ...v.questoes,
            alternativas: (embaralhar || data.simulado.embaralhar_alternativas)
              ? shuffle(v.questoes.alternativas)
              : [...v.questoes.alternativas].sort((a, b) => a.letra.localeCompare(b.letra)),
          }
        : null,
    }));
  }, [data, embaralhar]);

  const [idx, setIdx] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [mostrarGabarito, setMostrarGabarito] = useState(false);

  if (isLoading) return <div className="p-8 text-muted-foreground">Carregando...</div>;
  if (error || !data) return <div className="p-8 text-destructive">Erro ao carregar.</div>;

  const total = questoesOrdenadas.length;
  const pesoTotal = data.vinculos.reduce((s, v) => s + Number(v.peso), 0);

  if (total === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Link to="/admin/simulados/$id" params={{ id }} className="inline-flex items-center gap-1 text-sm text-secondary hover:underline mb-4">
          <ChevronLeft size={14} /> Voltar à edição
        </Link>
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">
            Este simulado ainda não tem questões vinculadas.
          </p>
        </Card>
      </div>
    );
  }

  const atual = questoesOrdenadas[idx];
  const respostaAtual = atual.questoes ? respostas[atual.questoes.id] : undefined;
  const correta = atual.questoes?.alternativas.find((a) => a.correta);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Barra de prévia (admin) */}
      <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Eye size={14} />
          <span>Prévia do administrador</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={embaralhar}
              onChange={(e) => setEmbaralhar(e.target.checked)}
            />
            Simular embaralhamento
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={mostrarGabarito}
              onChange={(e) => setMostrarGabarito(e.target.checked)}
            />
            Mostrar gabarito
          </label>
          <Button asChild size="sm" variant="secondary" className="h-7">
            <Link to="/admin/simulados/$id" params={{ id }}>
              <ChevronLeft size={12} className="mr-1" /> Voltar
            </Link>
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6">
        {/* Cabeçalho */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-primary">{data.simulado.titulo}</h1>
          {data.simulado.descricao && (
            <p className="text-muted-foreground mt-1">{data.simulado.descricao}</p>
          )}
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock size={12} /> {data.simulado.duracao_minutos} min
            </span>
            <span>{total} questões</span>
            <span>Peso total: {pesoTotal.toFixed(2)}</span>
          </div>
        </header>

        {data.simulado.instrucoes && idx === 0 && (
          <Card className="mb-4 border-secondary/40 bg-secondary/5">
            <CardContent className="pt-4 flex gap-2 text-sm">
              <Info size={16} className="text-secondary shrink-0 mt-0.5" />
              <Markdown className="flex-1">{data.simulado.instrucoes}</Markdown>
            </CardContent>
          </Card>
        )}

        {/* Card de questão */}
        <Card className="border-secondary/30">
          <CardHeader className="border-b border-secondary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary text-primary-foreground">
                  Questão {idx + 1}/{total}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Peso: {Number(atual.peso).toFixed(2)}
                </span>
              </div>
              <div className="flex gap-1">
                {atual.questoes?.disciplina && (
                  <Badge variant="secondary">{atual.questoes.disciplina}</Badge>
                )}
                {atual.questoes?.topico && (
                  <Badge variant="outline">{atual.questoes.topico}</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <Markdown className="text-foreground">{atual.questoes?.enunciado}</Markdown>

            <RadioGroup
              value={respostaAtual ?? ""}
              onValueChange={(v) =>
                atual.questoes &&
                setRespostas((r) => ({ ...r, [atual.questoes!.id]: v }))
              }
              className="space-y-2"
            >
              {atual.questoes?.alternativas.map((a, i) => {
                const letraExibida = embaralhar || data.simulado.embaralhar_alternativas
                  ? String.fromCharCode(65 + i)
                  : a.letra;
                const isCorreta = mostrarGabarito && a.correta;
                return (
                  <Label
                    key={a.id}
                    htmlFor={`p-${a.id}`}
                    className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer transition ${
                      isCorreta
                        ? "border-accent bg-accent/10"
                        : "border-secondary/20 hover:border-secondary/50"
                    }`}
                  >
                    <RadioGroupItem value={a.id} id={`p-${a.id}`} className="mt-1" />
                    <span className="font-bold text-primary w-5">{letraExibida}</span>
                    <Markdown className="flex-1 text-sm">{a.texto}</Markdown>
                    {isCorreta && (
                      <Badge className="bg-accent text-accent-foreground">Correta</Badge>
                    )}
                  </Label>
                );
              })}
            </RadioGroup>

            {mostrarGabarito && atual.questoes?.explicacao && (
              <div className="border-l-4 border-secondary bg-secondary/5 p-3 text-sm">
                <p className="font-semibold text-primary mb-1">Explicação</p>
                <Markdown className="text-muted-foreground">{atual.questoes.explicacao}</Markdown>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navegação */}
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            disabled={idx === 0}
            onClick={() => setIdx((i) => i - 1)}
          >
            <ArrowLeft size={14} className="mr-1" /> Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            {Object.keys(respostas).length} de {total} respondidas
          </span>
          <Button
            disabled={idx === total - 1}
            onClick={() => setIdx((i) => i + 1)}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            Próxima <ArrowRight size={14} className="ml-1" />
          </Button>
        </div>

        {/* Mapa de navegação */}
        <div className="mt-6">
          <p className="text-xs text-muted-foreground mb-2">Navegação rápida</p>
          <div className="grid grid-cols-10 gap-1">
            {questoesOrdenadas.map((q, i) => {
              const respondida = q.questoes && respostas[q.questoes.id];
              return (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`aspect-square text-xs rounded font-bold transition ${
                    i === idx
                      ? "bg-primary text-primary-foreground"
                      : respondida
                      ? "bg-accent/30 text-accent-foreground"
                      : "bg-muted text-muted-foreground hover:bg-secondary/30"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
