import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, FileQuestion, Users, BookOpenCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [{ title: "Dashboard — Plataforma de Simulados" }],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [simulados, questoes, estudantes, sessoes] = await Promise.all([
        supabase.from("simulados").select("*", { count: "exact", head: true }),
        supabase.from("questoes").select("*", { count: "exact", head: true }),
        supabase.from("estudantes").select("*", { count: "exact", head: true }),
        supabase.from("sessoes_prova").select("*", { count: "exact", head: true }).eq("status", "ativa"),
      ]);
      return {
        simulados: simulados.count ?? 0,
        questoes: questoes.count ?? 0,
        estudantes: estudantes.count ?? 0,
        sessoesAtivas: sessoes.count ?? 0,
      };
    },
  });

  const cards = [
    { label: "Simulados", value: stats?.simulados, icon: ClipboardList, color: "bg-primary text-primary-foreground" },
    { label: "Questões", value: stats?.questoes, icon: FileQuestion, color: "bg-secondary text-secondary-foreground" },
    { label: "Estudantes", value: stats?.estudantes, icon: Users, color: "bg-accent text-accent-foreground" },
    { label: "Sessões ativas", value: stats?.sessoesAtivas, icon: BookOpenCheck, color: "bg-primary text-primary-foreground" },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-primary">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral da plataforma de simulados.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="border-secondary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <div className={`p-2 rounded-md ${c.color}`}>
                <c.icon size={16} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {isLoading ? "—" : c.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8 border-accent/40">
        <CardHeader>
          <CardTitle className="text-primary">Sprint 0 concluído ✓</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>✓ Modelo de dados criado (13 tabelas, 4 enums, RLS ativa).</p>
          <p>✓ Autenticação de administradores funcional (email + senha).</p>
          <p>✓ Sistema de papéis (<code>user_roles</code> + <code>has_role</code>).</p>
          <p>✓ Trigger de auditoria pronto para integração nos próximos sprints.</p>
          <p className="pt-2 text-foreground">
            Próximo: <strong>Sprint 1 — Catálogo de questões e simulados</strong> (CRUD + importação CSV).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
