const STOPWORDS = new Set([
  "para",
  "com",
  "uma",
  "das",
  "dos",
  "pela",
  "pelo",
  "sobre",
  "estado",
  "bahia",
  "empresa"
]);

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function buildCompanyTerms(state) {
  const inferredIntent = inferHistoricalIntent(state.participatedTenders || []);
  const seed = [
    state.company?.name,
    state.company?.intent || inferredIntent,
    state.company?.summary,
    ...(state.documents || []).map((item) => `${item.name} ${item.kind}`),
    ...(state.cats || []).map((item) => `${item.title} ${item.scope}`),
    ...(state.responsaveis || []).map((item) => `${item.role} ${item.registry}`)
  ].join(" ");

  return [...new Set(normalizeText(seed).split(/\s+/))]
    .filter((term) => term.length >= 4 && !STOPWORDS.has(term))
    .slice(0, 40);
}

export function proposalFitForRecord(record, state) {
  const terms = buildCompanyTerms(state);
  const financialCeiling = Number(state.company?.financialCeiling || 0);
  const score = scoreBahiaRecord(record, terms, financialCeiling);
  return summarizeProposalFit(record, score, state);
}

export function inferHistoricalIntent(participatedTenders = []) {
  return participatedTenders
    .flatMap((item) => [
      item.objeto,
      item.modalidade,
      item.orgao,
      item.licitacaoFormatada,
      ...(item.items || []),
      ...(item.featuredItems || []),
      ...(item.cnaes || []).flatMap((cnae) =>
        typeof cnae === "string" ? [cnae] : [cnae.code, cnae.description]
      )
    ])
    .filter(Boolean)
    .join(" ");
}

export function recordSearchBlob(record) {
  if (record.index?.searchBlob) return record.index.searchBlob;
  const extracted = record.extracted || {};
  const analysis = record.analysis || {};
  return normalizeText(
    [
      record.licitacaoFormatada,
      record.orgao,
      record.unidade,
      record.modalidade,
      record.situacao,
      record.objeto,
      extracted.summary,
      extracted.requirements,
      extracted.items,
      extracted.locations,
      extracted.cnaes?.map((item) => `${item.code} ${item.description}`),
      analysis.summary,
      analysis.matchReasons
    ]
      .flat(5)
      .filter(Boolean)
      .join(" ")
  );
}

export function scoreBahiaRecord(record, terms, financialCeiling) {
  const blob = recordSearchBlob(record);
  let score = 0;

  for (const term of terms) {
    if (blob.includes(term)) score += 4;
  }

  const situacao = normalizeText(record.situacao);
  const modalidade = normalizeText(record.modalidade);
  const objeto = normalizeText(record.objeto);
  const value = Number(record.valorEstimado || 0);

  if (situacao.includes("andamento") || situacao.includes("elaboracao")) score += 10;
  if (modalidade.includes("concorrencia")) score += 6;
  if (modalidade.includes("pregao")) score += 2;
  if (objeto.includes("obra") || objeto.includes("engenharia") || objeto.includes("infraestrutura")) score += 12;
  if (record.editalPdfUrl) score += 3;
  if (value > 0 && value <= Number(financialCeiling || 0)) score += 10;
  if (value > Number(financialCeiling || 0) && Number(financialCeiling || 0) > 0) score -= 5;
  if (Array.isArray(record.featuredItems) && record.featuredItems.length > 0) score += 2;

  return score;
}

export function summarizeNotification(record, score, state = {}) {
  const fit = summarizeProposalFit(record, score, state);
  const extracted = record.extracted || {};
  const deadline = Array.isArray(extracted.deadlines) ? extracted.deadlines[0] : "";
  return {
    id: record.id,
    title: `${record.modalidade || "Licitacao"} ${record.licitacaoFormatada || record.id}`,
    orgao: record.orgao || "Orgao nao informado",
    objeto: record.objeto || extracted.summary || "Objeto nao informado",
    value: Number(record.valorEstimado || 0),
    date: record.dataAberturaIso || record.dataAbertura || "",
    score,
    proposalPercent: fit.proposalPercent,
    magnitudeArgument: fit.magnitudeArgument,
    reason: fit.magnitudeArgument,
    editalUrl: record.editalPdfUrl || "",
    deadline
  };
}

export function summarizeProposalFit(record, score, state = {}) {
  const value = Number(record.valorEstimado || 0);
  const ceiling = Number(state.company?.financialCeiling || 0);
  const intent = String(state.company?.intent || "").trim();
  const percent = Math.max(3, Math.min(100, Math.round((score / 60) * 100)));
  const valueArgument =
    value > 0 && ceiling > 0 && value <= ceiling
      ? "valor dentro do teto financeiro informado"
      : value > ceiling && ceiling > 0
        ? "valor acima do teto, exige decisao de apetite"
        : "valor ainda precisa ser confirmado";
  const intentArgument = intent
    ? "dialoga com a intencao declarada para esta busca"
    : "sem intencao declarada, argumento baseado em aderencia documental e financeira";
  const magnitude =
    percent >= 75 ? "alta" : percent >= 45 ? "media" : "baixa";

  return {
    proposalPercent: percent,
    magnitude,
    magnitudeArgument: `Magnitude ${magnitude}: ${intentArgument}; ${valueArgument}; objeto e requisitos merecem triagem antes de compor proposta.`
  };
}

export function runBahiaScan({ state, dataset, meta, limit = 5 }) {
  const terms = buildCompanyTerms(state);
  const financialCeiling = Number(state.company?.financialCeiling || 0);
  const notifications = [...(dataset || [])]
    .map((record) => [record, scoreBahiaRecord(record, terms, financialCeiling)])
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([record, score]) => summarizeNotification(record, score, state));

  return {
    notifications,
    meta: meta || null,
    lastScan: new Date().toISOString()
  };
}
