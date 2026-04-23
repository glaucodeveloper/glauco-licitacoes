export const NAV_ROUTES = [
  { id: "home", label: "Inicio" },
  { id: "dashboard", label: "Dashboard" },
  { id: "company", label: "Empresa" },
  { id: "documents", label: "Documentos" },
  { id: "proposal", label: "Propostas" },
  { id: "bahia", label: "Licitacoes Bahia" },
  { id: "portals", label: "Portais externos" },
  { id: "ventures", label: "Empreendimentos" },
  { id: "settings", label: "Configuracoes" }
];

const LEGACY_SEEDED_INTENT =
  "obras publicas, infraestrutura, saneamento, edificacoes, reforma predial, engenharia civil, projetos e manutencao";

export const LLM_ACTION_SCENARIOS = [
  {
    id: "apply_tecnico_capacidade",
    intent: "Resolver pendencia de capacidade tecnica.",
    action: "apply_criterion_action",
    targetType: "criterion",
    targetId: "tecnico_capacidade"
  },
  {
    id: "validate_certidoes_regularidade",
    intent: "Validar certidoes de regularidade.",
    action: "validate_document",
    targetType: "document",
    targetId: "doc_certidoes"
  },
  {
    id: "flag_dfl_financeiro",
    intent: "Marcar DFL para revisao.",
    action: "flag_document",
    targetType: "document",
    targetId: "doc_dfl"
  },
  {
    id: "compose_tecnico_block",
    intent: "Compor bloco tecnico da proposta.",
    action: "compose_block",
    targetType: "proposalBlock",
    targetId: "tecnico"
  },
  {
    id: "run_operational_sweep",
    intent: "Executar varredura geral de lacunas.",
    action: "run_all_agent_tasks",
    targetType: "workspace",
    targetId: null
  }
];

export const PORTAL_ROUTE_OPTIONS = [
  { id: "dashboard", label: "Inicio da empresa", path: "/portal/confidence" },
  { id: "company", label: "Cadastro da empresa", path: "/portal/empresa" },
  { id: "documents", label: "Documentos e formularios", path: "/portal/documentos" },
  { id: "bahia", label: "Radar Bahia", path: "/portal/radar-bahia" },
  { id: "ventures", label: "Empreendimento imobiliario", path: "/portal/empreendimento" }
];

export function defaultState(userRoot = "") {
  return {
    schemaVersion: 2,
    activeView: "home",
    setup: {
      completed: false,
      currentStep: 0,
      installedAt: null,
      userRoot
    },
    integrations: {
      google: {
        connected: false,
        email: "",
        status: "Aguardando login"
      },
      whatsapp: {
        connected: false,
        phone: "",
        status: "Aguardando pareamento"
      },
      notifications: {
        screen: true,
        email: true,
        whatsapp: false
      }
    },
    company: {
      id: "confidence",
      name: "Confidence Engenharia",
      cnpj: "",
      city: "Salvador",
      state: "BA",
      financialCeiling: 8500000,
      intent: "",
      intentSource: "historical_participations",
      letterhead: {
        name: "Papel timbrado Confidence",
        logoText: "CONFIDENCE",
        header:
          "Confidence Construtora Ltda | CNPJ: 28.863.854/0001-10 | Proposta formal de licitacao",
        footer:
          "Avenida Goiabeiras II, Fracao 8, Area Rural, Residencial Colina do Sul | Vitoria da Conquista, Bahia | CEP: 45.099-899 | contato@construtoraconfidence.com",
        filePath: ""
      },
      summary:
        "Plataforma destinada a usar IA para projetar a empresa em torno de licitacoes do Estado da Bahia."
    },
    assistantConfig: {
      behavior:
        "O assistente deve atuar como agente operacional de licitacoes da Bahia: ler o estado da empresa, documentos, CATs, responsaveis tecnicos, radar de editais e blocos de proposta; responder em portugues, com foco em acao, risco, lacunas documentais e proximo passo rastreavel. Deve preservar as instrucoes permanentes do sistema e usar esta configuracao apenas como orientacao adicional do produto."
    },
    proposalTemplate: {
      sections: [
        {
          id: "price_opening",
          title: "Proposta de preco",
          prompt:
            "Gerar a abertura formal da proposta de preco com modalidade, numero, processo administrativo, empresa, endereco, CNPJ, representante legal, RG, CPF, valor global, local e data. Manter linguagem juridica objetiva conforme modelo original Confidence Patagonia."
        },
        {
          id: "independent_proposal",
          title: "Elaboracao independente e inexistencia de impedimento",
          prompt:
            "Gerar declaracao legal afirmando elaboracao independente da proposta, ausencia de comunicacao indevida com concorrentes ou orgao licitante, ciencia do teor da declaracao, inexistencia de impedimentos legais e poderes do representante para firmar o documento."
        },
        {
          id: "document_truth",
          title: "Veracidade de documentos",
          prompt:
            "Gerar declaracao de veracidade documental, responsabilidade civil e penal pelas informacoes, autenticidade dos anexos enviados, coerencia entre cadastro da empresa e documentos apresentados."
        },
        {
          id: "execution_commitment",
          title: "Compromisso de execucao",
          prompt:
            "Gerar texto de compromisso de execucao do objeto conforme edital, cumprimento das condicoes de habilitacao, manutencao da proposta e atendimento de prazos, equipe e documentos tecnicos."
        },
        {
          id: "signature",
          title: "Assinatura e fechamento",
          prompt:
            "Gerar bloco final com local, data, razao social, CNPJ, representante legal, CPF, RG e espaco de assinatura, mantendo rodape do papel timbrado."
        }
      ]
    },
    companyMaintenance: {
      balanceSource: null,
      balanceInference: "Aguardando upload de Excel/CSV para inferir estrutura financeira.",
      balanceSeries: [
        { period: "01/2026", revenue: 620000, expense: 510000, balance: 110000 },
        { period: "02/2026", revenue: 710000, expense: 535000, balance: 175000 },
        { period: "03/2026", revenue: 680000, expense: 560000, balance: 120000 }
      ]
    },
    participatedTenders: [],
    documents: [
      {
        id: "doc_certidoes",
        name: "Certidoes de regularidade",
        kind: "Regularidade",
        role: "Comprova que a empresa pode participar sem impedimento fiscal, trabalhista ou cadastral.",
        sample: "Certidao negativa/positiva com efeito de negativa, validade, titularidade e orgao emissor.",
        status: "Pendente",
        confidence: 42
      },
      {
        id: "doc_dfl",
        name: "DFL e demonstracoes financeiras",
        kind: "Economico-financeiro",
        role: "Sustenta capacidade financeira, limites de execucao e solidez para a proposta.",
        sample: "Balanco, indices, declaracao financeira e demonstrativos ligados ao valor estimado.",
        status: "Revisar",
        confidence: 36
      },
      {
        id: "doc_cats",
        name: "CATs e atestados tecnicos",
        kind: "Tecnico",
        role: "Prova experiencia compativel com o objeto e vincula o responsavel tecnico ao escopo.",
        sample: "CAT, atestado, acervo, CAO/CREA e compatibilidade entre item executado e edital.",
        status: "Pendente",
        confidence: 51
      }
    ],
    cats: [
      {
        id: "cat-001",
        title: "Execucao de obra civil e infraestrutura",
        scope: "obras, reforma, infraestrutura urbana",
        status: "Em validacao"
      }
    ],
    responsaveis: [
      {
        id: "rt-001",
        name: "Responsavel tecnico principal",
        registry: "CREA a confirmar",
        role: "Engenheiro civil",
        status: "Vinculo pendente"
      }
    ],
    criteria: [
      {
        id: "tecnico_capacidade",
        title: "Capacidade tecnica comprovada",
        status: "Pendente",
        risk: "Alto",
        agent: "Agente tecnico"
      },
      {
        id: "regularidade",
        title: "Regularidade documental",
        status: "Pendente",
        risk: "Medio",
        agent: "Agente formal"
      },
      {
        id: "financeiro",
        title: "Suficiencia economico-financeira",
        status: "Revisar",
        risk: "Alto",
        agent: "Agente financeiro"
      }
    ],
    proposalBlocks: [
      { id: "tecnico", name: "Tecnico", status: "Em composicao", coverage: 45 },
      { id: "regularidade", name: "Regularidade", status: "Pendente", coverage: 32 },
      { id: "financeiro", name: "Financeiro", status: "Revisar", coverage: 28 },
      { id: "vinculos", name: "Vinculos", status: "Pendente", coverage: 38 }
    ],
    proposalProcess: {
      activeStep: "triagem",
      selectedTenderId: "",
      status: "Em composicao",
      registeredAt: null,
      documentDetails: {},
      chat: [
        {
          role: "assistant",
          text:
            "Vamos compor a proposta por processo. Primeiro confirme qual licitacao vamos atacar, depois eu cobro documentos, blocos tecnicos, riscos e fechamento."
        }
      ]
    },
    proposals: [],
    agentTasks: [
      {
        id: "agent_tecnico",
        name: "Cruzar CAT, responsavel tecnico e escopo",
        status: "Pendente",
        result: "Aguardando documentos tecnicos."
      },
      {
        id: "agent_financeiro",
        name: "Conferir teto financeiro e DFL",
        status: "Pendente",
        result: "Aguardando DFL e balanco."
      },
      {
        id: "agent_formal",
        name: "Validar certidoes e representante legal",
        status: "Pendente",
        result: "Aguardando login e arquivos."
      }
    ],
    bahia: {
      notifications: [],
      meta: null,
      lastScan: null
    },
    portalForms: [
      {
        id: "fornecedor-intake",
        name: "Cadastro externo de fornecedor",
        active: true,
        targetRoute: "documents",
        description: "Coleta documentos e respostas de fornecedores."
      },
      {
        id: "reserva-empreendimento",
        name: "Reserva de unidade",
        active: true,
        targetRoute: "ventures",
        description: "Coleta cadastro para reserva em mapa imobiliario."
      }
    ],
    portalApps: [
      {
        id: "confidence-portal",
        name: "Portal Confidence",
        description: "Pagina externa para acompanhar lacunas, formularios e estado da proposta.",
        route: "dashboard",
        packageName: "app.glauco.confidence",
        active: false,
        port: 8010,
        localUrl: "",
        publicUrl: "",
        twaStatus: "Nao gerado"
      },
      {
        id: "nexus-empreendimento",
        name: "Empreendimento Nexus",
        description: "Mapa navegavel com reserva autenticada de unidade imobiliaria.",
        route: "ventures",
        packageName: "app.glauco.nexus",
        active: false,
        port: 8010,
        localUrl: "",
        publicUrl: "",
        twaStatus: "Nao gerado"
      }
    ],
    chat: [
      {
        role: "assistant",
        text:
          "Agente pronto. Posso cruzar documentos, CATs, responsaveis tecnicos, radar Bahia e portais externos."
      }
    ],
    activity: [
      "Workspace local preparado para Electron.",
      "Radar Bahia pronto para varrer editais abertos."
    ]
  };
}

export function mergeState(base, loaded) {
  if (!loaded || typeof loaded !== "object") return base;
  const merged = {
    ...base,
    ...loaded,
    setup: { ...base.setup, ...loaded.setup },
    integrations: {
      ...base.integrations,
      ...loaded.integrations,
      google: { ...base.integrations.google, ...(loaded.integrations?.google || {}) },
      whatsapp: { ...base.integrations.whatsapp, ...(loaded.integrations?.whatsapp || {}) },
      notifications: {
        ...base.integrations.notifications,
        ...(loaded.integrations?.notifications || {})
      }
    },
    company: { ...base.company, ...loaded.company },
    assistantConfig: { ...base.assistantConfig, ...(loaded.assistantConfig || {}) },
    proposalTemplate: {
      ...base.proposalTemplate,
      ...(loaded.proposalTemplate || {}),
      sections: loaded.proposalTemplate?.sections || base.proposalTemplate.sections
    },
    companyMaintenance: { ...base.companyMaintenance, ...(loaded.companyMaintenance || {}) },
    bahia: { ...base.bahia, ...loaded.bahia },
    proposalProcess: { ...base.proposalProcess, ...(loaded.proposalProcess || {}) },
    proposals: loaded.proposals || base.proposals
  };
  if (merged.company.intent === LEGACY_SEEDED_INTENT) {
    merged.company.intent = "";
    merged.company.intentSource = "historical_participations";
  }
  if (!Array.isArray(merged.participatedTenders)) {
    merged.participatedTenders = [];
  }
  return merged;
}

export function nowStamp() {
  return new Date().toLocaleString("pt-BR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
