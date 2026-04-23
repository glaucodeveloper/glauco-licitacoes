import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { createWorker } from "tesseract.js";
import XLSX from "xlsx";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const INSTRUCTIONS = {
  Regularidade: [
    "arquivo anexado",
    "titularidade da empresa",
    "validade identificavel",
    "orgao emissor identificavel"
  ],
  "Economico-financeiro": [
    "arquivo anexado",
    "periodo ou exercicio identificavel",
    "assinatura ou origem contabil",
    "vinculo com limite financeiro"
  ],
  Tecnico: [
    "arquivo anexado",
    "responsavel tecnico identificavel",
    "escopo compativel com edital",
    "registro CAT/CREA/atestado identificavel"
  ]
};

const EXTENSION_HINTS = {
  Regularidade: [".pdf", ".png", ".jpg", ".jpeg"],
  "Economico-financeiro": [".pdf", ".xlsx", ".xls", ".csv"],
  Tecnico: [".pdf", ".png", ".jpg", ".jpeg"]
};

export async function verifyDocumentUpload({ document, filePath, state = {}, apiKey = "", model = "gemini-2.5-flash" }) {
  const stat = await fs.stat(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const instructions = INSTRUCTIONS[document.kind] || INSTRUCTIONS.Regularidade;
  const expectedExtensions = EXTENSION_HINTS[document.kind] || [".pdf"];
  const reader = await readDocumentText(filePath, extension);
  const llmInference = await inferDocumentChecksWithLlm({
    document,
    instructions: instructions.slice(1),
    reader,
    state,
    apiKey,
    model
  });
  const checks = [];

  checks.push(check("Arquivo anexado", stat.isFile(), "O arquivo foi salvo no workspace local."));
  checks.push(
    check(
      "Formato aceito",
      expectedExtensions.includes(extension),
      `Esperado: ${expectedExtensions.join(", ")}. Recebido: ${extension || "sem extensao"}.`
    )
  );
  checks.push(
    check(
      "Tamanho util",
      stat.size > 0 && stat.size <= 50 * 1024 * 1024,
      "O arquivo precisa existir e ter ate 50 MB para esta verificacao inicial."
    )
  );

  for (const instruction of instructions.slice(1)) {
    const semantic = llmInference.checks[instruction] || fallbackSemanticCheck(instruction, reader.text, document.kind);
    checks.push(
      check(
        sentenceCase(instruction),
        semantic.ok,
        semantic.detail || `${reader.kind}: ${reader.preview || "sem texto extraido"}`
      )
    );
  }

  const passed = checks.filter((item) => item.status === "ok").length;
  const pending = checks.filter((item) => item.status === "pending").length;
  const failed = checks.filter((item) => item.status === "error").length;
  const confidence = Math.max(20, Math.min(95, Math.round((passed / checks.length) * 100)));

  return {
    status: failed ? "Revisar" : pending ? "Em verificacao" : "Validado",
    confidence,
    checks,
    instructions,
    summary: llmInference.summary || fallbackDocumentSummary(document, reader),
    inference: llmInference.source,
    reader
  };
}

async function inferDocumentChecksWithLlm({ document, instructions, reader, state, apiKey, model }) {
  if (!apiKey || !reader.text) {
    return { source: "fallback_keywords", checks: {} };
  }

  const prompt = [
    "Voce e um verificador documental para licitacoes publicas no Brasil.",
    "Leia o texto extraido do arquivo e avalie cada requisito de forma inferida e coerente, nao por mera palavra-chave.",
    "Responda somente JSON valido. Sem markdown.",
    "",
    "Formato:",
    '{"summary":"resumo curto do que o documento e e para que serve na licitacao","checks":{"requisito exato":{"ok":true,"detail":"explicacao curta baseada no texto"}}}',
    "",
    `Empresa: ${state.company?.name || "nao informada"}`,
    `Tipo do documento: ${document.kind}`,
    `Nome do card: ${document.name}`,
    `Papel esperado: ${document.role || document.sample || ""}`,
    `Requisitos: ${instructions.join("; ")}`,
    `Leitor usado: ${reader.kind}`,
    "",
    "Texto extraido:",
    reader.raw.slice(0, 14000)
  ].join("\n");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      }
    );
    if (!response.ok) return { source: `fallback_keywords_http_${response.status}`, checks: {} };
    const json = await response.json();
    const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n").trim();
    const parsed = parseJsonObject(text);
    const checks = {};
    for (const instruction of instructions) {
      const item = parsed?.checks?.[instruction];
      if (!item) continue;
      checks[instruction] = {
        ok: item.ok === true ? true : item.ok === false ? null : null,
        detail: `Inferencia LLM: ${String(item.detail || "").slice(0, 220)}`
      };
    }
    return {
      source: "llm_gemini",
      summary: String(parsed?.summary || "").slice(0, 420),
      checks
    };
  } catch (error) {
    return { source: `fallback_keywords_error_${error.message}`, checks: {} };
  }
}

function fallbackDocumentSummary(document, reader) {
  const preview = String(reader.preview || "").trim();
  if (preview) {
    return `${document.name}: ${preview.slice(0, 280)}${preview.length > 280 ? "..." : ""}`;
  }
  return `${document.name}: documento anexado para comprovar ${String(document.role || document.sample || "requisito documental").toLowerCase()}.`;
}

async function readDocumentText(filePath, extension) {
  try {
    if (extension === ".pdf") {
      const parser = new PDFParse({ data: await fs.readFile(filePath) });
      const data = await parser.getText();
      await parser.destroy();
      return makeReader("PDF text", data.text);
    }
    if ([".xlsx", ".xls"].includes(extension)) {
      const workbook = XLSX.readFile(filePath, { cellDates: true });
      const text = workbook.SheetNames
        .map((name) => XLSX.utils.sheet_to_csv(workbook.Sheets[name]))
        .join("\n");
      return makeReader("XLSX", text);
    }
    if (extension === ".csv") {
      return makeReader("CSV", await fs.readFile(filePath, "utf8"));
    }
    if ([".png", ".jpg", ".jpeg"].includes(extension)) {
      const worker = await createWorker("por");
      const result = await worker.recognize(filePath);
      await worker.terminate();
      return makeReader("OCR imagem", result.data.text);
    }
  } catch (error) {
    return { kind: "reader_error", text: "", preview: error.message };
  }
  return { kind: "sem leitor", text: "", preview: "" };
}

function makeReader(kind, text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return {
    kind,
    raw: clean,
    text: normalize(clean),
    preview: clean.slice(0, 180)
  };
}

function fallbackSemanticCheck(instruction, normalizedText, kind) {
  if (!normalizedText) return { ok: null, detail: "Leitor nao extraiu texto suficiente; precisa OCR externo ou arquivo melhor." };

  const rules = {
    "titularidade da empresa": ["confidence", "construtora", "engenharia", "cnpj"],
    "validade identificavel": ["validade", "valida", "emitida", "emissao", "certidao"],
    "orgao emissor identificavel": ["crea", "sefaz", "receita", "certidao", "cadastro", "estado"],
    "periodo ou exercicio identificavel": ["exercicio", "periodo", "ano", "balanco", "patrimonio", "liquida"],
    "assinatura ou origem contabil": ["contador", "contabil", "assinatura", "crc", "demonstrativo"],
    "vinculo com limite financeiro": ["patrimonio", "dfl", "financeira", "liquida", "compromissos"],
    "responsavel tecnico identificavel": ["engenheiro", "engenheira", "crea", "responsavel tecnico", "emily", "paulo"],
    "escopo compativel com edital": ["obra", "civil", "engenharia", "servico", "execucao", "atestado"],
    "registro CAT/CREA/atestado identificavel": ["cat", "crea", "atestado", "acervo", "certidao"]
  };
  const terms = rules[instruction] || [];
  const hits = terms.filter((term) => normalizedText.includes(normalize(term)));
  const minimum = kind === "Economico-financeiro" ? 1 : Math.min(2, terms.length);
  if (hits.length >= minimum) return { ok: true, detail: `Fallback local: sinais encontrados (${hits.join(", ")}).` };
  return { ok: null, detail: `Fallback local rodou, mas achou poucos sinais (${hits.join(", ") || "nenhum"}). Use LLM para inferencia completa.` };
}

function parseJsonObject(text) {
  const clean = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    return {};
  }
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function check(title, condition, detail) {
  return {
    title,
    status: condition === null ? "pending" : condition ? "ok" : "error",
    detail
  };
}

function sentenceCase(value) {
  const text = String(value || "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
