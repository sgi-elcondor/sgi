'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT    = path.join(__dirname, '..', '..', '..');
const OUT_DIR = path.join(ROOT, 'docs', 'auditoria', 'anexos');

const SEVERITIES = ['P0', 'P1', 'P2', 'INFO'];

function rel(abs) {
  return path.relative(ROOT, abs).split(path.sep).join('/');
}

/**
 * Reads a source file with the BOM dropped and line endings normalized to LF.
 * Normalizing matters: byte offsets computed from `split(/\n/)` would drift by
 * one char per line on CRLF files, making brace matching read the wrong body.
 */
function readText(abs) {
  return fs.readFileSync(abs, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
}

function readLines(abs) {
  return readText(abs).split(/\r?\n/);
}

function exists(p) {
  return fs.existsSync(p);
}

/** Recursively collect files under dir, filtered by extension list. */
function walk(dir, exts, skip = ['node_modules', '.git', 'dist', 'coverage']) {
  const out = [];
  if (!exists(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.includes(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs, exts, skip));
    else if (!exts || exts.includes(path.extname(entry.name))) out.push(abs);
  }
  return out;
}

/**
 * A finding is the atomic unit of the audit: stable id, severity, where, what,
 * and what to do about it. Every script emits a list of these.
 */
function makeReporter(prefix, title) {
  const findings = [];
  let seq = 0;
  return {
    title,
    findings,
    add({ severity, category, summary, where, detail, action }) {
      if (!SEVERITIES.includes(severity)) throw new Error(`bad severity: ${severity}`);
      seq += 1;
      findings.push({
        id: `AUD-${prefix}${String(seq).padStart(3, '0')}`,
        severity,
        category,
        summary,
        where: Array.isArray(where) ? where : [where].filter(Boolean),
        detail: detail || '',
        action: action || '',
      });
    },
    counts() {
      return SEVERITIES.reduce((acc, s) => {
        acc[s] = findings.filter(f => f.severity === s).length;
        return acc;
      }, {});
    },
  };
}

function bySeverity(a, b) {
  return SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity);
}

/**
 * Findings verified by hand as acceptable. Keyed by `category|summary` so the
 * entry survives id renumbering. They stay in the report, marked as accepted
 * with the reason, instead of silently disappearing.
 */
function loadAllowlist() {
  const p = path.join(__dirname, '..', 'allowlist.json');
  if (!exists(p)) return {};
  try {
    return JSON.parse(readText(p));
  } catch (err) {
    console.warn(`[audit] allowlist.json ilegible: ${err.message}`);
    return {};
  }
}

function writeReport(name, reporter, extra = {}) {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const allow = loadAllowlist();
  for (const f of reporter.findings) {
    const reason = allow[`${f.category}|${f.summary}`];
    if (!reason) continue;
    f.accepted = reason;
    f.original_severity = f.severity;
    f.severity = 'INFO';
  }

  const sorted  = [...reporter.findings].sort(bySeverity);
  const counts  = reporter.counts();
  const payload = {
    script: name,
    title: reporter.title,
    generated_at: new Date().toISOString(),
    counts,
    findings: sorted,
    ...extra,
  };

  fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), JSON.stringify(payload, null, 2), 'utf8');

  const md = [];
  md.push(`# ${reporter.title}`, '');
  md.push(`_Generado por \`tools/audit/${name}.js\` el ${payload.generated_at}._`, '');
  md.push(`**Resumen:** P0=${counts.P0} · P1=${counts.P1} · P2=${counts.P2} · INFO=${counts.INFO}`, '');
  if (!sorted.length) {
    md.push('Sin hallazgos.', '');
  } else {
    md.push('| ID | Sev | Categoría | Hallazgo | Ubicación |', '|---|---|---|---|---|');
    for (const f of sorted) {
      md.push(
        `| ${f.id} | ${f.severity} | ${f.category} | ${esc(f.summary)} | ${f.where.map(esc).join('<br>')} |`
      );
    }
    md.push('');
    md.push('## Detalle', '');
    for (const f of sorted) {
      md.push(`### ${f.id} · ${f.severity} · ${esc(f.summary)}`, '');
      if (f.where.length) md.push(`- **Ubicación:** ${f.where.map(w => `\`${w}\``).join(', ')}`);
      if (f.detail) md.push(`- **Detalle:** ${f.detail}`);
      if (f.accepted) md.push(`- **Aceptado tras verificación** (severidad original ${f.original_severity}): ${f.accepted}`);
      if (f.action) md.push(`- **Acción propuesta:** ${f.action}`);
      md.push('');
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, `${name}.md`), md.join('\n'), 'utf8');

  const line = `[${name}] P0=${counts.P0} P1=${counts.P1} P2=${counts.P2} INFO=${counts.INFO}`;
  console.log(line);
  return payload;
}

function esc(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

module.exports = { ROOT, OUT_DIR, rel, readText, readLines, exists, walk, makeReporter, writeReport, bySeverity };
