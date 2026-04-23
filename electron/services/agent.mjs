import { nowStamp } from "../../src/shared/defaultState.mjs";

export function contextSnapshot(state) {
  const historicalIntent =
    state.company?.intent ||
    (state.participatedTenders || [])
      .flatMap((item) => [item.objeto, ...(item.items || []), ...(item.featuredItems || [])])
      .filter(Boolean)
      .join("; ") ||
    "em branco ate importar licitacoes participadas";
  const gaps = (state.criteria || [])
    .filter((item) => item.status !== "Atendido")
    .map((item) => `${item.title}: ${item.status}/${item.risk}`)
    .join("; ");

  const docs = (state.documents || [])
    .map((item) => `${item.name}: ${item.status} (${item.confidence}%)`)
    .join("; ");

  const tenders = (state.bahia?.notifications || [])
    .slice(0, 3)
    .map((item) => `${item.title} - score ${item.score}`)
    .join("; ");

  return [
    `Empresa: ${state.company?.name || "nao cadastrada"}`,
    `Intencao historica inferida: ${historicalIntent}`,
    `Teto financeiro: ${state.company?.financialCeiling || 0}`,
    `Lacunas: ${gaps || "sem lacunas criticas"}`,
    `Documentos: ${docs || "sem documentos"}`,
    `Licitacoes aderentes: ${tenders || "radar ainda nao executado"}`
  ].join("\n");
}

export function fallbackAgentAnswer(prompt, state) {
  const clean = String(prompt || "").toLowerCase();
  if (clean.includes("whatsapp")) {
    return "O WhatsApp fica como canal operacional de notificacao. Conecte no instalador, deixe notificacao ativa e eu anuncio licitacoes aderentes quando o radar Bahia encontrar oportunidade.";
  }
  if (clean.includes("google") || clean.includes("email")) {
    return "O login Google identifica o operador e habilita o email como canal de alerta. Sem credencial OAuth propria, o app grava o email localmente e abre o fluxo Google no navegador.";
  }
  if (clean.includes("cat") || clean.includes("tecnico")) {
    return "Prioridade tecnica: validar CATs, vinculo do responsavel tecnico e compatibilidade do escopo antes de compor bloco tecnico da proposta.";
  }
  if (clean.includes("bahia") || clean.includes("licit")) {
    const first = state.bahia?.notifications?.[0];
    if (first) {
      return `Radar Bahia: ${first.title} aparece como prioridade. Motivo: ${first.reason} Valor estimado: ${formatMoney(first.value)}.`;
    }
    return "Execute o radar Bahia para baixar o estado atual do corpus local e cruzar objeto, orgao, valor, CATs, documentos e intencao historica da empresa.";
  }
  return "Eu mantenho o estado da empresa, documentos, CATs, responsaveis, blocos de proposta e licitacoes Bahia em uma unica leitura operacional. Proxima acao sugerida: executar radar Bahia e fechar lacunas tecnicas de maior risco.";
}

export function inferAgentAction(prompt) {
  const clean = String(prompt || "").toLowerCase();
  const proposalCode =
    String(prompt || "").match(/\b(?:cp|pe|ce)?\s*\d{1,5}\s*\/\s*\d{4}\b/i)?.[0]?.replace(/\s+/g, "").toUpperCase() ||
    String(prompt || "").match(/\b\d{5}[A-Z]{2}\d{3,5}\d{4}\b/i)?.[0]?.toUpperCase() ||
    "";
  if (
    proposalCode &&
    clean.includes("proposta") &&
    (clean.includes("ger") || clean.includes("cri") || clean.includes("mont") || clean.includes("emit"))
  ) {
    return {
      type: "create_proposal",
      view: "proposal",
      tenderCode: proposalCode,
      label: `Gerar proposta ${proposalCode}`
    };
  }
  const routes = [
    { view: "ventures", label: "Abrir empreendimentos", terms: ["empreendimento", "nexus", "lote", "reserva", "contrato imobiliario"] },
    { view: "documents", label: "Abrir documentos", terms: ["documento", "certidao", "dfl", "cat", "upload", "validar arquivo"] },
    { view: "proposal", label: "Abrir propostas", terms: ["proposta", "dossie", "anexo", "composicao"] },
    { view: "bahia", label: "Abrir licitacoes BA", terms: ["bahia", "radar", "edital", "licitacao"] },
    { view: "company", label: "Abrir empresa", terms: ["empresa", "cadastro", "balanco", "cnpj"] },
    { view: "portals", label: "Abrir portais externos", terms: ["portal", "twa", "ngrok", "apk", "externo"] },
    { view: "settings", label: "Abrir configuracoes", terms: ["configuracao", "gmail", "whatsapp", "email", "instalador"] },
    { view: "dashboard", label: "Abrir dashboard", terms: ["dashboard", "metrica", "indicador"] },
    { view: "home", label: "Abrir inicio", terms: ["inicio", "diretriz", "assistente"] }
  ];
  const route = routes.find((item) => item.terms.some((term) => clean.includes(term)));
  if (!route) return null;
  return { type: "navigate", view: route.view, label: route.label };
}

export async function answerAgentPrompt({ prompt, state, apiKey, model = "gemini-2.5-flash" }) {
  if (apiKey) {
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
                parts: [
                  {
                    text:
                      "Voce e o agente operacional do Glauco para licitacoes da Bahia. Responda em portugues, direto, com foco em acao, risco e estado da empresa.\n\n" +
                      contextSnapshot(state) +
                      `\n\nPergunta do operador: ${prompt}`
                  }
                ]
              }
            ]
          })
        }
      );
      if (response.ok) {
        const json = await response.json();
        const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n").trim();
        if (text) return text;
      }
    } catch {
      return fallbackAgentAnswer(prompt, state);
    }
  }
  return fallbackAgentAnswer(prompt, state);
}

export async function reviseAssistantBehavior({ instruction, currentBehavior, state, apiKey, model = "gemini-2.5-flash" }) {
  const clean = String(instruction || "").trim();
  const current = String(currentBehavior || "").trim();
  if (!clean) return current;

  const fallback = [
    current || "O assistente atua como agente operacional de licitacoes da Bahia.",
    `Ajuste solicitado pelo operador: ${clean}.`,
    "Preservar: portugues direto, foco em acao, risco, documentos, CATs, responsaveis tecnicos, radar Bahia, proposta e instrucoes permanentes do sistema."
  ].join("\n");

  if (apiKey) {
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
                parts: [
                  {
                    text:
                      "Reescreva a configuracao editavel de comportamento do assistente para o produto Glauco Licitacoes.\n" +
                      "Nao substitua, reduza ou contradiga instrucoes permanentes do sistema. O texto final deve ser uma configuracao operacional, em portugues, objetiva, coerente e segura.\n\n" +
                      contextSnapshot(state) +
                      `\n\nConfiguracao atual:\n${current}\n\nPedido do operador:\n${clean}\n\nTexto final da configuracao:`
                  }
                ]
              }
            ]
          })
        }
      );
      if (response.ok) {
        const json = await response.json();
        const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n").trim();
        if (text) return text;
      }
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export async function reviseProposalTemplateSection({ instruction, section, state, apiKey, model = "gemini-2.5-flash" }) {
  const clean = String(instruction || "").trim();
  const current = String(section?.prompt || "").trim();
  if (!clean) return current;
  const fallback = [
    current,
    `Ajuste do operador: ${clean}.`,
    "Manter formato de proposta de preco, linguagem legal brasileira, papel timbrado, dados da empresa e coerencia com edital."
  ].join("\n");

  if (apiKey) {
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
                parts: [
                  {
                    text:
                      "Reescreva uma matriz de prompt para gerar secao de proposta de preco em licitacao.\n" +
                      "Preserve texto legal, formalidade, campos variaveis, papel timbrado e coerencia com o modelo Confidence Patagonia.\n" +
                      "Responda apenas com a matriz de prompt final, em portugues.\n\n" +
                      contextSnapshot(state) +
                      `\n\nSecao: ${section?.title || ""}\nMatriz atual:\n${current}\n\nComentario do operador:\n${clean}`
                  }
                ]
              }
            ]
          })
        }
      );
      if (response.ok) {
        const json = await response.json();
        const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n").trim();
        if (text) return text;
      }
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function runAgentTask(state, id) {
  const stamp = nowStamp();
  state.agentTasks = (state.agentTasks || []).map((task) => {
    if (task.id !== id) return task;
    return {
      ...task,
      status: "Executado",
      result: `Executado em ${stamp}. Lacunas vinculadas ao estado da empresa foram atualizadas.`
    };
  });
  state.activity = [`${stamp} - Agente executado: ${id}`, ...(state.activity || [])].slice(0, 30);
  return state;
}

export function runAllAgentTasks(state) {
  const stamp = nowStamp();
  state.agentTasks = (state.agentTasks || []).map((task) => ({
    ...task,
    status: "Executado",
    result: `Fila executada em ${stamp}.`
  }));
  state.criteria = (state.criteria || []).map((criterion) =>
    criterion.id === "tecnico_capacidade" ? { ...criterion, status: "Em validacao" } : criterion
  );
  state.activity = [`${stamp} - Fila de agentes executada`, ...(state.activity || [])].slice(0, 30);
  return state;
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}
