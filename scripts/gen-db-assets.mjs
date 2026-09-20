#!/usr/bin/env node
// =========================================================================
// Generates the client-side database assets from the master SQL files.
//
//   Schema.sql + Seed.sql  ->  apps/mobile/services/generated/schema.sqlite.ts
//                              apps/web/services/generated/schema.generated.ts
//
// Usage:  node scripts/gen-db-assets.mjs           (write files)
//         node scripts/gen-db-assets.mjs --check   (exit 1 if files are stale)
//
// The parser is intentionally strict: any statement it does not recognise, and
// any foreign key that points at a missing table/column, aborts the run. That
// is how typos such as [Meetings] vs [Meeting] get caught before they ship.
// =========================================================================
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

const OUT_MOBILE = join(ROOT, 'apps/mobile/services/generated/schema.sqlite.ts');
const OUT_WEB = join(ROOT, 'apps/web/services/generated/schema.generated.ts');

// ---------------------------------------------------------------- lexing ----

/** Removes `-- line` and `/* block *\/` comments while respecting 'string literals'. */
function stripComments(sql) {
  let out = '';
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const next = sql[i + 1];
    if (inString) {
      out += c;
      if (c === "'") {
        if (next === "'") { out += next; i++; } else inString = false;
      }
    } else if (c === "'") {
      inString = true;
      out += c;
    } else if (c === '-' && next === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && next === '*') {
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
      i++;
    } else {
      out += c;
    }
  }
  return out;
}

/** Splits a T-SQL script on `GO` batch separators (own line), dropping empty batches. */
function splitBatches(sql) {
  return stripComments(sql)
    .replace(/\r\n/g, '\n')
    .split(/^[ \t]*GO[ \t]*$/im)
    .map((b) => b.trim().replace(/;\s*$/, '').trim())
    .filter(Boolean);
}

/** Splits on `sep` at parenthesis depth 0, ignoring separators inside 'strings'. */
function splitTopLevel(text, sep = ',') {
  const parts = [];
  let depth = 0;
  let inString = false;
  let cur = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      cur += c;
      if (c === "'") {
        if (text[i + 1] === "'") { cur += "'"; i++; } else inString = false;
      }
      continue;
    }
    if (c === "'") { inString = true; cur += c; continue; }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === sep && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

const bracketNames = (text) => [...text.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
const fail = (msg, stmt) => { throw new Error(`${msg}\n--- statement ---\n${stmt}`); };

// ------------------------------------------------------- schema parsing ----

const TYPE_MAP = {
  INTEGER: ['INTEGER', 'int'], INT: ['INTEGER', 'int'],
  VARCHAR: ['TEXT', 'text'], CHAR: ['TEXT', 'text'], TEXT: ['TEXT', 'text'],
  BIT: ['INTEGER', 'bit'],
  MONEY: ['REAL', 'real'], DECIMAL: ['REAL', 'real'],
  DATE: ['TEXT', 'date'], TIME: ['TEXT', 'time'], DATETIME: ['TEXT', 'datetime'],
};

function parseColumn(item, table) {
  const m = item.match(/^\[([^\]]+)\]\s+([A-Za-z]+)\s*(?:\(([^)]*)\))?\s*([\s\S]*)$/);
  if (!m) fail(`Unrecognised column definition in [${table}]`, item);
  const [, name, rawType, , rest] = m;
  const mapped = TYPE_MAP[rawType.toUpperCase()];
  if (!mapped) fail(`Unsupported type ${rawType} on [${table}].[${name}]`, item);

  const defMatch = rest.match(/\bDEFAULT\s+(\S+)/i);
  let def = null;
  if (defMatch) {
    const raw = defMatch[1].toLowerCase();
    if (raw === 'getdate()') def = { kind: 'now' };
    else if (/^-?\d+(\.\d+)?$/.test(raw)) def = { kind: 'literal', value: Number(raw) };
    else fail(`Unsupported DEFAULT ${defMatch[1]} on [${table}].[${name}]`, item);
  }
  return {
    name,
    sqlType: mapped[0],
    kind: mapped[1],
    notNull: /\bNOT\s+NULL\b/i.test(rest),
    identity: /\bIDENTITY\b/i.test(rest),
    default: def,
  };
}

function parseSchema(sql) {
  const tables = new Map(); // name -> { columns, pk, fks }
  const indexes = [];
  const alters = [];
  const views = [];

  for (const stmt of splitBatches(sql)) {
    let m;
    if ((m = stmt.match(/^CREATE TABLE \[([^\]]+)\]\s*\(([\s\S]*)\)$/i))) {
      const [, name, body] = m;
      const columns = [];
      let pk = [];
      for (const item of splitTopLevel(body)) {
        const pkm = item.match(/^PRIMARY KEY\s*\(([\s\S]*)\)$/i);
        if (pkm) pk = bracketNames(pkm[1]);
        else columns.push(parseColumn(item, name));
      }
      if (!pk.length) fail(`[${name}] has no PRIMARY KEY`, stmt);
      for (const c of pk) if (!columns.some((x) => x.name === c)) fail(`PK column [${c}] missing on [${name}]`, stmt);
      tables.set(name, { columns, pk, fks: [] });
    } else if ((m = stmt.match(/^ALTER TABLE \[([^\]]+)\]\s+ADD FOREIGN KEY\s*\(\[([^\]]+)\]\)\s+REFERENCES\s+\[?([^\s(\]]+)\]?\s*(?:\(\[?([^\])]+)\]?\))?$/i))) {
      alters.push({ table: m[1], column: m[2], refTable: m[3], refColumn: m[4] ?? null, stmt });
    } else if ((m = stmt.match(/^CREATE INDEX \[([^\]]+)\]\s+ON\s+\[([^\]]+)\]\s*\(([^)]*)\)(?:\s*INCLUDE\s*\([^)]*\))?$/i))) {
      indexes.push({ name: m[1], table: m[2], columns: m[3].trim(), stmt });
    } else if ((m = stmt.match(/^CREATE OR ALTER VIEW \[([^\]]+)\]\s+AS\s+([\s\S]+)$/i))) {
      views.push({ name: m[1], body: m[2].trim() });
    } else {
      fail('Unrecognised statement in Schema.sql (not DDL the generator understands)', stmt);
    }
  }

  // Second pass: foreign keys can only be validated once every table is known.
  for (const a of alters) {
    const child = tables.get(a.table) ?? fail(`FK on unknown table [${a.table}]`, a.stmt);
    if (!child.columns.some((c) => c.name === a.column)) fail(`FK column [${a.table}].[${a.column}] does not exist`, a.stmt);
    const parent = tables.get(a.refTable) ?? fail(`FK references unknown table [${a.refTable}]`, a.stmt);
    const refColumn = a.refColumn ?? (parent.pk.length === 1 ? parent.pk[0] : fail(`FK to [${a.refTable}] needs an explicit column`, a.stmt));
    if (!parent.columns.some((c) => c.name === refColumn)) fail(`FK references unknown column [${a.refTable}].[${refColumn}]`, a.stmt);
    child.fks.push({ column: a.column, refTable: a.refTable, refColumn });
  }
  for (const ix of indexes) if (!tables.has(ix.table)) fail(`Index [${ix.name}] on unknown table [${ix.table}]`, ix.stmt);

  return { tables, indexes, views };
}

// ---------------------------------------------------------- SQLite emit ----

function sqliteCreateTable(name, t) {
  const lines = t.columns.map((c) => {
    if (c.identity) {
      if (t.pk.length !== 1 || t.pk[0] !== c.name) throw new Error(`IDENTITY column [${name}].[${c.name}] must be the sole primary key`);
      return `  [${c.name}] INTEGER PRIMARY KEY AUTOINCREMENT`;
    }
    let l = `  [${c.name}] ${c.sqlType}`;
    if (c.notNull) l += ' NOT NULL';
    if (c.default) l += c.default.kind === 'now' ? ' DEFAULT CURRENT_TIMESTAMP' : ` DEFAULT ${c.default.value}`;
    return l;
  });
  const identityPk = t.columns.some((c) => c.identity);
  if (!identityPk) lines.push(`  PRIMARY KEY (${t.pk.map((c) => `[${c}]`).join(', ')})`);
  for (const fk of t.fks) lines.push(`  FOREIGN KEY ([${fk.column}]) REFERENCES [${fk.refTable}]([${fk.refColumn}])`);
  return `CREATE TABLE [${name}] (\n${lines.join(',\n')}\n);`;
}

function sqliteSchemaStatements({ tables, indexes, views }) {
  const out = [];
  for (const [name, t] of tables) out.push(sqliteCreateTable(name, t));
  for (const ix of indexes) out.push(`CREATE INDEX [${ix.name}] ON [${ix.table}] (${ix.columns});`);
  for (const v of views) {
    out.push(`DROP VIEW IF EXISTS [${v.name}];`);
    out.push(`CREATE VIEW [${v.name}] AS\n${v.body};`);
  }
  return out;
}

// --------------------------------------------------------- seed parsing ----

/** Parses `(a, 'b', NULL, 3), (...)` into arrays of JS values. */
function parseTuples(text, stmt) {
  const tuples = [];
  for (const raw of splitTopLevel(text)) {
    const inner = raw.match(/^\(([\s\S]*)\)$/);
    if (!inner) fail('Malformed VALUES tuple', stmt);
    tuples.push(splitTopLevel(inner[1]).map((v) => {
      if (/^NULL$/i.test(v)) return null;
      if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
      const s = v.match(/^'([\s\S]*)'$/);
      if (s) return s[1].replace(/''/g, "'");
      return fail(`Unsupported seed value ${v}`, stmt);
    }));
  }
  return tuples;
}

function parseSeed(sql, tables) {
  const seed = [];
  for (const stmt of splitBatches(sql)) {
    const m = stmt.match(/^INSERT INTO \[([^\]]+)\]\s*\(([^)]*)\)\s*VALUES\s*([\s\S]+)$/i);
    if (!m) fail('Unrecognised statement in Seed.sql (only multi-row INSERT ... VALUES is supported)', stmt);
    const [, table, cols, values] = m;
    const meta = tables.get(table) ?? fail(`Seed targets unknown table [${table}]`, stmt);
    const columns = bracketNames(cols);
    for (const c of columns) if (!meta.columns.some((x) => x.name === c)) fail(`Seed column [${table}].[${c}] does not exist`, stmt);
    const rows = parseTuples(values, stmt).map((vals) => {
      if (vals.length !== columns.length) fail(`Row has ${vals.length} values for ${columns.length} columns in [${table}]`, stmt);
      return Object.fromEntries(columns.map((c, i) => [c, vals[i]]));
    });
    seed.push({ table, columns, rows });
  }
  return seed;
}

const sqlLiteral = (v) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`);

function sqliteSeedStatements(seed) {
  return seed.map(({ table, columns, rows }) => {
    const cols = columns.map((c) => `[${c}]`).join(', ');
    const vals = rows.map((r) => `(${columns.map((c) => sqlLiteral(r[c])).join(', ')})`).join(',\n');
    return `INSERT INTO [${table}] (${cols}) VALUES\n${vals};`;
  });
}

// ------------------------------------------------------------- emitting ----

const HEADER = `// =========================================================================
// GENERATED FILE - DO NOT EDIT.
// Source: Schema.sql + Seed.sql   Generator: scripts/gen-db-assets.mjs
// Regenerate with:  node scripts/gen-db-assets.mjs
// =========================================================================
`;

const tsArray = (name, doc, items) =>
  `/** ${doc} */\nexport const ${name}: readonly string[] = ${JSON.stringify(items, null, 2)};\n`;

function renderMobile(statements, seedStatements) {
  return (
    HEADER + '\n' +
    tsArray('SCHEMA_STATEMENTS', 'SQLite DDL (tables, indexes, views) in dependency-safe order. Foreign keys are inline.', statements) + '\n' +
    tsArray('SEED_STATEMENTS', 'Lookup + baseline seed rows (Council 15295, credentials, members, roles). Run once on first launch.', seedStatements)
  );
}

function renderWeb(tables, seed) {
  const meta = Object.fromEntries(
    [...tables].map(([name, t]) => [name, {
      primaryKey: t.pk,
      columns: t.columns.map((c) => ({
        name: c.name, kind: c.kind, notNull: c.notNull, identity: c.identity, default: c.default,
      })),
      foreignKeys: t.fks,
    }]),
  );
  return (
    HEADER + `
export type ColumnKind = 'int' | 'text' | 'real' | 'bit' | 'date' | 'time' | 'datetime';

export interface ColumnMeta {
  name: string;
  kind: ColumnKind;
  notNull: boolean;
  identity: boolean;
  default: { kind: 'literal'; value: number } | { kind: 'now' } | null;
}

export interface ForeignKeyMeta {
  column: string;
  refTable: string;
  refColumn: string;
}

export interface TableMeta {
  primaryKey: string[];
  columns: ColumnMeta[];
  foreignKeys: ForeignKeyMeta[];
}

export type SeedValue = string | number | null;

export interface SeedTable {
  table: string;
  rows: Record<string, SeedValue>[];
}

/** Every table in Schema.sql, in creation order. */
export const TABLES: Record<string, TableMeta> = ${JSON.stringify(meta, null, 2)};

/** Seed rows from Seed.sql, in insertion order. */
export const SEED_DATA: readonly SeedTable[] = ${JSON.stringify(seed.map(({ table, rows }) => ({ table, rows })), null, 2)};
`
  );
}

// ----------------------------------------------------------------- main ----

const schema = parseSchema(readFileSync(join(ROOT, 'Schema.sql'), 'utf8'));
const seed = parseSeed(readFileSync(join(ROOT, 'Seed.sql'), 'utf8'), schema.tables);

const outputs = [
  [OUT_MOBILE, renderMobile(sqliteSchemaStatements(schema), sqliteSeedStatements(seed))],
  [OUT_WEB, renderWeb(schema.tables, seed)],
];

let stale = false;
for (const [file, content] of outputs) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (CHECK) {
    // Line endings are ignored: git may check the files out with CRLF on Windows.
    const current = existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
    if (current !== content) { console.error(`STALE: ${rel}`); stale = true; }
  } else {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content, 'utf8');
    console.log(`wrote ${rel}`);
  }
}
if (CHECK) process.exit(stale ? 1 : 0);
console.log(`${schema.tables.size} tables, ${schema.indexes.length} indexes, ${schema.views.length} views, ${seed.reduce((n, s) => n + s.rows.length, 0)} seed rows`);
