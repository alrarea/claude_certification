import * as cheerio from "cheerio";

export async function extractDocumentText(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));

  if (ext === ".html") {
    const $ = cheerio.load(buffer.toString("utf8"));
    return $("body").text().replace(/\s+/g, " ").trim();
  }

  if (ext === ".pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text.replace(/\s+/g, " ").trim();
  }

  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value.replace(/\s+/g, " ").trim();
  }

  throw new Error(`Unsupported file type: ${ext}`);
}
