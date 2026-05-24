// Shared financial input helpers — used across cuotas.js, ventas.js and any future view.

function fmtMiles(n) {
  return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseMiles(str) {
  return Number(String(str || "").replace(/\./g, "")) || 0;
}

function applyMoneyInput(el) {
  const raw    = el.value.replace(/[^\d]/g, "");
  const cur    = el.selectionStart;
  const before = el.value.length;
  el.value = raw ? raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";
  const delta = el.value.length - before;
  el.selectionStart = el.selectionEnd = Math.max(0, cur + delta);
}

// Returns { value: number } on successful conversion,
//         { error: string } if percentage but reference is missing,
//         null if the input should not be converted.
function smartConvert(rawInput, valorReferencia) {
  const trimmed = (rawInput || "").trim();
  if (!trimmed) return null;
  if (/[a-zA-Z$%\-]/.test(trimmed)) return null;

  // Already formatted with thousands separators (e.g. "12.000" or "1.500.000")
  if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) return null;

  // Parse using dot as decimal separator
  const n = Number(trimmed);
  if (!isFinite(n) || isNaN(n) || n <= 0) return null;

  // Percentage shorthand: 0 < n < 1  →  Math.round(n * ref)
  if (n < 1) {
    if (!valorReferencia || valorReferencia <= 0) {
      return { error: "Primero define el valor de referencia" };
    }
    return { value: Math.round(n * valorReferencia) };
  }

  // Million shorthand: 1 <= n <= 1000  →  n * 1_000_000
  if (n <= 1000) {
    return { value: Math.round(n * 1_000_000) };
  }

  return null; // > 1000, already a large number
}

// Expose globally so all views can access them.
window.SGIHelpers = { fmtMiles, parseMiles, applyMoneyInput, smartConvert };

// Backwards-compatible aliases (ventas.js uses these names directly).
window._fmtMiles     = fmtMiles;
window._parseMiles   = parseMiles;
window._onMoneyInput = applyMoneyInput;
