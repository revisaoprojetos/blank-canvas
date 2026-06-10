/**
 * Geração de PDFs do resultado do estudante (dois modelos).
 *
 * Modelos disponíveis:
 *   - "alternativas": Tabela de Gabarito de Alternativas no padrão da marca.
 *   - "completa":     Prova completa em formato ABNT (Times New Roman 12pt,
 *                     espaçamento 1.5, margens 3/2/2/3 cm).
 *
 * Regras de aplicação respeitadas em AMBOS os modelos:
 *   - `mostrarResultado=false` → omite nota, acertos, erros e gabarito oficial.
 *   - `mostrarResultado=true` + `mostrarGabarito=false` → mostra alternativa
 *     correta no gabarito de alternativas, mas NÃO inclui explicações.
 *   - `mostrarResultado=true` + `mostrarGabarito=true` → inclui tudo.
 */
import jsPDF from "jspdf";
import { stripMarkdown } from "@/components/ui/markdown";
import logoHorizontal from "@/assets/revisao-marca-horizontal.asset.json";

export type PdfAlt = { id: string; letra: string; texto: string; correta?: boolean };
export type PdfQuestao = {
  id: string;
  enunciado: string;
  explicacao?: string | null;
  alternativas: PdfAlt[];
};
export type PdfPayloadQuestao = {
  numero: number;
  questao: PdfQuestao;
  marcadaId: string | null;
};
export type PdfPayload = {
  tituloSimulado: string;
  descricaoSimulado?: string | null;
  nomeAluno?: string | null;
  emailAluno?: string | null;
  dataRealizacao?: Date | null;
  mostrarResultado: boolean;
  mostrarGabarito: boolean;
  stats?: {
    acertos: number;
    erros: number;
    emBranco: number;
    total: number;
    aproveitamento: number;
    pontuacao: number;
  } | null;
  questoes: PdfPayloadQuestao[];
};

const COR_ROXO: [number, number, number] = [79, 74, 110];
const COR_CREME: [number, number, number] = [251, 239, 208];

const fill = (doc: jsPDF, c: readonly [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
const stroke = (doc: jsPDF, c: readonly [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
const text = (doc: jsPDF, c: readonly [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);

/* ------------------------------ helpers ------------------------------ */

async function carregarLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = logoHorizontal.url;
    } catch {
      resolve(null);
    }
  });
}

function cabecalhoComLogo(
  doc: jsPDF,
  pageW: number,
  logo: HTMLImageElement | null,
  titulo: string,
): number {
  // Faixa roxa superior
  doc.setFillColor(...COR_ROXO);
  doc.rect(0, 0, pageW, 28, "F");

  if (logo) {
    const ratio = logo.width / logo.height;
    const h = 12;
    const w = h * ratio;
    try {
      doc.addImage(logo, "PNG", 14, 8, w, h);
    } catch {
      // ignore — segue sem logo
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("SIMULADO", pageW - 14, 11, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(titulo.slice(0, 70), pageW - 14, 18, { align: "right" });

  return 36; // y inicial após o cabeçalho
}

function rodape(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 160);
    doc.text(
      `Revisão Ensino Jurídico • página ${i} de ${total}`,
      pageW - 14,
      pageH - 8,
      { align: "right" },
    );
  }
}

function nomeArquivo(titulo: string, sufixo: string) {
  const safe = titulo.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 50) || "simulado";
  return `${safe}_${sufixo}.pdf`;
}

/* ===================================================================== */
/* 1) GABARITO DE ALTERNATIVAS                                           */
/* ===================================================================== */

export async function gerarPdfGabarito(payload: PdfPayload): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const logo = await carregarLogo();

  let y = cabecalhoComLogo(doc, pageW, logo, payload.tituloSimulado);

  // Metadados
  doc.setTextColor(60, 60, 70);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (payload.nomeAluno) { doc.text(`Aluno: ${payload.nomeAluno}`, margin, y); y += 5; }
  if (payload.emailAluno) { doc.text(`E-mail: ${payload.emailAluno}`, margin, y); y += 5; }
  if (payload.dataRealizacao) {
    doc.text(
      `Realizado em: ${payload.dataRealizacao.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      margin, y,
    );
    y += 6;
  }

  // Estatísticas (apenas se mostrar_resultado)
  if (payload.mostrarResultado && payload.stats) {
    const w = pageW - margin * 2;
    doc.setFillColor(...COR_CREME);
    doc.setDrawColor(...COR_ROXO);
    doc.roundedRect(margin, y, w, 18, 2, 2, "FD");
    const itens: Array<[string, string]> = [
      ["Acertos", String(payload.stats.acertos)],
      ["Erros", String(payload.stats.erros)],
      ["Em branco", String(payload.stats.emBranco)],
      ["Aproveitamento", `${payload.stats.aproveitamento.toFixed(1)}%`],
      ["Pontuação", payload.stats.pontuacao.toFixed(2)],
    ];
    const cw = w / itens.length;
    itens.forEach(([l, v], i) => {
      const cx = margin + cw * i + cw / 2;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 90);
      doc.text(l, cx, y + 6, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...COR_ROXO);
      doc.text(v, cx, y + 13, { align: "center" });
    });
    y += 24;
  }

  // Cabeçalho da tabela do gabarito
  const w = pageW - margin * 2;
  doc.setFillColor(...COR_ROXO);
  doc.rect(margin, y, w, 9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("GABARITO DE ALTERNATIVAS", margin + w / 2, y + 6, { align: "center" });
  y += 9;

  // Grid 5 colunas (cada coluna tem dupla [n | letra])
  const cols = 5;
  const cellH = 9;
  const colW = w / cols;
  const halfW = colW / 2;

  let i = 0;
  let linhaIdx = 0;
  while (i < payload.questoes.length) {
    if (y + cellH > pageH - 16) {
      doc.addPage();
      y = cabecalhoComLogo(doc, pageW, logo, payload.tituloSimulado);
    }
    const linhaRoxa = linhaIdx % 2 === 1;
    for (let c = 0; c < cols; c++) {
      if (i >= payload.questoes.length) {
        // célula vazia
        doc.setFillColor(255, 255, 255);
        doc.rect(margin + c * colW, y, colW, cellH, "F");
        continue;
      }
      const item = payload.questoes[i];
      const numero = item.numero;
      const marc = item.marcadaId
        ? item.questao.alternativas.find((a) => a.id === item.marcadaId)?.letra ?? "—"
        : "—";

      // Célula do número — alternância POR LINHA da tabela.
      fill(doc, linhaRoxa ? COR_ROXO : COR_CREME);
      doc.rect(margin + c * colW, y, halfW, cellH, "F");
      text(doc, linhaRoxa ? [255, 255, 255] : [20, 20, 20]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(
        String(numero).padStart(2, "0"),
        margin + c * colW + halfW / 2,
        y + 6,
        { align: "center" },
      );

      // Célula da letra
      doc.setFillColor(255, 255, 255);
      doc.rect(margin + c * colW + halfW, y, halfW, cellH, "F");
      doc.setDrawColor(220, 220, 225);
      doc.setLineWidth(0.1);
      doc.rect(margin + c * colW, y, colW, cellH);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(marc, margin + c * colW + halfW + halfW / 2, y + 6, { align: "center" });

      i++;
    }
    y += cellH;
    linhaIdx++;
  }

  // Gabarito oficial (somente se permitido)
  if (payload.mostrarResultado && payload.mostrarGabarito) {
    y += 6;
    if (y > pageH - 30) { doc.addPage(); y = cabecalhoComLogo(doc, pageW, logo, payload.tituloSimulado); }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COR_ROXO);
    doc.text("Gabarito oficial", margin, y);
    y += 5;

    let j = 0;
    while (j < payload.questoes.length) {
      if (y + cellH > pageH - 16) {
        doc.addPage();
        y = cabecalhoComLogo(doc, pageW, logo, payload.tituloSimulado);
      }
      for (let c = 0; c < cols; c++) {
        if (j >= payload.questoes.length) continue;
        const item = payload.questoes[j];
        const correta = item.questao.alternativas.find((a) => a.correta)?.letra ?? "—";
        doc.setFillColor(245, 245, 250);
        doc.rect(margin + c * colW, y, halfW, cellH, "F");
        doc.setTextColor(...COR_ROXO);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(
          String(item.numero).padStart(2, "0"),
          margin + c * colW + halfW / 2,
          y + 6,
          { align: "center" },
        );
        doc.setFillColor(232, 245, 233);
        doc.rect(margin + c * colW + halfW, y, halfW, cellH, "F");
        doc.setDrawColor(220, 220, 225);
        doc.rect(margin + c * colW, y, colW, cellH);
        doc.setTextColor(22, 120, 60);
        doc.text(correta, margin + c * colW + halfW + halfW / 2, y + 6, { align: "center" });
        j++;
      }
      y += cellH;
    }
  }

  rodape(doc);
  doc.save(nomeArquivo(payload.tituloSimulado, "gabarito"));
}

/* ===================================================================== */
/* 2) PROVA COMPLETA — layout institucional premium                      */
/* ===================================================================== */

const COR_DIVISOR: [number, number, number] = [217, 217, 217];
const COR_EXPLICACAO_BG: [number, number, number] = [248, 248, 248];
const COR_VERDE_SUAVE: [number, number, number] = [226, 244, 230];
const COR_VERDE_TXT: [number, number, number] = [30, 110, 55];

export async function gerarPdfProvaCompleta(payload: PdfPayload): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const logo = await carregarLogo();

  // Layout
  const HEADER_H = 22;
  const FOOTER_H = 12;
  const MARGIN_LEFT = 20;
  const MARGIN_RIGHT = 20;
  const MARGIN_TOP = HEADER_H + 10;     // ~10mm gap após o cabeçalho
  const MARGIN_BOTTOM = FOOTER_H + 10;
  const usableW = pageW - MARGIN_LEFT - MARGIN_RIGHT;

  const FONT = "helvetica";
  const FS = 11;
  const LINE_H = 5.6; // ~1.4 line-height

  let y = MARGIN_TOP;

  const ensure = (h: number) => {
    if (y + h > pageH - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
    }
  };

  /* ---------- justify helper ---------- */
  const drawLine = (line: string, x: number, yy: number, width: number, justify: boolean) => {
    const trimmed = line.replace(/\s+$/g, "");
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (!justify || words.length < 2) {
      doc.text(trimmed, x, yy);
      return;
    }
    const wordsW = words.reduce((s, w) => s + doc.getTextWidth(w), 0);
    const gap = (width - wordsW) / (words.length - 1);
    let cx = x;
    for (const w of words) {
      doc.text(w, cx, yy);
      cx += doc.getTextWidth(w) + gap;
    }
  };

  const writeParagraph = (
    txt: string,
    opts: {
      bold?: boolean;
      size?: number;
      color?: [number, number, number];
      align?: "left" | "center" | "justify";
      x?: number;
      width?: number;
    } = {},
  ) => {
    doc.setFont(FONT, opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? FS);
    text(doc, opts.color ?? [25, 25, 30]);
    const x = opts.x ?? MARGIN_LEFT;
    const width = opts.width ?? usableW;
    const lines = doc.splitTextToSize(txt, width) as string[];
    for (let i = 0; i < lines.length; i++) {
      ensure(LINE_H);
      const isLast = i === lines.length - 1;
      if (opts.align === "center") {
        doc.text(lines[i], x + width / 2, y, { align: "center" });
      } else if (opts.align === "justify") {
        drawLine(lines[i], x, y, width, !isLast);
      } else {
        doc.text(lines[i], x, y);
      }
      y += LINE_H;
    }
  };

  const divisor = () => {
    ensure(4);
    stroke(doc, COR_DIVISOR);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_LEFT, y, pageW - MARGIN_RIGHT, y);
    y += 4;
  };

  /* ---------- topo do documento ---------- */
  // 1) Nome do Simulado (título principal, grande)
  writeParagraph(payload.tituloSimulado, {
    bold: true, size: 18, color: COR_ROXO, align: "center",
  });

  // 2) Descrição cadastrada no simulado (omitida quando inexistente)
  const descricao = payload.descricaoSimulado?.trim();
  if (descricao) {
    y += 1;
    writeParagraph(descricao, {
      bold: false, size: 11, color: [90, 90, 105], align: "center",
    });
  }

  if (payload.nomeAluno || payload.dataRealizacao) {
    y += 4;
  }

  if (payload.nomeAluno) {
    writeParagraph(`Aluno: ${payload.nomeAluno}`, { size: 10, color: [70, 70, 80], align: "left" });
  }
  if (payload.dataRealizacao) {
    writeParagraph(
      `Realizado em: ${payload.dataRealizacao.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      { size: 10, color: [70, 70, 80], align: "left" },
    );
  }

  // Estatísticas — só renderiza quando permitido. Quando bloqueadas,
  // não deixa NENHUM espaço extra (segue direto para o divisor).
  if (payload.mostrarResultado && payload.stats) {
    y += 4;
    const s = payload.stats;
    const linha = `Acertos: ${s.acertos}   |   Erros: ${s.erros}   |   Em branco: ${s.emBranco}   |   Aproveitamento: ${s.aproveitamento.toFixed(1)}%   |   Pontuação: ${s.pontuacao.toFixed(2)}`;
    const cardH = 12;
    ensure(cardH + 2);
    fill(doc, COR_CREME);
    stroke(doc, COR_ROXO);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN_LEFT, y, usableW, cardH, 2, 2, "FD");
    text(doc, COR_ROXO);
    doc.setFont(FONT, "bold");
    doc.setFontSize(10);
    doc.text(linha, MARGIN_LEFT + usableW / 2, y + cardH / 2 + 1.5, { align: "center" });
    y += cardH + 6;
  } else {
    y += 4;
  }

  divisor();
  y += 4;

  /* ---------- questões ---------- */
  for (let qi = 0; qi < payload.questoes.length; qi++) {
    const item = payload.questoes[qi];
    const { numero, questao, marcadaId } = item;
    const marcada = marcadaId ? questao.alternativas.find((a) => a.id === marcadaId) : null;
    const correta = payload.mostrarResultado && payload.mostrarGabarito
      ? questao.alternativas.find((a) => a.correta)
      : null;

    // Manter título + ao menos início do enunciado juntos
    ensure(LINE_H * 5);

    // Cabeçalho da questão
    writeParagraph(`QUESTÃO ${String(numero).padStart(2, "0")}`, {
      bold: true, size: 13, color: COR_ROXO,
    });
    y += 3;

    // Enunciado — justificado
    writeParagraph(stripMarkdown(questao.enunciado), {
      size: FS, color: [25, 25, 30], align: "justify",
    });

    y += 6; // espaço entre enunciado e alternativas

    // Alternativas
    for (const alt of questao.alternativas) {
      const isCorreta = correta?.id === alt.id;
      const conteudo = `[${alt.letra}]  ${stripMarkdown(alt.texto)}`;
      const lines = doc.splitTextToSize(conteudo, usableW - 4) as string[];
      const blockH = lines.length * LINE_H + 2;
      ensure(blockH + 2);

      if (isCorreta) {
        fill(doc, COR_VERDE_SUAVE);
        doc.rect(MARGIN_LEFT - 1, y - LINE_H + 2, usableW + 2, blockH, "F");
        text(doc, COR_VERDE_TXT);
        doc.setFont(FONT, "bold");
      } else {
        text(doc, [30, 30, 35]);
        doc.setFont(FONT, "normal");
      }
      doc.setFontSize(FS);
      for (let li = 0; li < lines.length; li++) {
        doc.text(lines[li], MARGIN_LEFT + 2, y);
        y += LINE_H;
      }
      y += 3; // 8px ≈ 3mm entre alternativas
    }

    y += 4;

    // Resposta marcada — pill roxa
    {
      const label = "Resposta Marcada:";
      const valor = marcada ? marcada.letra : "Em branco";
      doc.setFont(FONT, "bold");
      doc.setFontSize(11);
      const labelW = doc.getTextWidth(label);
      const valorTxt = ` ${valor}`;
      const valorW = doc.getTextWidth(valorTxt) + 6;
      const pillH = 8;
      ensure(pillH + 2);
      // label em texto neutro
      text(doc, [40, 40, 50]);
      doc.text(label, MARGIN_LEFT, y + pillH - 2.5);
      // pill
      fill(doc, marcada ? COR_ROXO : [150, 80, 80]);
      doc.roundedRect(MARGIN_LEFT + labelW + 3, y, valorW, pillH, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.text(valorTxt, MARGIN_LEFT + labelW + 6, y + pillH - 2.5);
      y += pillH + 6;
    }

    // Gabarito oficial
    if (correta) {
      const label = "Gabarito Oficial:";
      const valor = ` ${correta.letra}`;
      doc.setFont(FONT, "bold");
      doc.setFontSize(11);
      const labelW = doc.getTextWidth(label);
      const valorW = doc.getTextWidth(valor) + 6;
      const pillH = 8;
      ensure(pillH + 2);
      text(doc, [40, 40, 50]);
      doc.text(label, MARGIN_LEFT, y + pillH - 2.5);
      fill(doc, COR_VERDE_SUAVE);
      doc.roundedRect(MARGIN_LEFT + labelW + 3, y, valorW, pillH, 2, 2, "F");
      text(doc, COR_VERDE_TXT);
      doc.text(valor, MARGIN_LEFT + labelW + 6, y + pillH - 2.5);
      y += pillH + 6;
    }

    // Explicação
    if (payload.mostrarResultado && payload.mostrarGabarito && questao.explicacao) {
      y += 2;
      const exTxt = stripMarkdown(questao.explicacao);
      doc.setFont(FONT, "normal");
      doc.setFontSize(FS);
      const PAD_L = 10;   // espaço entre a barra roxa e o texto (~16px)
      const PAD_R = 8;
      const PAD_T = 6;
      const PAD_B = 6;
      const TITLE_GAP = 4; // espaço entre título "EXPLICAÇÃO" e o primeiro parágrafo
      const LH_EXP = 6.2;  // line-height ~1.6
      const innerW = usableW - PAD_L - PAD_R;
      const exLines = doc.splitTextToSize(exTxt, innerW) as string[];
      const headerH = 6 + TITLE_GAP;
      const bodyH = exLines.length * LH_EXP;
      const totalH = PAD_T + headerH + bodyH + PAD_B;
      ensure(Math.min(totalH, pageH - MARGIN_TOP - MARGIN_BOTTOM));

      const startY = y;
      // bloco com borda lateral roxa
      fill(doc, COR_EXPLICACAO_BG);
      doc.rect(MARGIN_LEFT, startY, usableW, totalH, "F");
      fill(doc, COR_ROXO);
      doc.rect(MARGIN_LEFT, startY, 1.5, totalH, "F");

      // título
      text(doc, COR_ROXO);
      doc.setFont(FONT, "bold");
      doc.setFontSize(11);
      doc.text("EXPLICAÇÃO", MARGIN_LEFT + PAD_L, startY + PAD_T + 4);
      y = startY + PAD_T + headerH;

      // corpo justificado dentro do bloco
      doc.setFont(FONT, "normal");
      doc.setFontSize(FS);
      text(doc, [55, 55, 65]);
      for (let li = 0; li < exLines.length; li++) {
        if (y + LH_EXP > pageH - MARGIN_BOTTOM) {
          doc.addPage();
          y = MARGIN_TOP;
          // continua o bloco na nova página
          const remainH = pageH - MARGIN_TOP - MARGIN_BOTTOM;
          fill(doc, COR_EXPLICACAO_BG);
          doc.rect(MARGIN_LEFT, y - 2, usableW, remainH + 2, "F");
          fill(doc, COR_ROXO);
          doc.rect(MARGIN_LEFT, y - 2, 1.5, remainH + 2, "F");
          y += PAD_T;
          doc.setFont(FONT, "normal");
          doc.setFontSize(FS);
          text(doc, [55, 55, 65]);
        }
        const isLast = li === exLines.length - 1;
        drawLine(exLines[li], MARGIN_LEFT + PAD_L, y + 1, innerW, !isLast);
        y += LH_EXP;
      }
      y = startY + totalH + 4;
    }

    if (qi < payload.questoes.length - 1) {
      y += 6;
      divisor();
      y += 6;
    }
  }

  /* ---------- cabeçalho + rodapé institucional em todas as páginas ---------- */
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Cabeçalho roxo
    fill(doc, COR_ROXO);
    doc.rect(0, 0, pageW, HEADER_H, "F");
    if (logo) {
      try {
        const ratio = logo.width / logo.height;
        const h = 11;
        const w = h * ratio;
        doc.addImage(logo, "PNG", MARGIN_LEFT, (HEADER_H - h) / 2, w, h);
      } catch { /* ignore */ }
    }
    doc.setFont(FONT, "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("Prova Completa", pageW - MARGIN_RIGHT, HEADER_H / 2 + 1.5, { align: "right" });

    // Rodapé roxo com número da página centralizado
    fill(doc, COR_ROXO);
    doc.rect(0, pageH - FOOTER_H, pageW, FOOTER_H, "F");
    doc.setFont(FONT, "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(`Página ${p} de ${totalPages}`, pageW / 2, pageH - FOOTER_H / 2 + 1, { align: "center" });
  }

  doc.save(nomeArquivo(payload.tituloSimulado, "prova_completa"));
}

/* ===================================================================== */
/* Compat: API antiga (escolhe modelo "completa" por padrão).            */
/* ===================================================================== */

export function gerarPdfResultado(payload: PdfPayload): void {
  void gerarPdfProvaCompleta(payload);
}
