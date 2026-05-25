import { useEffect, useMemo, useRef, useState } from "react";

const api = window.glauco;

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0
});

const emptyListing = { items: [], total: 0, totalPages: 1, page: 1 };

const navItems = [
  ["dashboard", "Dashboard", "dashboard"],
  ["company", "Empresa", "building"],
  ["documents", "Docs", "files"],
  ["proposal", "Propostas", "fileText"],
  ["bahia", "Bahia", "radar"],
  ["portals", "Portais", "external"],
  ["settings", "Ajustes", "settings"]
];

const iconPaths = {
  dashboard: ["M3 13h8V3H3v10Z", "M13 21h8V3h-8v18Z", "M3 21h8v-6H3v6Z"],
  building: ["M4 21V7l8-4 8 4v14", "M9 21v-6h6v6", "M8 9h.01", "M12 9h.01", "M16 9h.01", "M8 13h.01", "M16 13h.01"],
  files: ["M7 3h8l4 4v14H7V3Z", "M15 3v5h5", "M4 7v14h3"],
  fileText: ["M6 3h9l4 4v14H6V3Z", "M15 3v5h5", "M9 12h6", "M9 16h8"],
  radar: ["M12 12l7-7", "M5 19a10 10 0 0 0 14 0", "M8 16a6 6 0 0 0 8 0", "M12 12h.01"],
  external: ["M14 3h7v7", "M21 3l-9 9", "M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"],
  settings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04a2 2 0 1 1-2.83 2.83l-.04-.04A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6V20a2 2 0 1 1-4 0v-.06a1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.04.04a2 2 0 1 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1H4a2 2 0 1 1 0-4h.06a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.04-.04a2 2 0 1 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 9 4.6c.36 0 .7-.1 1-.29V4a2 2 0 1 1 4 0v.06c.3.19.64.29 1 .29a1.7 1.7 0 0 0 1.88-.34l.04-.04a2 2 0 1 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.4 9c0 .36.1.7.29 1H20a2 2 0 1 1 0 4h-.06c-.19.3-.29.64-.29 1Z"],
  refresh: ["M21 12a9 9 0 1 1-2.64-6.36", "M21 3v7h-7"],
  upload: ["M12 3v12", "M7 8l5-5 5 5", "M5 21h14"],
  check: ["M20 6 9 17l-5-5"],
  edit: ["M12 20h9", "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"],
  send: ["M22 2 11 13", "M22 2 15 22l-4-9-9-4 20-7Z"],
  x: ["M18 6 6 18", "M6 6l12 12"]
};

function Icon({ name }) {
  const paths = iconPaths[name] || iconPaths.dashboard;
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

export default function App() {
  const [state, setState] = useState(null);
  const [portalRoutes, setPortalRoutes] = useState([]);
  const [versions, setVersions] = useState({});
  const [busy, setBusy] = useState("");
  const isSetupWindow = new URLSearchParams(window.location.search).get("setup") === "1";

  useEffect(() => {
    let alive = true;
    api.bootstrap().then((payload) => {
      if (!alive) return;
      setState(payload.state);
      setPortalRoutes(payload.routes);
      setVersions(payload.versions);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function applyState(promise, busyLabel = "Atualizando") {
    setBusy(busyLabel);
    try {
      const next = await promise;
      setState(next);
      return next;
    } finally {
      setBusy("");
    }
  }

  if (!state) return <div className="boot">Carregando cockpit Electron...</div>;

  if (isSetupWindow) {
    return (
      <Onboarding
        state={state}
        onState={setState}
        onComplete={(payload) => applyState(api.completeSetup(payload), "Concluindo instalacao")}
      />
    );
  }

  return (
    <div className="app">
      <aside className="left-nav">
        <div className="brand">
          <span>GL</span>
          <strong>Glauco</strong>
          <small>Licitacoes</small>
        </div>
        <nav>
          {navItems.map(([id, label, icon]) => (
            <button
              key={id}
              className={state.activeView === id ? "nav-item active" : "nav-item"}
              onClick={() => applyState(api.setActiveView(id), "Abrindo tela")}
              title={label}
            >
              <Icon name={icon} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="nav-footer">
          <small>Pasta local</small>
          <span>{state.setup.userRoot}</span>
        </div>
      </aside>

      <section className="workspace">
        <main className="content">
          {busy && <div className="busy">{busy}</div>}
          {state.activeView === "dashboard" && (
            <DashboardView
              state={state}
              onScan={() => applyState(api.runBahiaScan(), "Rodando radar Bahia")}
              onOpen={(view) => applyState(api.setActiveView(view), "Abrindo acao")}
            />
          )}
          {state.activeView === "company" && (
            <CompanyView
				state={state}
				onSave={(patch) => applyState(api.updateState(patch), "Salvando empresa")}
				onUploadDocument={(id) => applyState(api.uploadDocument(id), "Enviando documento")}
				onVerifyDocument={(id) => applyState(api.verifyDocument(id), "Verificando documento")}
        onSelectLetterheadTemplate={() => applyState(api.selectLetterheadDocx(), "Selecionando papel timbrado")}
              onConfigure={() => api.openSetup()}
              onUploadBalance={() => applyState(api.uploadBalanceSheet(), "Importando balanco")}
            />
          )}
          {state.activeView === "documents" && (
            <DocumentsView
              state={state}
              onSave={(patch) => applyState(api.updateState(patch), "Salvando documentos")}
              onUpload={(id) => applyState(api.uploadDocument(id), "Enviando documento")}
              onVerify={(id) => applyState(api.verifyDocument(id), "Verificando documento")}
              onUploadCat={(id) => applyState(api.uploadCatDocument(id), "Anexando PDF da CAT")}
              onEvaluateCatCompatibility={(id, tenderId) => applyState(api.evaluateCatTenderCompatibility(id, tenderId), "Avaliando CAT contra edital")}
            />
          )}
          {state.activeView === "proposal" && (
            <ProposalsView
              state={state}
              onSave={(patch) => applyState(api.updateState(patch), "Salvando processo")}
              onCreateProposal={(tenderId) => applyState(api.createProposal(tenderId), "Gerando PDF da proposta")}
              onEvaluateTenderDocuments={(tenderId) => applyState(api.evaluateTenderDocumentsCompatibility(tenderId), "Avaliando documentos contra edital")}
              onOpen={(url) => api.openExternal(url)}
            />
          )}
          {state.activeView === "bahia" && (
            <BahiaExplorer
              state={state}
              onOpen={(url) => api.openExternal(url)}
              onOpenProposals={() => applyState(api.updateState({ activeView: "proposal" }), "Abrindo propostas")}
              onGenerateProposal={(selected) =>
                applyState(
                  api.updateState({
                    activeView: "proposal",
                    proposalProcess: {
                      ...(state.proposalProcess || {}),
                      selectedTenderId: selected.id,
                      activeStep: "documentos",
                      triageDecision: "Atacar agora"
                    }
                  }),
                  "Abrindo proposta"
                )
              }
            />
          )}
          {state.activeView === "portals" && (
            <PortalsView
              state={state}
              routes={portalRoutes}
              onAdd={(payload) => applyState(api.addPortalApp(payload), "Cadastrando app")}
              onToggle={(id, active) => applyState(api.togglePortalApp(id, active), active ? "Ativando portal" : "Desativando portal")}
              onOpen={(url) => api.openExternal(url)}
            />
          )}
          {state.activeView === "settings" && (
            <SettingsView
              state={state}
              versions={versions}
              onSave={(patch) => applyState(api.updateState(patch), "Salvando configuracoes")}
              onOpenSetup={() => api.openSetup()}
              onSaveAssistant={(behavior) => applyState(api.updateState({ assistantConfig: { behavior } }), "Salvando assistente")}
              onReviseAssistant={(instruction) => applyState(api.reviseAssistantConfig(instruction), "Revisando assistente")}
              onReviseProposalSection={(sectionId, instruction) =>
                applyState(api.reviseProposalTemplateSection(sectionId, instruction), "Revisando matriz da proposta")
              }
            />
          )}
        </main>

        <ChatSidebar
          state={state}
          onSend={(prompt) => applyState(api.chat(prompt), "Consultando agente")}
          onRun={(id) => applyState(api.runAgentTask(id), "Executando agente")}
          onRunAll={() => applyState(api.runAllAgentTasks(), "Executando fila")}
        />
      </section>
    </div>
  );
}

function Onboarding({ state, onComplete }) {
  const [step, setStep] = useState(state.setup.currentStep || 0);
  const [draft, setDraft] = useState(state);
  const slides = [
    "Plataforma",
    "Empresa",
    "Concluir"
  ];

  function patch(path, value) {
    setDraft((current) => setPath(current, path, value));
  }

  return (
    <section className="installer">
      <div className="installer-ribbon" />
      <div className="installer-top">
        <strong>Instalacao inicial</strong>
        <span>{slides[step]}</span>
      </div>
      <div className="slide-track" style={{ transform: `translateX(-${step * 100}%)` }}>
        <InstallSlide>
          <p className="eyebrow">IA para licitacoes do Estado</p>
          <h1>Organize a empresa para competir melhor nas licitacoes da Bahia.</h1>
          <p>
            A plataforma mantem estado da empresa, documentos, CATs, responsaveis tecnicos e historico
            intencional. O agente cruza isso com editais abertos e avisa oportunidades compativeis.
          </p>
          <div className="install-facts">
            <Fact label="Pasta local" value={state.setup.userRoot} />
            <Fact label="Radar diario" value="Corpus Bahia + agente Gemini" />
            <Fact label="Canal" value="Tela do sistema" />
          </div>
        </InstallSlide>
        <InstallSlide>
          <p className="eyebrow">Perfil da empresa</p>
          <h2>Defina o cadastro e o recorte financeiro inicial.</h2>
          <p>A intencao historica inicia em branco. O sistema infere esse perfil depois, a partir dos itens das licitacoes em que a empresa participou.</p>
          <div className="form-grid">
            <label className="field">
              <span>Empresa</span>
              <input value={draft.company.name} onChange={(event) => patch("company.name", event.target.value)} />
            </label>
            <label className="field">
              <span>CNPJ</span>
              <input value={draft.company.cnpj} onChange={(event) => patch("company.cnpj", event.target.value)} />
            </label>
            <label className="field">
              <span>Teto financeiro</span>
              <input
                type="number"
                value={draft.company.financialCeiling}
                onChange={(event) => patch("company.financialCeiling", Number(event.target.value))}
              />
            </label>
            <div className="field wide derived-field">
              <span>Intencao historica inferida</span>
              <strong>Em branco ate importar licitacoes participadas</strong>
            </div>
          </div>
        </InstallSlide>

        <InstallSlide>
          <p className="eyebrow">Pronto</p>
          <h2>Entrar no cockpit operacional.</h2>
          <p>
            Depois de concluir, a aplicacao abre com sidebar de navegacao, conteudo central e chatbox lateral.
            O agente continua usando o mesmo estado local para licitacoes, documentos e propostas.
          </p>
          <div className="install-facts">
            <Fact label="Empresa" value={draft.company.name} />
          </div>
          <button className="primary large" onClick={() => onComplete(draft)}>Finalizar instalacao</button>
        </InstallSlide>
      </div>
      <div className="installer-controls">
        <button className="ghost" disabled={step === 0} onClick={() => setStep((value) => Math.max(value - 1, 0))}>Voltar</button>
        <div className="dots">
          {slides.map((label, index) => (
            <button
              key={label}
              className={step === index ? "dot active" : "dot"}
              aria-label={label}
              onClick={() => setStep(index)}
            />
          ))}
        </div>
        <button
          className="primary continue-button"
          onClick={() => {
            if (step === slides.length - 1) {
              onComplete(draft);
              return;
            }
            setStep((value) => Math.min(value + 1, slides.length - 1));
          }}
        >
          {step === slides.length - 1 ? "Entrar no app" : "Continuar"}
        </button>
      </div>
    </section>
  );
}

function InstallSlide({ children }) {
  return <article className="install-slide">{children}</article>;
}

function Fact({ label, value }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HomeView({ state, onScan }) {


  return (
    <section className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Estado da empresa</p>
          <h1>{state.company.name}</h1>
          <p>{state.company.summary}</p>
        </div>
        <button className="primary command-button" onClick={onScan}>
          <Icon name="refresh" />
          <span>Radar</span>
        </button>
      </header>
      <section className="panel company-state-panel">
        <div>
          <p className="eyebrow">Leitura operacional</p>
          <h2>Empresa preparada por estado, diretriz e evidencias</h2>
          <p>
            Esta tela fica reservada para a narrativa atual da empresa: o que ela pretende disputar,
            quais limites financeiros orientam a busca e como a IA deve interpretar oportunidade,
            risco documental e composicao de proposta.
          </p>
        </div>
        <div className="state-facts">
          <Fact label="Cidade" value={`${state.company.city}/${state.company.state}`} />
          <Fact label="Teto financeiro" value={money.format(Number(state.company.financialCeiling || 0))} />
          <Fact label="Intencao historica" value={state.participatedTenders?.length ? "Inferida por participacoes" : "Em branco"} />
        </div>
      </section>
      {/* <section className="panel intent-panel home-intent">
        <div>
          <p className="eyebrow">Diretriz da empresa</p>
          <h2>Texto que guia radar, proposta e agente</h2>
          <p>A diretriz declarada pesa nos percentuais dos editais e nos argumentos que alimentam a composicao de proposta.</p>
        </div>
        <textarea
          value={intentDraft}
          onChange={(event) => setIntentDraft(event.target.value)}
          placeholder="Ex: obras de infraestrutura urbana, saneamento, reforma predial, manutencao civil, valores ate o teto financeiro..."
        />
        <div className="row-actions">
          <button className="primary" onClick={() => onSaveIntent(intentDraft)}>Salvar diretriz</button>
          <button onClick={onScan}>Recalcular aderencia</button>
        </div>
      </section> */}

    </section>
  );
}

function ProposalTemplateEditor({ state, onReviseSection }) {
  const sections = state.proposalTemplate?.sections || [];
  const [instructions, setInstructions] = useState({});
  return (
    <section className="template-editor-block">
      <header className="template-editor-head">
        <div>
          <p className="eyebrow">Matrizes legais editaveis</p>
          <h3>Blocos textuais orientados pelo agente</h3>
        </div>
        <p>
          Estas matrizes orientam abertura de preco, declaracoes, compromissos documentais e assinatura.
          O modelo DOCX do papel timbrado fica no cadastro da Empresa.
        </p>
      </header>
      <div className="proposal-template-sections">
        {sections.map((section, index) => (
          <article className="proposal-template-section" key={section.id}>
            <div className="template-section-head">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <small>Matriz legal</small>
                <strong>{section.title}</strong>
              </div>
            </div>
            <div className="assistant-behavior-readout matrix-readout">
              <p>{section.prompt}</p>
            </div>
            <label className="field">
              <span>Comentario para IA ajustar esta matriz</span>
              <textarea
                value={instructions[section.id] || ""}
                onChange={(event) => setInstructions((current) => ({ ...current, [section.id]: event.target.value }))}
                placeholder="Ex: deixe esta declaracao mais conservadora, citando validade da proposta e ausencia de impedimento..."
              />
            </label>
            <div className="row-actions">
              <button
                className="primary command-button"
                onClick={() => {
                  onReviseSection(section.id, instructions[section.id] || "");
                  setInstructions((current) => ({ ...current, [section.id]: "" }));
                }}
              >
                <Icon name="edit" />
                <span>Aplicar IA</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function LetterheadTemplatePanel({ template, onSelectTemplate }) {
  return (
    <section className="docx-template-panel letterhead-template-panel">
      <div className="docx-template-meta">
        <div>
          <p className="eyebrow">Papel timbrado</p>
          <h2>Modelo DOCX do papel timbrado</h2>
          <p>Arquivo usado como referencia visual do timbrado da empresa para a geracao das propostas.</p>
        </div>
        <Fact label="Modelo DOCX" value={template?.name || "Nenhum papel timbrado selecionado"} />
        <Fact label="Importado" value={template?.uploadedAt || "Aguardando escolha"} />
        <div className="row-actions">
          <button className="primary command-button" onClick={onSelectTemplate}>
            <Icon name="upload" />
            <span>Escolher DOCX</span>
          </button>
        </div>
      </div>
      <DocxTemplateViewer template={template} />
    </section>
  );
}

function DocxTemplateViewer({ template }) {
  const hasPreview = Boolean(template?.previewHtml || template?.previewText);
  const srcDoc = docxPreviewDocument(template);

  return (
    <div className="docx-viewer-shell">
      <header>
        <div>
          <p className="eyebrow">Visualizador do papel timbrado</p>
          <h4>{template?.name || "Papel timbrado DOCX ainda nao escolhido"}</h4>
        </div>
        {template?.messages?.length ? <span>{template.messages.length} aviso(s)</span> : <span>DOCX</span>}
      </header>
      {hasPreview ? (
        <iframe title="Previa do modelo DOCX" srcDoc={srcDoc} />
      ) : (
        <div className="docx-empty-preview">
          <strong>Escolha um arquivo .docx para ver o papel timbrado aqui.</strong>
          <p>O preview preserva a leitura do documento e imagens incorporadas quando o conversor consegue extrair do Word.</p>
        </div>
      )}
    </div>
  );
}

function docxPreviewDocument(template) {
  const content = template?.previewHtml || `<p>${escapeHtml(template?.previewText || "")}</p>`;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body {
      margin: 0;
      background: #e8e8e8;
      color: #161616;
      font-family: "Times New Roman", serif;
      font-size: 12pt;
      line-height: 1.45;
    }
    .page {
      width: 794px;
      min-height: 1123px;
      margin: 18px auto;
      padding: 72px 76px;
      background: #fff;
      box-shadow: 0 0 0 1px #d0d0d0, 0 10px 28px rgba(0, 0, 0, 0.12);
    }
    img { max-width: 100%; height: auto; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #d0d0d0; padding: 4px; }
    p { margin: 0 0 10px; }
  </style>
</head>
<body><main class="page">${content}</main></body>
</html>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function AgentContextItem({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function AgentSettingsPanel({ state, onSaveAssistant, onReviseAssistant, onReviseProposalSection }) {
  const [displayedBehavior, setDisplayedBehavior] = useState(state.assistantConfig?.behavior || "");
  const [isTypingBehavior, setIsTypingBehavior] = useState(false);
  const [assistantInstruction, setAssistantInstruction] = useState("");

  useEffect(() => {
    if (!isTypingBehavior) setDisplayedBehavior(state.assistantConfig?.behavior || "");
  }, [state.assistantConfig?.behavior, isTypingBehavior]);

  async function reviseAssistant() {
    const next = await onReviseAssistant(assistantInstruction);
    const text = next?.assistantConfig?.behavior || "";
    typeAssistantBehavior(text);
  }

  function typeAssistantBehavior(text) {
    setIsTypingBehavior(true);
    setDisplayedBehavior("");
    let index = 0;
    const chunk = Math.max(2, Math.ceil(text.length / 180));
    const timer = setInterval(() => {
      index = Math.min(text.length, index + chunk);
      setDisplayedBehavior(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(timer);
        setIsTypingBehavior(false);
      }
    }, 16);
  }

  return (
    <section className="panel agent-editor-shell">
      <header className="agent-editor-head">
        <div>
          <p className="eyebrow">Config. Assistente</p>
          <h2>Comportamento editavel do agente</h2>
          <p>
            Texto operacional que orienta tom, proposito, leitura de risco, evidencias documentais e
            composicao de proposta. Abaixo, a mesma area tambem governa as matrizes legais editaveis.
          </p>
        </div>
        <div className="agent-editor-stats">
          <Fact label="Escopo fixo" value="Licitacoes BA, documentos, CATs e proposta" />
          <Fact label="Sistema" value="Instrucoes permanentes preservadas" />
          <Fact label="Matrizes legais" value={`${state.proposalTemplate?.sections?.length || 0} blocos`} />
        </div>
      </header>

      <div className="agent-editor-layout">
        <aside className="agent-editor-rail">
          <div className="agent-rail-title">
            <span>Cabecalho do agente</span>
            <strong>Como o texto deve ficar estruturado</strong>
          </div>
          <dl className="agent-context-list">
            <AgentContextItem label="Proposito" value="Responder como agente operacional da licitacao, com foco em acao e proximo passo." />
            <AgentContextItem label="Tom" value="Portugues direto, conciso e rastreavel, sem esconder risco documental." />
            <AgentContextItem label="Criterios" value="Empresa, documentos, CATs, responsaveis tecnicos, radar Bahia e blocos de proposta." />
            <AgentContextItem label="Saida" value="Diagnostico curto, evidencia pedida e decisao sobre avancar, revisar ou bloquear." />
          </dl>
        </aside>

        <div className="agent-editor-main">
          <section className="agent-text-panel">
            <header className="agent-section-head">
              <div>
                <p className="eyebrow">Texto descritivo do agente</p>
                <h3>Comportamento atual e ajuste assistido</h3>
              </div>
              {isTypingBehavior && <span>Atualizando configuracao...</span>}
            </header>
            <div className="agent-text-grid">
              <div className="assistant-behavior-readout live-readout">
                <span>Texto de comportamento atual</span>
                <p>{displayedBehavior}</p>
              </div>
              <div className="agent-instruction-panel">
                <label className="field">
                  <span>Instrucao para a IA modificar este texto</span>
                  <textarea
                    value={assistantInstruction}
                    onChange={(event) => setAssistantInstruction(event.target.value)}
                    placeholder="Ex: deixe o agente mais objetivo, sempre pedindo a proxima evidencia documental antes de recomendar proposta..."
                  />
                </label>
                <div className="row-actions">
                  <button className="primary command-button" onClick={reviseAssistant} disabled={isTypingBehavior}>
                    <Icon name="edit" />
                    <span>Aplicar IA</span>
                  </button>
                  <button onClick={() => onSaveAssistant(displayedBehavior)} disabled={isTypingBehavior}>Salvar exibido</button>
                </div>
              </div>
            </div>
          </section>
          <ProposalTemplateEditor
            state={state}
            onReviseSection={onReviseProposalSection}
          />
        </div>
      </div>
    </section>
  );
}

function DashboardView({ state, onScan, onOpen }) {
  const criteriaDone = state.criteria.filter((item) => item.status === "Atendido").length;
  const docsOk = state.documents.filter((item) => item.status === "Validado").length;
  const activePortals = state.portalApps.filter((item) => item.active).length;
  return (
    <section className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Cockpit operacional</p>
          <h1>Dashboard</h1>
          <p>Metricas de prontidao, atividade e oportunidades separadas da tela inicial.</p>
        </div>
        <button className="primary command-button" onClick={onScan}>
          <Icon name="refresh" />
          <span>Radar</span>
        </button>
      </header>
      <div className="metric-grid">
        <Metric title="Criterios atendidos" value={`${criteriaDone}/${state.criteria.length}`} detail="manutencao da empresa" onClick={() => onOpen("company")} />
        <Metric title="Documentos validados" value={`${docsOk}/${state.documents.length}`} detail="abrir inventario documental" onClick={() => onOpen("documents")} />
        <Metric title="Portais ativos" value={activePortals} detail="formularios externos" onClick={() => onOpen("portals")} />
        <Metric title="Editais aderentes" value={state.bahia.notifications.length} detail="abrir radar Bahia" onClick={() => onOpen("bahia")} />
      </div>
      <div className="split">
        <Panel title="Radar Bahia">
          <TenderList items={state.bahia.notifications} />
        </Panel>
        <Panel title="Atividade recente">
          <ul className="activity">
            {(state.activity || []).slice(0, 10).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </Panel>
      </div>
    </section>
  );
}

function CompanyView({
  state,
  onConfigure,
  onUploadBalance,
  onSave,
  onUploadDocument,
  onVerifyDocument,
  onSelectLetterheadTemplate
}) {
  const companyDocuments = (state.documents || []).filter((doc) => ["doc_certidoes", "doc_dfl"].includes(doc.id));

  function updateCompanyDocument(id, patch) {
    const documents = (state.documents || []).map((item) => (item.id === id ? { ...item, ...patch } : item));
    onSave({ documents });
  }
  const balanceSeries = state.companyMaintenance?.balanceSeries || [];
  return (
    <section className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Cadastro administrativo</p>
          <h1>Empresa</h1>
        </div>
        <button className="icon-button primary" onClick={onConfigure} title="Configurar cadastro" aria-label="Configurar cadastro">
          <Icon name="settings" />
			  </button>
      </header>
      <section className="panel company-fixed-panel">
        <div>
          <p className="eyebrow">Cadastro fixo</p>
          <h2>{state.company.name}</h2>
          <p>{state.company.summary}</p>
        </div>
        <div className="company-read-grid">
          <Fact label="CNPJ" value={state.company.cnpj || "Nao informado"} />
          <Fact label="Cidade" value={`${state.company.city || "Nao informada"}/${state.company.state || "--"}`} />
          <Fact label="Teto financeiro" value={money.format(Number(state.company.financialCeiling || 0))} />
          <Fact label="Diretriz" value={state.company.intent ? "Declarada na tela Inicio" : "Em branco"} />
        </div>
        <button className="command-button" onClick={onConfigure}>
          <Icon name="settings" />
          <span>Cadastro</span>
        </button>
      </section>
      <CompanyInstitutionalPanel
        company={state.company}
        onSave={(companyPatch) => onSave({ company: { ...state.company, ...companyPatch } })}
      />
      <LetterheadTemplatePanel
        template={state.company?.letterhead?.template || {}}
        onSelectTemplate={onSelectLetterheadTemplate}
      />
      <Panel title="Fonte da intencao historica">
        <p>
          A intencao historica nao e preenchida manualmente na instalacao. Ela e inferida pelos itens, CNAEs, objetos e orgaos das licitacoes participadas pela empresa. A intencao declarada da busca atual fica na tela Inicio.
        </p>
      </Panel>
      <section className="panel maintenance-panel">
        <div className="maintenance-head">
          <div>
            <p className="eyebrow">Manutencao da empresa</p>
            <h2>Balanco medido ao longo do tempo</h2>
            <p>{state.companyMaintenance?.balanceInference}</p>
          </div>
          <button className="primary command-button" onClick={onUploadBalance}>
            <Icon name="upload" />
            <span>Excel</span>
          </button>
        </div>
        <BalanceChart series={balanceSeries} />
        {state.companyMaintenance?.balanceSource && (
          <div className="balance-source">
            <Fact label="Arquivo" value={state.companyMaintenance.balanceSource.name} />
            <Fact label="Aba" value={state.companyMaintenance.balanceSource.sheet} />
            <Fact label="Linhas" value={state.companyMaintenance.balanceSource.rows} />
            <Fact label="Importado" value={state.companyMaintenance.balanceSource.importedAt} />
          </div>
        )}
      </section>
      <section className="company-document-admin">
        <header>
          <div>
            <p className="eyebrow">Administracao documental formal</p>
            <h2>Certidoes e demonstrativos editaveis</h2>
            <p>Regularidade e economico-financeiro ficam junto ao cadastro da empresa, porque sustentam habilitacao, limite e risco formal antes da proposta.</p>
          </div>
        </header>
        <div className="company-document-grid">
          {companyDocuments.map((doc) => (
            <EditableCompanyDocumentCard
              key={doc.id}
              doc={doc}
              onSave={(patch) => updateCompanyDocument(doc.id, patch)}
              onUpload={() => onUploadDocument(doc.id)}
              onVerify={() => onVerifyDocument(doc.id)}
            />
          ))}
        </div>
		  </section>
    </section>
  );
}

function CompanyInstitutionalPanel({ company, onSave }) {
  const [draft, setDraft] = useState(() => companyInstitutionalDraft(company));

  useEffect(() => {
    setDraft(companyInstitutionalDraft(company));
  }, [company]);

  function patch(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function patchInstitutional(field, value) {
    setDraft((current) => ({
      ...current,
      institutional: {
        ...(current.institutional || {}),
        [field]: value
      }
    }));
  }

  function patchCnae(index, field, value) {
    setDraft((current) => {
      const cnaes = [...(current.cnaes || [])];
      cnaes[index] = { ...(cnaes[index] || {}), [field]: value };
      if (field === "primary" && value) {
        cnaes.forEach((item, itemIndex) => {
          item.primary = itemIndex === index;
        });
      }
      return { ...current, cnaes };
    });
  }

  function addCnae() {
    setDraft((current) => ({
      ...current,
      cnaes: [
        ...(current.cnaes || []),
        { code: "", description: "Nova atividade economica", primary: !(current.cnaes || []).length }
      ]
    }));
  }

  function removeCnae(index) {
    setDraft((current) => {
      const cnaes = (current.cnaes || []).filter((_, itemIndex) => itemIndex !== index);
      if (cnaes.length && !cnaes.some((item) => item.primary)) cnaes[0] = { ...cnaes[0], primary: true };
      return { ...current, cnaes };
    });
  }

  function save() {
    onSave({
      name: draft.name,
      cnpj: draft.cnpj,
      city: draft.city,
      state: draft.state,
      summary: draft.summary,
      mission: draft.mission,
      values: linesFromTextarea(draft.valuesText),
      cnaes: normalizeCompanyCnaes(draft.cnaes),
      institutional: {
        positioning: draft.institutional.positioning,
        audience: draft.institutional.audience,
        differentials: draft.institutional.differentials
      }
    });
  }

  return (
    <section className="company-institutional-panel">
      <header>
        <div>
          <p className="eyebrow">Sessao institucional</p>
          <h2>Identidade, CNAEs e narrativa da empresa</h2>
          <p>Cadastro usado pela IA para interpretar aderencia, linguagem de proposta, risco documental e escopo institucional.</p>
        </div>
        <button className="primary command-button" onClick={save}>
          <Icon name="edit" />
          <span>Salvar institucional</span>
        </button>
      </header>

      <div className="company-institutional-grid">
        <section className="institutional-form">
          <div className="form-grid company-identity-grid">
            <label className="field wide">
              <span>Razao / nome operacional</span>
              <input value={draft.name} onChange={(event) => patch("name", event.target.value)} />
            </label>
            <label className="field">
              <span>CNPJ</span>
              <input value={draft.cnpj} onChange={(event) => patch("cnpj", event.target.value)} />
            </label>
            <label className="field">
              <span>Cidade</span>
              <input value={draft.city} onChange={(event) => patch("city", event.target.value)} />
            </label>
            <label className="field">
              <span>UF</span>
              <input value={draft.state} onChange={(event) => patch("state", event.target.value.toUpperCase().slice(0, 2))} />
            </label>
            <label className="field wide">
              <span>Resumo institucional</span>
              <textarea value={draft.summary} onChange={(event) => patch("summary", event.target.value)} />
            </label>
            <label className="field wide">
              <span>Missao</span>
              <textarea value={draft.mission} onChange={(event) => patch("mission", event.target.value)} />
            </label>
            <label className="field">
              <span>Publico / interlocutores</span>
              <textarea value={draft.institutional.audience} onChange={(event) => patchInstitutional("audience", event.target.value)} />
            </label>
            <label className="field">
              <span>Posicionamento</span>
              <textarea value={draft.institutional.positioning} onChange={(event) => patchInstitutional("positioning", event.target.value)} />
            </label>
            <label className="field">
              <span>Diferenciais</span>
              <textarea value={draft.institutional.differentials} onChange={(event) => patchInstitutional("differentials", event.target.value)} />
            </label>
          </div>
        </section>

        <aside className="institutional-side">
          <label className="field">
            <span>Valores institucionais</span>
            <textarea
              value={draft.valuesText}
              onChange={(event) => patch("valuesText", event.target.value)}
              placeholder="Um valor por linha"
            />
          </label>
          <div className="company-values-preview">
            {linesFromTextarea(draft.valuesText).map((value) => <span key={value}>{value}</span>)}
          </div>
        </aside>
      </div>

      <section className="company-cnae-section">
        <header>
          <div>
            <p className="eyebrow">CNAEs</p>
            <h3>Atividades economicas vinculadas ao radar</h3>
          </div>
          <button className="command-button" onClick={addCnae}>
            <Icon name="fileText" />
            <span>Adicionar CNAE</span>
          </button>
        </header>
        <div className="company-cnae-list">
          {(draft.cnaes || []).map((cnae, index) => (
            <article className={cnae.primary ? "company-cnae-card primary-cnae" : "company-cnae-card"} key={`${cnae.code}-${index}`}>
              <label className="field">
                <span>Codigo</span>
                <input value={cnae.code || ""} onChange={(event) => patchCnae(index, "code", event.target.value)} />
              </label>
              <label className="field">
                <span>Descricao da atividade</span>
                <input value={cnae.description || ""} onChange={(event) => patchCnae(index, "description", event.target.value)} />
              </label>
              <label className="settings-toggle">
                <input type="checkbox" checked={Boolean(cnae.primary)} onChange={(event) => patchCnae(index, "primary", event.target.checked)} />
                <span>CNAE principal</span>
              </label>
              <button className="icon-action" onClick={() => removeCnae(index)} title="Remover CNAE" aria-label="Remover CNAE">
                <Icon name="x" />
              </button>
            </article>
          ))}
          {!(draft.cnaes || []).length && <div className="empty">Adicione CNAEs para orientar aderencia e natureza dos editais.</div>}
        </div>
      </section>
    </section>
  );
}

function companyInstitutionalDraft(company) {
  const institutional = company?.institutional || {};
  return {
    name: company?.name || "",
    cnpj: company?.cnpj || "",
    city: company?.city || "",
    state: company?.state || "",
    summary: company?.summary || "",
    mission: company?.mission || "",
    valuesText: (company?.values || []).join("\n"),
    cnaes: normalizeCompanyCnaes(company?.cnaes || []),
    institutional: {
      positioning: institutional.positioning || "",
      audience: institutional.audience || "",
      differentials: institutional.differentials || ""
    }
  };
}

function linesFromTextarea(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCompanyCnaes(cnaes) {
  const normalized = (cnaes || [])
    .map((item, index) => ({
      code: String(item?.code || "").trim(),
      description: String(item?.description || "").trim(),
      primary: Boolean(item?.primary)
    }))
    .filter((item) => item.code || item.description);
  const primaryIndex = Math.max(0, normalized.findIndex((item) => item.primary));
  return normalized.map((item, index) => ({ ...item, primary: index === primaryIndex }));
}

function EditableCompanyDocumentCard({ doc, onSave, onUpload, onVerify }) {
  const [draft, setDraft] = useState(() => documentDraftFrom(doc));
  const readiness = documentAiReadiness(doc);

  useEffect(() => {
    setDraft(documentDraftFrom(doc));
  }, [doc]);

  function patch(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function save() {
    onSave({
      name: draft.name,
      status: draft.status,
      role: draft.role,
      sample: draft.sample,
      summary: draft.summary
    });
  }

  return (
    <article className="editable-document-card">
      <div className="document-card-top">
        <span>{doc.kind}</span>
        <strong>{doc.status}</strong>
      </div>
      <div className="editable-doc-title">
        <label className="field">
          <span>Nome do item</span>
          <input value={draft.name} onChange={(event) => patch("name", event.target.value)} />
        </label>
        <label className="field">
          <span>Status</span>
          <select value={draft.status} onChange={(event) => patch("status", event.target.value)}>
            {["Pendente", "Revisar", "Validado", "Bloqueado"].map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Papel na habilitacao</span>
        <textarea value={draft.role} onChange={(event) => patch("role", event.target.value)} />
      </label>
      <label className="field">
        <span>Amostra / criterio esperado</span>
        <textarea value={draft.sample} onChange={(event) => patch("sample", event.target.value)} />
      </label>
      <label className="field">
        <span>Resumo por IA ou operador</span>
        <textarea
          value={draft.summary}
          onChange={(event) => patch("summary", event.target.value)}
          placeholder="Resumo do conteudo, validade, titularidade e risco para licitacao."
        />
      </label>
      <div className={doc.file ? "document-file ready" : "document-file"}>
        <span>Arquivo do usuario</span>
        <strong>{doc.file?.name || "Nenhum arquivo enviado"}</strong>
        {doc.file?.uploadedAt && <small>Enviado em {doc.file.uploadedAt}</small>}
      </div>
      <div className={`document-ai-readiness ${readiness.level}`}>
        <div>
          <span>Prontidao IA do slot</span>
          <strong>{readiness.score}%</strong>
        </div>
        <progress value={readiness.score} max="100" />
        <p>{readiness.detail}</p>
      </div>
      {doc.verification?.checks?.length ? (
        <div className="document-checks compact-checks">
          {doc.verification.checks.slice(0, 4).map((check) => (
            <div className={`document-check ${check.status}`} key={check.title}>
              <span>{check.title}</span>
              <small>{check.detail}</small>
            </div>
          ))}
        </div>
      ) : null}
      <div className="document-actions editable-document-actions">
        <button className="primary icon-action" onClick={onUpload} title="Upload" aria-label={`Upload ${doc.name}`}>
          <Icon name="upload" />
        </button>
        <button className="icon-action" disabled={!doc.file} onClick={onVerify} title="Verificar" aria-label={`Verificar ${doc.name}`}>
          <Icon name="check" />
        </button>
        <button className="icon-action" onClick={save} title="Salvar edicao" aria-label={`Salvar ${doc.name}`}>
          <Icon name="edit" />
        </button>
      </div>
    </article>
  );
}

function documentDraftFrom(doc) {
  return {
    name: doc?.name || "",
    status: doc?.status || "Pendente",
    role: doc?.role || documentRole(doc?.kind),
    sample: doc?.sample || "",
    summary: doc?.summary || ""
  };
}

function documentAiReadiness(doc) {
  const score = doc?.file?.localPath ? Number(doc?.confidence || 0) : 0;
  const slotCheck = (doc?.verification?.checks || []).find((check) => /correspondencia|slot/i.test(check.title));
  const detail = doc?.file?.localPath
    ? slotCheck?.detail || doc?.summary || "A IA avaliou o arquivo enviado contra o papel esperado deste slot documental."
    : "Envie um arquivo para a IA avaliar se ele corresponde a este slot documental.";
  return {
    score,
    detail,
    level: score >= 70 ? "good" : score >= 40 ? "warn" : "risk"
  };
}

function DocumentsView({ state, onSave, onUploadCat, onEvaluateCatCompatibility }) {
  const cats = normalizeCats(state.cats || []);
  const [selectedCatId, setSelectedCatId] = useState("");
  const selectedCat = cats.find((item) => item.id === selectedCatId);
  const compatibilityTender = selectedTenderForCompatibility(state);

  function saveCats(nextCats) {
    onSave({ cats: nextCats });
  }

  function updateCat(id, patch) {
    saveCats(cats.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addCat() {
    const id = `cat-${Date.now()}`;
    const next = [
      ...cats,
      normalizeCat({
        id,
        title: "Nova CAT ou atestado tecnico",
        scope: "Escopo tecnico a preencher",
        status: "Pendente",
        documentType: "CAT",
        area: "Obras Civis"
      })
    ];
    saveCats(next);
    setSelectedCatId(id);
  }

  if (selectedCat) {
    return (
      <CatDetailPage
        cat={selectedCat}
        responsaveis={state.responsaveis || []}
        compatibilityTender={compatibilityTender}
        onBack={() => setSelectedCatId("")}
        onSave={(patch) => updateCat(selectedCat.id, patch)}
        onUpload={() => onUploadCat(selectedCat.id)}
        onEvaluateCompatibility={() => onEvaluateCatCompatibility?.(selectedCat.id, compatibilityTender?.id)}
      />
    );
  }

  return (
    <section className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">CATs e responsaveis</p>
          <h1>Acervo tecnico</h1>
          <p>As certidoes e demonstrativos financeiros ficam na pagina Empresa. Aqui ficam CATs, atestados e vinculos tecnicos, em coluna vertical e com ficha dedicada por documento.</p>
        </div>
        <button className="primary command-button" onClick={addCat}>
          <Icon name="fileText" />
          <span>Nova CAT</span>
        </button>
      </header>
      <div className="cat-admin-page">
        <section className="cat-column">
          {cats.map((cat) => (
            <CatDocumentCard
              key={cat.id}
              cat={cat}
              responsavel={responsavelForCat(cat, state.responsaveis || [])}
              tender={compatibilityTender}
              onOpen={() => setSelectedCatId(cat.id)}
              onUpload={() => onUploadCat(cat.id)}
            />
          ))}
        </section>
        <aside className="cat-side-panel">
          <Panel title="Responsaveis tecnicos">
            <ul className="activity">
              {(state.responsaveis || []).map((item) => <li key={item.id}>{item.name} - {item.status}</li>)}
            </ul>
          </Panel>
          <Panel title="Leitura operacional">
            <p>Use cada ficha de CAT para amarrar escopo, municipio, responsavel tecnico e arquivo PDF. A compatibilidade com edital so aparece depois da leitura LLM do PDF contra o edital em foco.</p>
          </Panel>
        </aside>
      </div>
    </section>
  );
}

function CatDocumentCard({ cat, responsavel, tender, onOpen, onUpload }) {
  const evaluation = documentTenderCompatibility(cat, tender);
  const score = compatibilityScore(evaluation);
  const level = compatibilityLevel(score);
  const compatibilityLabel = score === null ? "Nao avaliada" : `${score}%`;
  return (
    <article className="cat-card">
      <div className="cat-card-main">
        <div className="document-card-top">
          <span>{cat.documentType}</span>
          <strong>{cat.status}</strong>
        </div>
        <h2>{cat.title}</h2>
        <p>{cat.scope}</p>
        <dl className="cat-card-facts">
          <div><dt>Area</dt><dd>{cat.area}</dd></div>
          <div><dt>Municipio</dt><dd>{cat.municipality}</dd></div>
          <div><dt>Responsavel</dt><dd>{responsavel?.name || cat.responsibleName}</dd></div>
          <div><dt>Documento</dt><dd>{cat.file?.name || "PDF nao anexado"}</dd></div>
        </dl>
        <div className={`cat-card-compat ${level}`}>
          <div>
            <span>Compatibilidade LLM com edital</span>
            <strong>{compatibilityLabel}</strong>
          </div>
          {score === null ? (
            <p>{tender ? `Aguardando leitura do PDF contra ${tenderTitle(tender)}.` : "Selecione um edital para gerar a metrica por LLM."}</p>
          ) : (
            <progress value={score} max="100" />
          )}
          {evaluation?.summary && <small>{evaluation.summary}</small>}
        </div>
      </div>
      <div className="cat-card-actions">
        <button className="primary command-button" onClick={onOpen}>
          <Icon name="fileText" />
          <span>Abrir ficha</span>
        </button>
        <button className="icon-button" onClick={onUpload} title="Anexar PDF" aria-label={`Anexar PDF ${cat.title}`}>
          <Icon name="upload" />
        </button>
      </div>
    </article>
  );
}

function CatDetailPage({ cat, responsaveis, compatibilityTender, onBack, onSave, onUpload, onEvaluateCompatibility }) {
  const [draft, setDraft] = useState(() => ({ ...cat }));
  const pdfSrc = pdfSrcFromFile(cat.file);
  const evaluation = documentTenderCompatibility(cat, compatibilityTender);

  useEffect(() => {
    setDraft({ ...cat });
  }, [cat]);

  function patch(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function save() {
    onSave({
      title: draft.title,
      documentType: draft.documentType,
      status: draft.status,
      scope: draft.scope,
      area: draft.area,
      municipality: draft.municipality,
      organ: draft.organ,
      number: draft.number,
      issuedAt: draft.issuedAt,
      validity: draft.validity,
      responsibleId: draft.responsibleId,
      responsibleName: draft.responsibleName,
      notes: draft.notes
    });
  }

  return (
    <section className="view cat-detail-view">
      <header className="view-head">
        <button onClick={onBack}>Voltar</button>
        <div>
          <p className="eyebrow">Ficha tecnica dedicada</p>
          <h1>{cat.title}</h1>
          <p>Formulario de edicao da CAT com o PDF do documento dentro da propria ficha.</p>
        </div>
        <button className="primary command-button" onClick={save}>
          <Icon name="edit" />
          <span>Salvar</span>
        </button>
      </header>
      <div className="cat-detail-layout">
        <section className="cat-edit-panel">
          <div className="form-grid cat-form-grid">
            <label className="field wide">
              <span>Titulo do documento</span>
              <input value={draft.title || ""} onChange={(event) => patch("title", event.target.value)} />
            </label>
            <label className="field">
              <span>Tipo</span>
              <select value={draft.documentType || "CAT"} onChange={(event) => patch("documentType", event.target.value)}>
                <option value="CAT">CAT</option>
                <option value="Atestado tecnico">Atestado tecnico</option>
                <option value="Acervo CREA">Acervo CREA</option>
                <option value="CAO/CREA">CAO/CREA</option>
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select value={draft.status || "Pendente"} onChange={(event) => patch("status", event.target.value)}>
                {["Pendente", "Em validacao", "Revisar", "Validado", "Bloqueado"].map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Numero / protocolo</span>
              <input value={draft.number || ""} onChange={(event) => patch("number", event.target.value)} />
            </label>
            <label className="field">
              <span>Orgao emissor</span>
              <input value={draft.organ || ""} onChange={(event) => patch("organ", event.target.value)} />
            </label>
            <label className="field">
              <span>Municipio</span>
              <input value={draft.municipality || ""} onChange={(event) => patch("municipality", event.target.value)} />
            </label>
            <label className="field">
              <span>Area</span>
              <input value={draft.area || ""} onChange={(event) => patch("area", event.target.value)} />
            </label>
            <label className="field">
              <span>Emissao</span>
              <input value={draft.issuedAt || ""} onChange={(event) => patch("issuedAt", event.target.value)} />
            </label>
            <label className="field">
              <span>Validade</span>
              <input value={draft.validity || ""} onChange={(event) => patch("validity", event.target.value)} />
            </label>
            <label className="field">
              <span>Responsavel tecnico</span>
              <select value={draft.responsibleId || ""} onChange={(event) => patch("responsibleId", event.target.value)}>
                <option value="">A vincular</option>
                {responsaveis.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="field wide">
              <span>Escopo executado</span>
              <textarea value={draft.scope || ""} onChange={(event) => patch("scope", event.target.value)} />
            </label>
            <label className="field wide">
              <span>Notas tecnicas para proposta</span>
              <textarea
                value={draft.notes || ""}
                onChange={(event) => patch("notes", event.target.value)}
                placeholder="Ex: comprova assentamento de tubulacao PVC DN >= 200mm, com extensao compativel."
              />
            </label>
          </div>
          <CatCompatibilityPanel
            cat={cat}
            tender={compatibilityTender}
            evaluation={evaluation}
            onEvaluate={onEvaluateCompatibility}
          />
        </section>
        <section className="cat-pdf-panel">
          <header>
            <div>
              <p className="eyebrow">PDF da CAT</p>
              <h2>{cat.file?.name || "Nenhum PDF anexado"}</h2>
            </div>
            <button className="primary command-button" onClick={onUpload}>
              <Icon name="upload" />
              <span>Anexar</span>
            </button>
          </header>
          <div className={cat.file ? "document-file ready" : "document-file"}>
            <span>Arquivo do usuario</span>
            <strong>{cat.file?.name || "Selecione o PDF da CAT ou atestado tecnico."}</strong>
            {cat.file?.uploadedAt && <small>Enviado em {cat.file.uploadedAt}</small>}
          </div>
          <div className="cat-pdf-viewer">
            {pdfSrc ? (
              <webview key={pdfSrc} src={pdfSrc} />
            ) : (
              <div className="empty">O PDF aparece aqui depois do upload.</div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function CatCompatibilityPanel({ cat, tender, evaluation, onEvaluate }) {
  const score = compatibilityScore(evaluation);
  const level = compatibilityLevel(score);
  const canEvaluate = Boolean(cat.file?.localPath && tender);
  return (
    <section className={`cat-compat-panel ${level}`}>
      <header>
        <div>
          <p className="eyebrow">Compatibilidade por LLM</p>
          <h3>{tender ? tenderTitle(tender) : "Nenhum edital em foco"}</h3>
        </div>
        <strong>{score === null ? "IA" : `${score}%`}</strong>
      </header>
      <p>
        {evaluation?.summary ||
          evaluation?.reason ||
          (canEvaluate
            ? "A nota sera calculada lendo o PDF desta CAT contra os requisitos do edital selecionado."
            : "Anexe um PDF e selecione um edital para que a LLM gere a metrica.")}
      </p>
      {evaluation?.evidence?.length ? (
        <ul>
          {evaluation.evidence.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
      {evaluation?.gaps?.length ? (
        <div className="cat-compat-gaps">
          <span>Lacunas</span>
          {evaluation.gaps.slice(0, 3).map((item) => <small key={item}>{item}</small>)}
        </div>
      ) : null}
      {score !== null && <progress value={score} max="100" />}
      <div className="row-actions">
        <button className="primary command-button" onClick={onEvaluate} disabled={!canEvaluate}>
          <Icon name="check" />
          <span>Avaliar com IA</span>
        </button>
        {evaluation?.evaluatedAt && <small>Avaliado em {evaluation.evaluatedAt}</small>}
      </div>
    </section>
  );
}

function normalizeCats(cats) {
  return (cats || []).map(normalizeCat);
}

function normalizeCat(cat) {
  return {
    id: cat?.id || `cat-${Date.now()}`,
    title: cat?.title || "CAT ou atestado tecnico",
    documentType: cat?.documentType || "CAT",
    scope: cat?.scope || "Escopo tecnico a preencher",
    status: cat?.status || "Pendente",
    area: cat?.area || "Obras Civis",
    municipality: cat?.municipality || "Bahia",
    organ: cat?.organ || "CREA/CAU a confirmar",
    number: cat?.number || "",
    issuedAt: cat?.issuedAt || "",
    validity: cat?.validity || "Acervo tecnico sem validade operacional definida",
    responsibleId: cat?.responsibleId || "",
    responsibleName: cat?.responsibleName || "Responsavel tecnico a vincular",
    readiness: Number(cat?.readiness ?? cat?.confidence ?? 0),
    notes: cat?.notes || "",
    summary: cat?.summary || "",
    verification: cat?.verification || null,
    tenderCompatibility: cat?.tenderCompatibility || {},
    file: cat?.file || null
  };
}

function responsavelForCat(cat, responsaveis) {
  return (responsaveis || []).find((item) => item.id === cat.responsibleId) || null;
}

function selectedTenderForCompatibility(state) {
  const tenders = state.bahia?.notifications || [];
  const selectedId = state.proposalProcess?.proposalDetailId || state.proposalProcess?.selectedTenderId || "";
  return tenders.find((item) => item.id === selectedId) || tenders[0] || null;
}

function documentTenderCompatibility(document, tender) {
  if (!document || !tender) return null;
  const records = document.tenderCompatibility || {};
  return records[tender.id] || Object.values(records).find((item) => item?.tenderId === tender.id) || null;
}

function tenderDocumentCompatibilityRecords(tender, state) {
  if (!tender) return [];
  const documents = (state.documents || []).map((doc) => ({
    id: doc.id,
    label: doc.name,
    kind: doc.kind,
    fileName: doc.file?.name || "",
    evaluation: documentTenderCompatibility(doc, tender)
  }));
  const cats = normalizeCats(state.cats || []).map((cat) => ({
    id: cat.id,
    label: cat.title,
    kind: "Tecnico",
    fileName: cat.file?.name || "",
    evaluation: documentTenderCompatibility(cat, tender)
  }));
  return [...documents, ...cats].filter((item) => item.evaluation);
}

function compatibilityScore(evaluation) {
  const score = Number(evaluation?.score);
  return Number.isFinite(score) ? clampNumber(score, 0, 100) : null;
}

function compatibilityLevel(score) {
  if (score === null) return "pending";
  if (score >= 70) return "good";
  if (score >= 40) return "warn";
  return "risk";
}

function tenderTitle(tender) {
  return tender?.title || tender?.licitacaoFormatada || tender?.numero || tender?.id || "Edital sem titulo";
}

function pdfSrcFromFile(file) {
  const source = file?.fileUrl || file?.localPath || "";
  if (!source) return "";
  if (/^https?:\/\//i.test(source) || /^file:/i.test(source)) return source;
  const normalized = String(source).replace(/\\/g, "/").replace(/#/g, "%23").replace(/\?/g, "%3F").replace(/ /g, "%20");
  return `file:///${normalized.replace(/^\/+/, "")}`;
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function documentRole(kind) {
  return {
    Regularidade: "Comprova habilitacao formal e reduz risco de inabilitacao.",
    "Economico-financeiro": "Demonstra capacidade financeira para sustentar proposta e execucao.",
    Tecnico: "Conecta experiencia, escopo e responsavel tecnico ao criterio do edital."
  }[kind] || "Documento operacional vinculado a um criterio da licitacao.";
}

function BalanceChart({ series }) {
  if (!series?.length) return <div className="empty">Importe uma planilha para montar o grafico.</div>;
  const max = Math.max(...series.flatMap((item) => [Math.abs(item.revenue || 0), Math.abs(item.expense || 0), Math.abs(item.balance || 0)]), 1);
  const width = 720;
  const height = 260;
  const pad = 34;
  const step = series.length > 1 ? (width - pad * 2) / (series.length - 1) : 1;
  const y = (value) => height - pad - (Math.max(0, value) / max) * (height - pad * 2);
  const line = (key) =>
    series
      .map((item, index) => `${pad + index * step},${y(item[key] || 0)}`)
      .join(" ");
  return (
    <div className="balance-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafico de balanco financeiro">
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} />
        <polyline className="revenue-line" points={line("revenue")} />
        <polyline className="expense-line" points={line("expense")} />
        <polyline className="balance-line" points={line("balance")} />
        {series.map((item, index) => (
          <g key={`${item.period}-${index}`}>
            <circle className="balance-dot" cx={pad + index * step} cy={y(item.balance || 0)} r="4" />
            <text x={pad + index * step} y={height - 8} textAnchor="middle">{shortPeriod(item.period)}</text>
          </g>
        ))}
      </svg>
      <div className="balance-legend">
        <span className="revenue-line">Receita</span>
        <span className="expense-line">Despesa</span>
        <span className="balance-line">Saldo</span>
      </div>
    </div>
  );
}

function shortPeriod(period) {
  const text = String(period || "");
  return text.length > 9 ? text.slice(0, 9) : text;
}

function buildProposalDossier({ state, selectedTender, process }) {
  const lines = [
    `Proposta - ${state.company.name}`,
    `Status: ${process.status || "Em composicao"}`,
    `Edital: ${selectedTender?.title || selectedTender?.licitacaoFormatada || "Nao selecionado"}`,
    `Orgao: ${selectedTender?.orgao || "Nao informado"}`,
    `Aderencia: ${selectedTender?.proposalFit?.proposalPercent || selectedTender?.proposalPercent || 0}%`,
    "",
    "Anexos/documentos da proposta:"
  ];
  for (const doc of state.documents || []) {
    const detail = process.documentDetails?.[doc.id] || {};
    lines.push(
      "",
      `- ${doc.name}`,
      `  Estado documental: ${doc.status} (${doc.confidence}%)`,
      `  Anexo na proposta: ${detail.included ? "incluido" : "nao incluido"}`,
      `  Revisao: ${detail.proposalStatus || "pendente"}`,
      `  Arquivo: ${doc.file?.name || "sem arquivo enviado"}`,
      `  Criterios: ${proposalDocumentChecklist(doc).join("; ")}`
    );
  }
  return lines.join("\n");
}

function AgentsView({ state, onRun, onRunAll }) {
  return (
    <section className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Trabalho de agente</p>
          <h1>Fila operacional</h1>
        </div>
        <button className="primary" onClick={onRunAll}>Executar fila</button>
      </header>
      <div className="card-list">
        {state.agentTasks.map((task) => (
          <article className="item-card" key={task.id}>
            <strong>{task.name}</strong>
            <span>{task.status}</span>
            <p>{task.result}</p>
            <button onClick={() => onRun(task.id)}>Executar</button>
          </article>
        ))}
      </div>
      <Panel title="Contrato do agente">
        <p>
          O agente transforma texto em criterio, criterio em cobertura, cobertura em estado, e estado em acao
          rastreavel sobre documento, CAT, responsavel tecnico, bloco de proposta ou licitacao.
        </p>
      </Panel>
    </section>
  );
}

const proposalSteps = [
  { id: "triagem", title: "Triagem", detail: "Escolher edital e tese de participacao" },
  { id: "documentos", title: "Documentos", detail: "Fechar habilitacao e inventario" },
  { id: "tecnica", title: "Tecnica", detail: "CATs, equipe, metodo e escopo" },
  { id: "preco", title: "Preco", detail: "Composicao, teto e margem" },
  { id: "fechamento", title: "Fechamento", detail: "Riscos, anexos e protocolo" }
];

const proposalCategoryFilters = [
  { id: "", label: "Todas as categorias" },
  { id: "obras", label: "Obras e infraestrutura", itens: ["obra"] },
  { id: "saneamento", label: "Saneamento / hidrica", itens: ["saneamento"] },
  { id: "engenharia", label: "Servicos de engenharia", itens: ["engenharia"] },
  { id: "bens", label: "Bens e materiais", itens: ["aquisicao"] },
  { id: "tecnologia", label: "Tecnologia / informatica", itens: ["informatica"] },
  { id: "saude", label: "Saude", itens: ["saude"] }
];

const proposalNatureFilters = [
  { id: "", label: "Todas as naturezas" },
  { id: "tecnica", label: "Exige tecnico / CAT", itens: ["atest"] },
  { id: "financeira", label: "Exige financeiro", itens: ["financeir"] },
  { id: "regularidade", label: "Regularidade e habilitacao", itens: ["regularidade"] },
  { id: "registro-precos", label: "Registro de precos", itens: ["registro de precos"] },
  { id: "entrega-digital", label: "Entrega digital", entrega: ["digital"] },
  { id: "concorrencia", label: "Concorrencia publica", modalidades: ["Concorrencia"] },
  { id: "pregao", label: "Pregao eletronico", modalidades: ["Pregao"] }
];

function ProposalsView({ state, onSave, onCreateProposal, onEvaluateTenderDocuments, onOpen }) {
  const process = state.proposalProcess || {};
  const proposals = state.proposals || [];
  const tenderSummaries = state.bahia.notifications || [];
  const workingTenderSeeds = useMemo(
    () => proposalWorkingTenderSeeds(process, proposals, tenderSummaries),
    [process, proposals, tenderSummaries]
  );
  const workingTenderIds = workingTenderSeeds.map((item) => item.id).join("|");
  const [tenderDetails, setTenderDetails] = useState({});
  const [pdfReader, setPdfReader] = useState(null);
  const workTenders = useMemo(
    () => workingTenderSeeds.map((item) => mergeTenderDetail(item, tenderDetails[item.id])).filter(Boolean),
    [workingTenderSeeds, tenderDetails]
  );
  const selectedTenderSummary =
    workTenders.find((item) => item.id === process.selectedTenderId) ||
    workTenders[0] ||
    null;
  const selectedTenderId = process.selectedTenderId || selectedTenderSummary?.id || "";
  const selectedTender = useMemo(
    () => selectedTenderSummary,
    [selectedTenderSummary]
  );
  const focusedTender = process.proposalDetailId
    ? workTenders.find((item) => item.id === process.proposalDetailId) || selectedTender
    : null;
  const pdfReaderTender = pdfReader?.tenderId
    ? workTenders.find((item) => item.id === pdfReader.tenderId) || focusedTender || selectedTender
    : null;
  const readiness = proposalReadiness(state);
  const docReadiness = proposalDocumentReadiness(state);

  useEffect(() => {
    let alive = true;
    if (!workingTenderSeeds.length) {
      setTenderDetails({});
      return () => {
        alive = false;
      };
    }
    Promise.all(
      workingTenderSeeds.map((item) =>
        api.openEditalDetail(item.id)
          .then((detail) => [item.id, detail])
          .catch(() => [item.id, null])
      )
    ).then((entries) => {
      if (!alive) return;
      setTenderDetails(Object.fromEntries(entries.filter(([, detail]) => detail)));
    });
    return () => {
      alive = false;
    };
  }, [workingTenderIds]);

  function saveProcess(patch) {
    onSave({ proposalProcess: { ...process, ...patch } });
  }

  function createProposal() {
    if (!selectedTender) return;
    onCreateProposal(selectedTender.id);
  }

  async function createProposalFromTender(tender) {
    if (!tender) return;
    await onSave({
      proposalProcess: {
        ...process,
        selectedTenderId: tender.id,
        proposalDetailId: tender.id,
        activeStep: "triagem",
        workingTenders: upsertWorkingTender(process.workingTenders || [], tender)
      }
    });
    await onCreateProposal(tender.id);
  }

  function selectTenderForWork(tender) {
    if (!tender) return;
    onSave({
      proposalProcess: {
        ...process,
        selectedTenderId: tender.id,
        proposalDetailId: tender.id,
        activeStep: "triagem",
        workingTenders: upsertWorkingTender(process.workingTenders || [], tender)
      }
    });
  }

  function discardProposal(proposal) {
    const nextProposals = proposals.filter((item) => item.id !== proposal.id);
    const isRegistered = process.registeredProposal?.id === proposal.id;
    onSave({
      proposals: nextProposals,
      proposalProcess: {
        ...process,
        status: isRegistered ? "Em composicao" : process.status,
        registeredAt: isRegistered ? null : process.registeredAt,
        registeredProposal: isRegistered ? null : process.registeredProposal
      }
    });
  }

  function downloadDossier(proposal) {
    const text = buildProposalCollectionDossier({ state, proposal });
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${proposal.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="view proposal-process">
      <header className="view-head">
        <div>
          <p className="eyebrow">Colecao</p>
          <h1>Propostas</h1>
          <p>Selecione editais no funil da Bahia e acompanhe aqui apenas as propostas em trabalho no programa.</p>
        </div>
        <button className="primary" onClick={createProposal} disabled={!selectedTender}>Gerar PDF da selecionada</button>
      </header>

      {pdfReader && pdfReaderTender ? (
        <ProposalPdfReaderPage
          tender={pdfReaderTender}
          initialTopic={pdfReader.topic}
          onBack={() => setPdfReader(null)}
          onOpenExternal={onOpen}
        />
      ) : focusedTender ? (
        <ProposalTenderDetailPage
          tender={focusedTender}
          state={state}
          process={process}
          proposals={proposals}
          readiness={readiness}
          docReadiness={docReadiness}
          onBack={() => saveProcess({ proposalDetailId: "" })}
          onCreate={() => createProposalFromTender(focusedTender)}
          onEvaluateTenderDocuments={() => onEvaluateTenderDocuments?.(focusedTender.id)}
          onOpenCompanyDocuments={() => onSave({ activeView: "company" })}
          onOpen={onOpen}
          onShowInPdf={(topic) => setPdfReader({ tenderId: focusedTender.id, topic })}
        />
      ) : (
        <>
          <ProposalTenderExplorer
            state={state}
            selectedTenderId={selectedTenderId}
            onOpen={onOpen}
            onSelectTender={selectTenderForWork}
          />

          <section className="proposal-opportunity-board">
            <header>
              <div>
                <p className="eyebrow">Propostas em trabalho</p>
                <h2>Cards dos editais ja selecionados</h2>
                <p>Esta area mostra somente processos abertos para composicao de proposta, com valor, municipio, prazo, entrega e compatibilidade LLM quando ja avaliada.</p>
              </div>
              <div className="proposal-board-summary">
                <Fact label="Em trabalho" value={`${workTenders.length} processo(s)`} />
                <Fact label="Docs atuais" value={`${readiness}% prontos`} />
              </div>
            </header>
            <div className="proposal-card-grid">
              {workTenders.map((tender) => (
                <ProposalOpportunityCard
                  key={tender.id}
                  tender={tender}
                  state={state}
                  active={tender.id === selectedTenderId}
                  onOpen={() => saveProcess({ selectedTenderId: tender.id, proposalDetailId: tender.id })}
                />
              ))}
              {!workTenders.length && <div className="empty">Selecione um edital na lista acima para abrir uma proposta em trabalho.</div>}
            </div>
          </section>

          <section className="proposal-document-registry">
            <header>
              <div>
                <strong>Propostas criadas</strong>
                <span>Registros gerados a partir dos editais selecionados.</span>
              </div>
              <span>{proposals.length} registros</span>
            </header>
            <div className="proposal-doc-grid">
              {proposals.map((proposal) => (
                <article className="proposal-doc-card" key={proposal.id}>
                  <div className="proposal-doc-head">
                    <div>
                      <strong>{proposal.title}</strong>
                      <span>{proposal.status} - prontidao {proposal.readiness}%</span>
                    </div>
                  </div>
                  <p>{proposal.argument}</p>
                  <progress value={proposal.readiness} max="100" />
                  <div className="mini-doc-list">
                    {(proposal.documents || []).slice(0, 4).map((doc) => (
                      <article key={doc.id}>
                        <strong>{doc.name}</strong>
                        <span>{doc.ready ? "Pronto" : "Pendente"} - {doc.confidence}%</span>
                      </article>
                    ))}
                  </div>
                  <div className="row-actions">
                    <button onClick={() => downloadDossier(proposal)}>Download dossie</button>
                    {proposal.pdfPath && <button onClick={() => onOpen(proposal.pdfPath)}>Abrir PDF</button>}
                    <button disabled={!proposal.editalUrl} onClick={() => onOpen(proposal.editalUrl)}>Link edital</button>
                    <button className="danger" onClick={() => discardProposal(proposal)}>Descartar</button>
                  </div>
                </article>
              ))}
              {!proposals.length && <div className="empty">Nenhuma proposta criada.</div>}
            </div>
          </section>
        </>
      )}
    </section>
  );
}

function ProposalTenderExplorer({ state, selectedTenderId, onOpen, onSelectTender }) {
  const [overview, setOverview] = useState(null);
  const [filters, setFilters] = useState({
    query: "",
    sort: "recentes",
    category: "",
    nature: "",
    minFit: "",
    page: 1,
    pageSize: 12
  });
  const [listing, setListing] = useState(emptyListing);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const query = useMemo(() => openEditaisQueryFromProposalFilters(filters), [filters]);
  const queryKey = JSON.stringify(query);
  const visibleItems = useMemo(() => {
    const minFit = Number(filters.minFit || 0);
    if (!minFit) return listing.items || [];
    return (listing.items || []).filter((item) => Number(item.proposalFit?.proposalPercent || 0) >= minFit);
  }, [listing.items, filters.minFit]);
  const proposalReady = selected ? documentsMeetProposalRequirements(state, selected) : false;

  useEffect(() => {
    api.openEditaisOverview().then(setOverview);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.openEditaisList(query).then((payload) => {
      if (!alive) return;
      setListing(payload);
      const first = payload.items?.[0];
      if (first) {
        api.openEditalDetail(first.id).then((detail) => alive && setSelected(detail));
      } else {
        setSelected(null);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [queryKey]);

  function patchFilters(patch) {
    setFilters((current) => ({ ...current, ...patch, page: patch.page || 1 }));
  }

  function selectDetail(item) {
    api.openEditalDetail(item.id).then(setSelected);
  }

  return (
    <section className="proposal-tender-funnel">
      <header>
        <div>
          <p className="eyebrow">Funil Bahia</p>
          <h2>Lista de editais para abrir proposta</h2>
          <p>{overview ? `${overview.totals?.documents || 0} editais no corpus local` : "Carregando panorama dos editais"}</p>
        </div>
        <div className="proposal-board-summary">
          <Fact label="Filtrados" value={`${listing.total || 0} edital(is)`} />
          <Fact label="Pagina" value={`${listing.page || 1}/${listing.totalPages || 1}`} />
        </div>
      </header>

      <div className="proposal-filter-grid">
        <input
          value={filters.query}
          placeholder="item, orgao, requisito, local..."
          onChange={(event) => patchFilters({ query: event.target.value, sort: "relevancia" })}
        />
        <select value={filters.category} onChange={(event) => patchFilters({ category: event.target.value })}>
          {proposalCategoryFilters.map((filter) => <option key={filter.id} value={filter.id}>{filter.label}</option>)}
        </select>
        <select value={filters.nature} onChange={(event) => patchFilters({ nature: event.target.value })}>
          {proposalNatureFilters.map((filter) => <option key={filter.id} value={filter.id}>{filter.label}</option>)}
        </select>
        <select value={filters.minFit} onChange={(event) => setFilters((current) => ({ ...current, minFit: event.target.value }))}>
          <option value="">Aderencia livre</option>
          <option value="50">Min. 50%</option>
          <option value="70">Min. 70%</option>
          <option value="85">Min. 85%</option>
        </select>
        <select value={filters.sort} onChange={(event) => patchFilters({ sort: event.target.value })}>
          <option value="recentes">Recentes</option>
          <option value="relevancia">Relevancia</option>
          <option value="maior_valor_estimado">Maior valor</option>
        </select>
      </div>

      <div className="proposal-explorer-grid">
        <section className="proposal-list-panel">
          <div className="result-list">
            {loading && <div className="empty">Carregando editais...</div>}
            {!loading && visibleItems.map((item) => (
              <button
                key={item.id}
                className={`licitacao-card ${item.id === selectedTenderId ? "active" : ""}`}
                onClick={() => selectDetail(item)}
              >
                <div className="licitacao-card-top">
                  <strong>{item.licitacaoFormatada || item.id}</strong>
                  <span>{item.proposalFit?.proposalPercent || 0}%</span>
                </div>
                <p>{item.orgao}</p>
                <small>{money.format(Number(item.valorEstimado || 0))}</small>
                <progress value={item.proposalFit?.proposalPercent || 0} max="100" />
                <em>{proposalTenderNatureLabel(item)}</em>
              </button>
            ))}
            {!loading && !visibleItems.length && <div className="empty">Nenhum edital encontrado com estes filtros.</div>}
          </div>
          <div className="row-actions proposal-page-actions">
            <button disabled={(listing.page || 1) <= 1} onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}>
              Anterior
            </button>
            <button disabled={(listing.page || 1) >= (listing.totalPages || 1)} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>
              Proxima
            </button>
          </div>
        </section>

        <section className="proposal-tender-detail">
          {selected ? (
            <>
              <p className="eyebrow">{selected.modalidade}</p>
              <h2>{selected.licitacaoFormatada || selected.id}</h2>
              <p>{selected.extracted?.summary || selected.objeto}</p>
              <div className="detail-grid">
                <Fact label="Orgao" value={selected.orgao} />
                <Fact label="Abertura" value={selected.dataAbertura || selected.dataAberturaIso} />
                <Fact label="Valor" value={money.format(Number(selected.valorEstimado || selected.value || 0))} />
                <Fact label="Aderencia radar" value={`${selected.proposalFit?.proposalPercent || 0}%`} />
              </div>
              <div className="proposal-argument">
                <span>Argumento de magnitude</span>
                <p>{selected.proposalFit?.magnitudeArgument || "Sem argumento calculado."}</p>
              </div>
              <div className={proposalReady ? "proposal-action-ready" : "proposal-action-ready blocked"}>
                <div>
                  <strong>{proposalReady ? "Base documental pronta para iniciar" : "Entrar em trabalho com saneamento documental"}</strong>
                  <span>{proposalDocumentGateReason(state)}</span>
                </div>
                <div className="row-actions">
                  <button className="primary command-button" onClick={() => onSelectTender(selected)}>
                    <Icon name="fileText" />
                    <span>Colocar em trabalho</span>
                  </button>
                  {selected.editalPdfUrl && <button onClick={() => onOpen(selected.editalPdfUrl)}>Abrir PDF</button>}
                </div>
              </div>
            </>
          ) : (
            <div className="empty">Selecione um edital.</div>
          )}
        </section>
      </div>
    </section>
  );
}

function ProposalOpportunityCard({ tender, state, active, onOpen }) {
  const meta = proposalTenderMeta(tender);
  const compatibility = proposalCompatibility(tender, state);
  const badges = proposalTenderBadges(tender, compatibility);
  return (
    <button className={`proposal-opportunity-card ${active ? "active" : ""} ${compatibility.level}`} onClick={onOpen}>
      <div className="proposal-card-topline">
        <div>
          <span>{tender.modalidade || "Edital"}</span>
          <strong>{tender.title || tender.licitacaoFormatada || tender.id}</strong>
        </div>
        <b>{compatibility.evaluated ? `${compatibility.score}%` : "IA"}</b>
      </div>
      <p>{tender.objeto || tender.extracted?.summary || "Objeto nao informado."}</p>
      <dl className="proposal-card-meta">
        <div><dt>Valor</dt><dd>{meta.value}</dd></div>
        <div><dt>Municipio</dt><dd>{meta.city}</dd></div>
        <div><dt>Area</dt><dd>{meta.area}</dd></div>
        <div><dt>Prazo</dt><dd>{meta.deadline}</dd></div>
        <div><dt>Participacao</dt><dd>{meta.participation}</dd></div>
        <div><dt>Entrega</dt><dd>{meta.delivery}</dd></div>
      </dl>
      <div className="proposal-card-badges">
        {badges.map((badge) => <span className={`proposal-badge ${badge.tone}`} key={badge.label}>{badge.label}</span>)}
      </div>
      <progress value={compatibility.evaluated ? compatibility.score : 0} max="100" />
    </button>
  );
}

function openEditaisQueryFromProposalFilters(filters) {
  const category = proposalCategoryFilters.find((item) => item.id === filters.category) || {};
  const nature = proposalNatureFilters.find((item) => item.id === filters.nature) || {};
  return {
    query: filters.query || "",
    sort: filters.sort || "recentes",
    page: filters.page || 1,
    pageSize: filters.pageSize || 12,
    itens: [...(category.itens || []), ...(nature.itens || [])],
    entrega: [...(category.entrega || []), ...(nature.entrega || [])],
    modalidades: [...(category.modalidades || []), ...(nature.modalidades || [])]
  };
}

function proposalTenderNatureLabel(item) {
  const text = normalizeTenderInferenceText(item);
  const labels = [];
  if (/obra|engenharia|saneamento|infraestrutura|civil/.test(text)) labels.push("obra/engenharia");
  if (/cat|crea|atest|qualificacao tecnica|responsavel tecnico/.test(text)) labels.push("tecnico");
  if (/balanco|financeir|garantia|patrimon|liquidez|indice/.test(text)) labels.push("financeiro");
  if (/registro de precos|srp/.test(text)) labels.push("SRP");
  if (/digital|pendrive|cd|portal|comprasnet/.test(text)) labels.push("entrega digital");
  return labels.slice(0, 3).join(" - ") || item.modalidade || "edital";
}

function proposalWorkingTenderSeeds(process, proposals, radarItems) {
  const byId = new Map();
  const push = (item) => {
    if (!item?.id) return;
    byId.set(item.id, { ...(byId.get(item.id) || {}), ...item });
  };
  (process.workingTenders || []).forEach(push);
  (radarItems || []).forEach((item) => {
    if (item.id === process.selectedTenderId || item.id === process.proposalDetailId) push(proposalWorkingTenderSummary(item));
  });
  (proposals || []).forEach((proposal) => {
    push({
      id: proposal.tenderId,
      title: proposal.title,
      licitacaoFormatada: proposal.title,
      orgao: proposal.orgao,
      value: proposal.value,
      valorEstimado: proposal.value,
      editalUrl: proposal.editalUrl,
      editalPdfUrl: proposal.editalUrl,
      status: proposal.status
    });
  });
  return Array.from(byId.values());
}

function proposalWorkingTenderSummary(tender) {
  const extracted = tender?.extracted || {};
  return {
    id: tender?.id,
    title: tender?.title || tender?.licitacaoFormatada || tender?.id,
    licitacaoFormatada: tender?.licitacaoFormatada || tender?.title || tender?.id,
    modalidade: tender?.modalidade || "",
    orgao: tender?.orgao || "",
    objeto: tender?.objeto || extracted.summary || "",
    value: tender?.value ?? tender?.valorEstimado ?? 0,
    valorEstimado: tender?.valorEstimado ?? tender?.value ?? 0,
    deadline: tender?.deadline || tender?.dataAbertura || tender?.dataAberturaIso || tender?.date || "",
    editalUrl: tender?.editalUrl || tender?.editalPdfUrl || "",
    editalPdfUrl: tender?.editalPdfUrl || tender?.editalUrl || "",
    extracted,
    proposalFit: tender?.proposalFit || {}
  };
}

function upsertWorkingTender(items, tender) {
  const summary = proposalWorkingTenderSummary(tender);
  return [
    summary,
    ...(items || []).filter((item) => item.id !== summary.id)
  ].slice(0, 24);
}

function ProposalTenderDetailPage({
  tender,
  state,
  process,
  proposals,
  docReadiness,
  onBack,
  onCreate,
  onEvaluateTenderDocuments,
  onOpenCompanyDocuments,
  onOpen,
  onShowInPdf
}) {
  const meta = proposalTenderMeta(tender);
  const compatibility = proposalCompatibility(tender, state);
  const documents = inferTenderDocuments(tender);
  const technical = inferTenderTechnicalSignals(tender);
  const extracted = tender.extracted || {};
  const deadlines = dedupeList(
    [extracted.proposalDateHighlight, ...(extracted.deadlines || []), tender.deadline, tender.date],
    ["Data de participacao ainda precisa ser conferida no edital."]
  );
  const delivery = dedupeList(
    [...(extracted.deliveryConditions || []), meta.delivery],
    ["Meio de entrega deve ser confirmado no edital ou portal indicado."]
  );
  const created = (proposals || []).filter((proposal) => proposal.tenderId === tender.id || proposal.id?.includes(tender.id));

  return (
    <section className="proposal-focus-page">
      <header className="proposal-focus-header">
        <button onClick={onBack}>Voltar aos cards</button>
        <div>
          <p className="eyebrow">Pagina dedicada da proposta</p>
          <h2>{tender.title || tender.licitacaoFormatada || tender.id}</h2>
          <p>{tender.magnitudeArgument || tender.reason || tender.proposalFit?.magnitudeArgument || "Detalhe carregado do edital para decisao de proposta."}</p>
        </div>
        <div className={`proposal-compat-score ${compatibility.level}`}>
          <span>Compatibilidade LLM</span>
          <strong>{compatibility.evaluated ? `${compatibility.score}%` : "--"}</strong>
        </div>
      </header>

      <div className="proposal-focus-grid">
        <section className="proposal-focus-main">
          <div className="proposal-detail-facts">
            <Fact label="Valor" value={meta.value} />
            <Fact label="Municipio" value={meta.city} />
            <Fact label="Area" value={meta.area} />
            <Fact label="Prazo" value={meta.deadline} />
            <Fact label="Participacao/entrega" value={meta.participation} />
            <Fact label="Meio de entrega" value={meta.delivery} />
          </div>

          <div className="proposal-detail-badges">
            {proposalTenderBadges(tender, compatibility).map((badge) => (
              <span className={`proposal-badge ${badge.tone}`} key={badge.label}>{badge.label}</span>
            ))}
          </div>

          <div className="proposal-bullet-grid">
            <ProposalBulletSection
              title="Documentos exigidos"
              items={documents}
              tender={tender}
              onShowInPdf={onShowInPdf}
            />
            <ProposalBulletSection
              title="Sinais tecnicos"
              items={technical}
              tender={tender}
              onShowInPdf={onShowInPdf}
            />
            <ProposalBulletSection
              title="Prazos e participacao"
              items={deadlines}
              tender={tender}
              onShowInPdf={onShowInPdf}
            />
            <ProposalBulletSection
              title="Meio de entrega e condicoes"
              items={delivery}
              tender={tender}
              onShowInPdf={onShowInPdf}
            />
          </div>

          <section className="proposal-requirement-panel">
            <header>
              <div>
                <p className="eyebrow">Base documental da Empresa</p>
                <h3>Prontidao herdada dos slots verificados por IA</h3>
              </div>
              <div className="row-actions">
                <button className="primary command-button" onClick={onEvaluateTenderDocuments}>
                  <Icon name="check" />
                  <span>Avaliar contra edital</span>
                </button>
                <button className="command-button" onClick={onOpenCompanyDocuments}>
                  <Icon name="building" />
                  <span>Abrir Empresa</span>
                </button>
              </div>
            </header>
            <p className="proposal-requirement-note">
              Os arquivos nao sao anexados nesta tela. Regularidade e demonstrativos financeiros ficam na Empresa; CATs ficam no Acervo tecnico. A compatibilidade abaixo so aparece quando a LLM le o arquivo do inventario contra este edital.
            </p>
            <div className="proposal-company-doc-list">
              {docReadiness.map((doc) => {
                const inventoryDoc = (state.documents || []).find((item) => item.id === doc.id);
                const evaluation = documentTenderCompatibility(inventoryDoc, tender);
                const score = compatibilityScore(evaluation);
                return (
                  <article className={doc.ready ? "ready" : ""} key={doc.id}>
                    <div>
                      <strong>{doc.name}</strong>
                      <span>{doc.fileName || "sem arquivo enviado"}</span>
                      <small>{doc.source}</small>
                      <small>
                        {score === null
                          ? "Compatibilidade com edital ainda sem leitura LLM."
                          : `Compatibilidade LLM com edital: ${score}% - ${evaluation?.summary || evaluation?.status || "avaliada"}`}
                      </small>
                    </div>
                    <b>{doc.confidence}%</b>
                    <progress value={doc.confidence} max="100" />
                  </article>
                );
              })}
            </div>
          </section>
        </section>

        <aside className="proposal-focus-aside">
          <Panel title="Compatibilidade atual">
            <div className="proposal-compat-list">
              {compatibility.checks.map((check) => (
                <article className={check.ready ? "ready" : check.evaluated ? "" : "pending"} key={check.label}>
                  <strong>{check.label}</strong>
                  <span>{check.detail}</span>
                  <progress value={check.score} max="100" />
                </article>
              ))}
            </div>
          </Panel>
          <Panel title="Acoes">
            <div className="settings-stack">
              <button className="primary" onClick={onCreate}>Criar proposta</button>
              {tender.editalUrl && <button onClick={() => onOpen(tender.editalUrl)}>Abrir edital</button>}
              <Fact label="Propostas criadas" value={created.length} />
            </div>
          </Panel>
        </aside>
      </div>
    </section>
  );
}

function ProposalBulletSection({ title, items, tender, onShowInPdf }) {
  const visibleItems = (items || []).slice(0, 9);
  const [openIndex, setOpenIndex] = useState(null);
  return (
    <section className="proposal-bullet-section">
      <header>
        <div>
          <span>{String(visibleItems.length).padStart(2, "0")}</span>
          <h3>{title}</h3>
        </div>
      </header>
      <ol>
        {visibleItems.map((item, index) => (
          <li className={openIndex === index ? "open" : ""} key={`${item}-${index}`}>
            <button
              className="proposal-topic-toggle"
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{item}</p>
              <b>{openIndex === index ? "Fechar" : "Abrir"}</b>
            </button>
            {openIndex === index && (
              <div className="proposal-topic-panel">
                <span>Referencia extraida do edital</span>
                <p>{sourceExcerptForTopic(tender, item, title)}</p>
                <div className="row-actions">
                  <button
                    className="primary"
                    onClick={() => onShowInPdf?.({ sectionTitle: title, item })}
                    disabled={!(tender?.editalUrl || tender?.editalPdfUrl)}
                  >
                    Mostrar na pagina do edital
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function ProposalPdfReaderPage({ tender, initialTopic, onBack, onOpenExternal }) {
  const sections = proposalPdfSummarySections(tender);
  const flatTopics = sections.flatMap((section) => section.items.map((item) => ({ sectionTitle: section.title, item })));
  const [activeTopic, setActiveTopic] = useState(initialTopic || flatTopics[0] || null);
  const [topicLocations, setTopicLocations] = useState({});
  const [locatingKey, setLocatingKey] = useState("");
  const pdfBaseUrl = tender.editalUrl || tender.editalPdfUrl;
  const activeKey = topicKey(activeTopic);
  const activeLocation = activeKey ? topicLocations[activeKey] : null;
  const pdfUrl = pdfUrlForTopic(pdfBaseUrl, activeTopic?.item, activeLocation);

  useEffect(() => {
    if (initialTopic) setActiveTopic(initialTopic);
  }, [initialTopic]);

  useEffect(() => {
    let alive = true;
    if (!pdfBaseUrl || !activeTopic) return () => {
      alive = false;
    };
    const key = topicKey(activeTopic);
    if (topicLocations[key]) return () => {
      alive = false;
    };
    setLocatingKey(key);
    api.locateEditalPdfTopic(pdfBaseUrl, activeTopic.item).then((location) => {
      if (!alive) return;
      setTopicLocations((current) => ({ ...current, [key]: location }));
      setLocatingKey("");
    });
    return () => {
      alive = false;
    };
  }, [activeTopic, pdfBaseUrl, topicLocations]);

  return (
    <section className="proposal-pdf-page">
      <header className="proposal-pdf-head">
        <button onClick={onBack}>Voltar aos detalhes</button>
        <div>
          <p className="eyebrow">Leitor do edital</p>
          <h2>{tender.title || tender.licitacaoFormatada || tender.id}</h2>
          <p>{activeTopic ? `${activeTopic.sectionTitle}: ${activeTopic.item}` : "Selecione um item do sumario para navegar."}</p>
          {activeLocation?.ok && (
            <small>
              Trecho localizado na pagina {activeLocation.page}, ponto {Math.max(0, Math.round(activeLocation.top || 0))}: {activeLocation.excerpt}
            </small>
          )}
          {activeLocation && !activeLocation.ok && <small>{activeLocation.reason}</small>}
          {locatingKey === activeKey && <small>Localizando trecho no PDF...</small>}
        </div>
        {(tender.editalUrl || tender.editalPdfUrl) && (
          <button onClick={() => onOpenExternal(tender.editalUrl || tender.editalPdfUrl)}>Abrir externo</button>
        )}
      </header>
      <div className="proposal-pdf-layout">
        <aside className="proposal-pdf-summary">
          {sections.map((section) => (
            <section key={section.title}>
              <h3>{section.title}</h3>
              <div>
                {section.items.map((item, index) => {
                  const active = activeTopic?.sectionTitle === section.title && activeTopic?.item === item;
                  const location = topicLocations[topicKey({ sectionTitle: section.title, item })];
                  return (
                    <button
                      className={active ? "active" : ""}
                      key={`${section.title}-${item}-${index}`}
                      onClick={() => setActiveTopic({ sectionTitle: section.title, item })}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{item}</strong>
                      {location?.ok && (
                        <em>pag. {location.page} · ponto {Math.max(0, Math.round(location.top || 0))}</em>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </aside>
        <main className="proposal-pdf-reader">
          {pdfUrl ? (
            <webview key={pdfUrl} src={pdfUrl} />
          ) : (
            <div className="empty">Este edital nao tem PDF vinculado.</div>
          )}
        </main>
      </div>
    </section>
  );
}

function proposalPdfSummarySections(tender) {
  const extracted = tender?.extracted || {};
  const meta = proposalTenderMeta(tender);
  return [
    { title: "Documentos exigidos", items: inferTenderDocuments(tender).slice(0, 12) },
    { title: "Sinais tecnicos", items: inferTenderTechnicalSignals(tender).slice(0, 12) },
    {
      title: "Prazos e participacao",
      items: dedupeList(
        [extracted.proposalDateHighlight, ...(extracted.deadlines || []), tender?.deadline, tender?.date],
        ["Data de participacao ainda precisa ser conferida no edital."]
      ).slice(0, 10)
    },
    {
      title: "Meio de entrega e condicoes",
      items: dedupeList(
        [...(extracted.deliveryConditions || []), meta.delivery],
        ["Meio de entrega deve ser confirmado no edital ou portal indicado."]
      ).slice(0, 10)
    }
  ];
}

function sourceExcerptForTopic(tender, item, sectionTitle = "Topico") {
  const extracted = tender?.extracted || {};
  const normalizedItem = normalizeTenderInferenceToken(item);
  const sourcePools = [
    ["Documentos exigidos", extracted.documents || []],
    ["Sinais tecnicos", [extracted.technicalQualificationHighlight, ...(extracted.items || []), ...(extracted.requirements || [])].filter(Boolean)],
    ["Prazos", [extracted.proposalDateHighlight, ...(extracted.deadlines || [])].filter(Boolean)],
    ["Entrega", extracted.deliveryConditions || []]
  ];

  for (const [label, values] of sourcePools) {
    const match = values.find((value) => {
      const normalized = normalizeTenderInferenceToken(value);
      return normalized === normalizedItem || normalized.includes(normalizedItem) || normalizedItem.includes(normalized);
    });
    if (match) return `${label}: ${match}`;
  }

  const preview = extracted.sourceTextPreview || extracted.summary || tender?.objeto || "";
  const tokens = normalizedItem.split(/\s+/).filter((token) => token.length > 5);
  const previewText = String(preview).replace(/\s+/g, " ").trim();
  const normalizedPreview = normalizeTenderInferenceToken(previewText);
  const token = tokens.find((entry) => normalizedPreview.includes(entry));
  if (token) {
    const index = normalizedPreview.indexOf(token);
    const start = Math.max(0, index - 140);
    return `${sectionTitle}: trecho aproximado do edital aponta para "${item}". Contexto: ${previewText.slice(start, start + 320)}`;
  }
  return `${sectionTitle}: item extraido/inferido do edital para busca no PDF: "${item}".`;
}

function topicKey(topic) {
  if (!topic) return "";
  return `${topic.sectionTitle || ""}::${topic.item || ""}`;
}

function pdfUrlForTopic(url, topic, location) {
  if (!url) return "";
  if (!topic) return url;
  const baseUrl = String(url).split("#")[0];
  const search = encodeURIComponent(String(topic).slice(0, 96));
  if (location?.ok && location.page) {
    const page = Math.max(1, Math.round(Number(location.page) || 1));
    const top = Math.max(0, Math.round(Number(location.top || 0) - 80));
    const left = Math.max(0, Math.round(Number(location.left || 0) - 24));
    return `${baseUrl}#page=${page}&zoom=125,${left},${top}&search=${search}`;
  }
  return `${baseUrl}#search=${search}`;
}

function proposalTenderMeta(tender) {
  const extracted = tender?.extracted || {};
  return {
    value: money.format(Number(tender?.value ?? tender?.valorEstimado ?? 0)),
    city: tenderMunicipality(tender),
    area: tenderArea(tender),
    deadline: tenderDeadline(tender),
    participation: tenderParticipationDate(tender),
    delivery: tenderDeliveryMethod(tender),
    location: (extracted.locations || [])[0] || "Bahia"
  };
}

function proposalTenderBadges(tender, compatibility) {
  const value = Number(tender?.value ?? tender?.valorEstimado ?? 0);
  const badges = [
    { label: compatibility.evaluated ? `${compatibility.score}% por LLM` : "sem leitura LLM", tone: compatibility.level },
    { label: compatibility.readyCount ? `${compatibility.readyCount}/${compatibility.checks.length} docs compativeis` : "sem doc compativel avaliado", tone: compatibility.level }
  ];
  if (value > 0) badges.push({ label: money.format(value), tone: "neutral" });
  if ((compatibility.kinds || []).some((kind) => /tecn/i.test(kind))) badges.push({ label: "tecnico", tone: "info" });
  if ((compatibility.kinds || []).some((kind) => /financeir|economico/i.test(kind))) badges.push({ label: "financeiro", tone: "info" });
  if (/obra|engenharia|saneamento|adutor|tubul/i.test([tender?.objeto, tender?.extracted?.summary].filter(Boolean).join(" "))) {
    badges.push({ label: "obra/engenharia", tone: "info" });
  }
  return badges.slice(0, 6);
}

function proposalCompatibility(tender, state) {
  const records = tenderDocumentCompatibilityRecords(tender, state);
  const checks = records.length
    ? records.map((record) => {
        const score = compatibilityScore(record.evaluation);
        const evaluated = score !== null;
        return {
          label: record.label,
          kind: record.kind,
          score: score || 0,
          ready: evaluated && score >= 70,
          evaluated,
          detail: evaluated
            ? `${record.evaluation.status || "Avaliado"} (${score}%): ${record.evaluation.summary || record.fileName || "resultado LLM registrado"}`
            : record.evaluation?.reason || "A LLM ainda nao retornou nota numerica para este documento."
        };
      })
    : [
        {
          label: "Leitura LLM pendente",
          kind: "Pendente",
          score: 0,
          ready: false,
          evaluated: false,
          detail: "Nenhum documento do inventario foi lido por LLM contra este edital."
        }
      ];
  const scoredChecks = checks.filter((item) => item.evaluated);
  const score = scoredChecks.length
    ? Math.round(scoredChecks.reduce((total, item) => total + item.score, 0) / scoredChecks.length)
    : 0;
  return {
    score,
    checks,
    readyCount: scoredChecks.filter((item) => item.ready).length,
    evaluated: scoredChecks.length > 0,
    kinds: Array.from(new Set(records.map((record) => record.kind).filter(Boolean))),
    level: scoredChecks.length ? (score >= 70 ? "good" : score >= 40 ? "warn" : "risk") : "pending"
  };
}

function detectTenderDocumentCategories(tender) {
  const text = normalizeTenderInferenceText(tender);
  const categories = [];
  const add = (id, label, pattern) => {
    if (pattern.test(text)) categories.push({ id, label });
  };
  add("regularidade", "Regularidade", /regularidade|certidao|fgts|cndt|fazenda|tribut|cnpj|falencia/);
  add("tecnico", "Tecnico", /tecn|atest|cat|crea|responsavel|obra|engenharia|tubul|vistoria|capacitacao/);
  add("financeiro", "Financeiro", /balanco|dfl|financeir|patrimon|indice|garantia|liquidez|endividamento/);
  add("juridico", "Juridico", /contrato social|ato constitutivo|procuracao|representante|declaracao|impedimento/);
  if (!categories.length) {
    categories.push(
      { id: "regularidade", label: "Regularidade" },
      { id: "tecnico", label: "Tecnico" },
      { id: "financeiro", label: "Financeiro" }
    );
  }
  return categories;
}

function documentReadinessForCategory(category, documents) {
  const patterns = {
    regularidade: /regularidade|certid|fgts|fiscal|trabalhista|cnpj|falencia/i,
    tecnico: /tecn|cat|crea|atest|responsavel|engenheir/i,
    financeiro: /financeir|balanco|dfl|patrimon|indice|garantia|economico/i,
    juridico: /contrato|social|ato|procuracao|representante|declar/i
  };
  const pattern = patterns[category.id] || new RegExp(category.label, "i");
  const candidates = (documents || []).filter((doc) => pattern.test(`${doc.name} ${doc.kind} ${doc.role || ""}`));
  const doc = candidates.sort((left, right) => Number(right.confidence || 0) - Number(left.confidence || 0))[0];
  if (!doc) return { confidence: 0, ready: false, doc: null };
  const confidence = doc.file?.localPath ? Number(doc.confidence || 0) : 0;
  return {
    confidence,
    ready: Boolean(doc.file?.localPath) && confidence >= 50,
    doc
  };
}

function tenderMunicipality(tender) {
  const extracted = tender?.extracted || {};
  const source = [
    ...(extracted.locations || []),
    extracted.summary,
    tender?.objeto,
    ...(extracted.keywords || [])
  ].filter(Boolean).join(" | ");
  const match = source.match(/(?:municip(?:io|al) de|sede municipal de|em)\s+([^,|]+)/i);
  if (match?.[1]) return trimTenderMeta(match[1]);
  const keyword = (extracted.keywords || []).find((item) => !/bahia|licitacao|concorrencia|obra|saneamento|engenharia/i.test(item));
  return trimTenderMeta(keyword || "Bahia");
}

function tenderArea(tender) {
  const extracted = tender?.extracted || {};
  return trimTenderMeta(
    tender?.objeto ||
    extracted.cnaes?.[0]?.description ||
    (extracted.keywords || []).find((item) => /obra|servico|saneamento|engenharia|comunicacao|saude|consultoria/i.test(item)) ||
    "Area nao informada"
  );
}

function tenderDeadline(tender) {
  const deadlines = tender?.extracted?.deadlines || [];
  return trimTenderMeta(
    deadlines.find((item) => /execu|vigencia|prazo maximo|contrato/i.test(item)) ||
    tender?.deadline ||
    tender?.date ||
    tender?.dataAbertura ||
    "Prazo nao informado"
  );
}

function tenderParticipationDate(tender) {
  const extracted = tender?.extracted || {};
  return trimTenderMeta(
    extracted.proposalDateHighlight ||
    (extracted.deadlines || []).find((item) => /abertura|recebimento|proposta|sessao|licitacao/i.test(item)) ||
    tender?.deadline ||
    tender?.date ||
    "Data nao informada"
  );
}

function tenderDeliveryMethod(tender) {
  const extracted = tender?.extracted || {};
  return trimTenderMeta(
    (extracted.documents || []).find((item) => /midia|pendrive|cd|digitaliza|envelope|invólucro|involucro/i.test(item)) ||
    (extracted.deliveryConditions || []).find((item) => /entrega|portal|protocolo|sessao|recebimento/i.test(item)) ||
    (tender?.editalUrl || tender?.editalPdfUrl ? "Conforme edital/portal ComprasNet BA" : "") ||
    "Meio nao informado"
  );
}

function trimTenderMeta(value) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return clean.length > 92 ? `${clean.slice(0, 89)}...` : clean;
}

function normalizeTenderInferenceToken(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mergeTenderDetail(summary, detail) {
  if (!summary && !detail) return null;
  const extracted = {
    ...(detail?.extracted || {}),
    ...(summary?.extracted || {})
  };
  for (const key of ["documents", "requirements", "items", "keywords", "technical"]) {
    if (!(summary?.extracted?.[key] || []).length && (detail?.extracted?.[key] || []).length) {
      extracted[key] = detail.extracted[key];
    }
  }
  if (!summary?.extracted?.technicalQualificationHighlight && detail?.extracted?.technicalQualificationHighlight) {
    extracted.technicalQualificationHighlight = detail.extracted.technicalQualificationHighlight;
  }
  return {
    ...(detail || {}),
    ...(summary || {}),
    extracted,
    id: summary?.id || detail?.id,
    title: summary?.title || [detail?.modalidade, detail?.licitacaoFormatada].filter(Boolean).join(" ") || detail?.id,
    objeto: summary?.objeto || detail?.objeto || extracted.summary,
    orgao: summary?.orgao || detail?.orgao,
    value: summary?.value ?? detail?.valorEstimado,
    deadline: summary?.deadline || detail?.dataAbertura || detail?.dataAberturaIso,
    editalUrl: summary?.editalUrl || detail?.editalPdfUrl,
    proposalFit: summary?.proposalFit || detail?.proposalFit || {}
  };
}

function SelectedTenderDetails({ tender }) {
  const extracted = tender.extracted || {};
  const fit = tender.proposalFit || {};
  const documentItems = inferTenderDocuments(tender);
  const technicalItems = inferTenderTechnicalSignals(tender);
  return (
    <article className="selected-tender-details">
      <header>
        <div>
          <p className="eyebrow">Edital selecionado</p>
          <h3>{tender.title}</h3>
        </div>
        <strong>{tender.proposalPercent || fit.percent || tender.score || 0}%</strong>
      </header>
      <div className="selected-tender-facts">
        <Fact label="Orgao" value={tender.orgao || "Nao informado"} />
        <Fact label="Objeto" value={tender.objeto || extracted.summary || "Nao informado"} />
        <Fact label="Valor" value={money.format(Number(tender.value || 0))} />
        <Fact label="Prazo" value={tender.deadline || tender.date || "Nao informado"} />
      </div>
      <p>{tender.magnitudeArgument || tender.reason || fit.comment || "Sem comentario de aderencia calculado."}</p>
      <div className="selected-tender-lists">
        <DetailList title="Documentos exigidos" items={documentItems} />
        <DetailList title="Sinais tecnicos" items={technicalItems} />
      </div>
    </article>
  );
}

function inferTenderDocuments(tender) {
  const extracted = tender?.extracted || {};
  const fit = tender?.proposalFit || {};
  const text = normalizeTenderInferenceText(tender);
  const inferred = [];

  if (/concorrencia|pregao|licitacao/.test(text)) {
    inferred.push("Proposta de precos e documentos de habilitacao do edital");
  }
  if (/obra|engenharia|saneamento|adutor|tubulacao|civil|crea|cat/.test(text)) {
    inferred.push("Qualificacao tecnica: atestados, CAT/CREA e responsavel tecnico compativel");
  }
  if (/valor|preco|financeir|balanco|dfl|patrimonial|garantia/.test(text) || Number(tender?.value || tender?.valorEstimado || 0) > 0) {
    inferred.push("Capacidade economico-financeira: balanco, indices, DFL ou garantia quando exigida");
  }
  if (/declaracao|impedimento|menor|vistoria|visita|veracidade|independente/.test(text)) {
    inferred.push("Declaracoes legais: inexistencia de impedimento, veracidade, menor e vistoria quando aplicavel");
  }
  if (/cnpj|contrato social|ato constitutivo|representante|procuracao|credenciamento/.test(text)) {
    inferred.push("Cadastro e representacao: CNPJ, ato constitutivo, procuracao e representante legal");
  }
  if (/regularidade|certidao|fiscal|trabalhista|fgts|falencia/.test(text)) {
    inferred.push("Regularidade fiscal, trabalhista, FGTS e certidao de falencia/recuperacao");
  }

  return dedupeList(
    [
      ...(extracted.documents || []),
      ...(fit.documentSignals || []),
      ...(extracted.requirements || []).filter((entry) =>
        /document|habilit|proposta|declar|certid|balanco|garantia|regularidade|atestado|cat|crea|procuracao|contrato social|falencia|dfl/i.test(entry)
      ),
      ...inferred
    ],
    [
      "Proposta de precos e documentos de habilitacao do edital",
      "Regularidade fiscal, trabalhista e juridica",
      "Qualificacao tecnica e economico-financeira conforme termo de referencia"
    ]
  );
}

function inferTenderTechnicalSignals(tender) {
  const extracted = tender?.extracted || {};
  const fit = tender?.proposalFit || {};
  const text = normalizeTenderInferenceText(tender);
  const inferred = [];

  if (/obra|engenharia|civil|saneamento|adutor|barragem|tubulacao/.test(text)) {
    inferred.push("Escopo de obra/engenharia exige leitura tecnica de quantitativos e parcelas relevantes.");
  }
  if (/cat|crea|responsavel|atestado|qualificacao tecnica/.test(text)) {
    inferred.push("Exigir compatibilidade entre atestados, CAT/CREA e responsavel tecnico indicado.");
  }
  if (/tubulacao|pvc|fofo|dn|assentamento/.test(text)) {
    inferred.push("Sinal tecnico de tubulacao: comprovar assentamento, diametro nominal e material especificado.");
  }
  if (/vistoria|visita/.test(text)) {
    inferred.push("Verificar se ha vistoria obrigatoria ou declaracao de conhecimento do local.");
  }

  return dedupeList(
    [
      extracted.technicalQualificationHighlight,
      ...(extracted.technical || []),
      ...(fit.intentSignals || []),
      ...(extracted.items || []),
      ...(extracted.requirements || []).filter((entry) =>
        /tecn|atest|crea|cat|responsavel|obra|engenharia|tubul|vistoria|qualificacao|capacidade/i.test(entry)
      ),
      ...inferred
    ],
    [
      "Qualificacao tecnica deve ser conferida no termo de referencia.",
      "Cruzar escopo do objeto com CATs, atestados e responsavel tecnico."
    ]
  );
}

function normalizeTenderInferenceText(tender) {
  const extracted = tender?.extracted || {};
  return String(
    [
      tender?.title,
      tender?.modalidade,
      tender?.orgao,
      tender?.objeto,
      extracted.summary,
      extracted.technicalQualificationHighlight,
      ...(extracted.items || []),
      ...(extracted.requirements || []),
      ...(extracted.documents || []),
      ...(extracted.keywords || [])
    ]
      .filter(Boolean)
      .join(" ")
  )
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function proposalReadiness(state) {
  const docAverage =
    (state.documents || []).reduce((total, doc) => total + (doc.file?.localPath ? Number(doc.confidence || 0) : 0), 0) /
    Math.max(1, (state.documents || []).length);
  return Math.round(docAverage);
}

function proposalDocumentReadiness(state) {
  return (state.documents || []).map((doc) => {
    const confidence = doc.file?.localPath ? Number(doc.confidence || 0) : 0;
    return {
      id: doc.id,
      name: doc.name,
      kind: doc.kind,
      status: doc.status,
      confidence,
      ready: Boolean(doc.file?.localPath) && confidence >= 70,
      fileName: doc.file?.name || "",
      source: doc.file?.localPath
        ? `Prontidao calculada pela IA para o slot "${doc.name}".`
        : `Aguardando upload na pagina Empresa para o slot "${doc.name}".`
    };
  });
}

function buildProposalCollectionDossier({ state, proposal }) {
  return [
    `Proposta: ${proposal.title}`,
    `Empresa: ${state.company?.name || "Nao informada"}`,
    `Orgao: ${proposal.orgao || "Nao informado"}`,
    `Valor: ${money.format(Number(proposal.value || 0))}`,
    `Status: ${proposal.status}`,
    `Prontidao: ${proposal.readiness}%`,
    `Criada em: ${proposal.createdAt}`,
    "",
    "Arquivos medidos contra edital:",
    ...(proposal.documents || []).map(
      (doc) => `- ${doc.name}: ${doc.ready ? "pronto" : "pendente"} (${doc.confidence}%) ${doc.fileName || "sem arquivo"}`
    ),
    "",
    `Argumento: ${proposal.argument || ""}`
  ].join("\n");
}

function includedProposalDocuments(state, process) {
  return (state.documents || []).filter((doc) => process.documentDetails?.[doc.id]?.included);
}

function proposalDocumentsForStep(state, step) {
  const documents = state.documents || [];
  if (step === "tecnica") return documents.filter((doc) => doc.kind === "Tecnico");
  if (step === "preco") return documents.filter((doc) => doc.kind === "Economico-financeiro");
  if (step === "fechamento") return documents.filter((doc) => doc.kind !== "Economico-financeiro");
  return documents;
}

function proposalStageTitle(step) {
  const titles = {
    documentos: "Escolha e verificacao de documentos de habilitacao",
    tecnica: "Escolha e verificacao tecnica",
    preco: "Base documental para preco",
    fechamento: "Anexos finais e protocolo"
  };
  return titles[step] || "Verificacao documental";
}

function proposalStageHelp(step) {
  const help = {
    documentos: "Feche inventario, validade, titularidade e exigencia do edital antes da parte tecnica.",
    tecnica: "Confirme CATs, atestados, responsaveis, vinculos e compatibilidade de escopo.",
    preco: "A etapa de preco usa documentos economico-financeiros e teto do edital, sem texto livre na proposta.",
    fechamento: "Marque apenas anexos prontos para formar o dossie final e registrar o protocolo."
  };
  return help[step] || "Escolha documentos e confira os criterios pedidos pelo edital.";
}

function proposalStageChecks(step, state) {
  const selectedDocs = proposalDocumentsForStep(state, step);
  const base = [
    { id: "edital_requirements", label: "Exigencias do edital cruzadas com documentos desta etapa" },
    { id: "missing_uploads", label: "Pendencias de upload identificadas" },
    { id: "agent_review", label: "Revisao da IA considerada antes de avancar" }
  ];
  if (step === "tecnica") {
    return [
      ...base,
      { id: "cats_scope", label: "CATs e atestados conferidos contra escopo" },
      { id: "rt_link", label: "Responsaveis tecnicos e vinculos conferidos" }
    ];
  }
  if (step === "preco") {
    return [
      ...base,
      { id: "financial_ceiling", label: `Teto financeiro da empresa considerado (${money.format(state.company.financialCeiling || 0)})` },
      { id: "financial_docs", label: `${selectedDocs.length} documento(s) economico-financeiro(s) revisado(s)` }
    ];
  }
  if (step === "fechamento") {
    return [
      ...base,
      { id: "annex_order", label: "Ordem dos anexos pronta para o dossie" },
      { id: "participation_link", label: "Link de participacao e protocolo conferidos" }
    ];
  }
  return [
    ...base,
    { id: "inventory", label: `${selectedDocs.length} categoria(s) documentais no inventario da proposta` }
  ];
}

function proposalDocumentChecklist(doc) {
  const base = ["Arquivo enviado", "Validade conferida", "Titularidade da empresa", "Exigencia do edital atendida"];
  if (doc.kind === "Tecnico") return [...base, "CAT/atestado compativel", "Responsavel tecnico vinculado"];
  if (doc.kind === "Economico-financeiro") return [...base, "Indices financeiros conferidos", "Valor compativel com o teto"];
  return base;
}

function proposalQuestions(state, selectedTender) {
  const weakDoc = [...(state.documents || [])].sort((left, right) => left.confidence - right.confidence)[0];
  const weakBlock = [...(state.proposalBlocks || [])].sort((left, right) => left.coverage - right.coverage)[0];
  return [
    selectedTender
      ? `Qual tese de participacao justifica atacar "${selectedTender.title}" agora?`
      : "Qual edital do radar Bahia deve virar proposta primeiro?",
    weakDoc
      ? `O documento "${weakDoc.name}" esta suficiente para habilitacao ou precisa novo upload?`
      : "Qual documento ainda bloqueia a habilitacao?",
    weakBlock
      ? `O que falta para o bloco "${weakBlock.name}" sair de ${weakBlock.coverage}% para pronto?`
      : "Qual bloco da proposta deve ser fechado antes do preco?",
    "Existe risco tecnico, financeiro ou formal que pode inabilitar a proposta?"
  ];
}

function proposalBlockPrompt(block, state) {
  const relatedDoc = (state.documents || []).find((doc) => doc.kind.toLowerCase().includes(block.id));
  if (relatedDoc) return `${relatedDoc.name}: ${relatedDoc.status}, prontidao ${relatedDoc.confidence}%.`;
  if (block.id === "tecnico") return "Cruzar CATs, responsavel tecnico, escopo e experiencia similar.";
  if (block.id === "financeiro") return "Conferir DFL, demonstracoes e teto financeiro contra o valor estimado.";
  if (block.id === "regularidade") return "Fechar certidoes, validade, titularidade e representante legal.";
  return "Amarrar vinculos, anexos e rastreabilidade antes do protocolo.";
}

function BahiaExplorer({ state, onOpenProposals }) {
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    api.openEditaisOverview().then(setOverview);
  }, []);

  const radarItems = state.bahia?.notifications || [];

  return (
    <section className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Base explorador-licitacoes-ba-source</p>
          <h1>Base Bahia</h1>
          <p>{overview ? `${overview.totals?.documents || 0} editais no corpus local. A triagem operacional agora abre primeiro em Propostas.` : "Carregando panorama"}</p>
        </div>
      </header>
      <div className="split">
        <section className="panel bahia-handoff-panel">
          <div>
            <p className="eyebrow">Fluxo atualizado</p>
            <h2>Use Propostas para filtrar e abrir processos</h2>
            <p>
              A lista exploratoria da Bahia foi movida para o topo da pagina Propostas.
              Os filtros por categoria, natureza e aderencia agora alimentam os cards de propostas em trabalho.
            </p>
          </div>
          <div className="state-facts">
            <Fact label="Corpus local" value={`${overview?.totals?.documents || 0} edital(is)`} />
            <Fact label="Radar recente" value={`${radarItems.length} item(ns)`} />
          </div>
          <button className="primary command-button" onClick={onOpenProposals}>
            <Icon name="fileText" />
            <span>Abrir funil em Propostas</span>
          </button>
        </section>
        <Panel title="Radar recente">
          <TenderList items={radarItems} />
        </Panel>
      </div>
    </section>
  );
}

function documentsMeetProposalRequirements(state) {
  const documents = state.documents || [];
  if (!documents.length) return false;
  return documents.every((doc) => doc.file?.localPath && Number(doc.confidence || 0) >= 50);
}

function editalTechnicalNeeds(item) {
  const extracted = item?.extracted || {};
  const values = [
    extracted.technicalQualificationHighlight,
    ...(extracted.requirements || []).filter((entry) => /tecn|atest|crea|cat|responsavel|equip|amostra|conformidade|prova de conceito|qualificacao/i.test(entry)),
    ...(extracted.documents || []).filter((entry) => /tecn|atest|crea|cat|responsavel/i.test(entry)),
    ...(extracted.items || []).filter((entry) => /obra|engenharia|estrutura|instal|barragem|comunicacao|diagnostico|plano/i.test(entry))
  ].filter(Boolean);
  return dedupeList(values, [
    "Qualificacao tecnica descrita no edital/termo de referencia ainda precisa ser detalhada.",
    "Cruzar escopo com CATs, atestados, responsaveis tecnicos e capacidade operacional."
  ]);
}

function editalScopeItems(item) {
  const extracted = item?.extracted || {};
  const values = [
    item?.objeto,
    extracted.summary,
    ...(item?.featuredItems || []),
    ...(extracted.items || []),
    ...(extracted.deliveryConditions || [])
  ].filter(Boolean);
  return dedupeList(values, ["Objeto e parcelas relevantes ainda precisam de leitura mais fina do edital."]);
}

function dedupeList(values, fallback) {
  const seen = new Set();
  const items = [];
  for (const value of values) {
    const clean = String(value || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(clean);
  }
  return items.length ? items.slice(0, 8) : fallback;
}

function proposalDocumentGateReason(state) {
  const documents = state.documents || [];
  const uploaded = documents.filter((doc) => doc.file?.localPath).length;
  const ready = documents.filter((doc) => doc.file?.localPath && Number(doc.confidence || 0) >= 50).length;
  if (!documents.length) return "Nenhuma categoria documental cadastrada.";
  if (ready === documents.length) return `${ready}/${documents.length} categorias documentais conferidas no sistema.`;
  return `${ready}/${documents.length} categorias prontas; ${uploaded}/${documents.length} com arquivo enviado.`;
}

function proposalIntegrationComment(item) {
  const percent = item.proposalFit?.proposalPercent || 0;
  if (percent >= 75) return "Entrar na composicao de proposta com prioridade: edital aderente, exigir fechamento documental e tese de preco.";
  if (percent >= 50) return "Pode virar proposta se os documentos criticos forem saneados e o escopo tecnico for confirmado.";
  return "Manter em triagem: aderencia ainda baixa para consumir time de composicao.";
}

function docAiComments(item) {
  const docs = inferTenderDocuments(item);
  const base = docs.length ? docs.slice(0, 3) : ["Habilitacao", "Regularidade", "Qualificacao tecnica"];
  return base.map((doc) => `IA: revisar ${String(doc).slice(0, 96)} antes de abrir bloco de proposta.`);
}

function DetailList({ title, items }) {
  return (
    <div className="detail-list">
      <h3>{title}</h3>
      {items?.length ? (
        <ul>{items.slice(0, 8).map((item) => <li key={item}>{item}</li>)}</ul>
      ) : (
        <p>Nao informado no trecho extraido.</p>
      )}
    </div>
  );
}

function PortalsView({ state, routes, onAdd, onToggle, onOpen }) {
  const [form, setForm] = useState({ name: "", route: "dashboard", description: "" });
  return (
    <section className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Aplicativos externos</p>
          <h1>Portais e formularios</h1>
          <p>Ativar um app liga servidor local e tunel compartilhado para formularios externos.</p>
        </div>
      </header>
      <div className="panel form-panel">
        <h2>Adicionar portal</h2>
        <div className="form-grid">
          <label className="field">
            <span>Nome</span>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="field">
            <span>Rota da pagina</span>
            <select value={form.route} onChange={(event) => setForm({ ...form, route: event.target.value })}>
              {routes.map((route) => <option key={route.id} value={route.id}>{route.label}</option>)}
            </select>
          </label>
          <label className="field wide">
            <span>Descricao</span>
            <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
        </div>
        <button className="primary" onClick={() => onAdd(form)}>Adicionar app externo</button>
      </div>
      <div className="portal-list">
        {state.portalApps.map((app) => (
          <article className={app.active ? "portal-card active" : "portal-card"} key={app.id}>
            <div>
              <strong>{app.name}</strong>
              <p>{app.description}</p>
              <span>{routes.find((route) => route.id === app.route)?.label || app.route}</span>
            </div>
            <label className="switch">
              <input type="checkbox" checked={app.active} onChange={(event) => onToggle(app.id, event.target.checked)} />
              <span />
            </label>
            <div className="row-actions">
              {app.localUrl && <button onClick={() => onOpen(app.localUrl)}>Abrir local</button>}
              {app.publicUrl && <button className="primary" onClick={() => onOpen(app.publicUrl)}>Abrir publico</button>}
            </div>
            <div className="portal-public-url">
              <span>Endereco publico do portal</span>
              <strong>
                {app.publicUrl ||
                  (app.active
                    ? "Tunel ngrok ativo solicitado, aguardando URL publica"
                    : "Ative o aplicativo para gerar URL pelo tunel ngrok")}
              </strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SettingsView({
  state,
  versions,
  onSave,
  onOpenSetup,
  onSaveAssistant,
  onReviseAssistant,
  onReviseProposalSection
}) {
  const notifications = state.integrations?.notifications || {};

  return (
    <section className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Sistema</p>
          <h1>Configuracoes locais</h1>
          <p>Configuracao padrao de aplicativo: instalacao, workspace e notificacoes em tela.</p>
        </div>
      </header>
      <div className="settings-grid">
        <Panel title="Instalacao e workspace">
          <div className="settings-stack">
            <Fact label="Pasta local" value={state.setup.userRoot} />
            <Fact label="Electron" value={versions.electron || "N/A"} />
            <Fact label="Node" value={versions.node || "N/A"} />
            <button className="primary" onClick={onOpenSetup}>Reabrir instalador</button>
          </div>
        </Panel>
        <Panel title="Notificacoes">
          <div className="settings-stack">
            {[
              ["screen", "Notificacao em tela"]
            ].map(([key, label]) => (
              <label className="settings-toggle" key={key}>
                <input
                  type="checkbox"
                  checked={Boolean(notifications[key])}
                  onChange={(event) =>
                    onSave({ integrations: { notifications: { [key]: event.target.checked } } })
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </Panel>
      </div>
      <AgentSettingsPanel
        state={state}
        onSaveAssistant={onSaveAssistant}
        onReviseAssistant={onReviseAssistant}
        onReviseProposalSection={onReviseProposalSection}
      />
    </section>
  );
}

function FadeBubble({ message, index, fadeDelay = 4000, fadeDuration = 600 }) {
	const [visible, setVisible] = useState(true);
	const [hovered, setHovered] = useState(false);
	const timeoutRef = useRef(null);

	useEffect(() => {
		if (hovered) {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
			return;
		}

		timeoutRef.current = setTimeout(() => {
			setVisible(false);
		}, fadeDelay);

		return () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		};
	}, [hovered, fadeDelay]);

	return (
		<div
			key={`${message.role}-${index}`}
			className={`bubble ${message.role === "user" ? "user" : ""} ${visible ? "visible" : "fade-out"
				}`}
			style={{ transitionDuration: `${fadeDuration}ms` }}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			{message.text}
		</div>
	);
}

function ChatSidebar({ state, onSend, onRun, onRunAll }) {
	const [prompt, setPrompt] = useState("");

	function send() {
		const clean = prompt.trim();
		if (!clean) return;
		setPrompt("");
		onSend(clean);
	}

	function handleKeyDown(event) {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			send();
		}
	}

	return (
		<aside className="chat">
			<div className="chat-input">
				<textarea
					value={prompt}
					onKeyDown={handleKeyDown}
					onChange={(event) => setPrompt(event.target.value)}
					placeholder="Pergunte sobre licitacoes, documentos ou portais..."
				/>
				<button className="primary icon-button" onClick={send} title="Enviar" aria-label="Enviar mensagem">
					<Icon name="send" />
				</button>
			</div>

			<div className="chat-log">
				{(state.chat || []).map((message, index) => {
					const text =
						typeof message === "string"
							? message
							: message.text ??
							message.content ??
							message.message ??
							(Array.isArray(message.parts)
								? message.parts.map((part) => part.text || "").join("")
								: "");

					const role =
						typeof message === "string"
							? "assistant"
							: message.role || "assistant";

					return (
						<FadeBubble
							key={message.id || `${role}-${index}-${text.slice(0, 20)}`}
							message={{ ...message, role, text }}
							index={index}
							fadeDelay={1000}
							fadeDuration={2000}
						/>
					);
				})}
			</div>
		</aside>
	);
}
function TenderList({ items }) {
  if (!items?.length) return <div className="empty">Radar ainda nao executado.</div>;
  return (
    <div className="tender-list">
      {items.map((item) => (
        <article key={item.id}>
          <div className="licitacao-card-top">
            <strong>{item.title}</strong>
            <span>{item.proposalPercent || 0}%</span>
          </div>
          <span>{item.orgao}</span>
          <p>{item.magnitudeArgument || item.reason}</p>
          <progress value={item.proposalPercent || 0} max="100" />
          <small>{money.format(Number(item.value || 0))}</small>
        </article>
      ))}
    </div>
  );
}

function Metric({ title, value, detail, onClick }) {
  const Tag = onClick ? "button" : "article";
  return (
    <Tag className="metric" onClick={onClick}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </Tag>
  );
}

function Panel({ title, children }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function labelFor(key) {
  return {
    name: "Nome",
    cnpj: "CNPJ",
    city: "Cidade",
    state: "UF"
  }[key] || key;
}

function setPath(input, path, value) {
  const clone = JSON.parse(JSON.stringify(input));
  const parts = path.split(".");
  let cursor = clone;
  for (const part of parts.slice(0, -1)) {
    cursor[part] = cursor[part] || {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = value;
  return clone;
}
