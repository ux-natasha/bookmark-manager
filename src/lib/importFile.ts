import type { FavoriteItem } from './importer';
import { normalizeUrl } from './normalize';

// Where an import file came from, worked out from its contents.
export type ImportFileKind = 'pocket' | 'raindrop' | 'csv' | 'html';

export interface ImportFile {
  kind: ImportFileKind;
  // "Pocket", "Raindrop", for the dialog's title.
  label: string;
  items: FavoriteItem[];
}

const LABELS: Record<ImportFileKind, string> = {
  pocket: 'Pocket',
  raindrop: 'Raindrop',
  csv: 'a CSV file',
  html: 'a bookmarks file',
};

// Reads an export from Pocket or Raindrop (CSV), or a bookmarks file (the HTML that browsers, Raindrop and
// Pinboard all export). Throws a message the person can act on when the file is none of these.
export async function readImportFile(file: File): Promise<ImportFile> {
  if (/\.zip$/i.test(file.name)) {
    throw new Error('This is a zip file. Unzip it first, then pick the .csv or .html file inside.');
  }
  const text = (await file.text()).replace(/^﻿/, '');
  if (/<!DOCTYPE NETSCAPE-Bookmark-file|<DL[\s>]/i.test(text.slice(0, 4000))) {
    return { kind: 'html', label: LABELS.html, items: parseBookmarksHtml(text) };
  }
  const { kind, items } = parseExportCsv(text);
  return { kind, label: LABELS[kind], items };
}

// Pocket: title, url, time_added (seconds), tags (split by |), status.
// Raindrop: id, title, note, excerpt, url, folder ("Design/Type"), tags (split by commas), created (ISO date), …
// Anything else with a url column is read the same way, using whichever of those columns it has.
export function parseExportCsv(text: string): { kind: Exclude<ImportFileKind, 'html'>; items: FavoriteItem[] } {
  const [header, ...rows] = parseCsv(text);
  const columns = (header ?? []).map((name) => name.trim().toLowerCase());
  const col = (...names: string[]) => columns.findIndex((c) => names.includes(c));
  const urlCol = col('url', 'link', 'href');
  if (urlCol < 0) {
    throw new Error("This file has no url column, so it doesn't look like a Pocket or Raindrop export.");
  }
  const kind = columns.includes('time_added') ? 'pocket' : columns.includes('excerpt') ? 'raindrop' : 'csv';
  const [titleCol, tagsCol, noteCol, folderCol, dateCol] = [
    col('title', 'name'),
    col('tags'),
    col('note', 'notes', 'description'),
    col('folder', 'collection'),
    col('time_added', 'created', 'date_added', 'added'),
  ];
  const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? '').trim() : '');

  const items: FavoriteItem[] = [];
  for (const row of rows) {
    const url = cell(row, urlCol);
    if (!url) continue;
    // Raindrop's unfiled items sit in "Unsorted", which isn't a folder anyone made.
    const folderName = cell(row, folderCol);
    const folder = folderName && folderName !== 'Unsorted' ? folderName.split('/').map((f) => f.trim()).filter(Boolean) : [];
    items.push({
      url,
      title: cell(row, titleCol),
      folder,
      location: folder.length ? folder.join(' / ') : LABELS[kind],
      dateAdded: parseDate(cell(row, dateCol)),
      tags: splitTags(cell(row, tagsCol)),
      note: cell(row, noteCol) || undefined,
      normalizedUrl: normalizeUrl(url),
    });
  }
  return { kind, items };
}

// The Netscape bookmark format: folders are <H3> headings followed by a <DL> list of <A> links,
// and a <DD> after a link is its description.
export function parseBookmarksHtml(html: string): FavoriteItem[] {
  const items: FavoriteItem[] = [];
  // One entry per open <DL>: the folder it belongs to, or the built-in container it is (neither for the root).
  const stack: { folder?: string; container?: string }[] = [];
  let pendingFolder: { name: string; builtIn: boolean } | undefined;
  let last: FavoriteItem | undefined;

  const tag = /<(\/?)(h3|a|dl|dd)\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(html))) {
    const [, closing, rawName, attrs] = match;
    const name = rawName.toLowerCase();
    if (closing) {
      if (name === 'dl') stack.pop();
      continue;
    }
    if (name === 'h3') {
      const end = html.indexOf('</', tag.lastIndex);
      // Browsers mark their own toolbar and "Other bookmarks" containers, which aren't folders anyone made.
      pendingFolder = {
        name: decodeEntities(html.slice(tag.lastIndex, end).trim()),
        builtIn: /PERSONAL_TOOLBAR_FOLDER|UNFILED_BOOKMARKS_FOLDER/i.test(attrs),
      };
      last = undefined;
    } else if (name === 'dl') {
      stack.push(pendingFolder?.builtIn ? { container: pendingFolder.name } : { folder: pendingFolder?.name });
      pendingFolder = undefined;
    } else if (name === 'a') {
      const url = decodeEntities(attribute(attrs, 'href') ?? '');
      const end = html.indexOf('</', tag.lastIndex);
      if (!url) continue;
      const folder = stack.flatMap((entry) => (entry.folder ? [entry.folder] : []));
      const container = stack.find((entry) => entry.container)?.container ?? '';
      last = {
        url,
        title: decodeEntities(html.slice(tag.lastIndex, end).trim()),
        folder,
        location: [container, ...folder].filter(Boolean).join(' / ') || LABELS.html,
        dateAdded: parseDate(attribute(attrs, 'add_date') ?? ''),
        tags: splitTags(decodeEntities(attribute(attrs, 'tags') ?? '')),
        normalizedUrl: normalizeUrl(url),
      };
      items.push(last);
    } else if (name === 'dd' && last) {
      const end = html.indexOf('<', tag.lastIndex);
      const note = decodeEntities(html.slice(tag.lastIndex, end < 0 ? undefined : end).trim());
      if (note) last.note = note;
      last = undefined;
    }
  }
  return items;
}

// RFC 4180: commas between fields, double quotes around fields that hold commas, quotes or line breaks.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

// Pocket separates tags with |, Raindrop and bookmark files with commas.
function splitTags(value: string): string[] {
  if (!value) return [];
  return value
    .split(value.includes('|') ? '|' : ',')
    .map((t) => t.trim())
    .filter(Boolean);
}

// Seconds (Pocket, bookmark files), milliseconds, microseconds (some browsers) or an ISO date (Raindrop).
function parseDate(value: string): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) {
    const n = Number(value);
    if (n <= 0) return undefined;
    return n > 1e14 ? Math.round(n / 1000) : n > 1e11 ? n : n * 1000;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
}

function attribute(attrs: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
  return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] !== '#') return NAMED[code.toLowerCase()] ?? whole;
    const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
  });
}
