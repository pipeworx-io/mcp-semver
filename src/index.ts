interface McpToolDefinition {
  name: string;
  description: string;
  /** Human-facing one-liner (fleet #1967). Optional; consumers fall back to
   *  description. Kept in step with shared/src/types.ts — scripts/lib/
   *  check-inlined-types.mjs reports drift at publish time. */
  summary?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    anyOf?: Array<{ required: string[] }>;
    oneOf?: Array<{ required: string[] }>;
    allOf?: Array<{ required: string[] }>;
  };
  outputSchema?: Record<string, unknown>;
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Semantic Versioning (semver) MCP.
 *
 * Keyless, offline: parse a semver string, compare two versions (with correct
 * prerelease precedence), and test whether a version satisfies a range
 * (exact, ^, ~, comparators >=/>/<=/<, x-ranges, AND via spaces, OR via ||).
 * Pure logic — no API, no key.
 */


interface V { major: number; minor: number; patch: number; prerelease: string[]; build: string[]; }

function parse(v: string): V | null {
  const m = v.trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], prerelease: m[4] ? m[4].split('.') : [], build: m[5] ? m[5].split('.') : [] };
}

function cmpIds(a: string[], b: string[]): number {
  // No prerelease has higher precedence than any prerelease.
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    const an = /^\d+$/.test(a[i]), bn = /^\d+$/.test(b[i]);
    if (an && bn) { const d = +a[i] - +b[i]; if (d) return d < 0 ? -1 : 1; }
    else if (an) return -1; // numeric < alphanumeric
    else if (bn) return 1;
    else if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function compare(a: V, b: V): number {
  for (const k of ['major', 'minor', 'patch'] as const) if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1;
  return cmpIds(a.prerelease, b.prerelease);
}

function satisfiesComparator(v: V, cmp: string): boolean {
  const m = cmp.match(/^(>=|<=|>|<|=)?\s*(.+)$/);
  if (!m) return false;
  const op = m[1] || '=';
  const target = parse(m[2]);
  if (!target) return false;
  const c = compare(v, target);
  return op === '>=' ? c >= 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : op === '<' ? c < 0 : c === 0;
}

function expandRange(range: string): string[] {
  // Returns a list of comparator strings that must ALL hold.
  range = range.trim();
  if (range === '*' || range === '' || range === 'x') return ['>=0.0.0'];
  const caret = range.match(/^\^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/);
  if (caret) {
    const [, ma, mi, pa] = caret; const M = +ma;
    const upper = M > 0 ? `${M + 1}.0.0` : +mi > 0 ? `0.${+mi + 1}.0` : `0.0.${+pa + 1}`;
    return [`>=${range.slice(1)}`, `<${upper}`];
  }
  const tilde = range.match(/^~(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/);
  if (tilde) { const [, ma, mi] = tilde; return [`>=${range.slice(1)}`, `<${+ma}.${+mi + 1}.0`]; }
  const xr = range.match(/^(\d+)\.(\d+)\.[xX*]$/);
  if (xr) { const [, ma, mi] = xr; return [`>=${ma}.${mi}.0`, `<${ma}.${+mi + 1}.0`]; }
  const xr2 = range.match(/^(\d+)\.[xX*]$/);
  if (xr2) { const [, ma] = xr2; return [`>=${ma}.0.0`, `<${+ma + 1}.0.0`]; }
  if (/^\d+\.\d+\.\d+/.test(range) && !/^[<>=]/.test(range)) return [`=${range}`]; // bare exact
  return range.split(/\s+/); // already comparators
}

function satisfies(version: string, range: string): boolean {
  const v = parse(version);
  if (!v) return false;
  return range.split('||').some((orPart) => expandRange(orPart).every((cmp) => satisfiesComparator(v, cmp)));
}

const tools: McpToolExport['tools'] = [
  {
    name: 'parse_semver',
    description: 'Parse a semantic-version string into major/minor/patch/prerelease/build (keyless, offline). Accepts an optional leading "v".',
    inputSchema: { type: 'object', properties: { version: { type: 'string', description: 'e.g. "1.2.3-beta.1+build.5".' } }, required: ['version'] },
  },
  {
    name: 'compare_semver',
    description: 'Compare two semver strings. Returns -1 (a<b), 0 (equal), or 1 (a>b), honoring prerelease precedence.',
    inputSchema: { type: 'object', properties: { a: { type: 'string', description: 'First version.' }, b: { type: 'string', description: 'Second version.' } }, required: ['a', 'b'] },
  },
  {
    name: 'satisfies_range',
    description: 'Test whether a version satisfies a range: exact, ^ (caret), ~ (tilde), comparators (>=,>,<=,<,=), x-ranges (1.2.x), AND (space-separated), OR (||). E.g. version "1.4.2", range "^1.2.0".',
    inputSchema: { type: 'object', properties: { version: { type: 'string', description: 'The version to test.' }, range: { type: 'string', description: 'The range, e.g. "^1.2.0" or ">=1.2.0 <2.0.0".' } }, required: ['version', 'range'] },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'parse_semver': {
      const version = reqStr(args, 'version', '"1.2.3"');
      const v = parse(version);
      if (!v) return { input: version, valid: false, reason: 'Not a valid semantic version (expected MAJOR.MINOR.PATCH).' };
      return { input: version, valid: true, ...v, release: `${v.major}.${v.minor}.${v.patch}`, is_prerelease: v.prerelease.length > 0 };
    }
    case 'compare_semver': {
      const a = parse(reqStr(args, 'a', '"1.2.3"')), b = parse(reqStr(args, 'b', '"1.2.4"'));
      if (!a || !b) return { valid: false, reason: 'One of the versions is not valid semver.' };
      const c = compare(a, b);
      return { a: args.a, b: args.b, result: c, relationship: c < 0 ? 'a < b' : c > 0 ? 'a > b' : 'a == b' };
    }
    case 'satisfies_range': {
      const version = reqStr(args, 'version', '"1.4.2"'), range = reqStr(args, 'range', '"^1.2.0"');
      if (!parse(version)) return { version, range, valid: false, reason: 'Version is not valid semver.' };
      return { version, range, satisfies: satisfies(version, range) };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function reqStr(args: Record<string, unknown>, key: string, ex: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Required argument "${key}" is missing. Pass a string like ${ex}.`);
  return v;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
