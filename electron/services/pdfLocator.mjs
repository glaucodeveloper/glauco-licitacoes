import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const pdfTextCache = new Map();

export async function locatePdfTopic({ url, query }) {
  const cleanUrl = String(url || "").trim();
  const cleanQuery = String(query || "").trim();
  if (!cleanUrl || !cleanQuery) {
    return {
      ok: false,
      page: 1,
      top: 0,
      left: 0,
      query: cleanQuery,
      excerpt: "",
      reason: "PDF ou termo nao informado."
    };
  }

  try {
    const pages = await getPdfPages(cleanUrl);
    const match = bestPageMatch(pages, cleanQuery);
    if (!match) {
      return {
        ok: false,
        page: 1,
        top: 0,
        left: 0,
        query: cleanQuery,
        excerpt: "",
        reason: "Termo nao localizado no texto extraido do PDF."
      };
    }
    return {
      ok: true,
      page: match.page,
      top: match.top,
      left: match.left,
      query: cleanQuery,
      excerpt: match.excerpt,
      score: match.score,
      totalPages: pages.length
    };
  } catch (error) {
    return {
      ok: false,
      page: 1,
      top: 0,
      left: 0,
      query: cleanQuery,
      excerpt: "",
      reason: `Falha ao ler PDF: ${error?.message || error}`
    };
  }
}

async function getPdfPages(url) {
  if (pdfTextCache.has(url)) return pdfTextCache.get(url);

  const data = await readPdfBytes(url);
  const loadingTask = pdfjs.getDocument({
    data,
    disableWorker: true,
    useSystemFonts: true
  });
  const document = await loadingTask.promise;

  try {
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = (content.items || [])
        .map((item) => textContentItemToPoint(item, viewport))
        .filter((item) => item.text);
      const lines = groupItemsIntoLines(items);
      const text = clean(lines.map((line) => line.text).join(" "));

      if (text) {
        pages.push({
          page: pageNumber,
          width: Math.round(viewport.width),
          height: Math.round(viewport.height),
          text,
          normalized: normalize(text),
          lines
        });
      }

      page.cleanup();
    }

    pdfTextCache.set(url, pages);
    return pages;
  } finally {
    await document.destroy();
  }
}

async function readPdfBytes(url) {
  if (/^https?:\/\//i.test(url)) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} ao baixar PDF`);
    return new Uint8Array(await response.arrayBuffer());
  }

  const filePath = /^file:/i.test(url) ? fileURLToPath(url) : url;
  return new Uint8Array(await fs.readFile(filePath));
}

function textContentItemToPoint(item, viewport) {
  const text = clean(item.str);
  if (!text) return { text: "" };

  const transform = item.transform || [];
  const fontHeight = Math.abs(Number(item.height || transform[3] || transform[0] || 10));
  const x = Number(transform[4] || 0);
  const y = Number(transform[5] || 0);
  const top = clamp(Math.round(viewport.height - y - fontHeight), 0, Math.round(viewport.height));
  const bottom = clamp(Math.round(viewport.height - y), 0, Math.round(viewport.height));

  return {
    text,
    normalized: normalize(text),
    x: Math.max(0, Math.round(x)),
    top,
    bottom,
    height: Math.max(1, Math.round(fontHeight))
  };
}

function groupItemsIntoLines(items) {
  const sorted = [...items].sort((left, right) => left.top - right.top || left.x - right.x);
  const lines = [];

  for (const item of sorted) {
    const middle = item.top + item.height / 2;
    const tolerance = Math.max(4, item.height * 0.7);
    const line = lines.find((candidate) => Math.abs(candidate.middle - middle) <= tolerance);

    if (line) {
      line.items.push(item);
      line.top = Math.min(line.top, item.top);
      line.left = Math.min(line.left, item.x);
      line.middle = (line.middle * (line.items.length - 1) + middle) / line.items.length;
      continue;
    }

    lines.push({
      items: [item],
      top: item.top,
      left: item.x,
      middle
    });
  }

  return lines
    .map((line) => {
      const text = clean(line.items.sort((left, right) => left.x - right.x).map((item) => item.text).join(" "));
      return {
        text,
        normalized: normalize(text),
        top: Math.max(0, Math.round(line.top)),
        left: Math.max(0, Math.round(line.left))
      };
    })
    .filter((line) => line.text);
}

function bestPageMatch(pages, query) {
  const normalizedQuery = normalize(query);
  const queryTokens = meaningfulTokens(normalizedQuery);
  const candidates = pages
    .map((page) => {
      const exact = page.normalized.includes(normalizedQuery) ? 40 : 0;
      const tokenHits = queryTokens.filter((token) => page.normalized.includes(token));
      const phraseHits = adjacentTokenHits(page.normalized, queryTokens);
      const point = bestScrollPoint(page.lines, normalizedQuery, queryTokens);
      const score = exact + tokenHits.length * 8 + phraseHits * 4 + (point?.score || 0);
      return {
        page: page.page,
        top: point?.top || 0,
        left: point?.left || 0,
        score,
        excerpt: excerptAround(page.text, page.normalized, normalizedQuery, queryTokens)
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.page - right.page);

  return candidates[0] || null;
}

function bestScrollPoint(lines, normalizedQuery, tokens) {
  let best = null;

  for (let index = 0; index < lines.length; index += 1) {
    for (let span = 1; span <= 5 && index + span <= lines.length; span += 1) {
      const windowLines = lines.slice(index, index + span);
      const normalized = normalize(windowLines.map((line) => line.text).join(" "));
      const exact = normalized.includes(normalizedQuery) ? 70 : 0;
      const tokenHits = tokens.filter((token) => normalized.includes(token)).length;
      const phraseHits = adjacentTokenHits(normalized, tokens);
      const density = tokenHits / Math.max(normalized.split(/\s+/).length, 1);
      const score = exact + tokenHits * 10 + phraseHits * 5 + density * 10;

      if (score <= 0) continue;

      const candidate = {
        score,
        top: windowLines[0].top,
        left: windowLines[0].left,
        text: windowLines.map((line) => line.text).join(" ")
      };

      if (!best || candidate.score > best.score || (candidate.score === best.score && candidate.top < best.top)) {
        best = candidate;
      }
    }
  }

  return best;
}

function adjacentTokenHits(text, tokens) {
  let hits = 0;
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (text.includes(`${tokens[index]} ${tokens[index + 1]}`)) hits += 1;
  }
  return hits;
}

function excerptAround(originalText, normalizedText, normalizedQuery, tokens) {
  let normalizedIndex = normalizedText.indexOf(normalizedQuery);
  if (normalizedIndex < 0) {
    const token = tokens.find((item) => normalizedText.includes(item));
    normalizedIndex = token ? normalizedText.indexOf(token) : 0;
  }
  const ratio = normalizedIndex / Math.max(normalizedText.length, 1);
  const originalIndex = Math.floor(ratio * originalText.length);
  const start = Math.max(0, originalIndex - 240);
  return originalText.slice(start, start + 560).replace(/\s+/g, " ").trim();
}

function meaningfulTokens(value) {
  const stop = new Set(["para", "com", "dos", "das", "uma", "por", "que", "de", "em", "ao", "da", "do", "e"]);
  return String(value || "")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !stop.has(token))
    .slice(0, 14);
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
