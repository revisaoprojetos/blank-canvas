import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Play, Square, Archive, Clock, Eye, Link2, Copy, Check, RefreshCcw, Ban, CalendarClock, ExternalLink } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { formatBrasilia, brasiliaInputToISO } from "@/lib/datetime";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/simulados/")({
  head: () => ({ meta: [{ title: "Simulados — Painel Admin" }] }),
  component: SimuladosList,
});

type Simulado = {
  id: string;
  titulo: string;
  descricao: string | null;
  duracao_minutos: number;
  data_inicio: string | null;
  data_fim: string | null;
  status: "rascunho" | "agendado" | "em_andamento" | "encerrado" | "arquivado";
  token_acesso: string;
  link_expira_em: string | null;
  link_revogado_em: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<Simulado["status"], { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  agendado: { label: "Agendado", className: "bg-secondary text-secondary-foreground" },
  em_andamento: { label: "Em andamento", className: "bg-accent text-accent-foreground" },
  encerrado: { label: "Encerrado", className: "bg-primary text-primary-foreground" },
  arquivado: { label: "Arquivado", className: "bg-muted text-muted-foreground opacity-70" },
};

function GerenciarLink({ s }: { s: Simulado }) {
  const qc = useQueryClient();
  const [copiado, setCopiado] = useState(false);
  const [expira, setExpira] = useState("");

  if (!["agendado", "em_andamento"].includes(s.status)) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/simulado/${s.token_acesso}`;

  const revogado = Boolean(s.link_revogado_em);
  const expirado = s.link_expira_em && new Date(s.link_expira_em).getTime() < Date.now();
  const ativo = !revogado && !expirado;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      toast.success("Link copiado");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const regenerar = useMutation({
    mutationFn: async () => {
      // gera token novo via update setando para expressão default
      const novo = crypto.getRandomValues(new Uint8Array(16));
      const hex = Array.from(novo).map((b) => b.toString(16).padStart(2, "0")).join("");
      const { error } = await supabase
        .from("simulados")
        .update({ token_acesso: hex, link_revogado_em: null })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Novo link gerado. Links anteriores deixaram de funcionar.");
      qc.invalidateQueries({ queryKey: ["simulados"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revogar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("simulados")
        .update({ link_revogado_em: new Date().toISOString() })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link revogado");
      qc.invalidateQueries({ queryKey: ["simulados"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const definirExpira = useMutation({
    mutationFn: async (iso: string | null) => {
      const { error } = await supabase
        .from("simulados")
        .update({ link_expira_em: iso })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expiração atualizada");
      qc.invalidateQueries({ queryKey: ["simulados"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-3 space-y-2 rounded-md border border-accent/30 bg-accent/5 px-3 py-2">
      <div className="flex items-center gap-2">
        <Link2 size={14} className="text-accent shrink-0" />
        <code className={`flex-1 truncate text-xs ${ativo ? "text-foreground/80" : "text-muted-foreground line-through"}`}>
          {url}
        </code>
        {revogado && <Badge variant="destructive" className="text-[10px]">Revogado</Badge>}
        {expirado && !revogado && <Badge variant="destructive" className="text-[10px]">Expirado</Badge>}
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={copiar} disabled={!ativo}>
          {copiado ? <Check size={14} /> : <Copy size={14} />}
          <span className="ml-1 text-xs">{copiado ? "Copiado" : "Copiar"}</span>
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {s.link_expira_em && (
          <span className="text-muted-foreground">
            Expira em {formatBrasilia(s.link_expira_em, "dd/MM/yyyy HH:mm")}
          </span>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 px-2">
              <CalendarClock size={12} className="mr-1" /> Definir expiração
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-2">
            <Input
              type="datetime-local"
              value={expira}
              onChange={(e) => setExpira(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                disabled={!expira}
                onClick={() => definirExpira.mutate(brasiliaInputToISO(expira))}
              >
                Salvar
              </Button>
              {s.link_expira_em && (
                <Button size="sm" variant="ghost" onClick={() => definirExpira.mutate(null)}>
                  Limpar
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          size="sm" variant="ghost" className="h-7 px-2"
          onClick={() => regenerar.mutate()}
          title="Cria token novo e invalida links anteriores"
        >
          <RefreshCcw size={12} className="mr-1" /> Regenerar
        </Button>
        {!revogado && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive">
                <Ban size={12} className="mr-1" /> Revogar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revogar este link?</AlertDialogTitle>
                <AlertDialogDescription>
                  Estudantes que tentarem acessar com o link atual receberão uma mensagem
                  informando que o link foi revogado. Você pode gerar um novo link depois.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => revogar.mutate()}
                  className="bg-destructive text-destructive-foreground"
                >
                  Revogar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-accent ml-auto"
          disabled={!ativo}
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink size={12} className="mr-1" /> Abrir simulado
        </Button>
      </div>
    </div>
  );
}

function SimuladosList() {
  const qc = useQueryClient();

  const { data: simulados, isLoading } = useQuery({
    queryKey: ["simulados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulados")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Simulado[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Simulado["status"] }) => {
      const { error } = await supabase.from("simulados").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`Status atualizado para "${STATUS_LABELS[v.status].label}"`);
      qc.invalidateQueries({ queryKey: ["simulados"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("simulados").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Simulado excluído");
      qc.invalidateQueries({ queryKey: ["simulados"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Toaster />
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary">Simulados</h1>
          <p className="text-muted-foreground mt-1">Gerencie provas, agendamentos e publicações.</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/admin/simulados/novo">
              <Plus className="mr-2" size={16} /> Novo simulado
            </Link>
          </Button>
        </div>
      </header>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !simulados || simulados.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-secondary/40">
          <p className="text-muted-foreground mb-4">Nenhum simulado cadastrado ainda.</p>
          <Button asChild>
            <Link to="/admin/simulados/novo">Criar o primeiro simulado</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {simulados.map((s) => (
            <Card key={s.id} className="p-5 border-secondary/20 hover:border-secondary/50 transition">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-primary truncate">{s.titulo}</h3>
                      <Badge className={STATUS_LABELS[s.status].className}>
                        {STATUS_LABELS[s.status].label}
                      </Badge>
                    </div>
                    {s.descricao && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{s.descricao}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {s.duracao_minutos} min
                      </span>
                      {s.data_inicio && (
                        <span>Início: {formatBrasilia(s.data_inicio, "dd/MM/yyyy HH:mm")}</span>
                      )}
                      {s.data_fim && (
                        <span>Fim: {formatBrasilia(s.data_fim, "dd/MM/yyyy HH:mm")}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {s.status === "rascunho" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: s.id, status: "agendado" })}>
                        <Play size={14} className="mr-1" /> Publicar
                      </Button>
                    )}
                    {s.status === "agendado" && (
                      <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90"
                        onClick={() => setStatus.mutate({ id: s.id, status: "em_andamento" })}>
                        <Play size={14} className="mr-1" /> Ativar agora
                      </Button>
                    )}
                    {s.status === "em_andamento" && (
                      <Button size="sm" variant="destructive"
                        onClick={() => setStatus.mutate({ id: s.id, status: "encerrado" })}>
                        <Square size={14} className="mr-1" /> Encerrar
                      </Button>
                    )}
                    {s.status === "encerrado" && (
                      <>
                        <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90"
                          onClick={() => setStatus.mutate({ id: s.id, status: "em_andamento" })}
                          title="Reabrir simulado">
                          <Play size={14} className="mr-1" /> Reabrir
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: s.id, status: "arquivado" })}>
                          <Archive size={14} className="mr-1" /> Arquivar
                        </Button>
                      </>
                    )}

                    <Button asChild size="sm" variant="ghost" title="Prévia do estudante (simulação real)">
                      <Link to="/admin/simulados/$id/simulacao" params={{ id: s.id }}>
                        <Eye size={14} />
                      </Link>
                    </Button>

                    <Button asChild size="sm" variant="ghost" title="Editar simulado">
                      <Link to="/admin/simulados/$id" params={{ id: s.id }}>
                        <Pencil size={14} />
                      </Link>
                    </Button>



                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                          <Trash2 size={14} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir simulado?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Todas as matrículas e sessões deste
                            simulado serão removidas.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => remove.mutate(s.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <GerenciarLink s={s} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
