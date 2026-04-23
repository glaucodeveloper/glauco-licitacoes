import { useEffect, useMemo, useRef, useState } from "react";

const api = window.glauco;
const assetBase = import.meta.env.BASE_URL || "/";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0
});

const emptyListing = { items: [], total: 0, totalPages: 1, page: 1 };

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
          {[
            ["dashboard", "Dashboard"],
            ["company", "Empresa"],
            ["documents", "Documentos"],
            ["proposal", "Propostas"],
            ["bahia", "Licitacoes BA"],
            ["portals", "Portais externos"],
            ["ventures", "Empreendimentos"],
            ["settings", "Configuracoes"]
          ].map(([id, label]) => (
            <button
              key={id}
              className={state.activeView === id ? "nav-item active" : "nav-item"}
              onClick={() => applyState(api.setActiveView(id), "Abrindo tela")}
            >
              {label}
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
				onScan={() => applyState(api.runBahiaScan(), "Rodando radar Bahia")}
				onSaveIntent={(intent) => applyState(api.updateState({ company: { intent } }), "Salvando intencao")}
				onSaveAssistant={(behavior) => applyState(api.updateState({ assistantConfig: { behavior } }), "Salvando assistente")}
				onReviseAssistant={(instruction) => applyState(api.reviseAssistantConfig(instruction), "Revisando assistente")}
				onReviseProposalSection={(sectionId, instruction) =>
					applyState(api.reviseProposalTemplateSection(sectionId, instruction), "Revisando matriz da proposta")
				}
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
            />
          )}
          {state.activeView === "proposal" && (
            <ProposalsView
              state={state}
              onSave={(patch) => applyState(api.updateState(patch), "Salvando processo")}
              onCreateProposal={(tenderId) => applyState(api.createProposal(tenderId), "Gerando PDF da proposta")}
              onAttachRequirement={(requirement) =>
                applyState(api.selectProposalRequirementFile(requirement.id, requirement.label), "Anexando requisito")
              }
              onOpen={(url) => api.openExternal(url)}
            />
          )}
          {state.activeView === "bahia" && (
            <BahiaExplorer
              state={state}
              onOpen={(url) => api.openExternal(url)}
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
              onTwa={(id) => applyState(api.generateTwa(id), "Gerando TWA")}
              onOpen={(url) => api.openExternal(url)}
            />
          )}
          {state.activeView === "ventures" && <VenturesView />}
          {state.activeView === "settings" && (
            <SettingsView
              state={state}
              versions={versions}
              onSave={(patch) => applyState(api.updateState(patch), "Salvando configuracoes")}
              onOpenSetup={() => api.openSetup()}
              onConnectGoogle={(email) => applyState(api.connectGoogle(email), "Configurando Gmail")}
              onConnectWhatsApp={(phone) => applyState(api.connectWhatsApp(phone), "Configurando WhatsApp")}
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

function Onboarding({ state, onState, onComplete }) {
  const [step, setStep] = useState(state.setup.currentStep || 0);
  const [draft, setDraft] = useState(state);
  const slides = [
    "Plataforma",
    "Google e email",
    "WhatsApp",
    "Empresa",
    "Concluir"
  ];

  function patch(path, value) {
    setDraft((current) => setPath(current, path, value));
  }

  async function connectGoogle() {
    const next = await api.connectGoogle(draft.integrations.google.email);
    setDraft(next);
    onState(next);
  }

  async function connectWhatsApp() {
    const next = await api.connectWhatsApp(draft.integrations.whatsapp.phone);
    setDraft(next);
    onState(next);
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
            <Fact label="Canais" value="Tela, email e WhatsApp" />
          </div>
        </InstallSlide>

        <InstallSlide>
          <div className="install-web-layout">
            <div className="install-copy">
              <p className="eyebrow">Identidade e email</p>
              <h2>Vincule uma conta Google para o operador principal.</h2>
              <p>Use o painel interno para autenticar Gmail/Google. O email informado fica salvo na pasta local para alertas e auditoria.</p>
              <label className="field">
                <span>Email Google</span>
                <input
                  value={draft.integrations.google.email}
                  onChange={(event) => patch("integrations.google.email", event.target.value)}
                  placeholder="operador@empresa.com"
                />
              </label>
              <button className="primary" onClick={connectGoogle}>Confirmar Google/Gmail</button>
              <StatusLine status={draft.integrations.google.status} ok={draft.integrations.google.connected} />
            </div>
            <InstallWebFrame
              title="Google/Gmail"
              src="https://accounts.google.com/ServiceLogin?service=mail&continue=https%3A%2F%2Fmail.google.com%2Fmail%2F"
              partition="persist:glauco-google"
            />
          </div>
        </InstallSlide>

        <InstallSlide>
          <div className="install-web-layout">
            <div className="install-copy">
              <p className="eyebrow">Notificacao operacional</p>
              <h2>Ative WhatsApp para receber oportunidades e pendencias.</h2>
              <p>Faça o pareamento no painel interno do WhatsApp Web e confirme o numero para notificacoes da plataforma.</p>
              <label className="field">
                <span>Numero WhatsApp</span>
                <input
                  value={draft.integrations.whatsapp.phone}
                  onChange={(event) => patch("integrations.whatsapp.phone", event.target.value)}
                  placeholder="+55 71 99999-9999"
                />
              </label>
              <button className="primary" onClick={connectWhatsApp}>Confirmar WhatsApp</button>
              <StatusLine status={draft.integrations.whatsapp.status} ok={draft.integrations.whatsapp.connected} />
            </div>
            <InstallWebFrame
              title="WhatsApp Web"
              src="https://web.whatsapp.com/"
              partition="persist:glauco-whatsapp"
            />
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
            O agente continua usando o mesmo estado local para licitacoes, portais externos e empreendimentos.
          </p>
          <div className="install-facts">
            <Fact label="Google" value={draft.integrations.google.connected ? "Conectado" : "Pendente"} />
            <Fact label="WhatsApp" value={draft.integrations.whatsapp.connected ? "Conectado" : "Pendente"} />
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

function InstallWebFrame({ title, src, partition }) {
  return (
    <div className="install-web-frame">
      <div className="install-web-bar">
        <strong>{title}</strong>
        <span>{src.replace(/^https?:\/\//, "")}</span>
      </div>
      <webview
        src={src}
        partition={partition}
        allowpopups="true"
        webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes"
      />
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusLine({ status, ok }) {
  return <div className={ok ? "status ok" : "status"}>{status}</div>;
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
        <button className="primary" onClick={onScan}>Atualizar radar Bahia</button>
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
    <section className="panel proposal-template-panel">
      <div className="assistant-config-copy">
        <p className="eyebrow">Proposta de preco</p>
        <h2>Matrizes legais editaveis por comentario</h2>
        <p>
          A proposta usa o papel timbrado da empresa e gera secoes no estilo do PDF Confidence Patagonia:
          abertura de preco, declaracoes legais, compromisso documental e assinatura.
        </p>
        <div className="assistant-rules">
          <Fact label="Papel" value={state.company?.letterhead?.name || "Papel timbrado"} />
          <Fact label="Rodape" value={state.company?.letterhead?.footer || "Nao configurado"} />
        </div>
      </div>
      <div className="proposal-template-sections">
        {sections.map((section) => (
          <article className="proposal-template-section" key={section.id}>
            <div className="assistant-behavior-readout">
              <span>{section.title}</span>
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
                className="primary"
                onClick={() => {
                  onReviseSection(section.id, instructions[section.id] || "");
                  setInstructions((current) => ({ ...current, [section.id]: "" }));
                }}
              >
                Aplicar IA
              </button>
            </div>
          </article>
        ))}
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
        <button className="primary" onClick={onScan}>Atualizar radar Bahia</button>
      </header>
      <div className="metric-grid">
        <Metric title="Criterios atendidos" value={`${criteriaDone}/${state.criteria.length}`} detail="manutencao da empresa" onClick={() => onOpen("company")} />
        <Metric title="Documentos validados" value={`${docsOk}/${state.documents.length}`} detail="abrir inventario documental" onClick={() => onOpen("documents")} />
        <Metric title="Portais ativos" value={activePortals} detail="administrar TWA/ngrok" onClick={() => onOpen("portals")} />
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

function CompanyView({ state, onConfigure, onUploadBalance, onScan, onSaveIntent, onSaveAssistant, onReviseAssistant, onReviseProposalSection }) {
	const [displayedBehavior, setDisplayedBehavior] = useState(state.assistantConfig?.behavior || "");
	const [isTypingBehavior, setIsTypingBehavior] = useState(false);
	const [intentDraft, setIntentDraft] = useState(state.company.intent || "");

	const [assistantInstruction, setAssistantInstruction] = useState("");

	useEffect(() => {
		setIntentDraft(state.company.intent || "");
	}, [state.company.intent]);


	useEffect(() => {
		if (!isTypingBehavior) setDisplayedBehavior(state.assistantConfig?.behavior || "");
	}, [state.assistantConfig?.behavior]);
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
  const balanceSeries = state.companyMaintenance?.balanceSeries || [];
  return (
    <section className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Cadastro administrativo</p>
          <h1>Empresa</h1>
        </div>
        <button className="icon-button primary" onClick={onConfigure} title="Configurar cadastro">
          <span aria-hidden="true">⚙</span>
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
        <button onClick={onConfigure}>Abrir configurador de cadastro</button>
      </section>
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
          <button className="primary" onClick={onUploadBalance}>Atualizar por Excel</button>
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
      <section>
        <p className="eyebrow">Inventario documental da empresa</p>
        <div className="document-deck compact-document-deck">
          {state.documents.map((doc) => (
            <article className="document-card" key={doc.id}>
              <div className="document-card-top">
                <span>{doc.kind}</span>
                <strong>{doc.status}</strong>
              </div>
              <h2>{doc.name}</h2>
              <p>{doc.role || documentRole(doc.kind)}</p>
              <div className="document-ai-summary">
                <span>Resumo por IA</span>
                <p>{doc.summary || "Envie ou verifique o arquivo para o agente resumir o conteudo e o papel deste documento na licitacao."}</p>
              </div>
              <div className="document-sample">
                <span>Amostra do papel</span>
                <p>{doc.sample || "Arquivo, validade, titularidade e vinculo com criterio do edital."}</p>
              </div>
              <div className={doc.file ? "document-file ready" : "document-file"}>
                <span>Arquivo do usuario</span>
                <strong>{doc.file?.name || "Nenhum arquivo enviado"}</strong>
              </div>
              <div className="document-readiness">
                <div>
                  <span>Prontidao</span>
                  <strong>{doc.confidence}%</strong>
                </div>
                <progress value={doc.confidence} max="100" />
              </div>
            </article>
          ))}
        </div>
		  </section>
		  <section className="panel assistant-config-panel">
			  <div className="assistant-config-copy">
				  <p className="eyebrow">Config. Assistente</p>
				  <h2>Comportamento editavel do agente</h2>
				  <p>
					  Este texto descreve como o agente deve agir dentro da plataforma: proposito, tom,
					  foco operacional e criterios de resposta. A IA pode reescrever a configuracao a
					  partir da sua instrucao, mantendo coerencia com as instrucoes permanentes de sistema.
				  </p>
				  <div className="assistant-rules">
					  <Fact label="Escopo fixo" value="Licitacoes BA, documentos, CATs e proposta" />
					  <Fact label="Sistema" value="Instrucoes permanentes preservadas" />
				  </div>
			  </div>
			  <div className="assistant-config-editor">
				  <div className="assistant-behavior-readout">
					  <span>Texto de comportamento atual</span>
					  <p>{displayedBehavior}</p>
					  {isTypingBehavior && <i>Atualizando configuracao...</i>}
				  </div>
				  <label className="field">
					  <span>Instrucao para a IA modificar este texto</span>
					  <textarea
						  value={assistantInstruction}
						  onChange={(event) => setAssistantInstruction(event.target.value)}
						  placeholder="Ex: deixe o agente mais objetivo, sempre pedindo a proxima evidencia documental antes de recomendar proposta..."
					  />
				  </label>
				  <div className="row-actions">
					  <button className="primary" onClick={reviseAssistant} disabled={isTypingBehavior}>Aplicar IA</button>
					  <button onClick={() => onSaveAssistant(displayedBehavior)} disabled={isTypingBehavior}>Salvar exibido</button>
				  </div>
			  </div>
		  </section>
		  <ProposalTemplateEditor state={state} onReviseSection={onReviseProposalSection} />
    </section>
  );
}

function DocumentsView({ state, onSave, onUpload, onVerify }) {
  function updateDocument(id, patch) {
    const documents = state.documents.map((item) => (item.id === id ? { ...item, ...patch } : item));
    onSave({ documents });
  }
  return (
    <section className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Documentos, CATs e responsaveis</p>
          <h1>Administracao documental</h1>
          <p>Cada card e uma categoria de item de inventario documental. Ele comporta um documento enviado pelo usuario e verifica o arquivo segundo o requisito do tipo.</p>
        </div>
      </header>
      <div className="document-deck">
        {state.documents.map((doc) => (
          <article className="document-card" key={doc.id}>
            <div className="document-card-top">
              <span>{doc.kind}</span>
              <strong>{doc.status}</strong>
            </div>
            <h2>{doc.name}</h2>
            <p>{doc.role || documentRole(doc.kind)}</p>
            <div className="document-ai-summary">
              <span>Resumo por IA</span>
              <p>{doc.summary || "Envie ou verifique o arquivo para o agente resumir o conteudo e o papel deste documento na licitacao."}</p>
            </div>
            <div className="document-sample">
              <span>Amostra do papel</span>
              <p>{doc.sample || "Arquivo, validade, titularidade e vinculo com criterio do edital."}</p>
            </div>
            <div className={doc.file ? "document-file ready" : "document-file"}>
              <span>Arquivo do usuario</span>
              <strong>{doc.file?.name || "Nenhum arquivo enviado"}</strong>
              {doc.file?.uploadedAt && <small>Enviado em {doc.file.uploadedAt}</small>}
            </div>
            {doc.verification?.checks?.length ? (
              <div className="document-checks">
                {doc.verification.checks.map((check) => (
                  <div className={`document-check ${check.status}`} key={check.title}>
                    <span>{check.title}</span>
                    <small>{check.detail}</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="document-checks muted-checks">
                <div className="document-check pending">
                  <span>Aguardando upload</span>
                  <small>O agente verifica o arquivo segundo as instrucoes deste tipo documental.</small>
                </div>
              </div>
            )}
            <div className="document-readiness">
              <div>
                <span>Prontidao</span>
                <strong>{doc.confidence}%</strong>
              </div>
              <progress value={doc.confidence} max="100" />
            </div>
            <div className="document-actions">
              <button className="primary" onClick={() => onUpload(doc.id)}>Upload</button>
              <button disabled={!doc.file} onClick={() => onVerify(doc.id)}>Verificar</button>
              <button onClick={() => updateDocument(doc.id, { status: "Revisar", confidence: 35 })}>Revisar</button>
            </div>
          </article>
        ))}
      </div>
      <div className="split">
        <Panel title="CATs">
          <ul className="activity">{state.cats.map((item) => <li key={item.id}>{item.title} - {item.status}</li>)}</ul>
        </Panel>
        <Panel title="Responsaveis tecnicos">
          <ul className="activity">{state.responsaveis.map((item) => <li key={item.id}>{item.name} - {item.status}</li>)}</ul>
        </Panel>
      </div>
    </section>
  );
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

function ProposalsView({ state, onSave, onCreateProposal, onAttachRequirement, onOpen }) {
  const process = state.proposalProcess || {};
  const proposals = state.proposals || [];
  const selectedTender =
    (state.bahia.notifications || []).find((item) => item.id === process.selectedTenderId) ||
    (state.bahia.notifications || [])[0] ||
    null;
  const readiness = proposalReadiness(state);
  const docReadiness = proposalDocumentReadiness(state);
  const editalRequirements = proposalRequirementsForTender(selectedTender, state);

  function saveProcess(patch) {
    onSave({ proposalProcess: { ...process, ...patch } });
  }

  function createProposal() {
    if (!selectedTender) return;
    onCreateProposal(selectedTender.id);
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
          <p>Crie uma proposta a partir de um edital. A criacao mede prontidao dos arquivos da pagina Documentos contra o edital selecionado.</p>
        </div>
        <button className="primary" onClick={createProposal} disabled={!selectedTender}>Criar nova proposta</button>
      </header>
      <section className="proposal-document-registry">
        <header>
          <div>
            <strong>Colecao de propostas</strong>
            <span>Cada card e uma proposta criada a partir de edital e prontidao dos documentos.</span>
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
                {(proposal.documents || []).map((doc) => (
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
      <div className="proposal-step-workspace">
        <section className="proposal-step-panel">
          <header className="proposal-step-header">
            <div>
              <p className="eyebrow">Novo registro</p>
              <h2>{selectedTender?.title || "Selecione edital"}</h2>
              <p>{selectedTender?.magnitudeArgument || selectedTender?.reason || "Atualize o Radar Bahia para listar editais."}</p>
            </div>
            <div className="proposal-step-score">
              <Fact label="Prontidao arquivos" value={`${readiness}%`} />
              <progress value={readiness} max="100" />
            </div>
          </header>

          <div className="proposal-triage-grid">
            <label className="field proposal-tender-picker">
              <span>Edital</span>
              <select
                value={process.selectedTenderId || selectedTender?.id || ""}
                onChange={(event) => saveProcess({ selectedTenderId: event.target.value })}
              >
                {(state.bahia.notifications || []).map((item) => (
                  <option value={item.id} key={item.id}>{item.title}</option>
                ))}
                {!state.bahia.notifications?.length && <option value="">Radar vazio</option>}
              </select>
            </label>
            {selectedTender && <SelectedTenderDetails tender={selectedTender} />}
            <Panel title="Requisitos detectados por arquivo">
              <div className="proposal-requirement-list main-requirements">
                {editalRequirements.map((requirement) => {
                  const attached = process.requirementFiles?.[requirement.id];
                  const matchedDoc = docReadiness.find((doc) => requirement.label.toLowerCase().includes(doc.name.toLowerCase().slice(0, 10)));
                  return (
                    <article key={requirement.id}>
                      <div>
                        <strong>{requirement.label}</strong>
                        <span>{attached ? `Anexo: ${attached.name}` : requirement.source}</span>
                        {matchedDoc && (
                          <>
                            <small>{matchedDoc.ready ? "Pronto" : "Pendente"} - {matchedDoc.confidence}%</small>
                            <progress value={matchedDoc.confidence} max="100" />
                          </>
                        )}
                      </div>
                      <button onClick={() => onAttachRequirement(requirement)}>
                        {attached ? "Trocar anexo" : "Anexar"}
                      </button>
                    </article>
                  );
                })}
              </div>
            </Panel>
          </div>
        </section>

        <aside className="proposal-aside">
          <Panel title="Resumo">
            <div className="proposal-assembly-summary">
              <Fact label="Propostas" value={proposals.length} />
              <Fact label="Fonte" value="Documentos" />
              <Fact label="Regra" value="Prontidao x edital" />
            </div>
          </Panel>
          {selectedTender?.editalUrl && <button onClick={() => onOpen(selectedTender.editalUrl)}>Abrir edital</button>}
          <button className="primary" onClick={createProposal} disabled={!selectedTender}>Criar proposta</button>
        </aside>
      </div>


    </section>
  );
}

function SelectedTenderDetails({ tender }) {
  const extracted = tender.extracted || {};
  const fit = tender.proposalFit || {};
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
        <DetailList title="Documentos exigidos" items={extracted.documents || fit.documentSignals || []} />
        <DetailList title="Sinais tecnicos" items={extracted.technical || extracted.items || fit.intentSignals || []} />
      </div>
    </article>
  );
}

function proposalRequirementsForTender(tender, state) {
  const extracted = tender?.extracted || {};
  const fit = tender?.proposalFit || {};
  const raw = [
    ...(extracted.documents || []),
    ...(fit.documentSignals || []),
    ...(state.documents || []).map((doc) => doc.name)
  ].filter(Boolean);
  const normalized = new Map();
  for (const item of raw) {
    const label = String(item).slice(0, 120);
    const id = slugLocal(label);
    if (!normalized.has(id)) {
      normalized.set(id, {
        id,
        label,
        source: "Detectado automaticamente no edital/inventario"
      });
    }
  }
  if (!normalized.size) {
    ["Proposta de preco", "Declaracoes legais", "Regularidade fiscal", "Qualificacao tecnica", "Capacidade economico-financeira"].forEach((label) =>
      normalized.set(slugLocal(label), { id: slugLocal(label), label, source: "Fallback de requisitos usuais" })
    );
  }
  return [...normalized.values()].slice(0, 8);
}

function slugLocal(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function proposalReadiness(state) {
  const docAverage =
    (state.documents || []).reduce((total, doc) => total + Number(doc.confidence || 0), 0) /
    Math.max(1, (state.documents || []).length);
  return Math.round(docAverage);
}

function proposalDocumentReadiness(state) {
  return (state.documents || []).map((doc) => ({
    id: doc.id,
    name: doc.name,
    kind: doc.kind,
    status: doc.status,
    confidence: Number(doc.confidence || 0),
    ready: Boolean(doc.file) && Number(doc.confidence || 0) >= 70,
    fileName: doc.file?.name || ""
  }));
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

function BahiaExplorer({ state, onOpen, onGenerateProposal }) {
  const [overview, setOverview] = useState(null);
  const [filters, setFilters] = useState({ query: "", sort: "recentes", page: 1, pageSize: 12 });
  const [listing, setListing] = useState(emptyListing);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const proposalReady = selected ? documentsMeetProposalRequirements(state, selected) : false;

  useEffect(() => {
    api.openEditaisOverview().then(setOverview);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.openEditaisList(filters).then((payload) => {
      if (!alive) return;
      setListing(payload);
      const first = payload.items[0];
      if (first) api.openEditalDetail(first.id).then((detail) => alive && setSelected(detail));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [filters]);

  return (
    <section className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Base explorador-licitacoes-ba-source</p>
          <h1>Licitações abertas da Bahia</h1>
          <p>{overview ? `${overview.totals?.documents || 0} editais no corpus local` : "Carregando panorama"}</p>
        </div>
      </header>
      <div className="explorer-grid">
        <section className="panel">
          <div className="filters">
            <input
              value={filters.query}
              placeholder="item, orgao, requisito, local..."
              onChange={(event) => setFilters({ ...filters, query: event.target.value, page: 1, sort: "relevancia" })}
            />
            <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>
              <option value="recentes">Recentes</option>
              <option value="relevancia">Relevancia</option>
              <option value="maior_valor_estimado">Maior valor</option>
            </select>
          </div>
          <div className="result-list">
            {loading && <div className="empty">Carregando editais...</div>}
            {!loading && listing.items.map((item) => (
              <button key={item.id} className="licitacao-card" onClick={() => api.openEditalDetail(item.id).then(setSelected)}>
                <div className="licitacao-card-top">
                  <strong>{item.licitacaoFormatada || item.id}</strong>
                  <span>{item.proposalFit?.proposalPercent || 0}%</span>
                </div>
                <p>{item.orgao}</p>
                <small>{money.format(Number(item.valorEstimado || 0))}</small>
                <progress value={item.proposalFit?.proposalPercent || 0} max="100" />
                <em>Selecione para ver analise e acao de proposta.</em>
              </button>
            ))}
          </div>
        </section>
        <section className="panel detail">
          {selected ? (
            <>
              <p className="eyebrow">{selected.modalidade}</p>
              <h2>{selected.licitacaoFormatada || selected.id}</h2>
              <p>{selected.extracted?.summary || selected.objeto}</p>
              <div className="detail-grid">
                <Fact label="Orgao" value={selected.orgao} />
                <Fact label="Abertura" value={selected.dataAbertura || selected.dataAberturaIso} />
                <Fact label="Valor" value={money.format(Number(selected.valorEstimado || 0))} />
                <Fact label="Proposta" value={`${selected.proposalFit?.proposalPercent || 0}%`} />
              </div>
              <div className="proposal-argument">
                <span>Argumento de magnitude</span>
                <p>{selected.proposalFit?.magnitudeArgument || "Sem argumento calculado."}</p>
              </div>
              <div className="proposal-argument">
                <span>Analise para geracao de proposta</span>
                <p>{proposalIntegrationComment(selected)}</p>
                <ul className="side-analysis-list">
                  {docAiComments(selected).map((comment) => <li key={comment}>{comment}</li>)}
                </ul>
              </div>
              <div className={proposalReady ? "proposal-action-ready" : "proposal-action-ready blocked"}>
                <div>
                  <strong>{proposalReady ? "Documentos suficientes para abrir proposta" : "Documentos ainda nao cumprem requisitos"}</strong>
                  <span>{proposalDocumentGateReason(state)}</span>
                </div>
                <button className="primary" disabled={!proposalReady} onClick={() => onGenerateProposal(selected)}>
                  Gerar proposta com este edital
                </button>
              </div>
              <DetailList title="Requisitos" items={selected.extracted?.requirements || []} />
              <DetailList title="Documentos" items={selected.extracted?.documents || []} />
              <DetailList title="Capacidades tecnicas necessarias" items={editalTechnicalNeeds(selected)} />
              <DetailList title="Itens e escopos do objeto" items={editalScopeItems(selected)} />
              {selected.editalPdfUrl && <button className="primary" onClick={() => onOpen(selected.editalPdfUrl)}>Abrir PDF</button>}
            </>
          ) : (
            <div className="empty">Selecione um edital.</div>
          )}
        </section>
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
  const docs = item.extracted?.documents || item.proposalFit?.documentSignals || [];
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

function PortalsView({ state, routes, onAdd, onToggle, onTwa, onOpen }) {
  const [form, setForm] = useState({ name: "", packageName: "", route: "dashboard", description: "" });
  return (
    <section className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Aplicativos externos</p>
          <h1>Portais, formularios e TWA</h1>
          <p>Detalhes tecnicos ficam automatizados. Ativar um app tambem liga servidor local e tunel compartilhado.</p>
        </div>
      </header>
      <div className="panel form-panel">
        <h2>Adicionar TWA</h2>
        <div className="form-grid">
          <label className="field">
            <span>Nome</span>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="field">
            <span>Pacote Android</span>
            <input value={form.packageName} onChange={(event) => setForm({ ...form, packageName: event.target.value })} placeholder="app.glauco.portal" />
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
              <button onClick={() => onTwa(app.id)}>Gerar TWA</button>
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
            <small>{app.twaStatus}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function VenturesView() {
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [svgText, setSvgText] = useState("");
  const [selectedLot, setSelectedLot] = useState(null);
  const [selectedVenture, setSelectedVenture] = useState("nexus");
  const [contractPanel, setContractPanel] = useState({ ventureId: "nexus", contractId: "obra-lotes" });
  const [lotCount, setLotCount] = useState(0);
  const drag = useRef({ active: false, moved: false, x: 0, y: 0 });
  const liveOffset = useRef(offset);
  const ventures = [
    {
      id: "nexus",
      name: "Nexus Condominio",
      city: "Salvador/BA",
      status: "Mapa interativo",
      description: "Empreendimento importado do repositorio Nexus, com lotes SVG navegaveis e widget de reserva.",
      cnpj: "28.863.854/0001-10",
      address: "Av. das Goiabeiras II, Salvador/BA",
      createdAt: "23/04/2026",
      municipalRegistration: "Inscricao imobiliaria em conferencia",
      registry: "Matricula mae pendente de vinculo",
      incorporator: "Confidence Construtora LTDA",
      area: "Mapa base 102 lotes",
      metrics: ["102 lotes SVG", "Reserva por cadastro", "Portal TWA habilitado"],
      items: ["Lotes", "Mapa SVG", "Reservas", "Cadastro de interessados"],
      contracts: [
        { id: "obra-lotes", name: "Contrato de urbanizacao dos lotes", file: "contrato_urbanizacao_nexus.pdf", status: "Minuta anexada" },
        { id: "reserva", name: "Instrumento de reserva de unidade", file: "instrumento_reserva_unidade.pdf", status: "Modelo operacional" },
        { id: "corretagem", name: "Contrato de intermediacao comercial", file: "contrato_corretagem.pdf", status: "Pendente assinatura" }
      ]
    },
    {
      id: "patagonia",
      name: "Patagonia",
      city: "Bahia",
      status: "Cadastro inicial",
      description: "Area preparada para cadastro imobiliario, documentos comerciais e futura camada de mapa.",
      cnpj: "28.863.854/0001-10",
      address: "Endereco comercial em revisao",
      createdAt: "23/04/2026",
      municipalRegistration: "Inscricao municipal pendente",
      registry: "Matricula/RI pendente",
      incorporator: "Confidence Construtora LTDA",
      area: "Cadastro sem mapa vinculado",
      metrics: ["Ficha de empreendimento", "Documentos comerciais", "Portal externo pendente"],
      items: ["Documentos comerciais", "Contratos", "Ficha cadastral"],
      contracts: [
        { id: "patagonia-compra", name: "Contrato de aquisicao e desenvolvimento", file: "contrato_patagônia_base.pdf", status: "Arquivo pendente" },
        { id: "patagonia-reserva", name: "Modelo de reserva Patagonia", file: "reserva_patagônia.pdf", status: "Arquivo pendente" }
      ]
    }
  ];
  const activeVenture = ventures.find((venture) => venture.id === selectedVenture) || ventures[0];
  const activeContract =
    activeVenture.contracts?.find((contract) => contract.id === contractPanel.contractId) ||
    activeVenture.contracts?.[0];

  useEffect(() => {
    liveOffset.current = offset;
    if (layerRef.current) {
      layerRef.current.style.transform = `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`;
    }
  }, [offset, zoom]);

  useEffect(() => {
    let alive = true;
    if (selectedVenture !== "nexus") {
      setSvgText("");
      setLotCount(0);
      setSelectedLot(null);
      return () => {
        alive = false;
      };
    }
    fetch(`${assetBase}nexus-lotes.svg`)
      .then((response) => response.text())
      .then((text) => alive && setSvgText(text))
      .catch(() => alive && setSvgText(""));
    return () => {
      alive = false;
    };
  }, [selectedVenture]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !svgText) return;
    const svg = map.querySelector("svg");
    if (!svg) return;
    svg.classList.add("nexus-map-svg");
    const rects = Array.from(svg.querySelectorAll("rect"));
    setLotCount(rects.length);
    rects.forEach((rect, index) => {
      rect.id = `lote-${index}`;
      rect.classList.add("nexus-lote-rect");
      rect.dataset.index = String(index);
      rect.setAttribute("tabindex", "0");
      rect.setAttribute("role", "button");
      rect.setAttribute("aria-label", `Selecionar lote ${index}`);
      rect.onclick = (event) => {
        event.stopPropagation();
        selectSvgLot(rect);
      };
      rect.onkeydown = (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectSvgLot(rect);
        }
      };
    });
    if (!selectedLot && rects[0]) selectSvgLot(rects[0], false);
  }, [svgText]);

  function selectSvgLot(rect, focus = true) {
    const svg = mapRef.current?.querySelector("svg");
    if (!svg || !rect) return;
    const rects = Array.from(svg.querySelectorAll("rect"));
    rects.forEach((item) => item.classList.remove("lote-active"));
    rect.classList.add("lote-active");
    const index = rects.indexOf(rect);
    const bbox = rect.getBBox();
    const lot = {
      id: rect.id || `lote-${index}`,
      index,
      name: `Lote ${index}`,
      status: "Disponivel",
      area: `${Math.round(bbox.width * bbox.height).toLocaleString("pt-BR")} u2`,
      dimensions: `${bbox.width.toFixed(2)} x ${bbox.height.toFixed(2)}`,
      x: bbox.x,
      y: bbox.y
    };
    setSelectedLot(lot);
    if (focus) setZoom((value) => Math.max(value, 1.8));
  }

  return (
    <section className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Empreendimentos imobiliarios</p>
          <h1>Carteira de empreendimentos</h1>
          <p>Selecione um empreendimento para abrir mapa, reserva e portal externo correspondente.</p>
        </div>
        <div className="row-actions">
          <button onClick={() => setZoom((value) => Math.max(0.6, value - 0.2))}>-</button>
          <button onClick={() => setZoom((value) => Math.min(3, value + 0.2))}>+</button>
        </div>
      </header>
      <div className="venture-catalog">
        {ventures.map((venture) => (
          <article
            key={venture.id}
            role="button"
            tabIndex={0}
            className={selectedVenture === venture.id ? "venture-card active" : "venture-card"}
            onClick={() => {
              setSelectedVenture(venture.id);
              setContractPanel({ ventureId: venture.id, contractId: venture.contracts?.[0]?.id || "" });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedVenture(venture.id);
                setContractPanel({ ventureId: venture.id, contractId: venture.contracts?.[0]?.id || "" });
              }
            }}
          >
            <div className="venture-card-bg" />
            <div className="venture-card-content">
              <span>{venture.status}</span>
              <strong>{venture.name}</strong>
              <small>{venture.city}</small>
              <p>{venture.description}</p>
              <dl className="venture-card-details">
                <div><dt>CNPJ</dt><dd>{venture.cnpj}</dd></div>
                <div><dt>Endereco</dt><dd>{venture.address}</dd></div>
                <div><dt>Cadastro</dt><dd>{venture.createdAt}</dd></div>
                <div><dt>Inscricao</dt><dd>{venture.municipalRegistration}</dd></div>
                <div><dt>Matricula</dt><dd>{venture.registry}</dd></div>
                <div><dt>Incorporador</dt><dd>{venture.incorporator}</dd></div>
              </dl>
              <div className="venture-card-tags">
                {venture.metrics.map((metric) => <em key={metric}>{metric}</em>)}
              </div>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedVenture(venture.id);
                  setContractPanel({ ventureId: venture.id, contractId: venture.contracts?.[0]?.id || "" });
                }}
              >
                Contratos
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="venture-contracts-layout">
        <Panel title={`Itens de ${activeVenture.name}`}>
          <div className="venture-items-list">
            {(activeVenture.items || []).map((item) => <span key={item}>{item}</span>)}
          </div>
        </Panel>
        <Panel title="Contratos do empreendimento">
          <div className="venture-contract-grid">
            <div className="venture-contract-list">
              {(activeVenture.contracts || []).map((contract) => (
                <button
                  key={contract.id}
                  className={activeContract?.id === contract.id ? "active" : ""}
                  onClick={() => setContractPanel({ ventureId: activeVenture.id, contractId: contract.id })}
                >
                  {contract.name}
                </button>
              ))}
            </div>
            {activeContract && (
              <form className="venture-contract-form">
                <label className="field"><span>Nome do contrato</span><input value={activeContract.name} readOnly /></label>
                <label className="field"><span>Status</span><input value={activeContract.status} readOnly /></label>
                <label className="field"><span>Arquivo anexado</span><input value={activeContract.file} readOnly /></label>
                <button type="button" className="primary">Abrir formulario do contrato</button>
              </form>
            )}
          </div>
        </Panel>
      </div>
      <div className="venture-selected-head">
        <div>
          <p className="eyebrow">Mapa ativo</p>
          <h2>{activeVenture.name}</h2>
          <p>{activeVenture.id === "nexus" ? `Interacao carregada do SVG real do Nexus: ${lotCount || "..."} lotes detectados no mapa.` : "Mapa ainda nao cadastrado para este empreendimento."}</p>
        </div>
      </div>
      <div
        ref={mapRef}
        className="venture-map"
        onWheel={(event) => {
          event.preventDefault();
          setZoom((value) => clamp(value + (event.deltaY < 0 ? 0.12 : -0.12), 0.6, 3));
        }}
        onPointerDown={(event) => {
          if (event.target.closest("button")) return;
          drag.current = {
            active: true,
            moved: false,
            startX: event.clientX,
            startY: event.clientY,
            x: event.clientX - offset.x,
            y: event.clientY - offset.y
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current.active) return;
          const distance = Math.hypot(event.clientX - drag.current.startX, event.clientY - drag.current.startY);
          if (distance > 5) drag.current.moved = true;
          liveOffset.current = { x: event.clientX - drag.current.x, y: event.clientY - drag.current.y };
          if (layerRef.current) {
            layerRef.current.style.transform = `translate(${liveOffset.current.x}px, ${liveOffset.current.y}px) scale(${zoom})`;
          }
        }}
        onPointerUp={() => {
          drag.current.active = false;
          setOffset(liveOffset.current);
        }}
        onClick={(event) => {
          if (drag.current.moved) {
            drag.current.moved = false;
            return;
          }
          const rect = event.target.closest?.("rect");
          if (rect) selectSvgLot(rect);
        }}
      >
        <div ref={layerRef} className="venture-map-layer" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}>
          {activeVenture.id === "nexus" && svgText ? (
            <div className="nexus-svg-host" dangerouslySetInnerHTML={{ __html: svgText }} />
          ) : activeVenture.id === "nexus" ? (
            <div className="empty">Carregando mapa do Nexus...</div>
          ) : (
            <div className="empty">Mapa SVG ainda nao vinculado a este empreendimento.</div>
          )}
        </div>
        {activeVenture.id === "nexus" && selectedLot && (
          <aside className="lot-floating-card">
            <p className="eyebrow">Unidade selecionada</p>
            <h2>{selectedLot.name}</h2>
            <dl>
              <div><dt>Indice SVG</dt><dd>{selectedLot.index}</dd></div>
              <div><dt>Area tecnica</dt><dd>{selectedLot.area}</dd></div>
              <div><dt>Status</dt><dd>{selectedLot.status}</dd></div>
              <div><dt>Dimensoes</dt><dd>{selectedLot.dimensions}</dd></div>
            </dl>
            <p>Lote identificado pelo retangulo interativo original do SVG do empreendimento Nexus.</p>
            <button className="primary">Reservar este lote</button>
          </aside>
        )}
      </div>
      <Panel title="Widget de reserva">
        <div className="form-grid">
          <label className="field"><span>Nome</span><input placeholder="Interessado" /></label>
          <label className="field"><span>WhatsApp</span><input placeholder="+55..." /></label>
          <label className="field"><span>Unidade</span><input value={selectedLot?.name || ""} readOnly placeholder="Lote ou unidade" /></label>
          <button className="primary">Registrar reserva local</button>
        </div>
      </Panel>
    </section>
  );
}

function SettingsView({ state, versions, onSave, onOpenSetup, onConnectGoogle, onConnectWhatsApp }) {
  const [emailService, setEmailService] = useState("gmail");
  const [email, setEmail] = useState(state.integrations?.google?.email || "");
  const [phone, setPhone] = useState(state.integrations?.whatsapp?.phone || "");
  const notifications = state.integrations?.notifications || {};

  return (
    <section className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Sistema</p>
          <h1>Configuracoes locais</h1>
          <p>Configuracao padrao de aplicativo: instalacao, workspace, comunicacao, notificacoes e servicos externos.</p>
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
        <Panel title="Servico de email">
          <div className="settings-stack">
            <label className="field">
              <span>Tipo</span>
              <select value={emailService} onChange={(event) => setEmailService(event.target.value)}>
                <option value="gmail">Gmail</option>
              </select>
            </label>
            <label className="field">
              <span>Email Gmail</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="empresa@gmail.com" />
            </label>
            <StatusLine status={state.integrations?.google?.status || "Aguardando configuracao"} ok={state.integrations?.google?.connected} />
            <button className="primary" onClick={() => onConnectGoogle(email)}>Salvar Gmail</button>
          </div>
        </Panel>
        <Panel title="Servico WhatsApp">
          <div className="settings-stack">
            <label className="field">
              <span>Telefone</span>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+55 71 99999-9999" />
            </label>
            <StatusLine status={state.integrations?.whatsapp?.status || "Aguardando pareamento"} ok={state.integrations?.whatsapp?.connected} />
            <button className="primary" onClick={() => onConnectWhatsApp(phone)}>Salvar WhatsApp</button>
          </div>
        </Panel>
        <Panel title="Notificacoes">
          <div className="settings-stack">
            {[
              ["screen", "Notificacao em tela"],
              ["email", "Notificacao por email"],
              ["whatsapp", "Notificacao por WhatsApp"]
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
				<button className="primary" onClick={send}>
					Enviar
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
