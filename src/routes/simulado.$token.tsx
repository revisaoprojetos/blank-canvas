import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/simulado/$token")({
  component: SimuladoLayout,
});

function SimuladoLayout() {
  return <Outlet />;
}
