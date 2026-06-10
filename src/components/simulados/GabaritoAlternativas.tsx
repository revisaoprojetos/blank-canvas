/**
 * MODELO DE GABARITO DE ALTERNATIVAS — componente reutilizável.
 *
 * Renderiza uma tabela com células [número | letra] no padrão visual da
 * Revisão Ensino Jurídico. Utilizado em:
 *   - Tela de finalização do simulado
 *   - Exportações em PDF
 *   - Relatórios administrativos
 */
import { cn } from "@/lib/utils";

export type GabaritoItem = {
  numero: number;
  letra: string | null;
};

const COL_ROXO = "#4F4A6E";
const COL_CREME = "#FBEFD0";

export function GabaritoAlternativas({
  titulo,
  itens,
  colsMd = 5,
  className,
}: {
  titulo?: string;
  itens: GabaritoItem[];
  colsMd?: 5 | 10;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-xl border shadow-sm",
        className,
      )}
      style={{ borderColor: COL_ROXO }}
    >
      {titulo && (
        <div
          className="px-4 py-3 text-center"
          style={{ background: COL_ROXO, color: "#fff" }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">
            Simulado
          </div>
          <div className="text-base md:text-lg font-bold leading-tight">
            {titulo}
          </div>
        </div>
      )}
      <div
        className={cn(
          "grid",
          colsMd === 10
            ? "grid-cols-5 md:grid-cols-10"
            : "grid-cols-5 md:grid-cols-5",
        )}
      >
        {itens.map((it, idx) => {
          // Alternância por LINHA da tabela (a cada 5 questões).
          const linha = Math.floor(idx / 5);
          const linhaRoxa = linha % 2 === 1;
          return (
            <div
              key={it.numero}
              className="flex items-stretch border-r border-b last:border-r-0"
              style={{ borderColor: "#E7E2D6" }}
            >
              <div
                className="flex-1 px-2 py-2 text-center text-sm font-bold tabular-nums"
                style={{
                  background: linhaRoxa ? COL_ROXO : COL_CREME,
                  color: linhaRoxa ? "#fff" : "#1a1a1a",
                }}
              >
                {String(it.numero).padStart(2, "0")}
              </div>
              <div
                className="flex-1 px-2 py-2 text-center text-sm font-bold"
                style={{ background: "#fff", color: "#000" }}
              >
                {it.letra ?? "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
