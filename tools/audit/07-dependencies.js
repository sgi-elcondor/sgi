'use strict';

/**
 * Vulnerability audit of the dependencies that actually reach production.
 *
 * `npm audit` mixes dev tooling with runtime code, which hides the number that
 * matters at delivery time: what an attacker can reach in the deployed process.
 * This runs the audit with dev dependencies omitted and turns each advisory
 * into a finding, so the delivery gate tracks it instead of relying on someone
 * remembering to look.
 */

const { execSync } = require('child_process');
const { makeReporter, writeReport } = require('./lib/util');
const { ROOT } = require('./lib/util');

const SEVERITY_MAP = {
  critical: 'P0',
  high: 'P1',
  moderate: 'P2',
  low: 'P2',
  info: 'INFO',
};

// A fixed command string, run through the shell: on Windows `npm` is a .cmd
// shim that execFile cannot spawn directly. There is no interpolation here, so
// the shell adds no injection surface.
const AUDIT_CMD = 'npm audit --omit=dev --json';

function runAudit() {
  try {
    // npm exits non-zero when vulnerabilities exist, so stdout is read from the error too.
    const out = execSync(AUDIT_CMD, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 20 * 1024 * 1024,
    });
    return JSON.parse(out);
  } catch (err) {
    if (err.stdout) {
      try { return JSON.parse(err.stdout); } catch (_) { /* fall through */ }
    }
    throw new Error(`npm audit no devolvió JSON interpretable: ${err.message}`);
  }
}

function main() {
  const rep = makeReporter('DEP', 'Anexo H · Vulnerabilidades en dependencias de producción');

  let report;
  try {
    report = runAudit();
  } catch (err) {
    rep.add({
      severity: 'P1',
      category: 'cobertura-auditoria',
      summary: 'No se pudo ejecutar npm audit: las dependencias quedaron sin auditar',
      where: 'package.json',
      detail: err.message,
      action: 'Ejecutar `npm audit --omit=dev` a mano antes de entregar.',
    });
    return writeReport('07-dependencies', rep);
  }

  const vulns = report.vulnerabilities || {};
  const counts = report.metadata?.vulnerabilities || {};

  for (const v of Object.values(vulns)) {
    const severity = SEVERITY_MAP[v.severity] || 'P2';
    const titles = (v.via || [])
      .map(x => (typeof x === 'string' ? x : x.title))
      .filter(Boolean);
    const fix = v.fixAvailable;
    const fixText = fix === true
      ? 'Hay corrección sin cambio de versión mayor: `npm audit fix`.'
      : fix && fix.isSemVerMajor
        ? `Requiere subir a ${fix.name}@${fix.version} (**cambio de versión mayor**): validar el flujo que lo usa antes de subirlo.`
        : fix
          ? `Corrección disponible en ${fix.name}@${fix.version}.`
          : 'Sin corrección publicada: evaluar mitigación o reemplazo del paquete.';

    rep.add({
      severity,
      category: 'vulnerabilidad-dependencia',
      summary: `${v.severity.toUpperCase()} en dependencia de producción: ${v.name}`,
      where: ['package.json', ...(v.nodes || []).slice(0, 3)],
      detail: `${titles.slice(0, 3).join(' · ') || 'Sin título de advisory'}. Rango vulnerable: ${v.range || 'n/d'}. ${fixText}`,
      action: fix === true
        ? 'Ejecutar `npm audit fix`, correr `npm test` y `npm run build`, y re-auditar.'
        : 'Planificar la actualización con prueba del flujo afectado.',
    });
  }

  return writeReport('07-dependencies', rep, {
    stats: {
      production_only: true,
      critical: counts.critical || 0,
      high: counts.high || 0,
      moderate: counts.moderate || 0,
      low: counts.low || 0,
      total_dependencies: report.metadata?.dependencies?.prod ?? null,
    },
  });
}

if (require.main === module) main();
module.exports = main;
