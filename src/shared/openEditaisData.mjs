export function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeOpenText(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function stripControlChars(value) {
  return cleanText(String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " "));
}

function looksBrokenText(value) {
  if (!value) return false;
  const controlMatches = String(value).match(/[\u0000-\u001F\u007F]/g) || [];
  const normalized = normalizeOpenText(value);
  const letters = normalized.replace(/[^a-z]/g, "").length;
  const ratio = letters / Math.max(normalized.length, 1);
  return controlMatches.length >= 6 || normalized.length < 24 || ratio < 0.45;
}

function sanitizeTextList(values) {
  return (values || []).map(stripControlChars).filter(Boolean);
}

function toArray(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  if (typeof value === "string") return value.split(",").map(cleanText).filter(Boolean);
  return [];
}

export function buildSearchBlob(record) {
  const extracted = record.extracted || {};
  const cnaes = (extracted.cnaes || []).flatMap((item) => [item.code, item.description]);
  return normalizeOpenText(
    [
      record.id,
      record.licitacaoFormatada,
      record.orgao,
      record.unidade,
      record.modalidade,
      record.situacao,
      record.objeto,
      ...(record.featuredItems || []),
      ...(extracted.summary ? [extracted.summary] : []),
      ...(extracted.keywords || []),
      ...(extracted.items || []),
      ...(extracted.deliveryConditions || []),
      ...(extracted.technicalQualificationHighlight ? [extracted.technicalQualificationHighlight] : []),
      ...(extracted.proposalDateHighlight ? [extracted.proposalDateHighlight] : []),
      ...(extracted.requirements || []),
      ...(extracted.documents || []),
      ...(extracted.locations || []),
      ...cnaes
    ].join(" ")
  );
}

export function decorateOpenEdital(record) {
  const extracted = {
    ...(record.extracted || {}),
    technicalQualificationHighlight: stripControlChars(record.extracted?.technicalQualificationHighlight),
    proposalDateHighlight: stripControlChars(record.extracted?.proposalDateHighlight),
    items: sanitizeTextList(record.extracted?.items),
    deliveryConditions: sanitizeTextList(record.extracted?.deliveryConditions),
    locations: sanitizeTextList(record.extracted?.locations),
    deadlines: sanitizeTextList(record.extracted?.deadlines),
    requirements: sanitizeTextList(record.extracted?.requirements),
    documents: sanitizeTextList(record.extracted?.documents),
    keywords: sanitizeTextList(record.extracted?.keywords),
    sourceTextPreview: stripControlChars(record.extracted?.sourceTextPreview)
  };
  const fallbackSummary = stripControlChars(record.objeto);
  const summary = stripControlChars(extracted.summary);
  extracted.summary = looksBrokenText(summary) ? fallbackSummary : summary;

  const decorated = { ...record, extracted };
  return {
    ...decorated,
    index: {
      searchBlob: buildSearchBlob(decorated),
      orgao: normalizeOpenText(record.orgao),
      modalidade: normalizeOpenText(record.modalidade),
      situacao: normalizeOpenText(record.situacao),
      cnaes: (extracted.cnaes || []).map((item) =>
        normalizeOpenText([item.code, item.description].filter(Boolean).join(" "))
      ),
      items: [...(record.featuredItems || []), ...(extracted.items || [])].map(normalizeOpenText),
      delivery: (extracted.deliveryConditions || []).map(normalizeOpenText),
      keywords: (extracted.keywords || []).map(normalizeOpenText),
      locations: (extracted.locations || []).map(normalizeOpenText)
    }
  };
}

export function decorateOpenEditaisDataset(dataset) {
  return (dataset || []).map(decorateOpenEdital);
}

export function normalizeFilters(input = {}) {
  return {
    query: cleanText(input.query),
    orgaos: toArray(input.orgaos),
    modalidades: toArray(input.modalidades),
    situacoes: toArray(input.situacoes),
    anos: toArray(input.anos),
    cnaes: toArray(input.cnaes),
    itens: toArray(input.itens),
    entrega: toArray(input.entrega),
    sort: cleanText(input.sort) || "recentes"
  };
}

function matchesTokens(needles, haystacks) {
  if (!needles.length) return true;
  return needles.every((needle) =>
    haystacks.some((haystack) => haystack.includes(normalizeOpenText(needle)))
  );
}

function matchesPhrase(haystack, needle) {
  const normalizedNeedle = normalizeOpenText(needle);
  const tokens = normalizedNeedle.split(/\s+/).filter((token) => token.length >= 3);
  if (!tokens.length) return haystack.includes(normalizedNeedle);
  return tokens.every((token) => haystack.includes(token));
}

export function applyFilters(records, rawFilters = {}) {
  const filters = normalizeFilters(rawFilters);
  const query = normalizeOpenText(filters.query);

  return records.filter((record) => {
    if (query && !record.index.searchBlob.includes(query)) return false;
    if (filters.orgaos.length && !filters.orgaos.some((value) => matchesPhrase(record.index.orgao, value))) return false;
    if (
      filters.modalidades.length &&
      !filters.modalidades.some((value) => matchesPhrase(record.index.modalidade, value))
    ) {
      return false;
    }
    if (filters.situacoes.length && !filters.situacoes.some((value) => matchesPhrase(record.index.situacao, value))) {
      return false;
    }
    if (filters.anos.length && !filters.anos.includes(String(record.ano))) return false;
    if (!matchesTokens(filters.cnaes, record.index.cnaes)) return false;
    if (!matchesTokens(filters.itens, [...record.index.items, record.index.searchBlob])) return false;
    if (!matchesTokens(filters.entrega, [...record.index.delivery, ...record.index.locations, record.index.searchBlob])) {
      return false;
    }
    return true;
  });
}

function scoreRecord(record, filters) {
  let score = 0;
  const query = normalizeOpenText(filters.query);

  if (query) {
    if (record.index.searchBlob.includes(query)) score += 18;
    for (const token of query.split(/\s+/).filter(Boolean)) {
      if (record.index.searchBlob.includes(token)) score += 3;
    }
  }
  for (const cnae of filters.cnaes) {
    if (record.index.cnaes.some((entry) => entry.includes(normalizeOpenText(cnae)))) score += 7;
  }
  for (const item of filters.itens) {
    if ([...record.index.items, record.index.searchBlob].some((entry) => entry.includes(normalizeOpenText(item)))) {
      score += 6;
    }
  }
  for (const entry of filters.entrega) {
    if ([...record.index.delivery, ...record.index.locations, record.index.searchBlob].some((value) =>
      value.includes(normalizeOpenText(entry))
    )) {
      score += 5;
    }
  }
  return score;
}

export function sortRecords(records, rawFilters = {}) {
  const filters = normalizeFilters(rawFilters);
  const entries = [...records];

  if (filters.sort === "maior_valor_estimado") {
    return entries.sort((left, right) => Number(right.valorEstimado || 0) - Number(left.valorEstimado || 0));
  }

  if (filters.sort === "relevancia") {
    return entries.sort((left, right) => {
      const delta = scoreRecord(right, filters) - scoreRecord(left, filters);
      if (delta !== 0) return delta;
      return String(right.dataAberturaIso || "").localeCompare(String(left.dataAberturaIso || ""));
    });
  }

  return entries.sort((left, right) => {
    const dateDelta = String(right.dataAberturaIso || "").localeCompare(String(left.dataAberturaIso || ""));
    if (dateDelta !== 0) return dateDelta;
    return Number(right.valorEstimado || 0) - Number(left.valorEstimado || 0);
  });
}

export function paginate(records, page = 1, pageSize = 18) {
  const safePage = Math.max(Number(page || 1), 1);
  const safePageSize = Math.min(Math.max(Number(pageSize || 18), 1), 60);
  const total = records.length;
  const totalPages = Math.max(Math.ceil(total / safePageSize), 1);
  const start = (safePage - 1) * safePageSize;
  return {
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
    items: records.slice(start, start + safePageSize)
  };
}

export function summarizeForList(record) {
  return {
    id: record.id,
    licitacaoFormatada: record.licitacaoFormatada,
    orgao: record.orgao,
    unidade: record.unidade,
    modalidade: record.modalidade,
    situacao: record.situacao,
    ano: record.ano,
    dataAbertura: record.dataAbertura,
    dataAberturaIso: record.dataAberturaIso,
    valorEstimado: record.valorEstimado,
    objeto: record.objeto,
    editalPdfUrl: record.editalPdfUrl,
    featuredItems: record.featuredItems || [],
    extracted: {
      summary: record.extracted.summary || "",
      technicalQualificationHighlight: record.extracted.technicalQualificationHighlight || "",
      proposalDateHighlight: record.extracted.proposalDateHighlight || "",
      cnaes: record.extracted.cnaes || [],
      deliveryConditions: record.extracted.deliveryConditions || [],
      items: record.extracted.items || [],
      keywords: record.extracted.keywords || [],
      requirements: record.extracted.requirements || [],
      deadlines: record.extracted.deadlines || [],
      documents: record.extracted.documents || []
    }
  };
}

export function listOpenEditais(dataset, query = {}) {
  const filtered = applyFilters(dataset, query);
  const sorted = sortRecords(filtered, query);
  const page = paginate(sorted, query.page, query.pageSize);
  return {
    ...page,
    items: page.items.map(summarizeForList)
  };
}

export function getOpenEditalById(dataset, id) {
  return dataset.find((record) => record.id === id) || null;
}
