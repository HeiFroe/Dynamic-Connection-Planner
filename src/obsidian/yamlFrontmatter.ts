/**
 * Minimal YAML frontmatter parser/serializer tailored to DCDC's flat schema.
 *
 * Supports:
 *  - Scalars: string, number, boolean, null
 *  - Arrays of scalars: `tags: [a, b, c]` and `tags:\n  - a\n  - b`
 *  - Arrays of objects: `ports:\n  - id: ...\n    name: ...\n    position: { x: 0.5, y: 0.5 }`
 *  - Flow-style inline objects: `position: { x: 0.5, y: 0.5 }`
 *
 * Anything else is preserved as a string. This keeps us off `gray-matter`/`js-yaml`
 * (would add ~50KB to the bundle) for the small, well-known schema we own.
 */

export interface ParsedFrontmatter {
  data: Record<string, any>;
  body: string;
}

const FENCE = '---';

export function parseFrontmatter(md: string): ParsedFrontmatter {
  if (!md.startsWith(FENCE)) return { data: {}, body: md };
  const newlineAfterFence = md.indexOf('\n');
  if (newlineAfterFence === -1) return { data: {}, body: md };
  const endFence = md.indexOf(`\n${FENCE}`, newlineAfterFence);
  if (endFence === -1) return { data: {}, body: md };

  const yaml = md.slice(newlineAfterFence + 1, endFence);
  const bodyStart = md.indexOf('\n', endFence + 1) + 1;
  const body = bodyStart > 0 ? md.slice(bodyStart) : '';

  return { data: parseYaml(yaml), body };
}

export function stringifyFrontmatter(data: Record<string, any>, body: string): string {
  const yaml = stringifyValue(data, 0);
  return `${FENCE}\n${yaml}${FENCE}\n${body}`;
}

// ── YAML parser ──────────────────────────────────────────────────────────────

interface Line { indent: number; content: string; }

function tokenize(yaml: string): Line[] {
  return yaml
    .split('\n')
    .map(l => ({ indent: countIndent(l), content: l.trim() }))
    .filter(l => l.content && !l.content.startsWith('#'));
}

function countIndent(line: string): number {
  let n = 0;
  while (n < line.length && line[n] === ' ') n++;
  return n;
}

function parseYaml(yaml: string): Record<string, any> {
  const lines = tokenize(yaml);
  const [out] = parseMapping(lines, 0, 0);
  return out;
}

/** Parse a mapping at given indent. Returns [object, nextIndex]. */
function parseMapping(lines: Line[], start: number, indent: number): [Record<string, any>, number] {
  const obj: Record<string, any> = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent < indent) break;
    if (line.indent > indent) { i++; continue; }
    if (line.content.startsWith('-')) break; // not our level — array item belongs to parent

    const colon = findMapColon(line.content);
    if (colon === -1) { i++; continue; }

    const key   = line.content.slice(0, colon).trim();
    const value = line.content.slice(colon + 1).trim();
    i++;

    if (value !== '') {
      obj[key] = parseScalarOrInline(value);
      continue;
    }

    // Nested block — peek next line to decide
    if (i >= lines.length || lines[i].indent <= indent) { obj[key] = null; continue; }
    const next = lines[i];
    if (next.content.startsWith('-')) {
      const [arr, j] = parseArray(lines, i, next.indent);
      obj[key] = arr;
      i = j;
    } else {
      const [nested, j] = parseMapping(lines, i, next.indent);
      obj[key] = nested;
      i = j;
    }
  }
  return [obj, i];
}

/** Parse an array at given indent. Each item is `- ...`. */
function parseArray(lines: Line[], start: number, indent: number): [any[], number] {
  const arr: any[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent < indent) break;
    if (line.indent > indent) { i++; continue; }
    if (!line.content.startsWith('-')) break;

    // Strip "- " prefix
    const itemContent = line.content.slice(1).trim();
    i++;

    if (itemContent === '') {
      // Item content on following lines, deeper-indented
      if (i < lines.length && lines[i].indent > indent) {
        if (lines[i].content.startsWith('-')) {
          const [sub, j] = parseArray(lines, i, lines[i].indent);
          arr.push(sub);
          i = j;
        } else {
          const [obj, j] = parseMapping(lines, i, lines[i].indent);
          arr.push(obj);
          i = j;
        }
      } else {
        arr.push(null);
      }
      continue;
    }

    // Check if item is `key: value` (object item) — vs plain scalar
    const colon = findMapColon(itemContent);
    if (colon === -1) {
      // Plain scalar item
      arr.push(parseScalarOrInline(itemContent));
      continue;
    }

    // Array of objects — this line is the FIRST key.
    // Subsequent keys are at indent + 2 (because "- " takes 2 chars).
    const obj: Record<string, any> = {};
    const key   = itemContent.slice(0, colon).trim();
    const value = itemContent.slice(colon + 1).trim();
    if (value !== '') {
      obj[key] = parseScalarOrInline(value);
    } else if (i < lines.length && lines[i].indent > indent + 2) {
      // First key has nested content
      if (lines[i].content.startsWith('-')) {
        const [sub, j] = parseArray(lines, i, lines[i].indent);
        obj[key] = sub;
        i = j;
      } else {
        const [nested, j] = parseMapping(lines, i, lines[i].indent);
        obj[key] = nested;
        i = j;
      }
    } else {
      obj[key] = null;
    }

    // Continuation keys of this object: indent === indent + 2
    while (i < lines.length && lines[i].indent === indent + 2 && !lines[i].content.startsWith('-')) {
      const c = findMapColon(lines[i].content);
      if (c === -1) { i++; continue; }
      const k = lines[i].content.slice(0, c).trim();
      const v = lines[i].content.slice(c + 1).trim();
      i++;
      if (v !== '') {
        obj[k] = parseScalarOrInline(v);
      } else if (i < lines.length && lines[i].indent > indent + 2) {
        if (lines[i].content.startsWith('-')) {
          const [sub, j] = parseArray(lines, i, lines[i].indent);
          obj[k] = sub;
          i = j;
        } else {
          const [nested, j] = parseMapping(lines, i, lines[i].indent);
          obj[k] = nested;
          i = j;
        }
      } else {
        obj[k] = null;
      }
    }

    arr.push(obj);
  }
  return [arr, i];
}

/** Find the colon that separates key from value (outside flow brackets/quotes). */
function findMapColon(content: string): number {
  let depth = 0, inStr: false | '"' | '\'' = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inStr) {
      if (c === inStr && content[i - 1] !== '\\') inStr = false;
      continue;
    }
    if (c === '"' || c === '\'') { inStr = c as any; continue; }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
    else if (c === ':' && depth === 0) return i;
  }
  return -1;
}

/** Parse an inline scalar or flow-style array/object literal. */
function parseScalarOrInline(s: string): any {
  s = s.trim();
  if (s.length === 0) return '';

  // Flow array
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return splitFlowList(inner).map(parseScalarOrInline);
  }
  // Flow object
  if (s.startsWith('{') && s.endsWith('}')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return {};
    const obj: Record<string, any> = {};
    for (const pair of splitFlowList(inner)) {
      const colon = findMapColon(pair);
      if (colon < 0) continue;
      const k = pair.slice(0, colon).trim();
      const v = pair.slice(colon + 1).trim();
      obj[k] = parseScalarOrInline(v);
    }
    return obj;
  }
  return parseScalar(s);
}

function splitFlowList(s: string): string[] {
  const out: string[] = [];
  let depth = 0, inStr: false | '"' | '\'' = false, buf = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      buf += c;
      if (c === inStr && s[i - 1] !== '\\') inStr = false;
      continue;
    }
    if (c === '"' || c === '\'') { inStr = c as any; buf += c; continue; }
    if (c === '[' || c === '{') { depth++; buf += c; continue; }
    if (c === ']' || c === '}') { depth--; buf += c; continue; }
    if (c === ',' && depth === 0) { out.push(buf.trim()); buf = ''; continue; }
    buf += c;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function parseScalar(s: string): any {
  s = s.trim();
  if (s === '' || s === 'null' || s === '~') return null;
  if (s === 'true')  return true;
  if (s === 'false') return false;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith('\'') && s.endsWith('\''))) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, '\'');
  }
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

// ── YAML serializer ──────────────────────────────────────────────────────────

function stringifyValue(data: Record<string, any>, indent: number): string {
  let out = '';
  const pad = ' '.repeat(indent);
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (value === null) { out += `${pad}${key}: null\n`; continue; }

    if (Array.isArray(value)) {
      if (value.length === 0) { out += `${pad}${key}: []\n`; continue; }
      const allScalar = value.every(v => v === null || typeof v !== 'object');
      if (allScalar) {
        out += `${pad}${key}: [${value.map(formatScalar).join(', ')}]\n`;
      } else {
        out += `${pad}${key}:\n`;
        for (const item of value) {
          if (item === null || typeof item !== 'object') {
            out += `${pad}  - ${formatScalar(item)}\n`;
            continue;
          }
          // Array of objects: first key after "- ", rest at "    "
          const entries = Object.entries(item).filter(([, v]) => v !== undefined);
          entries.forEach(([k, v], i) => {
            const prefix = i === 0 ? `${pad}  - ` : `${pad}    `;
            if (v === null) {
              out += `${prefix}${k}: null\n`;
            } else if (Array.isArray(v) || (typeof v === 'object' && v !== null)) {
              out += `${prefix}${k}: ${formatInline(v)}\n`;
            } else {
              out += `${prefix}${k}: ${formatScalar(v)}\n`;
            }
          });
        }
      }
      continue;
    }

    if (typeof value === 'object') {
      out += `${pad}${key}: ${formatInline(value)}\n`;
      continue;
    }

    out += `${pad}${key}: ${formatScalar(value)}\n`;
  }
  return out;
}

function formatScalar(v: any): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  if (/[:#@`*&!|>?{}[\],]/.test(s) || /^\s|\s$/.test(s) || s === '' ||
      ['null','true','false','yes','no','on','off'].includes(s.toLowerCase())) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}

function formatInline(v: any): string {
  if (Array.isArray(v)) {
    return `[${v.map(x => Array.isArray(x) || (typeof x === 'object' && x) ? formatInline(x) : formatScalar(x)).join(', ')}]`;
  }
  if (v && typeof v === 'object') {
    return `{ ${Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) =>
      `${k}: ${Array.isArray(x) || (typeof x === 'object' && x) ? formatInline(x) : formatScalar(x)}`
    ).join(', ')} }`;
  }
  return formatScalar(v);
}
