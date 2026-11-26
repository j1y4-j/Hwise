export const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const CANONICAL_HEADINGS: Record<string, string> = {
  summary: 'Summary',
  assumptions: 'Assumptions',
  stakeholders: 'Stakeholders',
  'product context': 'Product context',
  requirements: 'Requirements',
  'decision factors': 'Decision factors',
  traceability: 'Traceability',
  risks: 'Risks',
  'open questions': 'Open questions',
  'ranked recommendations': 'Ranked recommendations',
  'recommended sdlc': 'Recommended SDLC',
  'project-specific workflow': 'Project-specific workflow',
  'evidence and traceability': 'Evidence and traceability',
  'human approvals': 'Human approvals',
  'residual risk and validation plan': 'Residual risk and validation plan',
};

const isTableRow = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.includes('|', 1);
};

const splitTableCells = (line: string): string[] => {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) trimmed = trimmed.slice(0, -1);

  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]!;
    if (ch === '\\' && trimmed[i + 1] === '|') {
      current += '\\|';
      i++;
      continue;
    }
    if (ch === '|') {
      cells.push(current.trim().replace(/\s+/g, ' '));
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim().replace(/\s+/g, ' '));
  return cells;
};

type ColumnAlign = 'left' | 'center' | 'right';

const parseSeparatorRow = (cells: string[]): ColumnAlign[] | null => {
  if (cells.length === 0) return null;
  const aligns: ColumnAlign[] = [];
  for (const cell of cells) {
    if (!/^:?-{3,}:?$/.test(cell)) return null;
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    aligns.push(left && right ? 'center' : right ? 'right' : 'left');
  }
  return aligns;
};

const formatSeparatorCell = (width: number, align: ColumnAlign): string => {
  const w = Math.max(3, width);
  if (align === 'center') return `:${'-'.repeat(Math.max(1, w - 2))}:`;
  if (align === 'right') return `${'-'.repeat(Math.max(2, w - 1))}:`;
  return '-'.repeat(w);
};

const padCells = (cells: string[], colCount: number): string[] => {
  const out = cells.slice(0, colCount);
  while (out.length < colCount) out.push('');
  return out;
};

const formatTableBlock = (lines: string[]): string[] => {
  if (lines.length < 2) return lines;
  const rawRows = lines.map(splitTableCells);
  const aligns = parseSeparatorRow(rawRows[1]!);
  if (!aligns) return lines;

  const colCount = Math.max(rawRows[0]!.length, aligns.length);
  const normalizedAligns: ColumnAlign[] = Array.from({ length: colCount }, (_, i) => aligns[i] ?? 'left');
  const header = padCells(rawRows[0]!, colCount);
  const body = rawRows.slice(2).map((row) => padCells(row, colCount));

  const widths = Array.from({ length: colCount }, (_, col) => {
    let max = Math.max(3, header[col]!.length);
    for (const row of body) {
      max = Math.max(max, row[col]!.length);
    }
    return max;
  });

  const renderRow = (row: string[]) => `| ${row.map((cell, i) => cell.padEnd(widths[i]!)).join(' | ')} |`;
  const renderSep = () => `| ${widths.map((w, i) => formatSeparatorCell(w, normalizedAligns[i]!)).join(' | ')} |`;

  return [renderRow(header), renderSep(), ...body.map(renderRow)];
};

const normalizeHeadingLine = (line: string): string => {
  const match = line.match(/^(#{1,6})\s*(.+?)\s*#*$/);
  if (!match) return line;
  const hashes = match[1]!;
  const rawTitle = match[2]!.trim().replace(/\s+/g, ' ');
  const canonical = hashes === '##' ? CANONICAL_HEADINGS[rawTitle.toLowerCase()] : undefined;
  return `${hashes} ${canonical ?? rawTitle}`;
};

const isHorizontalRule = (line: string): boolean => /^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line);

/**
 * Normalizes LLM-generated Markdown: aligns pipe tables, standardizes headings,
 * removes trailing line whitespace, and ensures clean spacing between blocks.
 */
export const formatHealthcareMarkdown = (markdown: string): string => {
  const rawLines = markdown.replace(/\r\n/g, '\n').split('\n').map((line) => line.replace(/[ \t]+$/g, ''));
  const out: string[] = [];
  let inCodeFence = false;

  const pushBlankIfNeeded = () => {
    if (out.length > 0 && out[out.length - 1] !== '') out.push('');
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]!;
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      if (!inCodeFence) pushBlankIfNeeded();
      out.push(trimmed);
      inCodeFence = !inCodeFence;
      if (!inCodeFence) out.push('');
      continue;
    }

    if (inCodeFence) {
      out.push(line);
      continue;
    }

    if (!trimmed) {
      pushBlankIfNeeded();
      continue;
    }

    if (isHorizontalRule(trimmed)) {
      pushBlankIfNeeded();
      out.push('---');
      out.push('');
      continue;
    }

    if (/^#{1,6}\s*\S/.test(trimmed)) {
      pushBlankIfNeeded();
      out.push(normalizeHeadingLine(trimmed));
      out.push('');
      continue;
    }

    if (isTableRow(trimmed) && i + 1 < rawLines.length && isTableRow(rawLines[i + 1]!)) {
      const tableLines = [trimmed];
      let j = i + 1;
      while (j < rawLines.length && isTableRow(rawLines[j]!)) {
        tableLines.push(rawLines[j]!.trim());
        j++;
      }
      const formatted = formatTableBlock(tableLines);
      if (formatted !== tableLines) {
        pushBlankIfNeeded();
        out.push(...formatted);
        out.push('');
        i = j - 1;
        continue;
      }
    }

    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      const indent = orderedMatch[1]!.length >= 2 ? '   ' : '';
      out.push(`${indent}${orderedMatch[2]}. ${orderedMatch[3]!.trim()}`);
      continue;
    }

    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (bulletMatch) {
      const prevLine = [...out].reverse().find((l) => l !== '');
      const underOrdered = Boolean(prevLine && /^\d+\.\s+/.test(prevLine))
        || Boolean(prevLine && /^ {3,}[-*+]\s+/.test(prevLine));
      const indent = bulletMatch[1]!.length >= 2 ? (underOrdered ? '   ' : '  ') : '';
      out.push(`${indent}- ${bulletMatch[2]!.trim()}`);
      continue;
    }

    out.push(trimmed);
  }

  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
};

const safeHref = (rawUrl: string): string | null => {
  const trimmed = rawUrl.trim();
  if (/^https?:\/\/[^\s<>"]+$/i.test(trimmed)) return trimmed;
  return null;
};

const renderBadge = (token: string): string | null => {
  switch (token) {
    case 'NEEDS-VALIDATION':
      return '<span class="badge badge-warn">NEEDS-VALIDATION</span>';
    case 'Critical':
      return '<span class="badge badge-critical">Critical</span>';
    case 'High':
      return '<span class="badge badge-high">High</span>';
    case 'Medium':
      return '<span class="badge badge-medium">Medium</span>';
    case 'Low':
      return '<span class="badge badge-low">Low</span>';
    default:
      return null;
  }
};

const formatPlainSegment = (text: string, badgeKeywords: boolean): string => {
  const pattern = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])|(\bNEEDS-VALIDATION\b)/g;
  let result = '';
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) result += escapeHtml(text.slice(lastIndex, idx));

    if (match[1] !== undefined) {
      result += `<strong>${formatPlainSegment(match[1], false)}</strong>`;
    } else if (match[2] !== undefined) {
      result += `<em>${formatPlainSegment(match[2], false)}</em>`;
    } else if (match[3] !== undefined) {
      const href = safeHref(match[3]);
      result += href
        ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(match[3])}</a>`
        : escapeHtml(match[3]);
    } else if (match[4] !== undefined) {
      result += renderBadge('NEEDS-VALIDATION')!;
    }
    lastIndex = idx + match[0].length;
  }

  if (lastIndex < text.length) result += escapeHtml(text.slice(lastIndex));

  if (badgeKeywords) {
    const exact = renderBadge(text.trim());
    if (exact) return exact;
  }
  return result;
};

const renderInline = (text: string, options: { badgeExactCell?: boolean } = {}): string => {
  if (options.badgeExactCell) {
    const badge = renderBadge(text.trim());
    if (badge) return badge;
  }

  // Split inline code and Markdown links first so their contents are not altered by emphasis/autolink rules.
  const tokenPattern = /`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)/g;
  let result = '';
  let lastIndex = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      result += formatPlainSegment(text.slice(lastIndex, idx), false);
    }

    if (match[1] !== undefined) {
      result += `<code>${escapeHtml(match[1])}</code>`;
    } else if (match[2] !== undefined && match[3] !== undefined) {
      const href = safeHref(match[3]);
      result += href
        ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${formatPlainSegment(match[2], false)}</a>`
        : escapeHtml(match[0]);
    }
    lastIndex = idx + match[0].length;
  }

  if (lastIndex < text.length) {
    result += formatPlainSegment(text.slice(lastIndex), false);
  }
  return result;
};

interface TocItem {
  id: string;
  level: number;
  text: string;
}

const slugify = (text: string, used: Map<string, number>): string => {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
  const count = (used.get(base) ?? 0) + 1;
  used.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
};

type ListType = 'ul' | 'ol';

interface ListEntry {
  indent: number;
  type: ListType;
  number?: number;
  text: string;
}

const parseListLine = (line: string): ListEntry | null => {
  const ol = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (ol) return { indent: ol[1]!.length, type: 'ol', number: Number(ol[2]), text: ol[3]! };
  const ul = line.match(/^(\s*)[-*+]\s+(.*)$/);
  if (ul) return { indent: ul[1]!.length, type: 'ul', text: ul[2]! };
  return null;
};

const renderListEntries = (entries: ListEntry[]): string => {
  const renderRange = (start: number, baseIndent: number, listType: ListType): { html: string; nextIndex: number } => {
    const items: string[] = [];
    const startNumber = listType === 'ol' ? entries[start]?.number : undefined;
    let i = start;

    while (i < entries.length) {
      const entry = entries[i]!;
      if (entry.indent < baseIndent) break;
      if (entry.indent > baseIndent || entry.type !== listType) break;

      let itemHtml = renderInline(entry.text);
      i++;

      while (i < entries.length && entries[i]!.indent > baseIndent) {
        const sub = renderRange(i, entries[i]!.indent, entries[i]!.type);
        itemHtml += sub.html;
        i = sub.nextIndex;
      }

      items.push(`<li>${itemHtml}</li>`);
    }

    const openTag = listType === 'ol' && startNumber && startNumber !== 1 ? `<ol start="${startNumber}">` : `<${listType}>`;
    return { html: `${openTag}${items.join('')}</${listType}>`, nextIndex: i };
  };

  let html = '';
  let idx = 0;
  while (idx < entries.length) {
    const block = renderRange(idx, entries[idx]!.indent, entries[idx]!.type);
    html += block.html;
    idx = block.nextIndex;
  }
  return html;
};

const renderSectionBody = (lines: string[], usedIds: Map<string, number>, toc: TocItem[]): string => {
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    const fenceMatch = trimmed.match(/^```([\w-]*)$/);
    if (fenceMatch) {
      const lang = fenceMatch[1] ? ` class="language-${escapeHtml(fenceMatch[1])}"` : '';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```$/.test(lines[i]!.trim())) {
        codeLines.push(lines[i]!);
        i++;
      }
      i++;
      html.push(`<pre><code${lang}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1]!.length;
      const text = headingMatch[2]!.trim();
      const id = slugify(text, usedIds);
      if (level <= 2) toc.push({ id, level, text });
      html.push(`<h${level} id="${escapeHtml(id)}">${renderInline(text)}</h${level}>`);
      i++;
      continue;
    }

    if (isTableRow(trimmed) && i + 1 < lines.length && isTableRow(lines[i + 1]!)) {
      const header = splitTableCells(trimmed);
      const aligns = parseSeparatorRow(splitTableCells(lines[i + 1]!));
      if (aligns) {
        const colCount = Math.max(header.length, aligns.length);
        const colAligns = Array.from({ length: colCount }, (_, c) => aligns[c] ?? 'left');
        const rows: string[][] = [];
        i += 2;
        while (i < lines.length && isTableRow(lines[i]!)) {
          rows.push(padCells(splitTableCells(lines[i]!), colCount));
          i++;
        }
        const ths = padCells(header, colCount)
          .map((cell, c) => `<th style="text-align:${colAligns[c]}">${renderInline(cell)}</th>`)
          .join('');
        const trs = rows
          .map((row) => `<tr>${row.map((cell, c) => `<td style="text-align:${colAligns[c]}">${renderInline(cell, { badgeExactCell: true })}</td>`).join('')}</tr>`)
          .join('');
        html.push(`<div class="table-wrap"><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`);
        continue;
      }
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!.trim())) {
        quoteLines.push(lines[i]!.trim().replace(/^>\s?/, ''));
        i++;
      }
      html.push(`<blockquote><p>${renderInline(quoteLines.join(' '))}</p></blockquote>`);
      continue;
    }

    const firstList = parseListLine(line);
    if (firstList) {
      const entries: ListEntry[] = [];
      while (i < lines.length) {
        const entry = parseListLine(lines[i]!);
        if (entry) {
          entries.push(entry);
          i++;
          continue;
        }
        // Keep loose list items separated by a single blank line in the same list when the type matches.
        if (lines[i]!.trim() === '' && i + 1 < lines.length) {
          const nextEntry = parseListLine(lines[i + 1]!);
          if (nextEntry && (nextEntry.indent > firstList.indent || nextEntry.type === firstList.type)) {
            i++;
            continue;
          }
        }
        break;
      }
      html.push(renderListEntries(entries));
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length) {
      const current = lines[i]!;
      const currentTrimmed = current.trim();
      if (!currentTrimmed || isHorizontalRule(currentTrimmed) || /^(#{1,6}\s+|```|>\s?)/.test(currentTrimmed) || parseListLine(current)) {
        break;
      }
      if (isTableRow(currentTrimmed) && i + 1 < lines.length && parseSeparatorRow(splitTableCells(lines[i + 1]!))) {
        break;
      }
      paraLines.push(currentTrimmed);
      i++;
    }
    if (paraLines.length > 0) {
      html.push(`<p>${renderInline(paraLines.join(' '))}</p>`);
    }
  }

  return html.join('\n');
};

/**
 * Renders normalized Hwise Markdown into a self-contained, styled HTML report.
 */
export const renderHealthcareHtml = (markdown: string): string => {
  const normalized = formatHealthcareMarkdown(markdown);
  const rawSections: string[][] = [[]];
  let inFence = false;

  for (const line of normalized.split('\n')) {
    if (/^```/.test(line.trim())) inFence = !inFence;
    if (!inFence && isHorizontalRule(line)) {
      rawSections.push([]);
      continue;
    }
    rawSections[rawSections.length - 1]!.push(line);
  }

  const nonEmptySections = rawSections.filter((sec) => sec.some((line) => line.trim().length > 0));
  const usedIds = new Map<string, number>();
  const toc: TocItem[] = [];
  const renderedSections = nonEmptySections.map((sec) => renderSectionBody(sec, usedIds, toc));

  const titleHeading = toc.find((item) => item.level === 1)?.text ?? 'Hwise Healthcare SDLC Report';
  const navItems = toc
    .map((item) => `<a class="toc-link toc-l${item.level}" href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(titleHeading)} — Hwise</title>
  <style>
    :root {
      --bg: #f3f6f8;
      --surface: #ffffff;
      --surface-alt: #f8fafc;
      --border: #dce4ea;
      --text: #0f172a;
      --text-muted: #475569;
      --accent: #0f766e;
      --accent-soft: #e6f4f1;
      --accent-border: #99d5cc;
      --shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04);
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      font: 15px/1.65 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: var(--text);
      background: var(--bg);
      -webkit-font-smoothing: antialiased;
    }
    .page-header {
      background: linear-gradient(135deg, #0f172a 0%, #134e4a 100%);
      color: #f8fafc;
      padding: 28px 24px 24px;
      border-bottom: 3px solid var(--accent);
    }
    .page-header-inner,
    .layout {
      max-width: 1180px;
      margin: 0 auto;
    }
    .eyebrow {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #99f6e4;
      margin-bottom: 6px;
    }
    .page-header h1 {
      margin: 0 0 8px;
      font-size: 24px;
      line-height: 1.25;
      font-weight: 700;
      color: #ffffff;
    }
    .disclaimer {
      margin: 0;
      font-size: 13px;
      color: #cbd5e1;
      max-width: 78ch;
    }
    .layout {
      padding: 24px 20px 48px;
    }
    .toc {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0 0 22px;
      padding: 12px 14px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    }
    .toc-link {
      font-size: 12.5px;
      text-decoration: none;
      color: var(--text-muted);
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid transparent;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .toc-link:hover {
      background: var(--accent-soft);
      color: var(--accent);
      border-color: var(--accent-border);
    }
    .toc-l1 {
      font-weight: 700;
      color: var(--accent);
      background: var(--accent-soft);
      border-color: var(--accent-border);
    }
    .report-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 28px 32px;
      margin-bottom: 24px;
      box-shadow: var(--shadow);
    }
    .report-card h1 {
      margin: 0 0 18px;
      font-size: 22px;
      line-height: 1.3;
      color: var(--text);
      padding-bottom: 12px;
      border-bottom: 2px solid var(--accent-soft);
    }
    .report-card h2 {
      margin: 28px 0 12px;
      font-size: 17px;
      line-height: 1.35;
      color: #0f3d39;
      padding-left: 10px;
      border-left: 3px solid var(--accent);
    }
    .report-card h3 {
      margin: 20px 0 8px;
      font-size: 15px;
      color: var(--text);
    }
    .report-card p {
      margin: 0 0 12px;
      color: var(--text-muted);
    }
    .report-card ul,
    .report-card ol {
      margin: 8px 0 14px;
      padding-left: 22px;
      color: var(--text-muted);
    }
    .report-card li {
      margin: 5px 0;
    }
    .report-card li > ul,
    .report-card li > ol {
      margin: 6px 0 8px;
    }
    .report-card strong {
      color: var(--text);
    }
    .report-card a {
      color: var(--accent);
      text-decoration: underline;
      text-underline-offset: 2px;
      word-break: break-word;
    }
    .report-card a:hover {
      color: #115e59;
    }
    .report-card code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.9em;
      background: #f1f5f9;
      color: #0f172a;
      padding: 1px 5px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }
    .report-card pre {
      background: #0f172a;
      color: #e2e8f0;
      padding: 14px 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 13px;
      line-height: 1.5;
    }
    .report-card pre code {
      background: transparent;
      border: none;
      color: inherit;
      padding: 0;
    }
    .report-card blockquote {
      margin: 12px 0;
      padding: 10px 16px;
      border-left: 3px solid var(--accent);
      background: var(--surface-alt);
      border-radius: 0 8px 8px 0;
    }
    .table-wrap {
      width: 100%;
      overflow-x: auto;
      margin: 12px 0 18px;
      border: 1px solid var(--border);
      border-radius: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
      line-height: 1.45;
    }
    thead th {
      background: #edf7f5;
      color: #0f3d39;
      font-weight: 600;
      padding: 10px 12px;
      border-bottom: 1px solid var(--accent-border);
      white-space: nowrap;
    }
    tbody td {
      padding: 9px 12px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
      color: var(--text-muted);
    }
    tbody tr:nth-child(even) td {
      background: var(--surface-alt);
    }
    tbody tr:last-child td {
      border-bottom: none;
    }
    tbody tr:hover td {
      background: #f0fdfa;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .badge-warn { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
    .badge-critical { background: #ffe4e6; color: #9f1239; border: 1px solid #fda4af; }
    .badge-high { background: #ffedd5; color: #9a3412; border: 1px solid #fdba74; }
    .badge-medium { background: #e0f2fe; color: #075985; border: 1px solid #7dd3fc; }
    .badge-low { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
    @media (max-width: 720px) {
      .report-card { padding: 20px 16px; }
      .page-header { padding: 22px 16px; }
    }
    @media print {
      body { background: #ffffff; }
      .toc { display: none; }
      .report-card { box-shadow: none; border: 1px solid #cbd5e1; break-inside: avoid-page; }
      .page-header { background: #ffffff; color: #0f172a; border-bottom: 2px solid #0f766e; }
      .page-header h1, .eyebrow, .disclaimer { color: #0f172a; }
    }
  </style>
</head>
<body>
  <header class="page-header">
    <div class="page-header-inner">
      <span class="eyebrow">Hwise Healthcare Software SDLC Assistant</span>
      <h1>${escapeHtml(titleHeading)}</h1>
      <p class="disclaimer">Evidence-grounded requirements profile and conditional lifecycle recommendation. Not a clinical, legal, regulatory, or compliance determination.</p>
    </div>
  </header>
  <main class="layout">
    ${navItems ? `<nav class="toc" aria-label="Document sections">${navItems}</nav>` : ''}
    ${renderedSections.map((body) => `<section class="report-card">\n${body}\n</section>`).join('\n    ')}
  </main>
</body>
</html>
`;
};
