import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const downloadsDir = path.join(os.homedir(), "Downloads");
const sourcePdf = process.argv[2] || (await findSourcePdf(downloadsDir));

const outputRoots = [
  path.join(repoRoot, "data", "imports", "confidence-patagonia-inventory"),
  path.join(
    process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
    "glauco-licitacoes-electron",
    "workspace",
    "imports",
    "confidence-patagonia-inventory",
  ),
];

const inventoryEntities = [
  {
    id: "proposta-preco",
    file: "01_proposta_preco.pdf",
    title: "Proposta de preco",
    entityType: "documento_principal",
    category: "proposta",
    pages: [[1, 1]],
    role: "Documento nuclear do certame, valor ofertado e proponente.",
  },
  {
    id: "declaracoes-habilitacao-integridade",
    file: "02_declaracoes_habilitacao_integridade.pdf",
    title: "Declaracoes de habilitacao e integridade",
    entityType: "grupo_documental",
    category: "regularidade",
    pages: [[2, 4], [50, 52]],
    role: "Declaracoes formais de independencia, veracidade, requisitos tecnicos, menor e reserva legal.",
  },
  {
    id: "capacidade-operacional-declarada",
    file: "03_capacidade_operacional_declarada.pdf",
    title: "Capacidade operacional declarada",
    entityType: "grupo_documental",
    category: "tecnico",
    pages: [[5, 6], [9, 9]],
    role: "Declaracoes de disponibilidade tecnica, equipamentos e aptidao de desempenho.",
  },
  {
    id: "financeiro-dfl-patrimonio-compromissos",
    file: "04_financeiro_dfl_patrimonio_compromissos.pdf",
    title: "Qualificacao economico-financeira",
    entityType: "grupo_documental",
    category: "financeiro",
    pages: [[7, 8], [10, 10]],
    role: "DFL, compromissos assumidos e patrimonio liquido.",
  },
  {
    id: "representante-legal",
    file: "05_representante_legal.pdf",
    title: "Representante legal",
    entityType: "pessoa",
    category: "cadastro",
    pages: [[11, 11]],
    role: "Identificacao do representante legal por CNH.",
  },
  {
    id: "empresa-cadastro-regularidade",
    file: "06_empresa_cadastro_regularidade.pdf",
    title: "Empresa - cadastro e regularidade",
    entityType: "empresa",
    category: "regularidade",
    pages: [[12, 16], [29, 29]],
    role: "CRC, situacao cadastral, certidao falencia/concordata, CREA PJ e CAO da empresa.",
  },
  {
    id: "rt-civil-emily-vinculo",
    file: "07_responsavel_tecnico_civil_emily_vinculo.pdf",
    title: "Responsavel tecnico civil - Emily Almeida Pires",
    entityType: "responsavel_tecnico",
    category: "responsavel_tecnico",
    pages: [[30, 34]],
    role: "Contrato de vinculacao, autorizacao individual e certidao CREA PF.",
  },
  {
    id: "rt-civil-emily-acervo",
    file: "08_responsavel_tecnico_civil_emily_acervo.pdf",
    title: "Acervo tecnico civil - Emily Almeida Pires",
    entityType: "cat_atestado",
    category: "cat",
    pages: [[17, 28]],
    role: "CAT e atestado vinculado da engenheira civil.",
  },
  {
    id: "rt-eletrica-paulo-vinculo",
    file: "09_responsavel_tecnico_eletrica_paulo_vinculo.pdf",
    title: "Responsavel tecnico eletrica - Paulo Moreira Mota da Silva",
    entityType: "responsavel_tecnico",
    category: "responsavel_tecnico",
    pages: [[35, 35], [46, 49]],
    role: "Autorizacao, contrato de assistencia tecnica e certidao CREA PF.",
  },
  {
    id: "rt-eletrica-paulo-acervo",
    file: "10_responsavel_tecnico_eletrica_paulo_acervo.pdf",
    title: "Acervo tecnico eletrica - Paulo Moreira Mota da Silva",
    entityType: "cat_atestado",
    category: "cat",
    pages: [[36, 45]],
    role: "CAT e atestado vinculado do engenheiro eletricista.",
  },
  {
    id: "contratos-vinculacao-tecnica",
    file: "11_contratos_vinculacao_tecnica.pdf",
    title: "Contratos de vinculacao tecnica",
    entityType: "contrato",
    category: "responsavel_tecnico",
    pages: [[30, 32], [46, 47]],
    role: "Contratos que vinculam os responsaveis tecnicos a empresa.",
  },
  {
    id: "autorizacoes-responsaveis-tecnicos",
    file: "12_autorizacoes_responsaveis_tecnicos.pdf",
    title: "Autorizacoes dos responsaveis tecnicos",
    entityType: "autorizacao",
    category: "responsavel_tecnico",
    pages: [[33, 33], [35, 35]],
    role: "Autorizacoes individuais para uso dos responsaveis tecnicos na proposta.",
  },
];

async function main() {
  const sourceBytes = await readFile(sourcePdf);
  const sourceDoc = await PDFDocument.load(sourceBytes);
  const sourcePageCount = sourceDoc.getPageCount();

  const results = [];
  for (const outputRoot of outputRoots) {
    await mkdir(outputRoot, { recursive: true });
    const manifest = {
      packageId: "confidence-patagonia-inventory-entities",
      title: "Confidence Patagonia - entidades de inventario",
      sourcePdf,
      sourcePageCount,
      generatedAt: new Date().toISOString(),
      entities: [],
    };

    for (const entity of inventoryEntities) {
      const doc = await PDFDocument.create();
      for (const [start, end] of entity.pages) {
        const indexes = Array.from({ length: end - start + 1 }, (_, index) => start - 1 + index);
        const copied = await doc.copyPages(sourceDoc, indexes);
        copied.forEach((page) => doc.addPage(page));
      }

      const targetPath = path.join(outputRoot, entity.file);
      await writeFile(targetPath, await doc.save());
      manifest.entities.push({
        ...entity,
        pageCount: entity.pages.reduce((total, [start, end]) => total + end - start + 1, 0),
        path: entity.file,
        status: "ready_for_inventory",
      });
    }

    await copyIfExists(path.join(downloadsDir, "confidence_patagonia_abstracao_documental.md"), path.join(outputRoot, "abstracao_documental.md"));
    await copyIfExists(path.join(downloadsDir, "template_sistema_documental_confidence.yml"), path.join(outputRoot, "template_sistema_documental.yml"));
    await writeFile(path.join(outputRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
    await writeFile(path.join(outputRoot, "README.md"), readme(manifest));
    results.push({ outputRoot, entities: manifest.entities.length });
  }

  console.table(results);
}

async function findSourcePdf(dir) {
  const files = await readdir(dir);
  const found = files.find(
    (name) => name.startsWith("Confidence Documenta") && name.includes("Patag") && name.toLowerCase().endsWith(".pdf"),
  );
  if (!found) throw new Error(`PDF Confidence Patagonia nao encontrado em ${dir}`);
  return path.join(dir, found);
}

async function copyIfExists(source, target) {
  try {
    await copyFile(source, target);
  } catch {
    // Optional companion files.
  }
}

function readme(manifest) {
  return `# Confidence Patagonia - entidades de inventario

Fonte: ${manifest.sourcePdf}
Paginas fonte: ${manifest.sourcePageCount}
Entidades geradas: ${manifest.entities.length}

${manifest.entities
  .map((entity) => `- ${entity.file}: ${entity.title} (${entity.category}, ${entity.pageCount} paginas)`)
  .join("\n")}
`;
}

await main();
