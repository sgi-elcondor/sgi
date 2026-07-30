'use strict';
// Compradores + Comisionistas + Usuarios del sistema
const { insert, query } = require('./lib/batch');
const { pick, randInt, maybe, shuffle } = require('./lib/rng');
const { fullName, cedula, phone, email, city } = require('./lib/names');
const { randomUUID: uuid } = require('crypto');

const COMPRADORES_DEF = [
  // [gender, tipo_persona, profile]
  // profile: 'premium' | 'regular' | 'moroso' | 'nuevo'
  ...Array.from({ length: 12 }, () => ['M', 'natural',   'regular']),
  ...Array.from({ length: 12 }, () => ['F', 'natural',   'regular']),
  ...Array.from({ length: 5  }, () => ['M', 'natural',   'premium']),
  ...Array.from({ length: 4  }, () => ['F', 'natural',   'premium']),
  ...Array.from({ length: 4  }, () => ['M', 'natural',   'moroso']),
  ...Array.from({ length: 3  }, () => ['F', 'natural',   'moroso']),
  ...Array.from({ length: 3  }, () => ['M', 'juridica',  'regular']),
  ...Array.from({ length: 2  }, () => ['F', 'natural',   'nuevo']),
  ...Array.from({ length: 2  }, () => ['M', 'natural',   'nuevo']),
];

function buildCompradores() {
  const usedDocs = new Set();
  return COMPRADORES_DEF.map(([gender, tipo, profile]) => {
    const { nombres, apellidos } = fullName(gender);
    let doc;
    do { doc = tipo === 'juridica' ? `9${cedula().slice(1,9)}` : cedula(); } while (usedDocs.has(doc));
    usedDocs.add(doc);
    const mail = email(nombres, apellidos);
    return {
      tipo_persona: tipo,
      documento:    doc,
      nombres,
      apellidos,
      telefono:     phone(),
      mail,
      estado:       profile === 'nuevo' ? 'activo' : 'activo',
      _profile:     profile,
    };
  });
}

const COMISIONISTAS_RAW = [
  { gender: 'M', nombres: 'Ricardo',  apellidos: 'Ospina Reyes',     performance: 'top' },
  { gender: 'F', nombres: 'Liliana',  apellidos: 'Castillo Mora',    performance: 'top' },
  { gender: 'M', nombres: 'Iván',     apellidos: 'Bravo Sepúlveda', performance: 'mid' },
  { gender: 'F', nombres: 'Claudia',  apellidos: 'Vega Ríos',       performance: 'mid' },
  { gender: 'M', nombres: 'Fernando', apellidos: 'Arias Quintero',   performance: 'low' },
  { gender: 'M', nombres: 'Rodrigo',  apellidos: 'Cano Herrera',     performance: 'low' },
];

const STAFF_ROLES = [
  { email: 'admin@elcondor.com',       rol: 'admin' },
  { email: 'auxiliar1@elcondor.com',   rol: 'auxiliar_contable' },
  { email: 'auxiliar2@elcondor.com',   rol: 'auxiliar_contable' },
  { email: 'asesor.top@elcondor.com',  rol: 'asesor' },
  { email: 'asesor.mid@elcondor.com',  rol: 'asesor' },
  { email: 'asesor.low@elcondor.com',  rol: 'asesor' },
  { email: 'gerencia@elcondor.com',    rol: 'gerencia' },
  { email: 'juridico@elcondor.com',    rol: 'juridico' },
  { email: 'auditoria@elcondor.com',   rol: 'auditoria' },
];

async function run(_ctx = {}) {
  // Load roles from DB
  const rolesDB = await query('roles');
  const roleMap = Object.fromEntries(rolesDB.map(r => [r.nombre, r.id_rol]));

  // Compradores
  console.log('→ Insertando compradores...');
  const compradorRows = buildCompradores();
  const profiles = compradorRows.map(c => c._profile);
  const cleanRows = compradorRows.map(({ _profile, ...rest }) => rest);
  const compradores = await insert('comprador', cleanRows);
  compradores.forEach((c, i) => { c._profile = profiles[i]; });
  console.log(`  ✓ ${compradores.length} compradores`);

  // Comisionistas
  console.log('→ Insertando comisionistas...');
  const usedDocs = new Set(compradores.map(c => c.documento));
  const comisionistaRows = COMISIONISTAS_RAW.map(raw => {
    let doc;
    do { doc = cedula(); } while (usedDocs.has(doc));
    usedDocs.add(doc);
    const mail = email(raw.nombres, raw.apellidos);
    return { documento: doc, nombres: raw.nombres, apellidos: raw.apellidos, telefono: phone(), mail, _performance: raw.performance };
  });
  const cleanComis = comisionistaRows.map(({ _performance, ...rest }) => rest);
  const comisionistas = await insert('comisionista', cleanComis);
  comisionistas.forEach((c, i) => { c._performance = comisionistaRows[i]._performance; });
  console.log(`  ✓ ${comisionistas.length} comisionistas`);

  // Usuarios de sistema (staff)
  console.log('→ Insertando usuarios staff...');
  const usedEmails = new Set();
  const staffRows = STAFF_ROLES.map(s => ({
    email:        s.email,
    id_rol:       roleMap[s.rol] || 1,
    firebase_uid: uuid(),
    activo:       true,
    fecha_creacion: '2026-01-02T08:00:00',
  }));
  const staffUsers = await insert('usuarios', staffRows);
  staffUsers.forEach((u, i) => { u._rol = STAFF_ROLES[i].rol; });
  console.log(`  ✓ ${staffUsers.length} usuarios staff`);

  // Usuarios compradores (algunos compradores tienen acceso al sistema)
  const compradorRole = roleMap['comprador'];
  const compradoresConAcceso = compradores.slice(0, 8);
  const compradorUserRows = compradoresConAcceso.map((c, i) => ({
    email:          c.mail,
    id_rol:         compradorRole,
    id_comprador:   c.id_comprador,
    firebase_uid:   uuid(),
    activo:         true,
    fecha_creacion: `2026-0${Math.min(i + 1, 5)}-${String(randInt(5, 25)).padStart(2,'0')}T10:00:00`,
  }));
  const compradorUsers = await insert('usuarios', compradorUserRows);
  console.log(`  ✓ ${compradorUsers.length} usuarios compradores`);

  return { compradores, comisionistas, staffUsers };
}

module.exports = { run };
