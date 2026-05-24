#!/usr/bin/env node
'use strict';
// Master seed runner — executes all seeds in correct dependency order
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const clean    = require('./00-clean');
const base     = require('./01-base');
const personas = require('./02-personas');
const ventas   = require('./03-ventas');
const pagos    = require('./04-pagos');
const extras   = require('./05-extras');

const STEPS = [
  { name: '00 · Limpieza de datos anteriores', fn: clean.run    },
  { name: '01 · Proyectos + Lotes',            fn: base.run     },
  { name: '02 · Personas + Usuarios',          fn: personas.run },
  { name: '03 · Ventas + Cuotas',              fn: ventas.run   },
  { name: '04 · Pagos + Recibos',              fn: pagos.run    },
  { name: '05 · Extras',                       fn: extras.run   },
];

async function main() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   SGI El Cóndor — Seed de datos      ║');
  console.log('╚══════════════════════════════════════╝\n');

  const ctx = {};

  for (const step of STEPS) {
    console.log(`\n▶ ${step.name}`);
    const t0 = Date.now();
    try {
      const result = await step.fn(ctx);
      Object.assign(ctx, result);
      console.log(`  ⏱  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (err) {
      console.error(`\n✗ Error en "${step.name}":`, err.message);
      process.exit(1);
    }
  }

  const summary = {
    proyectos:    ctx.proyectos?.length ?? 0,
    lotes:        ctx.lotes?.length ?? 0,
    compradores:  ctx.compradores?.length ?? 0,
    comisionistas:ctx.comisionistas?.length ?? 0,
    ventas:       ctx.ventas?.length ?? 0,
    cuotas:       ctx.allCuotas?.length ?? 0,
    pagos:        ctx.allPagos?.length ?? 0,
    recibos:      ctx.allRecibos?.length ?? 0,
    facturas:     ctx.allFacturas?.length ?? 0,
    txns:         ctx.txns?.length ?? 0,
    auditoria:    ctx.aud?.length ?? 0,
  };

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   Resumen de registros insertados     ║');
  console.log('╠══════════════════════════════════════╣');
  for (const [k, v] of Object.entries(summary)) {
    console.log(`║  ${k.padEnd(16)} ${String(v).padStart(6)}              ║`);
  }
  console.log('╚══════════════════════════════════════╝\n');
}

main();
