import { createFileRoute } from "@tanstack/react-router";
import { QuestaoForm } from "@/components/questoes/QuestaoForm";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_authenticated/admin/questoes/novo")({
  head: () => ({ meta: [{ title: "Nova questão — Painel Admin" }] }),
  component: () => (
    <>
      <Toaster />
      <QuestaoForm />
    </>
  ),
});
