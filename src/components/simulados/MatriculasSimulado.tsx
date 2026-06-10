import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Plus, Search, Trash2, UserPlus, Mail } from "lucide-react";
import { toast } from "sonner";

type MatriculaRow = {
  id: string;
  liberado: boolean;
  estudante_id: string;
  estudantes: {
    id: string;
    nome: string | null;
    email: string;
    cpf: string | null;
  } | null;
};

type EstudanteDisponivel = {
  id: string;
  nome: string | null;
  email: string;
  cpf: string | null;
};

export function MatriculasSimulado({ simuladoId }: { simuladoId: string }) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [openNovo, setOpenNovo] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [novo, setNovo] = useState({ email: "", nome: "", cpf: "" });

  const { data: matriculas = [], isLoading } = useQuery({
    queryKey: ["matriculas_simulado", simuladoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas")
        .select("id, liberado, estudante_id, estudantes(id, nome, email, cpf)")
        .eq("simulado_id", simuladoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as MatriculaRow[];
    },
  });

  const idsMatriculados = new Set(matriculas.map((m) => m.estudante_id));

  const { data: disponiveis = [] } = useQuery({
    queryKey: ["estudantes_disponiveis", simuladoId, busca],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("estudantes")
        .select("id, nome, email, cpf")
        .order("created_at", { ascending: false })
        .limit(50);
      if (busca.trim()) {
        q = q.or(`email.ilike.%${busca}%,nome.ilike.%${busca}%,cpf.ilike.%${busca}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data as EstudanteDisponivel[]).filter((e) => !idsMatriculados.has(e.id));
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["matriculas_simulado", simuladoId] });
    qc.invalidateQueries({ queryKey: ["estudantes_disponiveis", simuladoId] });
  };

  const adicionar = useMutation({
    mutationFn: async (ids: string[]) => {
      const rows = ids.map((eid) => ({
        simulado_id: simuladoId,
        estudante_id: eid,
        liberado: true,
      }));
      const { error } = await supabase.from("matriculas").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estudantes matriculados");
      setSelecionados(new Set());
      setOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const criarEMatricular = useMutation({
    mutationFn: async () => {
      const email = novo.email.trim().toLowerCase();
      if (!email) throw new Error("E-mail obrigatório.");
      // upsert estudante por email
      const { data: existente } = await supabase
        .from("estudantes")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      let estudanteId = existente?.id;
      if (!estudanteId) {
        const { data: criado, error } = await supabase
          .from("estudantes")
          .insert({
            email,
            nome: novo.nome || null,
            cpf: novo.cpf ? novo.cpf.replace(/\D/g, "") : null,
          })
          .select("id")
          .single();
        if (error) throw error;
        estudanteId = criado.id;
      }
      if (idsMatriculados.has(estudanteId)) {
        throw new Error("Este estudante já está matriculado.");
      }
      const { error: eM } = await supabase
        .from("matriculas")
        .insert({ simulado_id: simuladoId, estudante_id: estudanteId, liberado: true });
      if (eM) throw eM;
    },
    onSuccess: () => {
      toast.success("Estudante matriculado");
      setNovo({ email: "", nome: "", cpf: "" });
      setOpenNovo(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("matriculas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Matrícula removida");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleLiberado = useMutation({
    mutationFn: async ({ id, liberado }: { id: string; liberado: boolean }) => {
      const { error } = await supabase
        .from("matriculas")
        .update({ liberado })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Estudantes matriculados ({matriculas.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Dialog open={openNovo} onOpenChange={setOpenNovo}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <UserPlus size={14} className="mr-1" /> Novo estudante
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar e matricular estudante</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium">E-mail *</label>
                    <Input
                      type="email" maxLength={255}
                      value={novo.email}
                      onChange={(e) => setNovo({ ...novo, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Nome</label>
                    <Input
                      maxLength={120}
                      value={novo.nome}
                      onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">CPF</label>
                    <Input
                      maxLength={14} placeholder="000.000.000-00"
                      value={novo.cpf}
                      onChange={(e) => setNovo({ ...novo, cpf: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                  <Button
                    onClick={() => criarEMatricular.mutate()}
                    disabled={!novo.email || criarEMatricular.isPending}
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {criarEMatricular.isPending ? "Salvando..." : "Cadastrar e matricular"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                  <Plus size={14} className="mr-1" /> Matricular existentes
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Matricular estudantes no simulado</DialogTitle>
                </DialogHeader>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input
                    placeholder="Buscar por e-mail, nome ou CPF..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="max-h-96 overflow-y-auto space-y-2 mt-2">
                  {disponiveis.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum estudante disponível para matrícula.
                    </p>
                  ) : (
                    disponiveis.map((e) => {
                      const sel = selecionados.has(e.id);
                      return (
                        <div
                          key={e.id}
                          onClick={() => toggleSelecionado(e.id)}
                          className={`p-3 border rounded-md cursor-pointer transition ${
                            sel
                              ? "border-accent bg-accent/10"
                              : "border-secondary/20 hover:border-secondary/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Mail size={14} className="text-muted-foreground" />
                            <span className="text-sm font-medium">{e.email}</span>
                          </div>
                          {(e.nome || e.cpf) && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {e.nome && <span>{e.nome}</span>}
                              {e.nome && e.cpf && <span> · </span>}
                              {e.cpf && <span>CPF {e.cpf}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                  <Button
                    onClick={() => adicionar.mutate(Array.from(selecionados))}
                    disabled={selecionados.size === 0 || adicionar.isPending}
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    Matricular {selecionados.size > 0 ? `(${selecionados.size})` : ""}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : matriculas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum estudante matriculado. Clique em "Matricular existentes" ou "Novo estudante".
          </p>
        ) : (
          <div className="space-y-2">
            {matriculas.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 p-3 border border-secondary/20 rounded-md"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {m.estudantes?.nome || m.estudantes?.email}
                    </span>
                    {!m.liberado && <Badge variant="outline">Bloqueado</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {m.estudantes?.email}
                    {m.estudantes?.cpf && <span> · CPF {m.estudantes.cpf}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Liberado</span>
                    <Switch
                      checked={m.liberado}
                      onCheckedChange={(v) => toggleLiberado.mutate({ id: m.id, liberado: v })}
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm("Remover esta matrícula?")) remover.mutate(m.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
