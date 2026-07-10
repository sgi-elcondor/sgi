import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithCustomToken,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Firebase is initialized from a backend-provided config. This runs in an async IIFE (NOT
// top-level await) so the production esbuild bundle stays a valid ES module — top-level await
// forces esbuild to wrap the entry in a non-async helper, which breaks the whole SPA bundle.
let auth;
let provider;

// ─────────────────────────────────────────────────────────
// BRIDGE: exposes Firebase for regular scripts (app.js, api.js)
// window._firebaseAuth  → auth instance
// window._authReady     → Promise that resolves with the user (or null)
// ─────────────────────────────────────────────────────────
const _ready = (async () => {
  const res = await fetch('/api/v1/firebase-config');
  const firebaseConfig = await res.json();

  const app = initializeApp(firebaseConfig);
  auth     = getAuth(app);
  provider = new GoogleAuthProvider();
  window._firebaseAuth = auth;

  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      unsub();
      if (u) {
        const token = await u.getIdToken(true);
        localStorage.setItem('fb_token', token);
      } else {
        localStorage.removeItem('fb_token');
      }
      resolve(u);
    });
  });

  // Continuous listener to refresh the token when Firebase rotates it
  onAuthStateChanged(auth, async (u) => {
    if (u) {
      const token = await u.getIdToken();
      localStorage.setItem('fb_token', token);
    }
  });

  return user;
})();

window._authReady = _ready;

// ─────────────────────────────────────────────────────────
// Funciones de login/logout (usadas por login.html)
// ─────────────────────────────────────────────────────────
// Password login goes through our backend so the failed-attempt lockout is enforced authoritatively
// (the browser can't self-report attempts). On failure it throws an Error carrying
// { code, bloqueado, bloqueado_hasta, intentos_restantes }.
//
// SEG-04: for sensitive roles the backend does NOT return a customToken here — it responds 202
// with a challenge_id and expects the 6-digit code from login/2fa/verificar before any session
// is opened. Callers must check `requiere2FA` on the resolved value.
async function loginEmail(email, password) {
  await _ready;
  const res  = await fetch('/api/v1/auth/login', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'No se pudo iniciar sesión.'), {
      code:               data.code || 'backend/login-failed',
      bloqueado:          data.code === 'CUENTA_BLOQUEADA',
      bloqueado_hasta:    data.bloqueado_hasta ?? null,
      intentos_restantes: data.intentos_restantes,
    });
  }
  if (data.requiere_2fa) {
    return { requiere2FA: true, challengeId: data.challenge_id, primeraConfig: data.primera_config };
  }
  const cred  = await signInWithCustomToken(auth, data.customToken);
  const token = await cred.user.getIdToken();
  localStorage.setItem('fb_token', token);
  return { requiere2FA: false, user: cred.user };
}

// Second step of SEG-04. On failure throws an Error carrying { code, bloqueado, bloqueado_hasta }.
async function verificar2FA(challengeId, codigo) {
  const res = await fetch('/api/v1/auth/login/2fa/verificar', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ challenge_id: challengeId, codigo }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'Código incorrecto.'), {
      code:            data.code || 'backend/2fa-failed',
      bloqueado:       data.code === 'CUENTA_BLOQUEADA_2FA',
      bloqueado_hasta: data.bloqueado_hasta ?? null,
    });
  }
  const cred  = await signInWithCustomToken(auth, data.customToken);
  const token = await cred.user.getIdToken();
  localStorage.setItem('fb_token', token);
  return cred.user;
}

async function reenviar2FA(challengeId) {
  const res = await fetch('/api/v1/auth/login/2fa/reenviar', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ challenge_id: challengeId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(data.error || 'No se pudo reenviar el código.'), { code: data.code || 'backend/error' });
  }
}

async function loginGoogle() {
  await _ready;
  const cred  = await signInWithPopup(auth, provider);
  const token = await cred.user.getIdToken();
  localStorage.setItem('fb_token', token);
  return cred.user;
}

async function logout() {
  await _ready;
  await signOut(auth);
  localStorage.removeItem('fb_token');
  window.location.href = '/login';
}

// Waits for Firebase — used in login.html to detect an active session
function esperarAuthListo() {
  return window._authReady;
}

// ─────────────────────────────────────────────────────────
// Sign up with email and password.
// Sends a verification email and signs the user out: they must verify
// their inbox before logging in (USR-01).
// ─────────────────────────────────────────────────────────
async function registerEmail(email, password) {
  await _ready;
  const { createUserWithEmailAndPassword, sendEmailVerification } = await import(
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"
  );
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(cred.user);
  await signOut(auth);
  localStorage.removeItem('fb_token');
  return cred.user;
}

// ─────────────────────────────────────────────────────────
// Email-verification helpers exposed to regular scripts (app.js)
// ─────────────────────────────────────────────────────────
async function reenviarVerificacion() {
  await _ready;
  const { sendEmailVerification } = await import(
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"
  );
  const user = auth.currentUser;
  if (!user) throw new Error('No hay una sesión activa.');
  await sendEmailVerification(user);
}

async function recargarUsuario() {
  await _ready;
  const user = auth.currentUser;
  if (!user) return false;
  await user.reload();
  const fresh = auth.currentUser;
  if (fresh) {
    const token = await fresh.getIdToken(true);
    localStorage.setItem('fb_token', token);
  }
  return fresh?.emailVerified === true;
}

window._reenviarVerificacion = reenviarVerificacion;
window._recargarUsuario      = recargarUsuario;

// ─────────────────────────────────────────────────────────
// Password recovery
// ─────────────────────────────────────────────────────────
async function resetPassword(email) {
  const res = await fetch('/api/v1/auth/reset-password-email', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(data.error || 'Error al enviar el correo.'), { code: 'backend/error' });
  }
}

export { auth, loginEmail, loginGoogle, logout, esperarAuthListo, registerEmail, resetPassword, reenviarVerificacion, recargarUsuario, verificar2FA, reenviar2FA };