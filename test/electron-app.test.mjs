import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { defaultState } from "../src/shared/defaultState.mjs";
import { inferHistoricalIntent, runBahiaScan } from "../src/shared/radar.mjs";
import {
  decorateOpenEditaisDataset,
  getOpenEditalById,
  listOpenEditais
} from "../src/shared/openEditaisData.mjs";
import { generateTwaArtifacts, validatePortalApps } from "../src/shared/twa.mjs";
import { fallbackAgentAnswer, inferAgentAction, runAllAgentTasks } from "../electron/services/agent.mjs";
import { verifyDocumentUpload } from "../electron/services/documentVerifier.mjs";
import { inferFinancialWorkbook } from "../electron/services/financialImporter.mjs";
import { buildProposalRecord, generateProposalPdf } from "../electron/services/proposalPdf.mjs";

test("default state uses local user workspace and installer pending", () => {
  const state = defaultState("C:/Users/example/AppData/Roaming/Glauco/workspace");
  assert.equal(state.setup.completed, false);
  assert.equal(state.activeView, "home");
  assert.equal(state.company.intent, "");
  assert.deepEqual(state.participatedTenders, []);
  assert.equal(state.proposalProcess.activeStep, "triagem");
  assert.equal(state.proposalProcess.status, "Em composicao");
  assert.deepEqual(state.proposalProcess.documentDetails, {});
  assert.ok(state.proposalProcess.chat[0].text.includes("compor a proposta"));
  assert.match(state.assistantConfig.behavior, /instrucoes permanentes/);
  assert.ok(state.proposalTemplate.sections.some((item) => item.id === "price_opening"));
  assert.match(state.company.letterhead.footer, /Goiabeiras/);
  assert.match(state.setup.userRoot, /workspace/);
  assert.ok(state.portalApps.some((item) => item.route === "ventures"));
});

test("historical intent starts blank and is inferred from participated tender items", () => {
  const state = defaultState("");
  assert.equal(state.company.intent, "");
  const inferred = inferHistoricalIntent([
    {
      objeto: "Execucao de reforma predial",
      items: ["estrutura metalica", "instalacoes eletricas"],
      cnaes: [{ code: "4120-4/00", description: "Construcao de edificios" }]
    }
  ]);
  assert.match(inferred, /reforma predial/);
  assert.match(inferred, /estrutura metalica/);
  assert.match(inferred, /Construcao de edificios/);
});

test("open editais base from source filters and details records", async () => {
  const raw = JSON.parse(await fs.readFile("data/open-editais.dataset.json", "utf8"));
  const dataset = decorateOpenEditaisDataset(raw);
  const listing = listOpenEditais(dataset, { query: "engenharia", sort: "relevancia", pageSize: 6 });
  assert.ok(listing.total > 0);
  assert.ok(listing.items.length <= 6);
  const detail = getOpenEditalById(dataset, listing.items[0].id);
  assert.equal(detail.id, listing.items[0].id);
  assert.ok(detail.index.searchBlob.length > 20);
});

test("bahia radar ranks records against inferred participated tender intent", async () => {
  const state = defaultState("");
  state.participatedTenders = [
    {
      objeto: "Obras publicas de infraestrutura e saneamento",
      items: ["engenharia civil", "reforma predial", "saneamento"]
    }
  ];
  const dataset = decorateOpenEditaisDataset(JSON.parse(await fs.readFile("data/open-editais.dataset.json", "utf8")));
  const meta = JSON.parse(await fs.readFile("data/open-editais.meta.json", "utf8"));
  const result = runBahiaScan({ state, dataset, meta, limit: 4 });
  assert.equal(result.notifications.length, 4);
  assert.ok(result.notifications[0].score >= result.notifications.at(-1).score);
  assert.ok(result.notifications[0].proposalPercent > 0);
  assert.match(result.notifications[0].magnitudeArgument, /Magnitude/);
  assert.equal(result.meta.totals.documents, meta.totals.documents);
});

test("agent tasks and fallback answer work without network", () => {
  const state = runAllAgentTasks(defaultState(""));
  assert.ok(state.agentTasks.every((item) => item.status === "Executado"));
  const answer = fallbackAgentAnswer("quais licitacoes da bahia?", state);
  assert.match(answer.toLowerCase(), /radar|bahia|licit/);
  assert.equal(inferAgentAction("abra empreendimentos e contratos").view, "ventures");
});

test("uploaded user document is checked by document instructions", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "glauco-doc-"));
  const filePath = path.join(temp, "certidao.pdf");
  await fs.writeFile(filePath, "PDF placeholder");
  const document = defaultState("").documents.find((item) => item.id === "doc_certidoes");
  const verification = await verifyDocumentUpload({ document, filePath });
  assert.equal(verification.checks[0].status, "ok");
  assert.equal(verification.checks[1].status, "ok");
  assert.ok(verification.instructions.includes("titularidade da empresa"));
  assert.ok(verification.confidence > 20);
});

test("twa artifacts are generated for active portal contract", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "glauco-twa-"));
  const app = defaultState("").portalApps[0];
  const checks = validatePortalApps([app]);
  assert.equal(checks[0].level, "ok");
  const output = await generateTwaArtifacts({ app, outputDir: temp, host: "example.ngrok-free.app" });
  const manifest = JSON.parse(await fs.readFile(output.manifestPath, "utf8"));
  assert.equal(manifest.packageId, app.packageName);
  assert.equal(manifest.startUrl, `/__glauco/pages/${app.id}`);
});

test("nexus map uses original SVG rect lots from source repository", async () => {
  const svg = await fs.readFile("public/nexus-lotes.svg", "utf8");
  const rectCount = [...svg.matchAll(/<rect\b/g)].length;
  assert.equal(rectCount, 102);
  assert.match(svg, /viewBox="0 0 14499 6807"/);
});

test("financial workbook importer infers balance chart structure", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "glauco-finance-"));
  const filePath = path.join(temp, "balanco.csv");
  await fs.writeFile(filePath, "competencia,receita,despesa\n01/2026,1000,700\n02/2026,1500,900\n");
  const imported = inferFinancialWorkbook(filePath);
  assert.equal(imported.series.length, 2);
  assert.equal(imported.series[0].balance, 300);
  assert.equal(imported.source.columns.period, "competencia");
  assert.equal(imported.source.columns.revenue, "receita");
});

test("proposal creation produces complete pdf dossier", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "glauco-proposal-"));
  const state = defaultState(temp);
  state.documents = state.documents.map((doc) => ({ ...doc, confidence: 80, file: null }));
  const tender = {
    id: "23013CP0062026",
    title: "Concorrencia Publica CP006/2026",
    orgao: "Secretaria de Infraestrutura",
    value: 7962173.4,
    editalUrl: "https://example.com/edital.pdf",
    reason: "Aderente ao perfil da empresa."
  };
  const proposal = buildProposalRecord({ state, tender, createdAt: "23/04/2026, 06:30:00" });
  const generated = await generateProposalPdf({ state, proposal, downloadsDir: temp });
  const bytes = await fs.readFile(generated.outputPath);
  const letterhead = await fs.readFile(generated.letterheadPath);
  assert.match(path.basename(generated.outputPath), /^Proposta completa/);
  assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
  assert.equal(letterhead.subarray(0, 4).toString(), "%PDF");
});
