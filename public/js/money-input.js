const MoneyInput = (() => {
  function format(n) {
    if (n === null || n === undefined) return '';
    const num = Math.round(Number(n));
    if (isNaN(num)) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function parse(str) {
    if (!str) return 0;
    return parseInt(String(str).replace(/\./g, ''), 10) || 0;
  }

  function _isPercentInput(raw) {
    return /^\.\d+$/.test(raw) || /^0\.\d+$/.test(raw);
  }

  function init(el, opts) {
    if (el.dataset.miInit) return;
    el.dataset.miInit = '1';

    opts = opts || {};
    const dependsOn = typeof opts.dependsOn === 'function' ? opts.dependsOn : null;
    const onChange  = typeof opts.onChange  === 'function' ? opts.onChange  : null;

    el.addEventListener('input', () => {
      const raw = el.value;

      if (dependsOn) {
        const cleaned = raw.replace(/[^\d.]/g, '');
        if (/^\.\d*$/.test(cleaned) || /^0\.\d*$/.test(cleaned)) {
          el.value = cleaned;
          return;
        }
      }

      const digits = raw.replace(/\D/g, '');
      if (!digits) {
        el.value = '';
        if (onChange) onChange();
        return;
      }

      const num      = parseInt(digits, 10);
      const formatted = format(num);

      const cursor      = el.selectionEnd != null ? el.selectionEnd : el.value.length;
      const rawBefore   = raw.substring(0, cursor);
      const dotsBefore  = (rawBefore.match(/\./g) || []).length;
      const digitsBefore = cursor - dotsBefore;

      el.value = formatted;

      let newPos = formatted.length;
      if (digitsBefore > 0) {
        let counted = 0;
        for (let i = 0; i < formatted.length; i++) {
          if (formatted[i] !== '.') {
            counted++;
            if (counted === digitsBefore) { newPos = i + 1; break; }
          }
        }
      } else {
        newPos = 0;
      }
      try { el.setSelectionRange(newPos, newPos); } catch (_) {}

      if (onChange) onChange();
    });

    function commit() {
      const raw = el.value.trim();

      if (raw === '.' || raw === '0.') {
        el.value = '';
        if (onChange) onChange();
        return;
      }

      if (raw) {
        let num;
        if (dependsOn && _isPercentInput(raw)) {
          const pct      = parseFloat(raw);
          const parentVal = dependsOn();
          if (!isNaN(pct) && pct > 0 && parentVal > 0) {
            num = Math.round(parentVal * pct);
          }
        } else {
          num = parseInt(raw.replace(/\./g, ''), 10);
          if (!isNaN(num) && num >= 1 && num <= 1000) {
            num = num * 1_000_000;
          }
        }

        if (num !== undefined && !isNaN(num) && num > 0) {
          el.value = format(num);
        }
      }

      if (onChange) onChange();
    }

    el.addEventListener('blur', commit);
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      }
    });
  }

  return { format, parse, init };
})();
