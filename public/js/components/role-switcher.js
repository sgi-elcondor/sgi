function showSimBanner(roleLabel) {
  const banner  = document.getElementById("roleSimBanner");
  const label   = document.getElementById("roleSimBannerLabel");
  const exitBtn = document.getElementById("roleSimBannerExit");
  if (!banner || !label) return;
  label.textContent = roleLabel;
  banner.hidden = false;
  if (exitBtn) exitBtn.onclick = revertRoleSelect;
  window.SGIUI?.hydrate();
}

function hideSimBanner() {
  const banner = document.getElementById("roleSimBanner");
  if (banner) banner.hidden = true;
}

function revertRoleSelect() {
  const select = document.getElementById("roleViewSelect");
  if (select) select.value = "admin";
  applyAdminView();
}

function applyAdminView() {
  const perfil = window.currentUser;
  window.currentUser.vistas = perfil._originalVistas.slice();
  AppState.restore(perfil);
  renderSidebar(perfil._originalVistas);
  hideSimBanner();
  navigate(window.currentViewKey || "dashboard");
}

function applyRoleView(idRol, rolNombre) {
  if (rolNombre === "comprador" && !window.currentUser.id_comprador) {
    showLinkProfileModal("comprador", function() { applyRoleView(idRol, rolNombre); }, revertRoleSelect);
    return;
  }
  if (rolNombre === "comisionista" && !window.currentUser.id_comisionista) {
    showLinkProfileModal("comisionista", function() { applyRoleView(idRol, rolNombre); }, revertRoleSelect);
    return;
  }

  API.get("/roles/" + idRol + "/permisos").then(function(data) {
    const vistas = data.vistas || [];
    window.currentUser.vistas = vistas;
    AppState.simulate(vistas, data.can || []);
    renderSidebar(vistas, rolNombre);
    showSimBanner(humanizeRole(rolNombre));
    const cur  = window.currentViewKey || "dashboard";
    const next = vistas.includes(cur) ? cur : (vistas[0] || "dashboard");
    navigate(next);
  }).catch(function(err) {
    console.error("Error fetching role vistas:", err);
  });
}

function showLinkProfileModal(tipo, onSuccess, onCancel) {
  const existing = document.getElementById("link-profile-overlay");
  if (existing) existing.remove();

  const tipoLabel     = tipo === "comprador" ? "Comprador" : "Comisionista";
  const fieldStyle    = "width:100%;padding:.5rem .75rem;border:1px solid var(--border,#ddd);border-radius:8px;box-sizing:border-box;background:var(--surface);color:var(--text);font-family:inherit;font-size:.9rem;";
  const disabledStyle = fieldStyle + "background:var(--surface-2,#f5f5f5);color:var(--text-muted,#888);";
  const labelStyle    = "display:block;font-size:.85rem;margin-bottom:.3rem;font-weight:500;";

  const overlay = document.createElement("div");
  overlay.id = "link-profile-overlay";
  overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;";

  overlay.innerHTML =
    '<div style="background:var(--surface,#fff);border-radius:1rem;padding:2rem;width:min(480px,94vw);box-shadow:0 8px 32px rgba(0,0,0,.28)">' +
    '<h2 style="margin:0 0 .5rem;font-size:1.2rem;font-family:var(--font-serif)">Vincular perfil de ' + tipoLabel + '</h2>' +
    '<p style="margin:0 0 1.5rem;color:var(--text-muted,#666);font-size:.875rem;line-height:1.55">Para simular la vista de <strong>' + tipoLabel + '</strong> necesitas un perfil vinculado a tu cuenta de admin.</p>' +
    '<div style="display:grid;gap:.875rem">' +
    '<div><label style="' + labelStyle + '">Correo electronico</label>' +
    '<input type="email" value="' + (window.currentUser?.email || "") + '" disabled style="' + disabledStyle + '" /></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">' +
    '<div><label style="' + labelStyle + '">Nombres <span style="color:var(--danger,red)">*</span></label><input id="lp-nombres" type="text" placeholder="Nombres" style="' + fieldStyle + '" /></div>' +
    '<div><label style="' + labelStyle + '">Apellidos <span style="color:var(--danger,red)">*</span></label><input id="lp-apellidos" type="text" placeholder="Apellidos" style="' + fieldStyle + '" /></div>' +
    '</div>' +
    '<div><label style="' + labelStyle + '">Cedula <span style="color:var(--danger,red)">*</span></label><input id="lp-documento" type="text" placeholder="Ej: 1234567890" style="' + fieldStyle + '" /></div>' +
    '<div><label style="' + labelStyle + '">Telefono <span style="color:var(--text-muted,#888);font-weight:400">(opcional)</span></label><input id="lp-telefono" type="tel" placeholder="Ej: 3001234567" style="' + fieldStyle + '" /></div>' +
    '<div id="lp-error" style="display:none;color:var(--danger,red);font-size:.85rem"></div>' +
    '<button id="lp-submit" class="btn btn-primary" style="width:100%;margin-top:.25rem">Guardar y continuar</button>' +
    '<button id="lp-cancel" style="width:100%;padding:.6rem;border:1px solid var(--border,#ddd);border-radius:.5rem;background:transparent;color:var(--text-muted);cursor:pointer;font-family:inherit;font-size:.875rem;font-weight:500">Cancelar</button>' +
    '</div></div>';

  document.body.appendChild(overlay);
  window.SGIUI?.hydrate();

  document.getElementById("lp-cancel").addEventListener("click", function() {
    overlay.remove();
    onCancel();
  });

  document.getElementById("lp-submit").addEventListener("click", async function() {
    const nombres   = document.getElementById("lp-nombres").value.trim();
    const apellidos = document.getElementById("lp-apellidos").value.trim();
    const documento = document.getElementById("lp-documento").value.trim();
    const telefono  = document.getElementById("lp-telefono").value.trim();
    const errorEl   = document.getElementById("lp-error");
    const btn       = document.getElementById("lp-submit");

    if (!nombres || !apellidos || !documento) {
      errorEl.textContent = "Nombres, apellidos y cedula son obligatorios.";
      errorEl.style.display = "block";
      return;
    }

    errorEl.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
      const result = await API.post("/auth/completar-perfil", {
        nombres, apellidos, documento, telefono: telefono || undefined, tipo,
      });
      if (tipo === "comprador")    window.currentUser.id_comprador    = result.id_comprador;
      if (tipo === "comisionista") window.currentUser.id_comisionista = result.id_comisionista;
      overlay.remove();
      onSuccess();
    } catch (err) {
      errorEl.textContent = err.message || "Error al guardar.";
      errorEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = "Guardar y continuar";
    }
  });
}

function initRoleViewSwitcher(perfil) {
  if (perfil.rol !== "admin") return;

  const container = document.getElementById("roleViewSwitcher");
  if (!container) return;
  container.style.display = "";

  API.get("/roles").then(function(roles) {
    const select = document.getElementById("roleViewSelect");
    if (!select) return;

    select.innerHTML = '<option value="admin">Vista Admin</option>';
    roles.forEach(function(r) {
      if (r.nombre === "admin") return;
      const opt          = document.createElement("option");
      opt.value          = r.id_rol;
      opt.dataset.nombre = r.nombre;
      opt.textContent    = humanizeRole(r.nombre);
      select.appendChild(opt);
    });

    select.addEventListener("change", function() {
      const val = this.value;
      if (val === "admin") {
        applyAdminView();
      } else {
        const opt = this.options[this.selectedIndex];
        applyRoleView(Number(val), opt.dataset.nombre);
      }
    });
  }).catch(function(err) {
    console.error("Error loading roles for switcher:", err);
  });
}
