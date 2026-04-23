import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const downloadsDir = path.join(os.homedir(), "Downloads");
const sourcePdf = process.argv[2] || (await findSourcePdf(downloadsDir));

const sourceAbstract =
  path.join(downloadsDir, "confidence_patagonia_abstracao_documental.md");
const sourceTemplate =
  path.join(downloadsDir, "template_sistema_documental_confidence.yml");

const outputs = [
  path.join(repoRoot, "data", "imports", "confidence-patagonia"),
  path.join(
    process.env.APPDATA || "C:\\Users\\usuario\\AppData\\Roaming",
    "glauco-licitacoes-electron",
    "workspace",
    "imports",
    "confidence-patagonia",
  ),
];

const documents = [
  {
    id: "principal-01",
    folder: "00_principais",
    file: "01_proposta_preco.pdf",
    title: "Proposta de preco",
    kind: "proposta",
    pages: [1, 1],
    platformCategory: "proposta",
    role: "Abre o dossie e amarra proponente, certame e valor ofertado.",
  },
  {
    id: "declaracao-01",
    folder: "00_principais",
    file: "02_declaracao_independencia_inexistencia_impedimento.pdf",
    title: "Declaracao de elaboracao independente e inexistencia de impedimento",
    kind: "declaracao",
    pages: [2, 3],
    platformCategory: "regularidade",
    role: "Registra integridade da proposta e ausencia de impedimento.",
  },
  {
    id: "declaracao-02",
    folder: "00_principais",
    file: "03_declaracao_veracidade_documentos.pdf",
    title: "Declaracao de veracidade de documentos",
    kind: "declaracao",
    pages: [4, 4],
    platformCategory: "regularidade",
    role: "Declara responsabilidade pela autenticidade documental.",
  },
  {
    id: "declaracao-03",
    folder: "00_principais",
    file: "04_declaracao_disponibilidade_tecnica_equipamentos.pdf",
    title: "Declaracao de disponibilidade tecnica e equipamentos",
    kind: "declaracao_tecnica",
    pages: [5, 6],
    platformCategory: "tecnico",
    role: "Declara disponibilidade operacional para executar o objeto.",
  },
  {
    id: "financeiro-01",
    folder: "00_principais",
    file: "05_demonstrativo_disponibilidade_financeira_liquida.pdf",
    title: "Demonstrativo da disponibilidade financeira liquida",
    kind: "financeiro",
    pages: [7, 7],
    platformCategory: "financeiro",
    role: "Demonstra capacidade financeira liquida para absorver o contrato.",
  },
  {
    id: "financeiro-02",
    folder: "00_principais",
    file: "06_declaracao_compromissos_assumidos.pdf",
    title: "Declaracao de compromissos assumidos",
    kind: "financeiro",
    pages: [8, 8],
    platformCategory: "financeiro",
    role: "Informa compromissos assumidos que impactam disponibilidade.",
  },
  {
    id: "tecnico-00",
    folder: "00_principais",
    file: "07_comprovacao_aptidao_desempenho.pdf",
    title: "Comprovacao de aptidao para desempenho",
    kind: "declaracao_tecnica",
    pages: [9, 9],
    platformCategory: "tecnico",
    role: "Introduz a camada de qualificacao tecnica do dossie.",
  },
  {
    id: "financeiro-03",
    folder: "00_principais",
    file: "08_declaracao_patrimonio_liquido.pdf",
    title: "Declaracao de patrimonio liquido",
    kind: "financeiro",
    pages: [10, 10],
    platformCategory: "financeiro",
    role: "Declara patrimonio liquido para habilitacao economico-financeira.",
  },
  {
    id: "anexo-01",
    folder: "01_institucional_cadastral",
    file: "anexo_01_cnh_representante_legal.pdf",
    title: "CNH do representante legal",
    kind: "identificacao",
    pages: [11, 11],
    platformCategory: "cadastro",
    role: "Identifica o representante legal vinculado ao pacote.",
  },
  {
    id: "anexo-02",
    folder: "01_institucional_cadastral",
    file: "anexo_02_crc.pdf",
    title: "Certificado de Registro Cadastral - CRC",
    kind: "certidao",
    pages: [12, 12],
    platformCategory: "regularidade",
    role: "Comprova cadastro do fornecedor.",
  },
  {
    id: "anexo-03",
    folder: "01_institucional_cadastral",
    file: "anexo_03_situacao_cadastral_fornecedor.pdf",
    title: "Situacao cadastral do fornecedor",
    kind: "cadastro",
    pages: [13, 14],
    platformCategory: "regularidade",
    role: "Mostra situacao cadastral e painel de documentos/validade.",
  },
  {
    id: "anexo-04",
    folder: "01_institucional_cadastral",
    file: "anexo_04_certidao_falencia_concordata.pdf",
    title: "Certidao estadual de falencia e concordata",
    kind: "certidao",
    pages: [15, 15],
    platformCategory: "regularidade",
    role: "Comprova ausencia de falencia, concordata e recuperacao judicial.",
  },
  {
    id: "anexo-05",
    folder: "01_institucional_cadastral",
    file: "anexo_05_certidao_crea_pessoa_juridica.pdf",
    title: "Certidao CREA pessoa juridica",
    kind: "certidao_tecnica",
    pages: [16, 16],
    platformCategory: "tecnico",
    role: "Comprova registro e quitacao da empresa no CREA-BA.",
  },
  {
    id: "anexo-06",
    folder: "02_tecnico_engenharia_civil",
    file: "anexo_06_cat_emily_almeida_pires.pdf",
    title: "CAT com registro de atestado - Emily Almeida Pires",
    kind: "cat",
    pages: [17, 18],
    platformCategory: "cat",
    role: "Comprova acervo tecnico da responsavel civil.",
  },
  {
    id: "anexo-07",
    folder: "02_tecnico_engenharia_civil",
    file: "anexo_07_atestado_cat_engenharia_civil.pdf",
    title: "Atestado vinculado a CAT da Engenheira Civil",
    kind: "atestado",
    pages: [19, 28],
    platformCategory: "cat",
    role: "Evidencia experiencia aderente da responsavel civil.",
  },
  {
    id: "anexo-08",
    folder: "02_tecnico_engenharia_civil",
    file: "anexo_08_cao_empresa.pdf",
    title: "Certidao de Acervo Operacional da empresa",
    kind: "cao",
    pages: [29, 29],
    platformCategory: "tecnico",
    role: "Comprova acervo operacional da pessoa juridica.",
  },
  {
    id: "anexo-09",
    folder: "02_tecnico_engenharia_civil",
    file: "anexo_09_contrato_vinculacao_engenharia_civil.pdf",
    title: "Contrato de vinculacao da Engenheira Civil",
    kind: "contrato_vinculacao",
    pages: [30, 32],
    platformCategory: "responsavel_tecnico",
    role: "Vincula a profissional civil a empresa licitante.",
  },
  {
    id: "anexo-10",
    folder: "02_tecnico_engenharia_civil",
    file: "anexo_10_autorizacao_engenheira_civil.pdf",
    title: "Autorizacao individual da Engenheira Civil",
    kind: "autorizacao",
    pages: [33, 33],
    platformCategory: "responsavel_tecnico",
    role: "Autoriza uso da responsavel tecnica civil na proposta.",
  },
  {
    id: "anexo-11",
    folder: "02_tecnico_engenharia_civil",
    file: "anexo_11_certidao_crea_pf_emily.pdf",
    title: "Certidao CREA pessoa fisica - Emily Almeida Pires",
    kind: "certidao_tecnica",
    pages: [34, 34],
    platformCategory: "responsavel_tecnico",
    role: "Comprova registro e quitacao da responsavel civil.",
  },
  {
    id: "anexo-12",
    folder: "03_tecnico_engenharia_eletrica",
    file: "anexo_12_autorizacao_engenheiro_eletricista.pdf",
    title: "Autorizacao individual do Engenheiro Eletricista",
    kind: "autorizacao",
    pages: [35, 35],
    platformCategory: "responsavel_tecnico",
    role: "Autoriza uso do responsavel tecnico eletricista na proposta.",
  },
  {
    id: "anexo-13",
    folder: "03_tecnico_engenharia_eletrica",
    file: "anexo_13_cat_paulo_moreira.pdf",
    title: "CAT com registro de atestado - Paulo Moreira Mota da Silva",
    kind: "cat",
    pages: [36, 36],
    platformCategory: "cat",
    role: "Comprova acervo tecnico do responsavel eletricista.",
  },
  {
    id: "anexo-14",
    folder: "03_tecnico_engenharia_eletrica",
    file: "anexo_14_atestado_cat_engenharia_eletrica.pdf",
    title: "Atestado vinculado a CAT do Engenheiro Eletricista",
    kind: "atestado",
    pages: [37, 45],
    platformCategory: "cat",
    role: "Evidencia experiencia aderente do responsavel eletricista.",
  },
  {
    id: "anexo-15",
    folder: "03_tecnico_engenharia_eletrica",
    file: "anexo_15_contrato_vinculacao_engenharia_eletrica.pdf",
    title: "Contrato de vinculacao do Engenheiro Eletricista",
    kind: "contrato_vinculacao",
    pages: [46, 47],
    platformCategory: "responsavel_tecnico",
    role: "Vincula o profissional eletricista a empresa licitante.",
  },
  {
    id: "anexo-16",
    folder: "03_tecnico_engenharia_eletrica",
    file: "anexo_16_certidao_crea_pf_paulo.pdf",
    title: "Certidao CREA pessoa fisica - Paulo Moreira Mota da Silva",
    kind: "certidao_tecnica",
    pages: [48, 49],
    platformCategory: "responsavel_tecnico",
    role: "Comprova registro e quitacao do responsavel eletricista.",
  },
  {
    id: "final-01",
    folder: "04_declaracoes_finais",
    file: "01_declaracao_pleno_conhecimento_requisitos_tecnicos.pdf",
    title: "Declaracao de pleno conhecimento de requisitos tecnicos",
    kind: "declaracao",
    pages: [50, 50],
    platformCategory: "regularidade",
    role: "Fecha aderencia tecnica declarada ao edital.",
  },
  {
    id: "final-02",
    folder: "04_declaracoes_finais",
    file: "02_declaracao_protecao_trabalho_menor.pdf",
    title: "Declaracao de protecao ao trabalho do menor",
    kind: "declaracao",
    pages: [51, 51],
    platformCategory: "regularidade",
    role: "Declara cumprimento de regra trabalhista legal.",
  },
  {
    id: "final-03",
    folder: "04_declaracoes_finais",
    file: "03_declaracao_reserva_cargos_pcd_reabilitado.pdf",
    title: "Declaracao de reserva de cargos PCD/reabilitado",
    kind: "declaracao",
    pages: [52, 52],
    platformCategory: "regularidade",
    role: "Declara cumprimento de reserva legal de cargos.",
  },
];

async function findSourcePdf(downloadsPath) {
  const files = await readdir(downloadsPath);
  const file = files.find(
    (name) =>
      name.startsWith("Confidence Documenta") &&
      name.includes("Patag") &&
      name.toLowerCase().endsWith(".pdf"),
  );

  if (!file) {
    throw new Error(`PDF Confidence/Patagonia nao encontrado em ${downloadsPath}.`);
  }

  return path.join(downloadsPath, file);
}

async function splitPdf(targetRoot) {
  await mkdir(targetRoot, { recursive: true });
  const sourceBytes = await readFile(sourcePdf);
  const sourceDoc = await PDFDocument.load(sourceBytes);
  const pageCount = sourceDoc.getPageCount();

  if (pageCount < 52) {
    throw new Error(`PDF inesperado: ${pageCount} paginas, esperado pelo menos 52.`);
  }

  const manifest = {
    packageId: "confidence-patagonia-001-2025",
    sourcePdf,
    title: "Confidence Documentacao completa Patagonia",
    context: "Concorrencia Eletronica 001/2025",
    administrativeProcess: "069.1475.2024.0003715-28",
    proponent: "Confidence Construtora Ltda",
    generatedAt: new Date().toISOString(),
    totalSourcePages: pageCount,
    documents: [],
  };

  for (const item of documents) {
    const [start, end] = item.pages;
    const outputDoc = await PDFDocument.create();
    const indexes = Array.from({ length: end - start + 1 }, (_, index) => start - 1 + index);
    const copiedPages = await outputDoc.copyPages(sourceDoc, indexes);
    copiedPages.forEach((page) => outputDoc.addPage(page));

    const folder = path.join(targetRoot, item.folder);
    await mkdir(folder, { recursive: true });
    const relativePath = path.join(item.folder, item.file).replaceAll("\\", "/");
    const outputPath = path.join(targetRoot, relativePath);
    await writeFile(outputPath, await outputDoc.save());

    manifest.documents.push({
      ...item,
      pages: { start, end },
      pageCount: indexes.length,
      path: relativePath,
      source: "split_from_pdf",
      status: "ready_for_platform",
    });
  }

  await copyFile(sourceAbstract, path.join(targetRoot, "confidence_patagonia_abstracao_documental.md"));
  await copyFile(sourceTemplate, path.join(targetRoot, "template_sistema_documental_confidence.yml"));
  await writeFile(path.join(targetRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
  await writeFile(path.join(targetRoot, "README.md"), buildReadme(manifest));

  return manifest;
}

function buildReadme(manifest) {
  const byFolder = Map.groupBy(manifest.documents, (item) => item.folder);
  const sections = [...byFolder.entries()]
    .map(([folder, docs]) => {
      const lines = docs.map(
        (doc) => `- ${doc.file}: p. ${doc.pages.start}-${doc.pages.end} - ${doc.title}`,
      );
      return `## ${folder}\n\n${lines.join("\n")}`;
    })
    .join("\n\n");

  return `# Confidence Patagonia - pacote documental destrinchado

- Contexto: ${manifest.context}
- Processo: ${manifest.administrativeProcess}
- Proponente: ${manifest.proponent}
- Total de documentos gerados: ${manifest.documents.length}

Use o arquivo \`manifest.json\` como indice para importacao na plataforma.

${sections}
`;
}

const results = [];
for (const targetRoot of outputs) {
  const manifest = await splitPdf(targetRoot);
  results.push({ targetRoot, count: manifest.documents.length });
}

console.table(results);
