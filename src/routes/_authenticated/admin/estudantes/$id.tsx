import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Mail, Phone, CreditCard, Calendar, Target, Activity,
  Pencil, Save, Trash2, X, UserPlus,
} from "lucide-react";
import { formatBrasilia } from "@/lib/datetime";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/estudantes/$id")({
  head: () => ({ meta: [{ title: "Perfil do Estudante — Painel Admin" }] }),
  component: PerfilEstudante,
});

function PerfilEstudante() {
  const { id } = useParams({ from: "/_authenticated/admin/estudantes/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["perfil-estudante", id],
    queryFn: async () => {
      const [estR, sessR, gmR] = await Promise.all([
        supabase.from("estudantes").select("*").eq("id", id).single(),
        supabase
          .from("sessoes_prova")
          .select("id, simulado_id, status, iniciada_em, finalizada_em, pontuacao, acertos, total_questoes")
          .eq("estudante_id", id)
          .order("iniciada_em", { ascending: false }),
        supabase.from("grupo_membros").select("grupo_id").eq("estudante_id", id),
      ]);
      if (estR.error) throw estR.error;

      const simIds = Array.from(new Set((sessR.data ?? []).map((s) => s.simulado_id)));
      const grupoIds = (gmR.data ?? []).map((g) => g.grupo_id);

      const [simsR, grsR, respR] = await Promise.all([
        simIds.length > 0
          ? supabase.from("simulados").select("id, titulo, status").in("id", simIds)
          : Promise.resolve({ data: [] as { id: string; titulo: string; status: string }[] }),
        grupoIds.length > 0
          ? supabase.from("grupos").select("id, nome").in("id", grupoIds)
          : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
        supabase
          .from("respostas")
          .select("correta, sessao_id")
          .in("sessao_id", (sessR.data ?? []).map((s) => s.id).slice(0, 500)),
      ]);

      const simMap = new Map((simsR.data ?? []).map((s) => [s.id, s]));
      const respostas = respR.data ?? [];
      const totalResp = respostas.length;
      const acertos = respostas.filter((r) => r.correta).length;

      return {
        estudante: estR.data,
        sessoes: (sessR.data ?? []).map((s) => ({
          ...s, simulado: simMap.get(s.simulado_id) ?? null,
        })),
        grupos: grsR.data ?? [],
        stats: {
          totalResp, acertos,
          taxa: totalResp > 0 ? (acertos / totalResp) * 100 : 0,
        },
      };
    },
  });

  const { data: todosGrupos = [] } = useQuery({
    queryKey: ["grupos-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupos").select("id, nome").eq("arquivado", false).order("nome");
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
  });

  useEffect(() => {
    if (data?.estudante) {
      setNome(data.estudante.nome ?? "");
      setEmail(data.estudante.email);
      setCpf(data.estudante.cpf ?? "");
      setTelefone(data.estudante.telefone ?? "");
    }
  }, [data?.estudante]);

  const finalizadas = useMemo(
    () => data?.sessoes.filter((s) => s.status === "finalizada").length ?? 0,
    [data]
  );

  const salvar = useMutation({
    mutationFn: async () => {
      const e = email.trim().toLowerCase();
      if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        throw new Error("E-mail inválido");
      }
      const { error } = await supabase
        .from("estudantes")
        .update({
          nome: nome.trim() || null,
          email: e,
          cpf: cpf.trim() || null,
          telefone: telefone.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados atualizados");
      setEditando(false);
      qc.invalidateQueries({ queryKey: ["perfil-estudante", id] });
      qc.invalidateQueries({ queryKey: ["estudantes-full"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("estudantes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estudante excluído");
      qc.invalidateQueries({ queryKey: ["estudantes-full"] });
      navigate({ to: "/admin/estudantes" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addGrupo = useMutation({
    mutationFn: async (grupo_id: string) => {
      const { error } = await supabase
        .from("grupo_membros")
        .upsert(
          [{ estudante_id: id, grupo_id }],
          { onConflict: "grupo_id,estudante_id", ignoreDuplicates: true },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Adicionado ao grupo");
      qc.invalidateQueries({ queryKey: ["perfil-estudante", id] });
      qc.invalidateQueries({ queryKey: ["grupo-membros-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeGrupo = useMutation({
    mutationFn: async (grupo_id: string) => {
      const { error } = await supabase
        .from("grupo_membros")
        .delete()
        .eq("estudante_id", id)
        .eq("grupo_id", grupo_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido do grupo");
      qc.invalidateQueries({ queryKey: ["perfil-estudante", id] });
      qc.invalidateQueries({ queryKey: ["grupo-membros-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando perfil...</div>;
  }
  const { estudante, sessoes, grupos, stats } = data;
  const grupoIdsAtuais = new Set(grupos.map((g) => g.id));

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6">
      <Toaster />
      <Link
        to="/admin/estudantes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={14} /> Voltar para estudantes
      </Link>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start gap-6">
            <div className="h-20 w-20 rounded-full bg-primary/15 text-primary flex items-center justify-center text-2xl font-bold">
              {(estudante.nome ?? estudante.email).slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              {editando ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
                  <div>
                    <Label htmlFor="f-nome">Nome</Label>
                    <Input id="f-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="f-email">E-mail *</Label>
                    <Input id="f-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="f-cpf">CPF</Label>
                    <Input id="f-cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="f-tel">Telefone</Label>
                    <Input id="f-tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl font-bold">
                    {estudante.nome ?? <span className="italic text-muted-foreground">sem nome</span>}
                  </h1>
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Mail size={14} /> {estudante.email}</span>
                    {estudante.cpf && <span className="flex items-center gap-1"><CreditCard size={14} /> {estudante.cpf}</span>}
                    {estudante.telefone && <span className="flex items-center gap-1"><Phone size={14} /> {estudante.telefone}</span>}
                    <span className="flex items-center gap-1">
                      <Calendar size={14} /> Cadastrado em {formatBrasilia(estudante.created_at, "dd/MM/yyyy")}
                    </span>
                  </div>
                </>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-1">
                {grupos.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Sem grupos</span>
                ) : (
                  grupos.map((g) => (
                    <Badge key={g.id} variant="secondary" className="gap-1 pr-1">
                      <Link to="/admin/grupos/$id" params={{ id: g.id }}>{g.nome}</Link>
                      <button
                        type="button"
                        onClick={() => removeGrupo.mutate(g.id)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Remover do grupo"
                      >
                        <X size={12} />
                      </button>
                    </Badge>
                  ))
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                      <UserPlus size={12} className="mr-1" /> Adicionar a grupo
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-60 p-2">
                    <div className="max-h-60 overflow-auto">
                      {todosGrupos.filter((g) => !grupoIdsAtuais.has(g.id)).length === 0 ? (
                        <p className="text-xs text-muted-foreground p-2">
                          Estudante já está em todos os grupos disponíveis.
                        </p>
                      ) : (
                        todosGrupos
                          .filter((g) => !grupoIdsAtuais.has(g.id))
                          .map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => addGrupo.mutate(g.id)}
                              className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
                            >
                              {g.nome}
                            </button>
                          ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {editando ? (
                <>
                  <Button
                    onClick={() => salvar.mutate()}
                    disabled={salvar.isPending}
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    <Save size={14} className="mr-1" /> Salvar alterações
                  </Button>
                  <Button variant="outline" onClick={() => setEditando(false)}>
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setEditando(true)}>
                    <Pencil size={14} className="mr-1" /> Editar dados
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="text-destructive">
                        <Trash2 size={14} className="mr-1" /> Excluir estudante
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Tem certeza que deseja excluir este estudante?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não poderá ser desfeita. Todas as matrículas, sessões
                          e respostas vinculadas serão removidas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground"
                          onClick={() => excluir.mutate()}
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiPerfil label="Sessões iniciadas" value={sessoes.length} icon={<Activity size={16} />} />
        <KpiPerfil label="Sessões finalizadas" value={finalizadas} icon={<Activity size={16} />} />
        <KpiPerfil label="Respostas totais" value={stats.totalResp} icon={<Target size={16} />} />
        <KpiPerfil label="Taxa de acerto" value={`${stats.taxa.toFixed(1)}%`} icon={<Target size={16} />} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Sessões / simulados realizados</CardTitle></CardHeader>
        <CardContent className="p-0">
          {sessoes.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">
              Este estudante ainda não iniciou nenhum simulado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Simulado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Iniciado</TableHead>
                  <TableHead>Finalizado</TableHead>
                  <TableHead className="text-right">Acertos</TableHead>
                  <TableHead className="text-right">Pontuação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessoes.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {s.simulado?.titulo ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.status === "finalizada" ? "default" : "secondary"}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatBrasilia(s.iniciada_em, "dd/MM HH:mm")}</TableCell>
                    <TableCell className="text-xs">
                      {s.finalizada_em ? formatBrasilia(s.finalizada_em, "dd/MM HH:mm") : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {s.acertos != null && s.total_questoes != null
                        ? `${s.acertos}/${s.total_questoes}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {s.pontuacao != null ? Number(s.pontuacao).toFixed(2) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiPerfil({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <div className="text-primary">{icon}</div>
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}
