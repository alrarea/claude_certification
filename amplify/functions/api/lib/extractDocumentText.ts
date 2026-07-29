import * as cheerio from "cheerio";

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decodeXmlEntities(text: string): string {
  return text.replace(/&amp;|&lt;|&gt;|&quot;|&apos;/g, (m) => XML_ENTITIES[m]);
}

// A .pptx is a zip of per-slide XML parts; each run of visible text sits in
// its own <a:t>...</a:t> element with no nested tags, so a direct regex
// match is enough without pulling in a full XML parser.
async function extractPptxText(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)![1]);
      const nb = Number(b.match(/slide(\d+)\.xml$/)![1]);
      return na - nb;
    });

  const slideTexts: string[] = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async("text");
    const runs = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXmlEntities(m[1]));
    if (runs.length > 0) slideTexts.push(runs.join(" "));
  }
  return slideTexts.join("\n\n").replace(/[ \t]+/g, " ").trim();
}

export async function extractDocumentText(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));

  if (ext === ".html") {
    const $ = cheerio.load(buffer.toString("utf8"));
    return $("body").text().replace(/\s+/g, " ").trim();
  }

  if (ext === ".md") {
    return buffer.toString("utf8").trim();
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

  if (ext === ".pptx") {
    return extractPptxText(buffer);
  }

  throw new Error(`Unsupported file type: ${ext}`);
}
