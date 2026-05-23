function parseDisplayName(displayName) {
  const parts = (displayName || "").trim().split(" ").filter(Boolean);
  if (!parts.length) return { nombres: "", apellidos: "" };
  if (parts.length === 1) return { nombres: parts[0], apellidos: "" };
  const mid = Math.ceil(parts.length / 2);
  return { nombres: parts.slice(0, mid).join(" "), apellidos: parts.slice(mid).join(" ") };
}

function mostrarOnboarding(perfil, firebaseUser) {
  const overlay = document.createElement("div");
  overlay.id = "onboarding-overlay";
  overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;";

  const { nombres, apellidos } = parseDisplayName(firebaseUser?.displayName || "");
  const labelRol = perfil.rol === "comisionista" ? "Comisionista" : "Comprador";

  overlay.innerHTML =
    '<div style="background:var(--surface,#fff);border-radius:12px;padding:2rem;width:min(480px,94vw);box-shadow:0 8px 32px rgba(0,0,0,.25)">' +
    '<h2 style="margin:0 0 .5rem;font-size:1.25rem">Completa tu perfil</h2>' +
    '<p style="margin:0 0 1.5rem;color:var(--text-muted,#666);font-size:.9rem">Para continuar como <strong>' + labelRol + '</strong> necesitamos algunos datos.</p>' +
    '<div style="display:grid;gap:.875rem">' +
    '<div><label style="display:block;font-size:.85rem;margin-bottom:.3rem;font-weight:500">Correo electronico</label>' +
    '<input type="email" value="' + perfil.email + '" disabled style="width:100%;padding:.5rem .75rem;border:1px solid var(--border,#ddd);border-radius:8px;background:var(--surface2,#f5f5f5);color:var(--text-muted,#888);box-sizing:border-box" /></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">' +
    '<div><label style="display:block;font-size:.85rem;margin-bottom:.3rem;font-weight:500">Nombres <span style="color:var(--danger,red)">*</span></label><input id="ob-nombres" type="text" value="' + nombres + '" placeholder="Nombres" style="width:100%;padding:.5rem .75rem;border:1px solid var(--border,#ddd);border-radius:8px;box-sizing:border-box" /></div>' +
    '<div><label style="display:block;font-size:.85rem;margin-bottom:.3rem;font-weight:500">Apellidos <span style="color:var(--danger,red)">*</span></label><input id="ob-apellidos" type="text" value="' + apellidos + '" placeholder="Apellidos" style="width:100%;padding:.5rem .75rem;border:1px solid var(--border,#ddd);border-radius:8px;box-sizing:border-box" /></div>' +
    '</div>' +
    '<div><label style="display:block;font-size:.85rem;margin-bottom:.3rem;font-weight:500">Cedula <span style="color:var(--danger,red)">*</span></label><input id="ob-documento" type="text" placeholder="Ej: 1234567890" style="width:100%;padding:.5rem .75rem;border:1px solid var(--border,#ddd);border-radius:8px;box-sizing:border-box" /></div>' +
    '<div><label style="display:block;font-size:.85rem;margin-bottom:.3rem;font-weight:500">Telefono <span style="color:var(--text-muted,#888);font-weight:400">(opcional)</span></label><input id="ob-telefono" type="tel" placeholder="Ej: 3001234567" style="width:100%;padding:.5rem .75rem;border:1px solid var(--border,#ddd);border-radius:8px;box-sizing:border-box" /></div>' +
    '<div id="ob-error" style="display:none;color:var(--danger,red);font-size:.85rem"></div>' +
    '<button id="ob-submit" class="btn btn-primary" style="width:100%;margin-top:.25rem">Guardar y continuar</button>' +
    '</div></div>';

  document.body.appendChild(overlay);

  document.getElementById("ob-submit").addEventListener("click", async function() {
    const nombres   = document.getElementById("ob-nombres").value.trim();
    const apellidos = document.getElementById("ob-apellidos").value.trim();
    const documento = document.getElementById("ob-documento").value.trim();
    const telefono  = document.getElementById("ob-telefono").value.trim();
    const errorEl   = document.getElementById("ob-error");
    const btn       = document.getElementById("ob-submit");

    if (!nombres || !apellidos || !documento) {
      errorEl.textContent = "Nombres, apellidos y cedula son obligatorios.";
      errorEl.style.display = "block";
      return;
    }

    errorEl.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
      await API.post("/auth/completar-perfil", { nombres, apellidos, documento, telefono: telefono || undefined });
      overlay.remove();
      if (perfil.rol === "comprador") mostrarPromptFoto();
    } catch (err) {
      errorEl.textContent = err.message || "Error al guardar.";
      errorEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = "Guardar y continuar";
    }
  });
}

function mostrarPromptFoto() {
  const overlay = document.createElement("div");
  overlay.className = "photo-prompt-overlay";
  overlay.innerHTML =
    '<div class="photo-prompt-card">' +
    '<svg class="photo-prompt-illustration" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="60" cy="60" r="58" stroke="currentColor" stroke-width="2" stroke-dasharray="6 4" opacity="0.3"/>' +
    '<circle cx="60" cy="44" r="20" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="2"/>' +
    '<circle cx="60" cy="44" r="20" fill="currentColor" opacity="0.1"/>' +
    '<ellipse cx="60" cy="96" rx="34" ry="18" fill="currentColor" opacity="0.12" stroke="currentColor" stroke-width="2"/>' +
    '<circle cx="53" cy="41" r="3" fill="currentColor" opacity="0.5"/>' +
    '<circle cx="67" cy="41" r="3" fill="currentColor" opacity="0.5"/>' +
    '<path d="M53 51 Q60 57 67 51" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/>' +
    '<path d="M26 74 Q60 58 94 74" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.3"/>' +
    '</svg>' +
    '<h2>Agrega tu foto de perfil</h2>' +
    '<p>Una foto de primer plano ayuda a identificarte fácilmente en el sistema. Debe mostrar claramente tu cara.</p>' +
    '<div class="photo-prompt-actions">' +
    '<button class="auth-card-btn auth-card-btn--primary" id="pp-upload-btn">Subir foto</button>' +
    '<button class="auth-card-btn" id="pp-skip-btn">Omitir por ahora</button>' +
    '</div></div>';

  document.body.appendChild(overlay);

  document.getElementById("pp-skip-btn").addEventListener("click", function() { overlay.remove(); });
  document.getElementById("pp-upload-btn").addEventListener("click", function() {
    overlay.remove();
    if (typeof AvatarCropper === "undefined") return;
    AvatarCropper.open({ onSuccess: function(url) {
      window.currentUser.photo_url = url;
      const btn   = document.getElementById("userMenuBtn");
      const panel = document.getElementById("userMenuPanel");
      const umpAv = panel?.querySelector(".ump-avatar");
      if (btn)   btn.innerHTML  = '<img src="' + url + '" class="user-menu-btn-img" alt="foto" />';
      if (umpAv) umpAv.innerHTML = '<img src="' + url + '" class="ump-avatar-img" alt="foto" />';
    }});
  });
}
