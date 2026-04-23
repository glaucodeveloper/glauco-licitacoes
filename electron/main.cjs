const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { dialog } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
require("dotenv").config({
	path: path.join(process.resourcesPath, ".env")
});

const appRoot = path.resolve(__dirname, "..");

let JsonStore;
let PortalRuntime;
let answerAgentPrompt;
let inferAgentAction;
let reviseAssistantBehavior;
let reviseProposalTemplateSection;
let runAgentTask;
let runAllAgentTasks;
let nowStamp;
let PORTAL_ROUTE_OPTIONS;
let runBahiaScan;
let proposalFitForRecord;
let slugify;
let validatePortalApps;
let decorateOpenEditaisDataset;
let getOpenEditalById;
let listOpenEditais;
let verifyDocumentUpload;
let inferFinancialWorkbook;
let buildProposalRecord;
let generateProposalPdf;

let mainWindow;
let setupWindow;
let store;
let portals;
let editaisCache = null;

async function loadModules() {
  ({ JsonStore } = await import("./services/store.mjs"));
  ({ PortalRuntime } = await import("./services/portalRuntime.mjs"));
  ({ answerAgentPrompt, inferAgentAction, reviseAssistantBehavior, reviseProposalTemplateSection, runAgentTask, runAllAgentTasks } = await import("./services/agent.mjs"));
  ({ nowStamp, PORTAL_ROUTE_OPTIONS } = await import("../src/shared/defaultState.mjs"));
  ({ runBahiaScan, proposalFitForRecord } = await import("../src/shared/radar.mjs"));
  ({ slugify, validatePortalApps } = await import("../src/shared/twa.mjs"));
  ({ decorateOpenEditaisDataset, getOpenEditalById, listOpenEditais } = await import("../src/shared/openEditaisData.mjs"));
  ({ verifyDocumentUpload } = await import("./services/documentVerifier.mjs"));
  ({ inferFinancialWorkbook } = await import("./services/financialImporter.mjs"));
  ({ buildProposalRecord, generateProposalPdf } = await import("./services/proposalPdf.mjs"));
}

function getResourcePath(relativePath) {
  if (app.isPackaged) return path.join(process.resourcesPath, relativePath);
  return path.join(appRoot, relativePath);
}

function getAppFilePath(relativePath) {
  if (app.isPackaged) return path.join(app.getAppPath(), relativePath);
  return path.join(appRoot, relativePath);
}

async function readJsonResource(relativePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(getResourcePath(relativePath), "utf8"));
  } catch {
    return fallback;
  }
}

async function loadOpenEditais() {
  const datasetRaw = await readJsonResource("data/open-editais.dataset.json", []);
  const meta = await readJsonResource("data/open-editais.meta.json", null);
  const sourceKey = `${datasetRaw.length}:${meta?.generatedAt || ""}`;
  if (!editaisCache || editaisCache.sourceKey !== sourceKey) {
    editaisCache = {
      sourceKey,
      dataset: decorateOpenEditaisDataset(datasetRaw),
      meta
    };
  }
  return editaisCache;
}

async function createProposalFromTenderCode(tenderCode) {
  const current = store.snapshot();
  const tender = await findTenderByCode(tenderCode, current);
  if (!tender) {
    return { ok: false, reason: `edital "${tenderCode || "nao informado"}" nao encontrado no radar nem na base local.` };
  }
  const proposal = buildProposalRecord({ state: current, tender });
  const generated = await generateProposalPdf({
    state: current,
    proposal,
    downloadsDir: app.getPath("downloads")
  });
  proposal.pdfPath = generated.outputPath;
  await store.update((state) => {
    state.company = {
      ...(state.company || {}),
      letterhead: {
        ...((state.company || {}).letterhead || {}),
        filePath: generated.letterheadPath
      }
    };
    state.proposals = [proposal, ...(state.proposals || [])];
    state.proposalProcess = {
      ...(state.proposalProcess || {}),
      selectedTenderId: tender.id,
      status: proposal.status,
      registeredAt: proposal.status === "Registrada" ? proposal.createdAt : null,
      registeredProposal: proposal
    };
    state.activeView = "proposal";
    state.activity = [`${nowStamp()} - Proposta PDF gerada: ${proposal.title}`, ...(state.activity || [])].slice(0, 30);
    return state;
  });
  return { ok: true, proposal, tender };
}

async function findTenderByCode(code, state) {
  const wanted = normalizeTenderCode(code);
  const inRadar = (state.bahia?.notifications || []).find((item) => tenderMatches(item, wanted));
  if (inRadar) return inRadar;
  const { dataset } = await loadOpenEditais();
  return dataset.find((item) => tenderMatches(item, wanted)) || null;
}

function tenderMatches(tender, wanted) {
  if (!wanted) return false;
  return [tender.id, tender.title, tender.editalUrl, tender.editalPdfUrl, tender.numero, tender.processo]
    .filter(Boolean)
    .some((value) => normalizeTenderCode(value).includes(wanted) || wanted.includes(normalizeTenderCode(value)));
}

function normalizeTenderCode(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    show: false,
    title: "Glauco Licitacoes",
    backgroundColor: "#f4f4f4",
    resizable: false,
    maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });
  mainWindow.on("unmaximize", () => mainWindow.maximize());
  mainWindow.on("restore", () => mainWindow.maximize());
  mainWindow.on("resize", () => {
    if (!mainWindow.isMaximized() && !mainWindow.isFullScreen()) mainWindow.maximize();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(getAppFilePath("dist/renderer/index.html"));
  }
}

async function createSetupWindow() {
  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.focus();
    return;
  }
  setupWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 680,
    title: "Instalacao inicial - Glauco Licitacoes",
    backgroundColor: "#f4f4f4",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });
  setupWindow.on("closed", () => {
    setupWindow = null;
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    await setupWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}?setup=1`);
  } else {
    await setupWindow.loadFile(getAppFilePath("dist/renderer/index.html"), { query: { setup: "1" } });
  }
}

async function bootstrapApp() {
  const userRoot = path.join(app.getPath("userData"), "workspace");
  store = new JsonStore({ userRoot });
  await store.init();
  portals = new PortalRuntime({ store, getResourcePath });
  registerIpc();
  await createWindow();
  if (!store.snapshot().setup?.completed) {
    await createSetupWindow();
  }
}

function registerIpc() {
  ipcMain.handle("app:bootstrap", async () => ({
    state: store.snapshot(),
    routes: PORTAL_ROUTE_OPTIONS,
    userRoot: store.userRoot,
    versions: {
      electron: process.versions.electron,
      node: process.versions.node
    }
  }));

  ipcMain.handle("state:active-view", async (_event, view) => store.setActiveView(view));

  ipcMain.handle("state:update", async (_event, patch) =>
    store.update((state) => deepMerge(state, patch || {}))
  );

  ipcMain.handle("setup:open", async () => {
    await createSetupWindow();
    return true;
  });

  ipcMain.handle("setup:complete", async (event, payload) => {
    const next = await store.update((state) => {
      const merged = deepMerge(state, payload || {});
      merged.setup.completed = true;
      merged.setup.installedAt = merged.setup.installedAt || nowStamp();
      merged.activity = [`${nowStamp()} - Instalacao inicial concluida`, ...(merged.activity || [])].slice(0, 30);
      return merged;
    });
    const sourceWindow = BrowserWindow.fromWebContents(event.sender);
    if (sourceWindow === setupWindow) {
      setTimeout(() => {
        if (setupWindow && !setupWindow.isDestroyed()) setupWindow.close();
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload();
      }, 250);
    }
    return next;
  });

  ipcMain.handle("integration:google", async (_event, email) => {
    return store.update((state) => {
      state.integrations.google = {
        connected: Boolean(email),
        email: email || "",
        status: email
          ? "Google/Gmail vinculado localmente"
          : "Informe email e use o painel interno Google/Gmail"
      };
      return state;
    });
  });

  ipcMain.handle("integration:whatsapp", async (_event, phone) => {
    return store.update((state) => {
      state.integrations.whatsapp = {
        connected: Boolean(phone),
        phone: phone || "",
        status: phone
          ? "WhatsApp vinculado localmente"
          : "Informe numero e use o painel interno WhatsApp"
      };
      state.integrations.notifications.whatsapp = Boolean(phone);
      return state;
    });
  });

  ipcMain.handle("document:upload", async (_event, id) => {
    const current = store.snapshot();
    const document = current.documents.find((item) => item.id === id);
    if (!document) return current;

    const result = await dialog.showOpenDialog(mainWindow, {
      title: `Selecionar arquivo - ${document.name}`,
      properties: ["openFile"],
      filters: [
        { name: "Documentos", extensions: ["pdf", "png", "jpg", "jpeg", "xlsx", "xls", "csv"] },
        { name: "Todos", extensions: ["*"] }
      ]
    });
    if (result.canceled || !result.filePaths[0]) return current;

    const sourcePath = result.filePaths[0];
    const safeName = `${id}-${Date.now()}-${path.basename(sourcePath).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const destinationPath = path.join(store.dirs.documents, safeName);
    await fs.copyFile(sourcePath, destinationPath);
    const verification = await verifyDocumentUpload({
      document,
      filePath: destinationPath,
      state: current,
      apiKey: geminiApiKey(current),
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash"
    });

    return store.update((state) => {
      state.documents = state.documents.map((item) =>
        item.id === id
          ? {
              ...item,
              status: verification.status,
              confidence: verification.confidence,
              summary: verification.summary,
              file: {
                name: path.basename(sourcePath),
                localPath: destinationPath,
                uploadedAt: nowStamp()
              },
              verification
            }
          : item
      );
      state.activity = [`${nowStamp()} - Documento enviado: ${document.name}`, ...(state.activity || [])].slice(0, 30);
      return state;
    });
  });

  ipcMain.handle("document:verify", async (_event, id) => {
    const current = store.snapshot();
    const document = current.documents.find((item) => item.id === id);
    if (!document?.file?.localPath) return current;
    const verification = await verifyDocumentUpload({
      document,
      filePath: document.file.localPath,
      state: current,
      apiKey: geminiApiKey(current),
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash"
    });
    return store.update((state) => {
      state.documents = state.documents.map((item) =>
        item.id === id
          ? {
              ...item,
              status: verification.status,
              confidence: verification.confidence,
              summary: verification.summary,
              verification
            }
          : item
      );
      state.activity = [`${nowStamp()} - Documento verificado: ${document.name}`, ...(state.activity || [])].slice(0, 30);
      return state;
    });
  });

  ipcMain.handle("company:upload-balance", async () => {
    const current = store.snapshot();
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Selecionar planilha de balanco",
      properties: ["openFile"],
      filters: [
        { name: "Planilhas", extensions: ["xlsx", "xls", "csv"] },
        { name: "Todos", extensions: ["*"] }
      ]
    });
    if (result.canceled || !result.filePaths[0]) return current;

    const sourcePath = result.filePaths[0];
    const safeName = `balanco-${Date.now()}-${path.basename(sourcePath).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const destinationPath = path.join(store.dirs.finance, safeName);
    await fs.copyFile(sourcePath, destinationPath);
    const imported = inferFinancialWorkbook(destinationPath);

    return store.update((state) => {
      state.companyMaintenance = {
        ...(state.companyMaintenance || {}),
        balanceSource: {
          ...imported.source,
          path: destinationPath,
          importedAt: nowStamp()
        },
        balanceInference: imported.inference,
        balanceSeries: imported.series
      };
      state.activity = [`${nowStamp()} - Balanco financeiro importado`, ...(state.activity || [])].slice(0, 30);
      return state;
    });
  });

	ipcMain.handle("agent:chat", async (_event, prompt) => {
		const current = store.snapshot();
		const apiKey =
			process.env.GEMINI_API_KEY ||
			process.env.GOOGLE_API_KEY ||
			current.integrations?.google?.geminiApiKey ||
			"";

		try {
			const text = await answerAgentPrompt({
				prompt,
				state: current,
				apiKey,
				model: process.env.GEMINI_MODEL || "gemini-2.5-flash"
			});

			const action = inferAgentAction(prompt);

			if (action?.type === "create_proposal") {
				const result = await createProposalFromTenderCode(action.tenderCode);
				return store.update((state) => {
					state.chat = [
						...(state.chat || []),
						{ role: "user", text: prompt },
						{
							role: "assistant",
							text: result.ok
								? `Proposta gerada e registrada para ${result.proposal.title}.\n\nPDF: ${result.proposal.pdfPath}\n\nAcao executada: ${action.label}.`
								: `${text}\n\nNao consegui executar ${action.label}: ${result.reason}`
						}
					].slice(-40);
					return state;
				});
			}

			return store.update((state) => {
				if (action?.type === "navigate") {
					state.activeView = action.view;
				}

				state.chat = [
					...(state.chat || []),
					{ role: "user", text: prompt },
					{ role: "assistant", text: action ? `${text}\n\nAcao executada: ${action.label}.` : text }
				].slice(-40);

				return state;
			});
		} catch (error) {
			console.error("agent:chat failed", error);

			return store.update((state) => {
				state.chat = [
					...(state.chat || []),
					{ role: "user", text: prompt },
					{
						role: "assistant",
						text: `Falha ao consultar Gemini: ${error?.message || "erro desconhecido"}`
					}
				].slice(-40);

				state.activity = [
					`${nowStamp()} - Falha no agent:chat: ${error?.message || "erro desconhecido"}`,
					...(state.activity || [])
				].slice(0, 30);

				return state;
			});
		}
	});

  ipcMain.handle("assistant:revise-config", async (_event, instruction) => {
    const current = store.snapshot();
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      current.integrations?.google?.geminiApiKey ||
      "";
    const behavior = await reviseAssistantBehavior({
      instruction,
      currentBehavior: current.assistantConfig?.behavior || "",
      state: current,
      apiKey,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash"
    });
    return store.update((state) => {
      state.assistantConfig = {
        ...(state.assistantConfig || {}),
        behavior
      };
      state.activity = [`${nowStamp()} - Configuracao do assistente revisada`, ...(state.activity || [])].slice(0, 30);
      return state;
    });
  });

  ipcMain.handle("proposal-template:revise-section", async (_event, sectionId, instruction) => {
    const current = store.snapshot();
    const section = (current.proposalTemplate?.sections || []).find((item) => item.id === sectionId);
    if (!section) return current;
    const prompt = await reviseProposalTemplateSection({
      instruction,
      section,
      state: current,
      apiKey: geminiApiKey(current),
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash"
    });
    return store.update((state) => {
      state.proposalTemplate = {
        ...(state.proposalTemplate || {}),
        sections: (state.proposalTemplate?.sections || []).map((item) =>
          item.id === sectionId ? { ...item, prompt } : item
        )
      };
      state.activity = [`${nowStamp()} - Matriz de proposta revisada: ${section.title}`, ...(state.activity || [])].slice(0, 30);
      return state;
    });
  });

  ipcMain.handle("proposal:select-declarations", async () => {
    const current = store.snapshot();
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Anexar declaracoes da proposta",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "PDF", extensions: ["pdf"] },
        { name: "Todos", extensions: ["*"] }
      ]
    });
    if (result.canceled || !result.filePaths.length) return current;
    const dir = path.join(store.userRoot, "proposals", "manual-declarations");
    await fs.mkdir(dir, { recursive: true });
    const files = [];
    for (const sourcePath of result.filePaths) {
      const target = path.join(dir, `${Date.now()}-${path.basename(sourcePath)}`);
      await fs.copyFile(sourcePath, target);
      files.push({
        name: path.basename(sourcePath),
        localPath: target,
        uploadedAt: nowStamp()
      });
    }
    return store.update((state) => {
      state.proposalProcess = {
        ...(state.proposalProcess || {}),
        manualDeclarationFiles: files
      };
      state.activity = [`${nowStamp()} - Declaracoes manuais anexadas a proposta`, ...(state.activity || [])].slice(0, 30);
      return state;
    });
  });

  ipcMain.handle("proposal:select-requirement-file", async (_event, requirementId, label) => {
    const current = store.snapshot();
    const result = await dialog.showOpenDialog(mainWindow, {
      title: `Anexar arquivo - ${label || requirementId}`,
      properties: ["openFile"],
      filters: [
        { name: "Documentos", extensions: ["pdf", "png", "jpg", "jpeg", "xlsx", "xls", "csv"] },
        { name: "Todos", extensions: ["*"] }
      ]
    });
    if (result.canceled || !result.filePaths[0]) return current;
    const sourcePath = result.filePaths[0];
    const dir = path.join(store.userRoot, "proposals", "requirements");
    await fs.mkdir(dir, { recursive: true });
    const target = path.join(dir, `${Date.now()}-${path.basename(sourcePath).replace(/[^a-zA-Z0-9._-]/g, "_")}`);
    await fs.copyFile(sourcePath, target);
    return store.update((state) => {
      state.proposalProcess = {
        ...(state.proposalProcess || {}),
        requirementFiles: {
          ...((state.proposalProcess || {}).requirementFiles || {}),
          [requirementId]: {
            id: requirementId,
            label: label || requirementId,
            name: path.basename(sourcePath),
            localPath: target,
            uploadedAt: nowStamp()
          }
        }
      };
      state.activity = [`${nowStamp()} - Anexo de requisito adicionado: ${label || requirementId}`, ...(state.activity || [])].slice(0, 30);
      return state;
    });
  });

  ipcMain.handle("proposal:create", async (_event, tenderId) => {
    const result = await createProposalFromTenderCode(tenderId);
    if (!result.ok) return store.snapshot();
    return store.snapshot();
  });

  ipcMain.handle("proposal:chat", async (_event, prompt) => {
    const current = store.snapshot();
    const process = current.proposalProcess || {};
    const activeTender =
      (current.bahia?.notifications || []).find((item) => item.id === process.selectedTenderId) ||
      (current.bahia?.notifications || [])[0] ||
      null;
    const contextPrompt = [
      "Voce esta dentro da tela de processo Composicao de Proposta.",
      "Responda como agente que faz perguntas ativas, cobra lacunas e orienta o proximo passo do operador.",
      activeTender ? `Licitacao em foco: ${activeTender.title} - ${activeTender.orgao}.` : "Ainda nao ha licitacao selecionada.",
      `Etapa ativa: ${process.activeStep || "triagem"}.`,
      `Blocos: ${(current.proposalBlocks || []).map((item) => `${item.name} ${item.coverage}% ${item.status}`).join("; ")}.`,
      `Documentos: ${(current.documents || []).map((item) => `${item.name} ${item.status} ${item.confidence}%`).join("; ")}.`,
      `Operador escreveu: ${prompt}`
    ].join("\n");
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      current.integrations?.google?.geminiApiKey ||
      "";
    const text = await answerAgentPrompt({
      prompt: contextPrompt,
      state: current,
      apiKey,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash"
    });
    return store.update((state) => {
      state.proposalProcess = {
        ...(state.proposalProcess || {}),
        chat: [
          ...((state.proposalProcess || {}).chat || []),
          { role: "user", text: prompt },
          { role: "assistant", text }
        ].slice(-30)
      };
      state.activity = [`${nowStamp()} - Processo de proposta conversou com agente`, ...(state.activity || [])].slice(0, 30);
      return state;
    });
  });

  ipcMain.handle("agent:run-task", async (_event, id) =>
    store.update((state) => runAgentTask(state, id))
  );

  ipcMain.handle("agent:run-all", async () => store.update((state) => runAllAgentTasks(state)));

  ipcMain.handle("bahia:scan", async () => {
    const { dataset, meta } = await loadOpenEditais();
    const result = runBahiaScan({ state: store.snapshot(), dataset, meta, limit: 6 });
    return store.update((state) => {
      state.bahia = result;
      state.activity = [`${nowStamp()} - Radar Bahia atualizado`, ...(state.activity || [])].slice(0, 30);
      return state;
    });
  });

  ipcMain.handle("open-editais:overview", async () => {
    const { meta } = await loadOpenEditais();
    return meta;
  });

  ipcMain.handle("open-editais:list", async (_event, query) => {
    const { dataset } = await loadOpenEditais();
    const page = listOpenEditais(dataset, query || {});
    const state = store.snapshot();
    return {
      ...page,
      items: page.items.map((item) => ({
        ...item,
        proposalFit: proposalFitForRecord(item, state)
      }))
    };
  });

  ipcMain.handle("open-editais:detail", async (_event, id) => {
    const { dataset } = await loadOpenEditais();
    const detail = getOpenEditalById(dataset, id);
    return detail ? { ...detail, proposalFit: proposalFitForRecord(detail, store.snapshot()) } : null;
  });

  ipcMain.handle("portal:add-app", async (_event, payload) =>
    store.update((state) => {
      const name = payload?.name || "Novo portal";
      const id = uniqueId(slugify(name), state.portalApps || []);
      const route = payload?.route || "dashboard";
      state.portalApps = [
        ...(state.portalApps || []),
        {
          id,
          name,
          description: payload?.description || "Aplicativo externo gerado pela plataforma.",
          route,
          packageName: payload?.packageName || `app.glauco.${id.replaceAll("-", "")}`,
          active: false,
          port: 8010,
          localUrl: "",
          publicUrl: "",
          twaStatus: "Nao gerado"
        }
      ];
      state.activity = [`${nowStamp()} - App externo cadastrado: ${name}`, ...(state.activity || [])].slice(0, 30);
      return state;
    })
  );

  ipcMain.handle("portal:toggle", async (_event, id, active) =>
    active ? portals.activate(id) : portals.deactivate(id)
  );

  ipcMain.handle("portal:generate-twa", async (_event, id) => portals.generateTwa(id));

  ipcMain.handle("portal:checks", async () => validatePortalApps(store.snapshot().portalApps));

  ipcMain.handle("shell:open", async (_event, url) => {
    if (url && /^[a-z]+:\/\//i.test(url)) {
      await shell.openExternal(url);
    } else if (url) {
      await shell.openPath(url);
    }
    return true;
  });
}

function geminiApiKey(state) {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    state.integrations?.google?.geminiApiKey ||
    ""
  );
}

function deepMerge(target, patch) {
  if (!patch || typeof patch !== "object") return target;
  for (const [key, value] of Object.entries(patch)) {
    if (Array.isArray(value)) {
      target[key] = value;
    } else if (value && typeof value === "object") {
      target[key] = deepMerge(target[key] && typeof target[key] === "object" ? target[key] : {}, value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

function uniqueId(base, apps) {
  const used = new Set(apps.map((item) => item.id));
  let id = base || "portal";
  let index = 2;
  while (used.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return id;
}

app.whenReady().then(async () => {
  await loadModules();
  await bootstrapApp();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async () => {
  if (portals) {
    await portals.stopNgrok();
    await portals.stopServer();
  }
});
