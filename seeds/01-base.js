'use strict';
// Proyectos + Lotes
const { insert } = require('./lib/batch');
const { randInt, pick, maybe } = require('./lib/rng');

const PROYECTOS = [
  { nombre: 'Reserva Norte',    ubicacion: 'Manizales, Caldas',      descripcion: 'Urbanización residencial en zona norte, lotes premium con vista a la cordillera.', estado: 'activo' },
  { nombre: 'Villa del Río',    ubicacion: 'Armenia, Quindío',       descripcion: 'Proyecto de lotes en zona de expansión urbana cerca al río Quindío.', estado: 'activo' },
  { nombre: 'Parque Central',   ubicacion: 'Pereira, Risaralda',     descripcion: 'Lotes económicos en sector consolidado con acceso a transporte público.', estado: 'activo' },
  { nombre: 'Hacienda del Sol', ubicacion: 'Bucaramanga, Santander', descripcion: 'Proyecto premium de lotes campestres en las afueras de Bucaramanga.', estado: 'activo' },
];

// Lote config per project: [manzanas, lotsPerManzana, areaRange, priceRange]
const LOT_CONFIG = [
  { manzanas: ['A','B','C'],    perManzana: [8,9,8],  area: [72,180],  price: [45_000_000, 85_000_000]  }, // Reserva Norte
  { manzanas: ['A','B'],        perManzana: [10,10],  area: [60,140],  price: [25_000_000, 48_000_000]  }, // Villa del Río
  { manzanas: ['A','B'],        perManzana: [10,10],  area: [55,120],  price: [15_000_000, 28_000_000]  }, // Parque Central
  { manzanas: ['A','B'],        perManzana: [7,8],    area: [120,350], price: [85_000_000, 160_000_000] }, // Hacienda del Sol
];

function buildLotes(proyectos) {
  const rows = [];
  proyectos.forEach((p, pi) => {
    const cfg = LOT_CONFIG[pi];
    cfg.manzanas.forEach((mz, mi) => {
      const count = cfg.perManzana[mi];
      for (let n = 1; n <= count; n++) {
        const area  = randInt(cfg.area[0], cfg.area[1]);
        const base  = Math.round((cfg.price[0] + Math.random() * (cfg.price[1] - cfg.price[0])) / 500_000) * 500_000;
        const ancho = randInt(6, 14);
        const largo = Math.round(area / ancho);
        rows.push({
          id_proyecto:  p.id_proyecto,
          codigo_lote:  `${mz}-${String(n).padStart(2,'0')}`,
          manzana:      mz,
          numero_lote:  n,
          area_m2:      area,
          precio_base:  base,
          dimensiones:  `${ancho}m x ${largo}m`,
          descripcion:  maybe(0.4) ? `Lote esquinero, buena ventilación y acceso vial pavimentado.` : null,
        });
      }
    });
  });
  return rows;
}

async function run(_ctx = {}) {
  console.log('→ Insertando proyectos...');
  const proyectos = await insert('proyecto', PROYECTOS);
  console.log(`  ✓ ${proyectos.length} proyectos`);

  const loteRows = buildLotes(proyectos);
  console.log('→ Insertando lotes...');
  const lotes = await insert('lote', loteRows);
  console.log(`  ✓ ${lotes.length} lotes`);

  return { proyectos, lotes };
}

module.exports = { run };
