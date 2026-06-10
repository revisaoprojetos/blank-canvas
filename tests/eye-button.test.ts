import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ADMIN_DIR = "src/routes/_authenticated/admin";
const EXPECTED_TO = '"/admin/simulados/$id/simulacao"';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/**
 * Extrai todos os blocos <Link ...>...</Link> que contenham o ícone <Eye .../>.
 * Funciona com Link auto-fechado ou com filhos, em uma ou várias linhas.
 */
function extractEyeLinkBlocks(source: string): string[] {
  const blocks: string[] = [];
  const linkOpen = /<Link\b/g;
  let m: RegExpExecArray | null;
  while ((m = linkOpen.exec(source))) {
    const start = m.index;
    const close = source.indexOf("</Link>", start);
    if (close === -1) continue;
    const block = source.slice(start, close + "</Link>".length);
    if (/<Eye\b/.test(block)) blocks.push(block);
  }
  return blocks;
}

describe("Botão do olhinho (Eye) — rota da simulação real", () => {
  const files = walk(ADMIN_DIR);

  it("encontrou arquivos de rota do admin", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const blocks = extractEyeLinkBlocks(src);
    if (blocks.length === 0) continue;

    describe(file, () => {
      blocks.forEach((block, i) => {
        it(`Eye link #${i + 1} aponta para ${EXPECTED_TO}`, () => {
          // Garante que existe um atributo `to="..."` correto
          const match = block.match(/\bto=("[^"]+"|\{[^}]+\})/);
          expect(match, `<Link> com <Eye> sem atributo "to":\n${block}`).toBeTruthy();
          const toValue = match![1];

          expect(
            toValue,
            `<Link> com <Eye> aponta para ${toValue}, esperado ${EXPECTED_TO}.\nBloco:\n${block}`,
          ).toBe(EXPECTED_TO);

          // Garante que o params do dynamic segment é fornecido (id ou id: ...)
          expect(
            /params=\{\{\s*id(\s*[,:}])/.test(block),
            `<Link> com <Eye> não passa params={{ id }}:\n${block}`,
          ).toBe(true);
        });
      });
    });
  }
});

describe("Botão do lápis (Pencil) — rota de edição", () => {
  const file = "src/routes/_authenticated/admin/simulados/index.tsx";
  const src = readFileSync(file, "utf8");

  // Procura blocos <Link>...<Pencil .../>...</Link>
  const blocks: string[] = [];
  const linkOpen = /<Link\b/g;
  let m: RegExpExecArray | null;
  while ((m = linkOpen.exec(src))) {
    const start = m.index;
    const close = src.indexOf("</Link>", start);
    if (close === -1) continue;
    const block = src.slice(start, close + "</Link>".length);
    if (/<Pencil\b/.test(block)) blocks.push(block);
  }

  it("contém pelo menos um botão de edição com Pencil", () => {
    expect(blocks.length).toBeGreaterThan(0);
  });

  blocks.forEach((block, i) => {
    it(`Pencil link #${i + 1} aponta para a edição do simulado`, () => {
      const match = block.match(/\bto=("[^"]+")/);
      expect(match).toBeTruthy();
      expect(match![1]).toBe('"/admin/simulados/$id"');
    });
  });
});
