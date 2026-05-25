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
    const email = user?.email || '';
    vc.innerHTML =
      '<div class="auth-card-wrap"><div class="auth-card">' +
      '<div class="auth-card-brand"><div class="auth-card-icon"><i data-lucide="key-round"></i></div>' +
      '<div><div class="auth-card-title">Contrasena</div><div class="auth-card-sub">Seguridad de cuenta</div></div></div>' +
      '<div id="google-pwd-step1">' +
      '<div class="google-provider-notice">' +
      '<svg viewBox="0 0 24 24" width="1.25rem" height="1.25rem" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>' +
      '<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>' +
      '<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>' +
      '<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>' +
      '</svg>' +
      '<span>Tu cuenta usa Google</span>' +
      '</div>' +
      '<p class="google-pwd-note">Iniciaste sesion con Google (<strong>' + email + '</strong>). Tambien puedes habilitar el inicio de sesion con contrasena usando ese mismo correo.</p>' +
      '<button class="auth-card-btn auth-card-btn--primary" id="btn-enable-password">Habilitar inicio de sesion con contrasena</button>' +
      '<button class="auth-card-btn" id="back-from-pwd"><i data-lucide="arrow-left"></i> Volver</button>' +
      '</div>' +
      '<div id="google-pwd-step2" style="display:none">' +
      '<p class="google-pwd-note">Crea una contrasena para <strong>' + email + '</strong>. Podras iniciar sesion tanto con Google como con tu contrasena.</p>' +
      '<div class="auth-card-field"><label>Nueva contrasena</label><input type="password" id="pwd-new" placeholder="Minimo 8 caracteres" autocomplete="new-password" />' +
      '<div class="pwd-rules"><span class="pwd-rule" id="pr-len">Minimo 8 caracteres</span><span class="pwd-rule" id="pr-upper">Una letra mayuscula</span><span class="pwd-rule" id="pr-num">Un numero</span></div></div>' +
      '<div class="auth-card-field"><label>Confirmar contrasena</label><input type="password" id="pwd-confirm" placeholder="Repite la contrasena" autocomplete="new-password" /></div>' +
      '<div class="auth-card-error" id="pwd-error"></div>' +
      '<div class="auth-card-success" id="pwd-success"></div>' +
      '<button class="auth-card-btn auth-card-btn--primary" id="btn-set-pwd">Activar inicio de sesion con contrasena</button>' +
      '<button class="auth-card-btn" id="back-to-step1"><i data-lucide="arrow-left"></i> Volver</button>' +
      '</div>' +
      '</div></div>';

    window.SGIUI?.hydrate();

    document.getElementById("back-from-pwd")?.addEventListener("click", function() { navigate(prev); });

    document.getElementById("btn-enable-password")?.addEventListener("click", function() {
      document.getElementById("google-pwd-step1").style.display = "none";
      document.getElementById("google-pwd-step2").style.display = "block";
      document.getElementById("pwd-new")?.focus();
    });

    document.getElementById("back-to-step1")?.addEventListener("click", function() {
      document.getElementById("google-pwd-step2").style.display = "none";
      document.getElementById("google-pwd-step1").style.display = "";
      document.getElementById("pwd-error").style.display = "none";
    });

    document.getElementById("pwd-new")?.addEventListener("input", function(e) {
      const v = e.target.value;
      document.getElementById("pr-len")?.classList.toggle("ok", v.length >= 8);
      document.getElementById("pr-upper")?.classList.toggle("ok", /[A-Z]/.test(v));
      document.getElementById("pr-num")?.classList.toggle("ok", /[0-9]/.test(v));
    });

    document.getElementById("btn-set-pwd")?.addEventListener("click", async function() {
      const newPwd    = document.getElementById("pwd-new").value;
      const confirm   = document.getElementById("pwd-confirm").value;
      const errorEl   = document.getElementById("pwd-error");
      const successEl = document.getElementById("pwd-success");
      const btn       = document.getElementById("btn-set-pwd");

      errorEl.style.display = successEl.style.display = "none";

      if (!newPwd || !confirm)                                                     { errorEl.textContent = "Completa todos los campos."; errorEl.style.display = "block"; return; }
      if (newPwd.length < 8 || !/[A-Z]/.test(newPwd) || !/[0-9]/.test(newPwd)) { errorEl.textContent = "La contrasena no cumple los requisitos."; errorEl.style.display = "block"; return; }
      if (newPwd !== confirm)                                                      { errorEl.textContent = "Las contrasenass no coinciden."; errorEl.style.display = "block"; return; }

      btn.disabled = true; btn.textContent = "Activando...";

      try {
        const { EmailAuthProvider, linkWithCredential } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
        const fbUser     = window._firebaseAuth?.currentUser;
        const credential = EmailAuthProvider.credential(fbUser.email, newPwd);
        await linkWithCredential(fbUser, credential);
        successEl.textContent = "Inicio de sesion con contrasena habilitado. Ya puedes usar ambos metodos.";
        successEl.style.display = "block";
        setTimeout(function() { navigate(prev); }, 2500);
      } catch (err) {
        const MAP = {
          "auth/provider-already-linked": "Ya tienes contrasena configurada en tu cuenta.",
          "auth/weak-password":           "La contrasena es demasiado debil.",
          "auth/email-already-in-use":    "Este correo ya tiene una cuenta con contrasena independiente.",
          "auth/requires-recent-login":   "Por seguridad, vuelve a iniciar sesion con Google antes de continuar.",
          "auth/operation-not-allowed":   "Esta funcion no esta habilitada. Contacta al administrador.",
        };
        errorEl.textContent = MAP[err.code] || err.message; errorEl.style.display = "block";
        btn.disabled = false; btn.textContent = "Activar inicio de sesion con contrasena";
      }
    });

    return;
  }

  vc.innerHTML =
    '<div class="auth-card-wrap"><div class="auth-card">' +
    '<div class="auth-card-brand"><div class="auth-card-icon"><i data-lucide="key-round"></i></div>' +
    '<div><div class="auth-card-title">Cambiar contrasena</div><div class="auth-card-sub">Seguridad de cuenta</div></div></div>' +
    '<div class="auth-card-field"><label>Contrasena actual</label><input type="password" id="pwd-current" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" autocomplete="current-password" /><button type="button" class="pwd-forgot-link" id="btn-forgot-pwd">&iquest;Olvidaste tu contrasena?</button></div>' +
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

  document.getElementById("btn-forgot-pwd")?.addEventListener("click", async function() {
    const errorEl   = document.getElementById("pwd-error");
    const successEl = document.getElementById("pwd-success");
    const btn       = document.getElementById("btn-forgot-pwd");

    errorEl.style.display = successEl.style.display = "none";
    btn.disabled = true; btn.textContent = "Enviando...";

    try {
      const fbUser = window._firebaseAuth?.currentUser;
      await API.post('/auth/reset-password-email', { email: fbUser.email });
      successEl.textContent = "Enviamos un enlace de recuperacion a " + fbUser.email + ". Revisa tu correo (Spams)."; 
      successEl.style.display = "block";
    } catch (err) {
      errorEl.textContent = err.message; errorEl.style.display = "block";
    } finally {
      btn.disabled = false; btn.textContent = "¿Olvidaste tu contrasena?";
    }
  });

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
