const THEME_KEY = "sgi_theme";

function initUserMenu(perfil) {
  const btn   = document.getElementById("userMenuBtn");
  const panel = document.getElementById("userMenuPanel");
  if (!btn || !panel) return;

  const canEdit    = true; 
  const savedTheme = localStorage.getItem(THEME_KEY) || "system";

  const avatarPanelHtml = perfil.photo_url
    ? '<img src="' + perfil.photo_url + '" class="ump-avatar-img" alt="foto" />'
    : '<i data-lucide="user"></i>';

  const avatarBtnHtml = perfil.photo_url
    ? '<img src="' + perfil.photo_url + '" class="user-menu-btn-img" alt="foto" />'
    : '<i data-lucide="user"></i>';

  btn.innerHTML = avatarBtnHtml;
  if (perfil.photo_url) {
    btn.querySelector("img")?.addEventListener("error", function() {
      btn.innerHTML = '<i data-lucide="user"></i>';
      window.SGIUI?.hydrate();
    });
  }

  panel.innerHTML =
    '<div class="ump-header">' +
    '<div class="ump-avatar">' + avatarPanelHtml + '</div>' +
    '<div class="ump-identity">' +
    '<span class="ump-email">' + perfil.email + '</span>' +
    '<span class="ump-role">' + humanizeRole(perfil.rol) + '</span>' +
    '</div></div>' +
    '<div class="ump-divider"></div>' +
    '<div class="ump-section"><span class="ump-label">Tema</span>' +
    '<div class="ump-theme-row">' +
    '<button class="ump-theme-btn' + (savedTheme === "system" ? " active" : "") + '" data-theme-val="system"><i data-lucide="monitor"></i><span>Sistema</span></button>' +
    '<button class="ump-theme-btn' + (savedTheme === "light"  ? " active" : "") + '" data-theme-val="light"><i data-lucide="sun"></i><span>Claro</span></button>' +
    '<button class="ump-theme-btn' + (savedTheme === "dark"   ? " active" : "") + '" data-theme-val="dark"><i data-lucide="moon"></i><span>Oscuro</span></button>' +
    '</div></div>' +
    (canEdit ? '<div class="ump-divider"></div><button class="ump-action" id="ump-edit-profile"><i data-lucide="user-pen"></i><span>Editar perfil</span></button>' : '') +
    '<div class="ump-divider"></div>' +
    '<button class="ump-action" id="ump-change-pwd"><i data-lucide="key-round"></i><span>Cambiar contrasena</span></button>' +
    '<div class="ump-divider"></div>' +
    '<button class="ump-action ump-action--danger" id="ump-logout"><i data-lucide="log-out"></i><span>Cerrar sesion</span></button>';

  window.SGIUI?.hydrate();

  btn.addEventListener("click", function(e) {
    e.stopPropagation();
    const open = panel.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
    panel.setAttribute("aria-hidden", String(!open));
  });

  document.addEventListener("click", function(e) {
    if (!panel.contains(e.target) && e.target !== btn) {
      panel.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      panel.setAttribute("aria-hidden", "true");
    }
  });

  panel.addEventListener("click", function(e) {
    const themeBtn = e.target.closest("[data-theme-val]");
    if (themeBtn) applyTheme(themeBtn.dataset.themeVal);
  });

  document.getElementById("ump-logout")?.addEventListener("click", async function() {
    const auth = window._firebaseAuth;
    if (auth) {
      const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
      await signOut(auth);
    }
    localStorage.removeItem("fb_token");
    window.location.href = "/login.html";
  });

  if (canEdit) {
    document.getElementById("ump-edit-profile")?.addEventListener("click", function() {
      panel.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      renderEditProfileView(perfil);
    });
  }

  document.getElementById("ump-change-pwd")?.addEventListener("click", function() {
    panel.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    renderChangePasswordView();
  });
}

function renderChangePasswordView() {
  const prev = window.currentViewKey || "dashboard";
  const vc   = document.getElementById("viewContainer");
  if (!vc) return;
  setActiveNav("");
  setViewTitle("Cambiar contrasena");

  const user            = window._firebaseAuth?.currentUser;  
  const isEmailProvider = user?.providerData?.some(function(p) { return p.providerId === "password"; });

  if (!isEmailProvider) {
    vc.innerHTML =
      '<div class="auth-card-wrap"><div class="auth-card">' +
      '<div class="auth-card-brand"><div class="auth-card-icon"><i data-lucide="key-round"></i></div>' +
      '<div><div class="auth-card-title">Cambiar contrasena</div><div class="auth-card-sub">Seguridad de cuenta</div></div></div>' +
      '<p style="color:var(--text-muted);font-size:.9rem;line-height:1.6;margin-bottom:1.5rem">Tu cuenta usa Google. Gestiona tu contrasena desde tu cuenta de Google.</p>' +
      '<button class="auth-card-btn" id="back-from-pwd"><i data-lucide="arrow-left"></i> Volver</button>' +
      '</div></div>';
    window.SGIUI?.hydrate();
    document.getElementById("back-from-pwd")?.addEventListener("click", function() { navigate(prev); });
    return;
  }

  vc.innerHTML =
    '<div class="auth-card-wrap"><div class="auth-card">' +
    '<div class="auth-card-brand"><div class="auth-card-icon"><i data-lucide="key-round"></i></div>' +
    '<div><div class="auth-card-title">Cambiar contrasena</div><div class="auth-card-sub">Seguridad de cuenta</div></div></div>' +
    '<div class="auth-card-field"><label>Contrasena actual</label><input type="password" id="pwd-current" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" autocomplete="current-password" /></div>' +
    '<div class="auth-card-field"><label>Nueva contrasena</label><input type="password" id="pwd-new" placeholder="Minimo 8 caracteres" autocomplete="new-password" />' +
    '<div class="pwd-rules"><span class="pwd-rule" id="pr-len">Minimo 8 caracteres</span><span class="pwd-rule" id="pr-upper">Una letra mayuscula</span><span class="pwd-rule" id="pr-num">Un numero</span></div></div>' +
    '<div class="auth-card-field"><label>Confirmar contrasena</label><input type="password" id="pwd-confirm" placeholder="Repite la contrasena" autocomplete="new-password" /></div>' +
    '<div class="auth-card-error" id="pwd-error"></div>' +
    '<div class="auth-card-success" id="pwd-success"></div>' +
    '<button class="auth-card-btn auth-card-btn--primary" id="btn-change-pwd">Actualizar contrasena</button>' +
    '<button class="auth-card-btn" id="back-from-pwd"><i data-lucide="arrow-left"></i> Volver</button>' +
    '</div></div>';

  window.SGIUI?.hydrate();

  document.getElementById("pwd-new")?.addEventListener("input", function(e) {
    const v = e.target.value;
    document.getElementById("pr-len")?.classList.toggle("ok", v.length >= 8);
    document.getElementById("pr-upper")?.classList.toggle("ok", /[A-Z]/.test(v));
    document.getElementById("pr-num")?.classList.toggle("ok", /[0-9]/.test(v));
  });

  document.getElementById("back-from-pwd")?.addEventListener("click", function() { navigate(prev); });

  document.getElementById("btn-change-pwd")?.addEventListener("click", async function() {
    const current   = document.getElementById("pwd-current").value;
    const newPwd    = document.getElementById("pwd-new").value;
    const confirm   = document.getElementById("pwd-confirm").value;
    const errorEl   = document.getElementById("pwd-error");
    const successEl = document.getElementById("pwd-success");
    const btn       = document.getElementById("btn-change-pwd");

    errorEl.style.display = successEl.style.display = "none";

    if (!current || !newPwd || !confirm)                                        { errorEl.textContent = "Completa todos los campos."; errorEl.style.display = "block"; return; }
    if (newPwd.length < 8 || !/[A-Z]/.test(newPwd) || !/[0-9]/.test(newPwd)) { errorEl.textContent = "La contrasena no cumple los requisitos."; errorEl.style.display = "block"; return; }
    if (newPwd !== confirm)                                                     { errorEl.textContent = "Las contrasenass no coinciden."; errorEl.style.display = "block"; return; }

    btn.disabled = true; btn.textContent = "Actualizando...";

    try {
      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
      const fbUser = window._firebaseAuth?.currentUser;
      await reauthenticateWithCredential(fbUser, EmailAuthProvider.credential(fbUser.email, current));
      await updatePassword(fbUser, newPwd);
      successEl.textContent = "Contrasena actualizada correctamente."; successEl.style.display = "block";
      setTimeout(function() { navigate(prev); }, 2000);
    } catch (err) {
      const MAP = {
        "auth/wrong-password":    "La contrasena actual es incorrecta.",
        "auth/too-many-requests": "Demasiados intentos.",
        "auth/weak-password":     "Contrasena demasiado debil.",
        "auth/invalid-credential":"La contrasena actual es incorrecta.",
      };
      errorEl.textContent = MAP[err.code] || err.message; errorEl.style.display = "block";
      btn.disabled = false; btn.textContent = "Actualizar contrasena";
    }
  });
}

function renderEditProfileView(perfil) {
  const prev = window.currentViewKey || "dashboard";
  const vc   = document.getElementById("viewContainer");
  if (!vc) return;
  setActiveNav(""); setViewTitle("Editar perfil");

  const epAvatarHtml = perfil.photo_url
    ? '<img src="' + perfil.photo_url + '" class="ep-avatar" id="ep-avatar-img" alt="foto" />'
    : '<div class="ep-avatar-icon"><i data-lucide="user"></i></div>';

  vc.innerHTML =
    '<div class="auth-card-wrap"><div class="auth-card">' +
    '<div class="auth-card-brand"><div class="auth-card-icon"><i data-lucide="user-pen"></i></div>' +
    '<div><div class="auth-card-title">Editar perfil</div><div class="auth-card-sub">' + perfil.email + '</div></div></div>' +
    '<div class="ep-photo-section">' +
    epAvatarHtml +
    '<div class="ep-photo-info"><div class="ep-photo-label">Foto de perfil</div><div class="ep-photo-sub">JPG, PNG o WebP · máx. 5 MB</div></div>' +
    '<button class="ep-photo-btn" id="ep-change-photo-btn">Cambiar foto</button>' +
    '</div>' +
    '<div class="auth-card-grid-2">' +
    '<div class="auth-card-field"><label>Nombres <span style="color:var(--danger)">*</span></label><input type="text" id="ep-nombres" value="' + (perfil.nombres || "") + '" placeholder="Nombres" /></div>' +
    '<div class="auth-card-field"><label>Apellidos <span style="color:var(--danger)">*</span></label><input type="text" id="ep-apellidos" value="' + (perfil.apellidos || "") + '" placeholder="Apellidos" /></div>' +
    '</div>' +
    '<div class="auth-card-field"><label>Telefono <span style="color:var(--text-muted);font-weight:400">(opcional)</span></label><input type="tel" id="ep-telefono" value="' + (perfil.telefono || "") + '" placeholder="Ej: 3001234567" /></div>' +
    '<div class="auth-card-error" id="ep-error"></div>' +
    '<div class="auth-card-success" id="ep-success"></div>' +
    '<button class="auth-card-btn auth-card-btn--primary" id="btn-save-profile">Guardar cambios</button>' +
    '<button class="auth-card-btn" id="back-from-ep"><i data-lucide="arrow-left"></i> Volver</button>' +
    '</div></div>';

  window.SGIUI?.hydrate();

  document.getElementById("ep-change-photo-btn")?.addEventListener("click", function() {
    if (typeof AvatarCropper === "undefined") return;
    AvatarCropper.open({ onSuccess: function(url) {
      window.currentUser.photo_url = url;
      const section = document.querySelector(".ep-photo-section");
      if (section) {
        const old = section.querySelector(".ep-avatar, .ep-avatar-icon");
        if (old) {
          const img = document.createElement("img");
          img.src = url; img.className = "ep-avatar"; img.alt = "foto";
          old.replaceWith(img);
        }
      }
      const menuBtn = document.getElementById("userMenuBtn");
      const panel   = document.getElementById("userMenuPanel");
      const umpAv   = panel?.querySelector(".ump-avatar");
      if (menuBtn) menuBtn.innerHTML  = '<img src="' + url + '" class="user-menu-btn-img" alt="foto" />';
      if (umpAv)   umpAv.innerHTML    = '<img src="' + url + '" class="ump-avatar-img" alt="foto" />';
    }});
  });

  document.getElementById("back-from-ep")?.addEventListener("click", function() { navigate(prev); });

  document.getElementById("btn-save-profile")?.addEventListener("click", async function() {
    const nombres   = document.getElementById("ep-nombres").value.trim();
    const apellidos = document.getElementById("ep-apellidos").value.trim();
    const telefono  = document.getElementById("ep-telefono").value.trim();
    const errorEl   = document.getElementById("ep-error");
    const successEl = document.getElementById("ep-success");
    const btn       = document.getElementById("btn-save-profile");
    errorEl.style.display = successEl.style.display = "none";
    if (!nombres || !apellidos) { errorEl.textContent = "Nombres y apellidos son obligatorios."; errorEl.style.display = "block"; return; }
    btn.disabled = true; btn.textContent = "Guardando...";
    try {
      await API.put("/auth/perfil", { nombres, apellidos, telefono: telefono || undefined });
      window.currentUser.nombres   = nombres;
      window.currentUser.apellidos = apellidos;
      window.currentUser.telefono  = telefono;
      successEl.textContent = "Perfil actualizado correctamente."; successEl.style.display = "block";
      setTimeout(function() { navigate(prev); }, 1800);
    } catch (err) {
      errorEl.textContent = err.message || "Error al guardar."; errorEl.style.display = "block";
      btn.disabled = false; btn.textContent = "Guardar cambios";
    }
  });
}
