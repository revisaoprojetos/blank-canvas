import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { cn } from "@/lib/utils";

type Props = {
  children: string | null | undefined;
  className?: string;
  /** Renderiza em uma única linha (sem blocos), útil para títulos/badges. */
  inline?: boolean;
};

/**
 * Schema endurecido para sanitizar HTML potencialmente vindo das importações.
 * `react-markdown` já não interpreta HTML bruto por padrão (escapa como texto),
 * mas mantemos `rehype-sanitize` como defesa-em-profundidade caso algum
 * plugin futuro habilite `rehype-raw` ou outras transformações.
 */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...((defaultSchema.attributes?.a ?? []) as Array<string | [string, ...unknown[]]>),
      ["target", "_blank"],
      ["rel", "noreferrer", "noopener", "nofollow"],
    ],
    code: [...((defaultSchema.attributes?.code ?? []) as Array<string | [string, ...unknown[]]>), "className"],
  },
  // Apenas esquemas de URL inofensivos. Bloqueia javascript:, data:, vbscript: etc.
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto", "tel"],
    src: ["http", "https"],
    cite: ["http", "https"],
  },
};

const SAFE_URL = /^(https?:|mailto:|tel:|#|\/)/i;

function safeUrl(url?: string | null): string {
  if (!url) return "#";
  const trimmed = url.trim();
  return SAFE_URL.test(trimmed) ? trimmed : "#";
}

/** Remove sintaxe básica de Markdown para exibir como texto puro em previews/clamps. */
export function stripMarkdown(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/<\/?[^>]+>/g, "") // remove qualquer tag HTML
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

const baseComponents: Components = {
  a: ({ children, href }) => (
    <a
      href={safeUrl(href)}
      className="underline"
      target="_blank"
      rel="noreferrer noopener nofollow"
    >
      {children}
    </a>
  ),
  // Bloqueia <img> com URLs perigosas; mantém apenas http(s)
  img: ({ src, alt }) => {
    const s = typeof src === "string" ? src : "";
    if (!/^https?:\/\//i.test(s)) return null;
    return <img src={s} alt={alt ?? ""} className="max-w-full h-auto rounded" loading="lazy" />;
  },
};

/**
 * Renderiza Markdown vindo das importações (enunciados, alternativas,
 * explicações). Suporta GFM (tabelas, listas, links, ênfase, código).
 * HTML é escapado pelo react-markdown e adicionalmente sanitizado
 * pelo rehype-sanitize com schema endurecido (sem `script`, `iframe`,
 * `on*`, esquemas `javascript:` etc.).
 */
export function Markdown({ children, className, inline = false }: Props) {
  const text = (children ?? "").toString();
  if (!text.trim()) return null;

  const rehypePlugins = [[rehypeSanitize, sanitizeSchema]] as never;
  const remarkPlugins = [remarkGfm];

  if (inline) {
    return (
      <span className={cn("prose-inline", className)}>
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={{
            ...baseComponents,
            p: ({ children }) => <>{children}</>,
          }}
        >
          {text}
        </ReactMarkdown>
      </span>
    );
  }

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert",
        "prose-p:my-2 prose-headings:mt-3 prose-headings:mb-2",
        "prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5",
        "prose-strong:text-foreground prose-code:text-foreground",
        "prose-a:text-accent-foreground prose-a:underline",
        "prose-table:text-sm prose-th:border prose-td:border prose-th:px-2 prose-td:px-2",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={baseComponents}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
