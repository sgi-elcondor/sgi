'use strict';

/**
 * Runs every audit script and consolidates their findings into a single report.
 *
 * Exit code is the delivery gate: non-zero while any P0 or P1 survives, so
 * `npm run audit` can be wired into CI and into the pre-delivery checklist.
 */

const fs   = require('fs');
const path = require('path');
const { ROOT, OUT_DIR, exists, readText } = require('./lib/util');

const SCRIPTS = [
  '01-routes-vs-permissions',
  '02-frontend-vs-backend',
  '03-views-consistency',
  '04-db-vs-code',
  '05-permissions-db-drift',
  '06-dead-code',
  '07-dependencies',
];

const SEVERITIES = ['P0', 'P1', 'P2', 'INFO'];

async function main() {
  const args    = process.argv.slice(2);
  const only    = args.filter(a => !a.startsWith('--'));
  const offline = args.includes('--offline');

  const reports = [];
  for (const name of SCRIPTS) {
    const file = path.join(__dirname, `${name}.js`);
    if (!exists(file)) continue;
    if (only.length && !only.some(o => name.includes(o))) continue;
    if (offline && /db-vs-code|db-drift|access-matrix/.test(name)) {
      console.log(`[${name}] omitido (--offline)`);
      continue;
    }

    try {
      const payload = await require(file)();
      if (payload) reports.push(payload);
    } catch (err) {
      console.error(`[${name}] FALLÓ: ${err.message}`);
      reports.push({
        script: name,
        title: name,
        counts: { P0: 1, P1: 0, P2: 0, INFO: 0 },
        findings: [{
          id: `AUD-ERR-${name}`,
          severity: 'P0',
          category: 'cobertura-auditoria',
          summary: `El script de auditoría ${name} falló y su área quedó sin auditar`,
          where: [`tools/audit/${name}.js`],
          detail: err.message,
          action: 'Corregir el script y re-ejecutar antes de dar la auditoría por completa.',
        }],
      });
    }
  }

  const all = reports.flatMap(r => r.findings.map(f => ({ ...f, anexo: r.title, script: r.script })));
  const totals = SEVERITIES.reduce((acc, s) => {
    acc[s] = all.filter(f => f.severity === s).length;
    return acc;
  }, {});

  // A partial run must never overwrite the authoritative report: `--offline` skips
  // the two database cross-checks, so its totals are lower and its annex list
  // shorter. Publishing that as the consolidated report would silently contradict
  // whatever cites it.
  const partial   = offline || only.length > 0;
  const reportName = partial ? 'informe-hallazgos-parcial.md' : 'informe-hallazgos.md';
  const jsonName   = partial ? 'consolidado-parcial.json' : 'consolidado.json';
  const skipped    = SCRIPTS.filter(s => !reports.some(r => r.script === s));

  const md = [];
  md.push(`# Informe ${partial ? 'PARCIAL ' : ''}consolidado de auditoría — SGI El Cóndor`, '');
  md.push(`_Generado por \`npm run audit${offline ? ':offline' : ''}\` el ${new Date().toISOString()}._`, '');
  if (partial) {
    md.push('');
    md.push('> **Este informe está incompleto.** No cubre las siguientes áreas:');
    md.push('>');
    for (const s of skipped) md.push(`> - \`${s}\``);
    md.push('>');
    md.push('> Los cruces contra la base de datos exigen credenciales de Supabase. Para el');
    md.push('> informe autoritativo, ejecutar `npm run audit` con el entorno configurado.');
  }
  md.push('');
  md.push('## Resumen', '');
  md.push('| Severidad | Cantidad | Significado |', '|---|---|---|');
  md.push(`| P0 | ${totals.P0} | Bloquea la entrega |`);
  md.push(`| P1 | ${totals.P1} | Degrada la entrega |`);
  md.push(`| P2 | ${totals.P2} | Deuda / limpieza |`);
  md.push(`| INFO | ${totals.INFO} | Verificado, aceptado o límite de cobertura |`);
  md.push('');

  md.push('## Anexos', '');
  md.push('| Anexo | P0 | P1 | P2 | INFO |', '|---|---|---|---|---|');
  for (const r of reports) {
    md.push(`| [${r.title}](anexos/${r.script}.md) | ${r.counts.P0} | ${r.counts.P1} | ${r.counts.P2} | ${r.counts.INFO} |`);
  }
  md.push('');

  for (const sev of ['P0', 'P1', 'P2']) {
    const items = all.filter(f => f.severity === sev);
    if (!items.length) continue;
    md.push(`## Hallazgos ${sev}`, '');
    md.push('| ID | Categoría | Hallazgo | Ubicación | Acción |', '|---|---|---|---|---|');
    for (const f of items) {
      const esc = s => String(s).replace(/\|/g, '\\|');
      md.push(`| ${f.id} | ${f.category} | ${esc(f.summary)} | ${f.where.map(esc).join('<br>')} | ${esc(f.action)} |`);
    }
    md.push('');
  }

  const accepted = all.filter(f => f.accepted);
  if (accepted.length) {
    md.push('## Verificados y aceptados', '');
    md.push('| ID | Hallazgo | Severidad original | Motivo de aceptación |', '|---|---|---|---|');
    for (const f of accepted) {
      const esc = s => String(s).replace(/\|/g, '\\|');
      md.push(`| ${f.id} | ${esc(f.summary)} | ${f.original_severity} | ${esc(f.accepted)} |`);
    }
    md.push('');
  }

  fs.mkdirSync(path.join(ROOT, 'docs', 'auditoria'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'docs', 'auditoria', reportName), md.join('\n'), 'utf8');
  fs.writeFileSync(
    path.join(OUT_DIR, jsonName),
    JSON.stringify({ generated_at: new Date().toISOString(), partial, skipped, totals, findings: all }, null, 2),
    'utf8'
  );

  console.log('');
  console.log(`TOTAL  P0=${totals.P0}  P1=${totals.P1}  P2=${totals.P2}  INFO=${totals.INFO}`);
  if (partial) console.log(`AVISO: corrida parcial (sin ${skipped.join(', ')}). No sustituye al informe completo.`);
  console.log(`Informe: docs/auditoria/${reportName}`);

  const blocking = totals.P0 + totals.P1;
  if (blocking > 0) {
    console.error(`\nPuerta de entrega CERRADA: quedan ${totals.P0} P0 y ${totals.P1} P1 sin resolver.`);
    process.exitCode = 1;
  } else {
    console.log('\nPuerta de entrega ABIERTA: sin P0 ni P1 pendientes.');
  }
}

main().catch(err => {
  console.error('[audit] error fatal:', err);
  process.exit(1);
});
