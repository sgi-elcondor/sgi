// SEG-07 step-up: re-proves the current user's identity with a fresh 6-digit code (reuses the
// same email-OTP mechanism as SEG-04 login) right before a critical action — assigning the admin
// role or flipping a user's active flag. Resolves to { step_up_challenge_id, step_up_codigo } to
// merge into the request payload, or null if the user cancels.
async function solicitarStepUp(accion) {
  let challengeId;
  try {
    const res = await API.post('/auth/step-up/solicitar', { accion });
    challengeId = res.challenge_id;
  } catch (err) {
    UI.toast('No se pudo enviar el código de confirmación: ' + err.message, 'error');
    return null;
  }

  return new Promise(resolve => {
    let ov = document.getElementById('stepUpOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'stepUpOverlay';
      ov.className = 'confirm-overlay';
      document.body.appendChild(ov);
    }
    ov.innerHTML = `
      <div class="confirm-dialog" role="alertdialog" aria-modal="true">
        <div class="confirm-icon"><i data-lucide="shield-check"></i></div>
        <h3 class="confirm-title">Confirma tu identidad</h3>
        <p class="confirm-message">Te enviamos un código de 6 dígitos a tu correo para confirmar: <strong>${accion}</strong>.</p>
        <input id="stepUpCodigo" type="text" inputmode="numeric" maxlength="6" placeholder="000000"
          style="width:100%; text-align:center; font-size:1.4rem; letter-spacing:.3rem; padding:.6rem;
                 margin:.75rem 0; border-radius:8px; border:1px solid var(--border);
                 background:var(--surface); color:var(--text);" />
        <div class="confirm-actions">
          <button class="btn btn-ghost" data-stepup="cancel">Cancelar</button>
          <button class="btn btn-primary" data-stepup="ok">Confirmar</button>
        </div>
      </div>`;
    ov.classList.add('show');
    window.SGIUI?.hydrate?.();

    const input = document.getElementById('stepUpCodigo');
    input?.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 6); });
    input?.focus();

    const cleanup = () => {
      ov.classList.remove('show');
      ov.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
    const onClick = e => {
      const action = e.target.closest('[data-stepup]')?.dataset.stepup;
      if (action === 'ok') {
        const codigo = input?.value.trim() || '';
        if (!/^\d{6}$/.test(codigo)) return;
        cleanup();
        resolve({ step_up_challenge_id: challengeId, step_up_codigo: codigo });
      } else if (action === 'cancel') {
        cleanup();
        resolve(null);
      }
    };
    const onKey = e => {
      if (e.key === 'Escape') { cleanup(); resolve(null); }
      if (e.key === 'Enter')  document.querySelector('[data-stepup="ok"]')?.click();
    };

    ov.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
  });
}

window.solicitarStepUp = solicitarStepUp;
