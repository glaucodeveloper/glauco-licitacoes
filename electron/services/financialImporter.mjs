import path from "node:path";
import XLSX from "xlsx";

const DATE_KEYS = ["data", "date", "mes", "mês", "competencia", "competência", "periodo", "período"];
const REVENUE_KEYS = ["receita", "faturamento", "entrada", "credito", "crédito", "vendas"];
const EXPENSE_KEYS = ["despesa", "custo", "saida", "saída", "debito", "débito", "pagamento"];
const BALANCE_KEYS = ["saldo", "resultado", "lucro", "balanco", "balanço"];

export function inferFinancialWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const columns = {
    period: pickColumn(headers, DATE_KEYS) || headers[0] || "",
    revenue: pickColumn(headers, REVENUE_KEYS),
    expense: pickColumn(headers, EXPENSE_KEYS),
    balance: pickColumn(headers, BALANCE_KEYS)
  };

  const series = rows
    .map((row, index) => {
      const revenue = toNumber(row[columns.revenue]);
      const expense = toNumber(row[columns.expense]);
      const explicitBalance = toNumber(row[columns.balance]);
      const balance = Number.isFinite(explicitBalance) ? explicitBalance : safeNumber(revenue) - safeNumber(expense);
      return {
        period: formatPeriod(row[columns.period], index),
        revenue: safeNumber(revenue),
        expense: safeNumber(expense),
        balance: safeNumber(balance)
      };
    })
    .filter((item) => item.revenue || item.expense || item.balance)
    .slice(0, 48);

  return {
    source: {
      name: path.basename(filePath),
      sheet: sheetName,
      rows: rows.length,
      columns
    },
    series,
    inference:
      `IA estrutural: ${rows.length} linhas lidas em "${sheetName}". ` +
      `Periodo=${columns.period || "nao inferido"}, receita=${columns.revenue || "nao inferida"}, ` +
      `despesa=${columns.expense || "nao inferida"}, saldo=${columns.balance || "calculado"}.`
  };
}

function pickColumn(headers, keys) {
  return headers.find((header) => {
    const clean = normalize(header);
    return keys.some((key) => clean.includes(normalize(key)));
  });
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function toNumber(value) {
  if (typeof value === "number") return value;
  const clean = String(value || "")
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!clean) return NaN;
  const number = Number(clean);
  return Number.isFinite(number) ? number : NaN;
}

function safeNumber(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function formatPeriod(value, index) {
  if (value instanceof Date) {
    return value.toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
  }
  const text = String(value || "").trim();
  return text || `Linha ${index + 1}`;
}
