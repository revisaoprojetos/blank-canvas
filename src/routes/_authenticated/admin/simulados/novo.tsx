import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { SimuladoForm } from "@/components/simulados/SimuladoForm";

export const Route = createFileRoute("/_authenticated/admin/simulados/novo")({
  head: () => ({ meta: [{ title: "Novo simulado — Painel Admin" }] }),
  component: NovoSimulado,
});

function NovoSimulado() {
  return (
    <>
      <Toaster />
      <SimuladoForm />
    </>
  );
}
