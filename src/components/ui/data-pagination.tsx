import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";

export const PAGE_SIZES = [10, 20, 30, 50, 100];

export function DataPagination({
  page, pageSize, total, onPage, onPageSize, itemLabel = "registros",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
  itemLabel?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  const [pageInput, setPageInput] = useState(String(page));

  useEffect(() => { setPageInput(String(page)); }, [page]);

  function go(p: number) {
    const clamped = Math.min(Math.max(1, p), totalPages);
    onPage(clamped);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-t">
      <p className="text-xs text-muted-foreground">
        Mostrando {start.toLocaleString("pt-BR")}-{end.toLocaleString("pt-BR")} de{" "}
        {total.toLocaleString("pt-BR")} {itemLabel}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => { onPageSize(Number(v)); onPage(1); }}>
          <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => (
              <SelectItem key={s} value={String(s)}>{s} / página</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-0.5">
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={page <= 1} onClick={() => go(1)}>
            <ChevronsLeft size={14} />
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={page <= 1} onClick={() => go(page - 1)}>
            <ChevronLeft size={14} />
          </Button>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span>Página</span>
          <Input
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
            onBlur={() => go(Number(pageInput) || 1)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="h-8 w-14 text-center"
          />
          <span>de {totalPages.toLocaleString("pt-BR")}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={page >= totalPages} onClick={() => go(page + 1)}>
            <ChevronRight size={14} />
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={page >= totalPages} onClick={() => go(totalPages)}>
            <ChevronsRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Hook to persist UI state (filters, tab, page) per page-key in sessionStorage. */
export function useStickyState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.sessionStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
  }, [key, v]);
  return [v, setV];
}
