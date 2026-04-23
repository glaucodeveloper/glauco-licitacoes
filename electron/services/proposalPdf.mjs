import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

export function buildProposalRecord({ state, tender, createdAt = new Date().toLocaleString("pt-BR") }) {
  const documents = proposalDocumentReadiness(state);
  const readiness = Math.round(
    documents.reduce((total, doc) => total + Number(doc.confidence || 0), 0) / Math.max(1, documents.length)
  );
  return {
    id: `proposal-${tender.id}-${Date.now()}`,
    tenderId: tender.id,
    title: tender.title,
    orgao: tender.orgao,
    value: tender.value,
    editalUrl: tender.editalUrl || tender.editalPdfUrl || "",
    status: readiness >= 70 ? "Registrada" : "Em saneamento",
    readiness,
    createdAt,
    documents,
    argument: tender.magnitudeArgument || tender.reason || "Proposta criada a partir do radar Bahia e inventario documental."
  };
}

export async function generateProposalPdf({ state, proposal, downloadsDir }) {
  await fs.mkdir(downloadsDir, { recursive: true });
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const letterheadPath = await generateLetterheadPdf({ state, outputDir: path.join(downloadsDir, "glauco-letterheads") });
  addPriceProposalFirstPage(pdf, { state, proposal, regular, bold, serif, serifBold });
  const hasManualDeclarations = Boolean(state.proposalProcess?.manualDeclarationFiles?.length);
  if (!hasManualDeclarations) {
    addDeclarationPages(pdf, { state, proposal, regular, bold, serif, serifBold });
  }

  const annexes = await collectProposalAnnexes(state);

  for (const annex of annexes) {
    try {
      const bytes = await fs.readFile(annex.filePath);
      const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = await pdf.copyPages(source, source.getPageIndices());
      pages.forEach((page) => pdf.addPage(page));
    } catch (error) {
      addTextPages(pdf, [`Falha ao incorporar conteudo do documento ${annex.title}.`, String(error?.message || error)], { regular, bold, serif, serifBold, state });
    }
  }

  const safeTitle = slug(`${proposal.tenderId}-${proposal.title}`).slice(0, 90);
  const outputPath = path.join(downloadsDir, `Proposta completa ${safeTitle}.pdf`);
  await fs.writeFile(outputPath, await pdf.save());
  return { outputPath, letterheadPath };
}

async function collectProposalAnnexes(state) {
  const seen = new Set();
  const annexes = [];
  const push = (title, filePath, priority = 50) => {
    if (!filePath || path.extname(filePath).toLowerCase() !== ".pdf") return;
    const key = path.resolve(filePath).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    annexes.push({ title, filePath, priority });
  };

  const manualDeclarations = state.proposalProcess?.manualDeclarationFiles || [];
  for (const file of manualDeclarations) {
    push(file.name || labelFromFileName(file.localPath), file.localPath, 1);
  }

  for (const file of Object.values(state.proposalProcess?.requirementFiles || {})) {
    push(file.label || file.name, file.localPath, 2);
  }

  const inventoryDir = path.join(state.setup?.userRoot || "", "imports", "confidence-patagonia-inventory");
  try {
    const files = await fs.readdir(inventoryDir);
    for (const name of files.filter((item) => item.toLowerCase().endsWith(".pdf")).sort()) {
      const lower = name.toLowerCase();
      const isDeclaration =
        lower.includes("declar") ||
        lower.includes("proposta_preco") ||
        lower.includes("representante") ||
        lower.includes("autorizacoes");
      if (!isDeclaration) push(labelFromFileName(name), path.join(inventoryDir, name), 20);
    }
  } catch {
    // Inventario completo pode ainda nao existir no workspace.
  }

  for (const doc of state.documents || []) {
    push(doc.name, doc.file?.localPath, 10);
  }

  return annexes.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
}

export async function generateLetterheadPdf({ state, outputDir }) {
  await fs.mkdir(outputDir, { recursive: true });
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  drawLetterhead(page, { state, regular, bold });
  const outputPath = path.join(outputDir, "papel-timbrado-confidence.pdf");
  await fs.writeFile(outputPath, await pdf.save());
  return outputPath;
}

function renderSectionText(sectionId, prompt, ctx) {
  if (sectionId === "price_opening") {
    return `${ctx.empresa}, com sede em ${ctx.endereco}, inscrita no CNPJ sob n. ${ctx.cnpj}, neste ato representada por ${ctx.representante}, RG n. ${ctx.rg} e CPF n. ${ctx.cpf}, vem, por meio desta, apresentar proposta de preco para o processo licitatorio acima especificado. Valor Global da Proposta de Preco: ${ctx.valor} (${ctx.valorExtenso}).`;
  }
  if (sectionId === "independent_proposal") {
    return "Declaramos, sob as penas da lei, que a proposta apresentada foi elaborada de maneira independente; que seu conteudo nao foi informado, discutido ou recebido de outro participante potencial ou de fato; que nao houve tentativa de influenciar decisao de concorrente; que o conteudo nao sera comunicado antes da adjudicacao; e que nao ha impedimento legal conhecido para participacao no certame, mantendo ciencia integral do teor desta declaracao.";
  }
  if (sectionId === "document_truth") {
    return "Declaramos a veracidade, autenticidade e correspondencia dos documentos anexados, assumindo responsabilidade administrativa, civil e penal pelas informacoes apresentadas, inclusive quanto a titularidade, validade, poderes de representacao, vinculos tecnicos e coerencia dos anexos com os requisitos do edital.";
  }
  if (sectionId === "execution_commitment") {
    return "Declaramos compromisso de cumprir integralmente o objeto, os prazos, as condicoes de habilitacao, os requisitos tecnicos, as obrigacoes documentais e a manutencao da proposta, observadas as regras do edital e seus anexos.";
  }
  if (sectionId === "signature") {
    return `${ctx.cidade} - ${ctx.uf}, ${ctx.data}\n\n${ctx.empresa} CNPJ: ${ctx.cnpj}\n${ctx.representante} CPF: ${ctx.cpf}\nRG: ${ctx.rg}`;
  }
  return replaceTokens(prompt, ctx);
}

function proposalDeclarationTemplates(ctx) {
  const companyIntro = `${ctx.empresa}, com sede nesta cidade a ${ctx.endereco}, inscrita no CNPJ sob n. ${ctx.cnpj}, neste ato representada por seu representante legal o Sr ${ctx.representante}, portador da cedula de identidade RG sob n. ${ctx.rg} e CPF sob n. ${ctx.cpf}`;
  return [
    {
      title: "DECLARACAO DE ELABORACAO INDEPENDENTE DE PROPOSTA E DE INEXISTENCIA DE IMPEDIMENTO A PARTICIPACAO NO CERTAME",
      body:
        `${companyIntro}, para fins de participacao no certame licitatorio acima identificado, declaro, sob as penas da lei, em especial o art. 299 do Codigo Penal Brasileiro, que: ` +
        "a) a proposta apresentada para participar desta licitacao foi elaborada de maneira independente por mim e o conteudo da proposta nao foi, no todo ou em parte, direta ou indiretamente, informado, discutido ou recebido de qualquer outro participante potencial ou de fato desta licitacao, por qualquer meio ou por qualquer pessoa; " +
        "b) a intencao de apresentar a proposta elaborada para participar desta licitacao nao foi informada, discutida ou recebida de qualquer outro participante potencial ou de fato desta licitacao, por qualquer meio ou por qualquer pessoa; " +
        "c) que nao tentei, por qualquer meio ou por qualquer pessoa, influir na decisao de qualquer outro participante potencial ou de fato desta licitacao quanto a participar ou nao dela; " +
        "d) que o conteudo da proposta apresentada para participar desta licitacao nao sera, no todo ou em parte, direta ou indiretamente, comunicado ou discutido com qualquer outro participante potencial ou de fato desta licitacao antes da adjudicacao do objeto; " +
        "e) que o conteudo da proposta apresentada para participar desta licitacao nao foi, no todo ou em parte, direta ou indiretamente, informado, discutido ou recebido de qualquer integrante do orgao licitante antes da abertura oficial das propostas; e " +
        "f) que estou plenamente ciente do teor e da extensao desta declaracao e que detenho plenos poderes e informacoes para firma-la. Declaro, ainda, para os efeitos do art. 299 do Codigo Penal Brasileiro, nao estar sujeito as hipoteses de impedimento de participacao previstas na legislacao aplicavel."
    },
    {
      title: "DECLARACAO DE VERACIDADE DE DOCUMENTOS",
      body:
        `${companyIntro}, DECLARA, para fins de participacao no certame em epigrafe, a veracidade de todos os documentos apresentados, assumindo responsabilidade administrativa, civil e penal pela autenticidade, validade, titularidade e correspondencia das informacoes prestadas.`
    },
    {
      title: "DECLARACAO DE DISPONIBILIDADE TECNICA E EQUIPAMENTOS",
      body:
        `${companyIntro}, declara, em observancia aos requisitos de qualificacao tecnica do instrumento convocatorio, que dispora das instalacoes, do aparelhamento, da equipe tecnica, dos responsaveis e dos meios operacionais necessarios a execucao do objeto, estando ciente de que a declaracao falsa caracteriza ilicito administrativo e sujeita a empresa as sancoes legais.`
    },
    {
      title: "DECLARACAO DE PLENO CONHECIMENTO DE REQUISITOS TECNICOS",
      body:
        `${companyIntro}, em cumprimento ao Instrumento Convocatorio acima identificado, DECLARA, sob as penas da lei, pleno conhecimento e atendimento as exigencias de habilitacao e aos requisitos tecnicos do edital, ciente das sancoes passiveis de aplicacao em caso de descumprimento.`
    },
    {
      title: "DECLARACAO DE PROTECAO AO TRABALHO DO MENOR",
      body:
        `${companyIntro}, em cumprimento ao Instrumento Convocatorio acima identificado, declara, sob as penas da lei, em atendimento ao inciso XXXIII do art. 7o da Constituicao Federal, que nao emprega menor de 18 anos em trabalho noturno, perigoso ou insalubre, nem menor de 16 anos, salvo na condicao de aprendiz, a partir de 14 anos.`
    },
    {
      title: "DECLARACAO DE RESERVA DE CARGOS PARA PESSOA COM DEFICIENCIA OU REABILITADO DA PREVIDENCIA SOCIAL",
      body:
        `${companyIntro}, DECLARA que cumpre, quando aplicavel, a reserva de cargos prevista em lei para pessoa com deficiencia ou reabilitado da Previdencia Social e que atende as regras de acessibilidade previstas na legislacao.`
    }
  ];
}

function proposalContext(state, proposal) {
  return {
    modalidade: proposal.title?.split(" ")?.slice(0, 2).join(" ") || "Concorrencia Eletronica",
    numero: proposal.title?.match(/[A-Z]{2}\d+\/\d{4}|\d+\/\d{4}/i)?.[0] || proposal.tenderId || "A definir",
    processo: proposal.tenderId || "A definir",
    empresa: state.company?.legalName || state.company?.name || "Empresa nao informada",
    endereco:
      state.company?.address ||
      "Avenida Goiabeiras II, Fracao 8, Area Rural, Residencial Colina do Sul, Vitoria da Conquista, Bahia, CEP: 45.099-899",
    cnpj: state.company?.cnpj || "28.863.854/0001-10",
    representante: state.company?.representative?.name || "Alberto Marlon de Oliveira",
    rg: state.company?.representative?.rg || "4.086.238-02 SSP/BA",
    cpf: state.company?.representative?.cpf || "648.403.875-91",
    valor: formatMoney(proposal.value),
    valorExtenso: "valor por extenso a confirmar pelo operador antes do protocolo",
    cidade: state.company?.city || "Vitoria da Conquista",
    uf: state.company?.state || "BA",
    data: new Date().toLocaleDateString("pt-BR")
  };
}

function proposalDocumentReadiness(state) {
  return (state.documents || []).map((doc) => ({
    id: doc.id,
    name: doc.name,
    kind: doc.kind,
    status: doc.status,
    confidence: Number(doc.confidence || 0),
    ready: Boolean(doc.file) && Number(doc.confidence || 0) >= 70,
    fileName: doc.file?.name || "",
    filePath: doc.file?.localPath || ""
  }));
}

function addTextPages(pdf, lines, { regular, bold, serif, serifBold, state }) {
  let page = pdf.addPage([595.28, 841.89]);
  drawLetterhead(page, { state, regular, bold });
  const margin = 90;
  const contentWidth = 414;
  let y = 688;
  for (const rawLine of lines) {
    const text = String(rawLine || "");
    const isTitle = text === text.toUpperCase() && text.length < 60 && text.trim().length > 0;
    if (isTitle) {
      if (y < 104) {
        page = pdf.addPage([595.28, 841.89]);
        drawLetterhead(page, { state, regular, bold });
        y = 688;
      }
      drawCenteredText(page, text, 595.28 / 2, y, { font: serifBold, size: 13, color: rgb(0, 0, 0) });
      y -= 28;
      continue;
    }
    if (!text.trim()) {
      y -= 12;
      continue;
    }
    const result = drawJustifiedParagraph(page, text, {
      x: margin,
      y,
      width: contentWidth,
      size: 11.5,
      font: serif,
      color: rgb(0, 0, 0),
      bottomY: 104,
      onNewPage: () => {
        page = pdf.addPage([595.28, 841.89]);
        drawLetterhead(page, { state, regular, bold });
        return { page, y: 688 };
      }
    });
    page = result.page;
    y = result.y - 12;
  }
}

function addPriceProposalFirstPage(pdf, { state, proposal, regular, bold, serif, serifBold }) {
  const page = pdf.addPage([595.28, 841.89]);
  drawLetterhead(page, { state, regular, bold });
  const ctx = proposalContext(state, proposal);
  const centerX = 595.28 / 2;
  const black = rgb(0, 0, 0);

  drawCenteredText(page, "PROPOSTA DE PRECO", centerX, 696, { font: serifBold, size: 16, color: black });
  page.drawText(`Modalidade de Licitacao: ${ctx.modalidade}`, { x: 273, y: 660, size: 9.5, font: serifBold, color: black });
  page.drawText(`Numero: ${ctx.numero}`, { x: 402, y: 646, size: 9.5, font: serifBold, color: black });
  page.drawText(`PROCESSO ADMINISTRATIVO N. ${ctx.processo}`, { x: 218, y: 632, size: 9.5, font: serifBold, color: black });
  page.drawLine({ start: { x: 257, y: 620 }, end: { x: 536, y: 620 }, thickness: 0.8, color: black });

  const body =
    `${ctx.empresa}, com sede nesta cidade a ${ctx.endereco}, inscrita no CNPJ sob n. ${ctx.cnpj}, neste ato representada por seu representante legal o Sr ${ctx.representante}, portador da cedula de identidade RG sob n. ${ctx.rg} e CPF sob n. ${ctx.cpf}, vem, por meio desta, apresentar a proposta de preco para o processo licitatorio acima especificado.`;
  drawRichParagraph(page, body, {
    x: 90,
    y: 590,
    width: 414,
    size: 11.5,
    regular: serif,
    bold: serifBold,
    boldTerms: [ctx.empresa, ctx.representante]
  });

  const valueText = `Valor Global da Proposta de Preco: ${ctx.valor} (${ctx.valorExtenso}).`;
  drawRichParagraph(page, valueText, {
    x: 90,
    y: 438,
    width: 414,
    size: 11.5,
    regular: serif,
    bold: serifBold,
    boldTerms: [ctx.valor]
  });

  page.drawText(`${ctx.cidade} — ${ctx.uf}, ${ctx.data}`, { x: 90, y: 326, size: 11.5, font: serif, color: black });
  drawGovSignatureMark(page, { x: 220, y: 244, regular, bold });
  page.drawLine({ start: { x: 171, y: 204 }, end: { x: 442, y: 204 }, thickness: 0.8, color: black });
  drawCenteredText(page, `${ctx.empresa} CNPJ: ${ctx.cnpj}`, centerX, 176, { font: serif, size: 11.5, color: black });
  drawCenteredText(page, `${ctx.representante} CPF: ${ctx.cpf}`, centerX, 162, { font: serif, size: 11.5, color: black });
  drawCenteredText(page, `RG: ${ctx.rg}`, centerX, 148, { font: serif, size: 11.5, color: black });
}

function addDeclarationPages(pdf, { state, proposal, regular, bold, serif, serifBold }) {
  const ctx = proposalContext(state, proposal);
  for (const declaration of proposalDeclarationTemplates(ctx)) {
    addFormalDeclarationPage(pdf, { declaration, ctx, state, regular, bold, serif, serifBold });
  }
}

function addFormalDeclarationPage(pdf, { declaration, ctx, state, regular, bold, serif, serifBold }) {
  let page = pdf.addPage([595.28, 841.89]);
  drawLetterhead(page, { state, regular, bold });
  const centerX = 595.28 / 2;
  const black = rgb(0, 0, 0);

  drawWrappedCenteredTitle(page, declaration.title, centerX, 700, { font: serifBold, size: 13.5, color: black, maxWidth: 430 });
  page.drawText(`Modalidade de Licitacao: ${ctx.modalidade}`, { x: 273, y: 650, size: 9.5, font: serifBold, color: black });
  page.drawText(`Numero: ${ctx.numero}`, { x: 402, y: 636, size: 9.5, font: serifBold, color: black });
  page.drawText(`PROCESSO ADMINISTRATIVO N. ${ctx.processo}`, { x: 218, y: 622, size: 9.5, font: serifBold, color: black });
  page.drawLine({ start: { x: 257, y: 610 }, end: { x: 536, y: 610 }, thickness: 0.8, color: black });

  const result = drawJustifiedParagraph(page, declaration.body, {
    x: 90,
    y: 575,
    width: 414,
    size: 11.5,
    font: serif,
    color: black,
    bottomY: 182,
    onNewPage: () => {
      page = pdf.addPage([595.28, 841.89]);
      drawLetterhead(page, { state, regular, bold });
      return { page, y: 688 };
    }
  });
  page = result.page;

  page.drawText(`${ctx.cidade} — ${ctx.uf}, ${ctx.data}`, { x: 90, y: 158, size: 11.5, font: serif, color: black });
  page.drawLine({ start: { x: 171, y: 116 }, end: { x: 442, y: 116 }, thickness: 0.8, color: black });
  drawCenteredText(page, `${ctx.empresa} CNPJ: ${ctx.cnpj}`, centerX, 92, { font: serif, size: 11.5, color: black });
  drawCenteredText(page, `${ctx.representante} CPF: ${ctx.cpf}`, centerX, 78, { font: serif, size: 11.5, color: black });
  drawCenteredText(page, `RG: ${ctx.rg}`, centerX, 64, { font: serif, size: 11.5, color: black });
}

function drawLetterhead(page, { state, regular, bold }) {
  const blue = rgb(0.06, 0.29, 0.52);
  const paleBlue = rgb(0.62, 0.76, 0.85);
  const dark = rgb(0.04, 0.17, 0.27);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const border = { x: 22, y: 14, width: 551.28, height: 804 };

  page.drawRectangle({
    x: border.x,
    y: border.y,
    width: border.width,
    height: border.height,
    borderWidth: 0.75,
    borderColor: blue,
    color: rgb(1, 1, 1)
  });

  drawConfidenceLogo(page, {
    centerX: pageWidth / 2,
    topY: pageHeight - 36,
    regular,
    bold,
    blue,
    paleBlue,
    dark
  });

  const leftX = 84;
  const rightX = 380;
  const footerY = 36;
  const footer = letterheadFooter(state);
  page.drawText(footer.address1, { x: leftX, y: footerY + 22, size: 5.8, font: bold, color: dark });
  page.drawText(footer.address2, { x: leftX, y: footerY + 9, size: 5.8, font: bold, color: dark });
  page.drawText(footer.phone, { x: rightX + 72, y: footerY + 22, size: 5.8, font: bold, color: dark });
  page.drawText(footer.email, { x: rightX, y: footerY + 9, size: 5.8, font: bold, color: dark });
}

function drawConfidenceLogo(page, { centerX, topY, regular, bold, blue, paleBlue, dark }) {
  const markY = topY - 18;
  page.drawCircle({ x: centerX, y: markY, size: 18, color: paleBlue, opacity: 0.42 });
  page.drawCircle({ x: centerX, y: markY, size: 11, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: centerX - 2.4, y: markY - 19, width: 4.8, height: 38, color: rgb(1, 1, 1), rotate: degrees(45) });
  page.drawCircle({ x: centerX + 6, y: markY + 1, size: 8, color: blue, opacity: 0.55 });
  page.drawCircle({ x: centerX + 7, y: markY + 1, size: 4.6, color: rgb(1, 1, 1) });

  page.drawText("CONFIDENCE", {
    x: centerX - 50,
    y: topY - 62,
    size: 18,
    font: bold,
    color: blue
  });
  page.drawText("CONSTRUTORA", {
    x: centerX - 23,
    y: topY - 72,
    size: 5.8,
    font: regular,
    color: dark
  });
}

function letterheadFooter(state) {
  const fallback = {
    address1: "Avenida Goiabeiras II, Fracao 8, Area Rural, Residencial Colina do Sul",
    address2: "Vitoria da Conquista, Bahia. CEP: 45.099-899.",
    phone: "(77) 98804-3876",
    email: "contato@construtoraconfidence.com"
  };
  const footer = state.company?.letterhead?.footer || "";
  if (!footer) return fallback;
  const parts = footer.split("|").map((item) => item.trim()).filter(Boolean);
  return {
    address1: parts[0] || fallback.address1,
    address2: parts[1] || fallback.address2,
    phone: parts.find((item) => /\(\d{2}\)|\d{4,}/.test(item)) || fallback.phone,
    email: parts.find((item) => item.includes("@")) || fallback.email
  };
}

function drawCenteredText(page, text, centerX, y, { font, size, color }) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: centerX - width / 2, y, size, font, color });
}

function drawWrappedCenteredTitle(page, text, centerX, y, { font, size, color, maxWidth }) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  lines.forEach((line, index) => drawCenteredText(page, line, centerX, y - index * (size * 1.2), { font, size, color }));
}

function drawRichParagraph(page, text, { x, y, width, size, regular, bold, boldTerms = [] }) {
  const words = String(text || "").split(/\s+/);
  const spaceWidth = regular.widthOfTextAtSize(" ", size);
  let cursorX = x;
  let cursorY = y;
  for (const word of words) {
    const clean = word.replace(/[,.]/g, "");
    const isBold = boldTerms.some((term) => term && String(term).split(/\s+/).includes(clean));
    const font = isBold ? bold : regular;
    const wordWidth = font.widthOfTextAtSize(word, size);
    if (cursorX + wordWidth > x + width) {
      cursorX = x;
      cursorY -= size * 1.35;
    }
    page.drawText(word, { x: cursorX, y: cursorY, size, font, color: rgb(0, 0, 0) });
    cursorX += wordWidth + spaceWidth;
  }
}

function drawJustifiedParagraph(page, text, { x, y, width, size, font, color, bottomY, onNewPage }) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = [];
  for (const word of words) {
    const next = [...current, word];
    const nextWidth = font.widthOfTextAtSize(next.join(" "), size);
    if (nextWidth > width && current.length) {
      lines.push(current);
      current = [word];
    } else {
      current = next;
    }
  }
  if (current.length) lines.push(current);

  let activePage = page;
  let cursorY = y;
  const lineHeight = size * 1.35;
  lines.forEach((line, index) => {
    if (cursorY < bottomY) {
      const next = onNewPage();
      activePage = next.page;
      cursorY = next.y;
    }
    const isLast = index === lines.length - 1 || line.length === 1;
    const textWidth = font.widthOfTextAtSize(line.join(" "), size);
    const gap = isLast ? font.widthOfTextAtSize(" ", size) : (width - textWidth) / Math.max(1, line.length - 1) + font.widthOfTextAtSize(" ", size);
    let cursorX = x;
    line.forEach((word) => {
      activePage.drawText(word, { x: cursorX, y: cursorY, size, font, color });
      cursorX += font.widthOfTextAtSize(word, size) + gap;
    });
    cursorY -= lineHeight;
  });
  return { page: activePage, y: cursorY };
}

function drawGovSignatureMark(page, { x, y, regular, bold }) {
  page.drawText("gov", { x, y, size: 15, font: bold, color: rgb(0.08, 0.42, 0.75) });
  page.drawText(".br", { x: x + 26, y, size: 15, font: bold, color: rgb(0.95, 0.62, 0.05) });
  page.drawText("Documento assinado digitalmente", { x: x + 58, y: y + 8, size: 4.8, font: regular, color: rgb(0.15, 0.15, 0.15) });
  page.drawText("ALBERTO MARLON DE OLIVEIRA", { x: x + 58, y: y + 1, size: 4.8, font: bold, color: rgb(0.15, 0.15, 0.15) });
  page.drawText("Data e hora conforme plataforma oficial", { x: x + 58, y: y - 6, size: 4.2, font: regular, color: rgb(0.15, 0.15, 0.15) });
}

function replaceTokens(text, ctx) {
  return String(text || "").replace(/\{\{(\w+)\}\}/g, (_, key) => ctx[key] || "");
}

function labelFromFileName(name) {
  return String(name || "")
    .replace(/^\d+_/, "")
    .replace(/\.pdf$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function wrap(text, width) {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function slug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}
