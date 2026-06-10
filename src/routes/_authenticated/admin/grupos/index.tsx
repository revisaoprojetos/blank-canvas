import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { GruposManager } from "@/components/grupos/GruposManager";

export const Route = createFileRoute("/_authenticated/admin/grupos/")({
  head: () => ({ meta: [{ title: "Grupos — Painel Admin" }] }),
  component: GruposPage,
});

function GruposPage() {
  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6">
      <Toaster />
      <header>
        <h1 className="text-3xl font-bold text-primary">Grupos</h1>
      </header>
      <GruposManager />
    </div>
  );
}
