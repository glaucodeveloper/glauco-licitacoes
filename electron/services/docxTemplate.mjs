import path from "node:path";
import mammoth from "mammoth";

export async function buildDocxTemplateRecord({ filePath, sourceName }) {
  const result = await mammoth.convertToHtml(
    { path: filePath },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const buffer = await image.read("base64");
        return { src: `data:${image.contentType};base64,${buffer}` };
      })
    }
  );
  const textResult = await mammoth.extractRawText({ path: filePath });
  const html = cleanHtml(result.value);
  const text = cleanText(textResult.value);

  return {
    name: sourceName || path.basename(filePath),
    localPath: filePath,
    uploadedAt: new Date().toLocaleString("pt-BR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }),
    previewHtml: html,
    previewText: text.slice(0, 4000),
    messages: (result.messages || []).map((message) => message.message || String(message)).filter(Boolean).slice(0, 8)
  };
}

function cleanHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .trim();
}

function cleanText(value) {
  return String(value || "").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
