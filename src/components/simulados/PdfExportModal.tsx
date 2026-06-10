/**
 * Modal para escolher o modelo de exportação em PDF.
 *
 * Opções:
 *  - Gabarito de Alternativas (resumo)
 *  - Prova Completa (questões + alternativas + opcional gabarito/explicação)
 */
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ClipboardList, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export type ModeloPdf = "alternativas" | "completa";

export function PdfExportModal({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (modelo: ModeloPdf) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Escolha o modelo de exportação</DialogTitle>
          <DialogDescription>
            Selecione abaixo o tipo de documento que deseja baixar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-4 mt-2">
          <Opcao
            icon={<ClipboardList size={28} />}
            titulo="Gabarito de Alternativas"
            descricao="Exporta apenas o resumo com a letra marcada em cada questão."
            onClick={() => { onSelect("alternativas"); onOpenChange(false); }}
          />
          <Opcao
            icon={<BookOpen size={28} />}
            titulo="Prova Completa"
            descricao="Exporta a prova completa com enunciados, alternativas e (quando permitido) explicações."
            onClick={() => { onSelect("completa"); onOpenChange(false); }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Opcao({
  icon, titulo, descricao, onClick,
}: {
  icon: React.ReactNode;
  titulo: string;
  descricao: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group text-left rounded-xl border-2 border-border bg-card p-5",
        "transition-all hover:-translate-y-0.5 hover:shadow-elevated",
        "hover:border-primary focus-visible:border-primary focus-visible:outline-none",
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold">{titulo}</h3>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{descricao}</p>
    </button>
  );
}
