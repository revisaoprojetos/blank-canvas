import { useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { Bold, Italic, Quote, List, ListOrdered, Code, Link as LinkIcon, Heading } from "lucide-react";

type Props = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  required?: boolean;
};

export function MarkdownEditor({ id, value, onChange, rows = 6, placeholder, required }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(before: string, after = before, placeholderText = "texto") {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = value.slice(start, end) || placeholderText;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + before.length;
      el.setSelectionRange(pos, pos + selected.length);
    });
  }

  function prefixLines(prefix: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = end + (value.slice(end).indexOf("\n") === -1 ? value.length - end : value.slice(end).indexOf("\n"));
    const block = value.slice(lineStart, lineEnd);
    const updated = block.split("\n").map((l) => (l.startsWith(prefix) ? l : prefix + l)).join("\n");
    onChange(value.slice(0, lineStart) + updated + value.slice(lineEnd));
  }

  return (
    <Tabs defaultValue="edit" className="w-full">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => wrap("**")} title="Negrito (Ctrl+B)">
            <Bold size={14} />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => wrap("_")} title="Itálico">
            <Italic size={14} />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => prefixLines("> ")} title="Citação">
            <Quote size={14} />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => prefixLines("## ")} title="Título">
            <Heading size={14} />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => prefixLines("- ")} title="Lista">
            <List size={14} />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => prefixLines("1. ")} title="Lista numerada">
            <ListOrdered size={14} />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => wrap("`")} title="Código">
            <Code size={14} />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => wrap("[", "](https://)", "link")} title="Link">
            <LinkIcon size={14} />
          </Button>
        </div>
        <TabsList>
          <TabsTrigger value="edit">Editar</TabsTrigger>
          <TabsTrigger value="preview">Pré-visualizar</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="edit" className="mt-2">
        <Textarea
          id={id}
          ref={ref}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Suporta Markdown: **negrito**, _itálico_, &gt; citação, listas, [links](url), `código`.
        </p>
      </TabsContent>
      <TabsContent value="preview" className="mt-2">
        <div className="min-h-[8rem] rounded-md border border-input bg-background p-3">
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground italic">Nada para pré-visualizar.</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
