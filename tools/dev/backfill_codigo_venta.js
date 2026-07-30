'use strict';
// One-shot backfill of venta.codigo_venta for existing ventas.
// Assigns the descriptive code (#NNN-SIGLA-LOTE) in creation order (id_venta asc) using the
// same global sequence as new ventas, so the counter is left ready for future inserts.
// Safe to re-run: only ventas with a null codigo_venta are processed.
//
//   node seeds/backfill_codigo_venta.js
//
// Requires the codigo_venta column to exist (run the migration first):
//   ALTER TABLE condor.venta ADD COLUMN codigo_venta text;
//   CREATE UNIQUE INDEX venta_codigo_venta_key ON condor.venta (codigo_venta);

const supabase     = require('../src/config/supabase');
const consecutivos = require('../src/services/consecutivos.service');
const SCHEMA       = 'condor';

async function main() {
  const { data: ventas, error } = await supabase.schema(SCHEMA)
    .from('venta')
    .select('id_venta, codigo_venta, lote:id_lote(codigo_lote, proyecto:id_proyecto(sigla))')
    .is('codigo_venta', null)
    .order('id_venta', { ascending: true });

  if (error) {
    console.error('Error leyendo ventas:', error.message);
    process.exit(1);
  }

  if (!ventas || ventas.length === 0) {
    console.log('No hay ventas pendientes de codigo_venta. Nada que hacer.');
    return;
  }

  console.log(`Asignando codigo_venta a ${ventas.length} venta(s)...`);

  let ok = 0;
  for (const v of ventas) {
    try {
      const codigo = await consecutivos.generarCodigoVenta({
        sigla:       v.lote?.proyecto?.sigla,
        codigo_lote: v.lote?.codigo_lote,
      });
      const { error: eUpd } = await supabase.schema(SCHEMA)
        .from('venta')
        .update({ codigo_venta: codigo })
        .eq('id_venta', v.id_venta);
      if (eUpd) throw new Error(eUpd.message);
      console.log(`  venta #${v.id_venta} -> ${codigo}`);
      ok++;
    } catch (e) {
      console.error(`  venta #${v.id_venta} FALLÓ: ${e.message}`);
    }
  }

  console.log(`Listo. ${ok}/${ventas.length} ventas actualizadas.`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
