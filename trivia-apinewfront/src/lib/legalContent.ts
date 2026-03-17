import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type LegalKind = 'privacy' | 'terms' | 'officialRules';
export type LegalLocale = 'ru' | 'kk';

export type LegalBlock =
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] };

export interface LegalDocument {
  title: string;
  version: string;
  blocks: LegalBlock[];
}

const FILE_NAMES: Record<LegalKind, Record<LegalLocale, string>> = {
  privacy: {
    ru: 'privacy-policy.public.ru.md',
    kk: 'privacy-policy.public.kk.md',
  },
  terms: {
    ru: 'terms-of-service.public.ru.md',
    kk: 'terms-of-service.public.kk.md',
  },
  officialRules: {
    ru: 'official-rules.public.ru.md',
    kk: 'official-rules.public.kk.md',
  },
};

function toSupportedLocale(locale: string): LegalLocale {
  return locale === 'kk' ? 'kk' : 'ru';
}

function cleanInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\([^)]*\)/g, '$1')
    .trim();
}

function extractVersion(markdown: string): string {
  const match = markdown.match(/\*\*(?:Версия|Нұсқа):\*\*\s*\[?([^\]\n]+)\]?/u);
  const version = match?.[1]?.trim();
  return version && version.length > 0 ? version : '1.0';
}

function parseMarkdownBlocks(markdown: string): { title: string; blocks: LegalBlock[] } {
  const normalized = markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  const firstHeading = lines.find((line) => line.startsWith('# '));
  const title = cleanInlineMarkdown(firstHeading?.slice(2) ?? 'Legal Document');

  const blocks: LegalBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line || line.startsWith('# ')) {
      i += 1;
      continue;
    }

    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: 2, text: cleanInlineMarkdown(headingMatch[1]) });
      i += 1;
      continue;
    }

    const subHeadingMatch = line.match(/^###\s+(.+)/);
    if (subHeadingMatch) {
      blocks.push({ type: 'heading', level: 3, text: cleanInlineMarkdown(subHeadingMatch[1]) });
      i += 1;
      continue;
    }

    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(cleanInlineMarkdown(lines[i].trim().slice(2)));
        i += 1;
      }
      blocks.push({ type: 'quote', text: quoteLines.join(' ') });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(cleanInlineMarkdown(lines[i].trim().replace(/^\d+\.\s+/, '')));
        i += 1;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^-\s+/.test(lines[i].trim())) {
        items.push(cleanInlineMarkdown(lines[i].trim().replace(/^-\s+/, '')));
        i += 1;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const current = lines[i].trim();
      if (
        !current ||
        current.startsWith('# ') ||
        current.startsWith('## ') ||
        current.startsWith('### ') ||
        current.startsWith('> ') ||
        /^\d+\.\s+/.test(current) ||
        /^-\s+/.test(current)
      ) {
        break;
      }
      paragraphLines.push(cleanInlineMarkdown(current));
      i += 1;
    }

    const paragraph = paragraphLines.join(' ').trim();
    if (paragraph) {
      blocks.push({ type: 'paragraph', text: paragraph });
    }
  }

  return { title, blocks };
}

async function readLegalMarkdown(kind: LegalKind, locale: LegalLocale): Promise<string> {
  const fileName = FILE_NAMES[kind][locale];
  const filePath = path.resolve(process.cwd(), '..', 'trivia-mobile', 'docs', 'legal', fileName);
  return readFile(filePath, 'utf8');
}

export async function loadLegalDocument(kind: LegalKind, locale: string): Promise<LegalDocument> {
  const safeLocale = toSupportedLocale(locale);

  try {
    const markdown = await readLegalMarkdown(kind, safeLocale);
    const parsed = parseMarkdownBlocks(markdown);
    return {
      title: parsed.title,
      version: extractVersion(markdown),
      blocks: parsed.blocks,
    };
  } catch {
    return {
      title:
        kind === 'privacy'
          ? 'Privacy Policy'
          : kind === 'terms'
            ? 'Terms of Service'
            : 'Official Rules',
      version: '1.0',
      blocks: [
        {
          type: 'paragraph',
          text: 'Legal document is temporarily unavailable. Please try again later.',
        },
      ],
    };
  }
}
