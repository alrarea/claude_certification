/**
 * One-time migration: parse the two static HTML study guides in
 * claudecertification/guides/ into `topics` + `topic_content` (mode='normal')
 * rows. Not part of any Lambda runtime path — run manually via
 * `npm run migrate:guides --workspace=@claude-cert/db`. Idempotent: re-running
 * upserts the same rows rather than duplicating them.
 *
 * Structural parsing, not a hardcoded title list: both guides share the same
 * shape (one <section id="..."> per top-level area; domain sections contain
 * numbered "N.M Title" <h3> headings that split into subtopics). The script
 * reads titles straight from the DOM, so it can't drift from the source text.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import TurndownService from "turndown";
import { prisma } from "../src/client";

const GUIDES_DIR = resolve(__dirname, "../../../guides");

interface CertManifest {
  code: string;
  file: string;
  // Section ids in document order — defines top-level topic order_index.
  sectionOrder: string[];
}

const CERTS: CertManifest[] = [
  {
    code: "CCAR-F",
    file: "ccaf-tutorial.html",
    sectionOrder: ["overview", "scenarios", "d1", "d2", "d3", "d4", "d5", "sampleq", "scope", "quickref"],
  },
  {
    code: "CCAR-P",
    file: "ccar-p-guide.html",
    sectionOrder: [
      "overview",
      "vs-foundations",
      "d1",
      "d2",
      "d3",
      "d4",
      "d5",
      "d6",
      "d7",
      "samples",
      "policies",
      "quickref",
    ],
  },
];

const DOMAIN_SECTION_RE = /^d\d$/;
const SUBTOPIC_HEADING_RE = /^(\d+)\.(\d+)\s+(.*)$/;

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });

turndown.addRule("calloutBox", {
  filter: (node) =>
    node.nodeName === "DIV" &&
    ["plain", "simple", "callout"].some((cls) => node.classList?.contains(cls)),
  replacement: (_content, node) => {
    const $node = cheerio.load((node as HTMLElement).outerHTML ?? "")("body").children().first();
    const label = $node.find(".plain-label, .simple-label, .cl").first().text().trim();
    $node.find(".plain-label, .simple-label, .cl").remove();
    const bodyMd = turndown.turndown($node.html() ?? "");
    const prefixed = bodyMd
      .split("\n")
      .map((line) => (line.trim().length ? `> ${line}` : ">"))
      .join("\n");
    return `\n\n${label ? `> **${label}**\n>\n` : ""}${prefixed}\n\n`;
  },
});

function htmlToMarkdown(html: string): string {
  return turndown.turndown(html).trim();
}

interface ParsedSubtopic {
  order: number;
  title: string;
  contentMd: string;
}

interface ParsedTopLevel {
  sectionId: string;
  title: string;
  isDomain: boolean;
  examDomain: string | null;
  preambleMd: string; // content before the first numbered h3 (or entire section, if flat)
  subtopics: ParsedSubtopic[];
}

function parseSection($: cheerio.CheerioAPI, sectionId: string): ParsedTopLevel {
  const $section = $(`section#${sectionId}`);
  if ($section.length === 0) {
    throw new Error(`Section #${sectionId} not found in guide`);
  }
  const $container = $section.find("> div.container").first();
  const isDomain = DOMAIN_SECTION_RE.test(sectionId);

  const h2Text = $container.find("> h2, h2").first().text().trim();

  if (!isDomain) {
    // Flat topic: whole section content becomes one topic_content row.
    return {
      sectionId,
      title: h2Text || sectionId,
      isDomain: false,
      examDomain: null,
      preambleMd: htmlToMarkdown($container.html() ?? ""),
      subtopics: [],
    };
  }

  // Domain section: walk direct children of .container, splitting into groups
  // at each h3 that matches "N.M Title".
  const children = $container.children().toArray();
  const preambleNodes: Element[] = [];
  const subtopics: ParsedSubtopic[] = [];
  let current: { order: number; title: string; nodes: Element[] } | null = null;

  for (const el of children) {
    const $el = $(el);
    if (el.tagName?.toLowerCase() === "h3") {
      const match = SUBTOPIC_HEADING_RE.exec($el.text().trim());
      if (match) {
        if (current) {
          subtopics.push({
            order: current.order,
            title: current.title,
            contentMd: htmlToMarkdown(current.nodes.map((n) => $.html(n)).join("\n")),
          });
        }
        const [, , minor, title] = match;
        current = { order: Number(minor), title: title.trim(), nodes: [] };
        continue;
      }
    }
    if (current) {
      current.nodes.push(el);
    } else {
      preambleNodes.push(el);
    }
  }
  if (current) {
    subtopics.push({
      order: (current as { order: number }).order,
      title: (current as { title: string }).title,
      contentMd: htmlToMarkdown(
        (current as { nodes: Element[] }).nodes.map((n) => $.html(n)).join("\n")
      ),
    });
  }

  return {
    sectionId,
    title: h2Text || sectionId,
    isDomain: true,
    examDomain: sectionId.toUpperCase(),
    preambleMd: htmlToMarkdown(preambleNodes.map((n) => $.html(n)).join("\n")),
    subtopics,
  };
}

async function upsertTopic(params: {
  certificationId: string;
  parentTopicId: string | null;
  title: string;
  orderIndex: number;
  examDomain: string | null;
}) {
  const existing = await prisma.topic.findFirst({
    where: {
      certificationId: params.certificationId,
      parentTopicId: params.parentTopicId,
      title: params.title,
    },
  });
  if (existing) {
    return prisma.topic.update({
      where: { id: existing.id },
      data: { orderIndex: params.orderIndex, examDomain: params.examDomain },
    });
  }
  return prisma.topic.create({
    data: {
      certificationId: params.certificationId,
      parentTopicId: params.parentTopicId,
      title: params.title,
      orderIndex: params.orderIndex,
      examDomain: params.examDomain,
    },
  });
}

async function upsertContent(topicId: string, contentMd: string) {
  if (!contentMd.trim()) return;
  await prisma.topicContent.upsert({
    where: { topicId_mode: { topicId, mode: "normal" } },
    update: { contentMd },
    create: { topicId, mode: "normal", contentMd },
  });
}

async function migrateCert(manifest: CertManifest) {
  const certification = await prisma.certification.findUniqueOrThrow({
    where: { code: manifest.code },
  });

  const html = readFileSync(resolve(GUIDES_DIR, manifest.file), "utf8");
  const $ = cheerio.load(html);

  let topLevelCount = 0;
  let subtopicCount = 0;

  for (let i = 0; i < manifest.sectionOrder.length; i++) {
    const sectionId = manifest.sectionOrder[i];
    const parsed = parseSection($, sectionId);

    const topTopic = await upsertTopic({
      certificationId: certification.id,
      parentTopicId: null,
      title: parsed.title,
      orderIndex: i,
      examDomain: parsed.isDomain ? parsed.examDomain : null,
    });
    topLevelCount++;

    if (!parsed.isDomain) {
      await upsertContent(topTopic.id, parsed.preambleMd);
      continue;
    }

    if (parsed.preambleMd.trim()) {
      await upsertContent(topTopic.id, parsed.preambleMd);
    }

    for (const sub of parsed.subtopics) {
      const subTopic = await upsertTopic({
        certificationId: certification.id,
        parentTopicId: topTopic.id,
        title: sub.title,
        orderIndex: sub.order,
        examDomain: parsed.examDomain,
      });
      await upsertContent(subTopic.id, sub.contentMd);
      subtopicCount++;
    }
  }

  console.log(`${manifest.code}: ${topLevelCount} top-level topics, ${subtopicCount} subtopics`);
}

async function main() {
  for (const manifest of CERTS) {
    await migrateCert(manifest);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
