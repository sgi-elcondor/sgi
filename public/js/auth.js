import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
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
async function loginEmail(email, password) {
  await _ready;
  const cred  = await signInWithEmailAndPassword(auth, email, password);
  const token = await cred.user.getIdToken();
  localStorage.setItem('fb_token', token);
  return cred.user;
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

export { auth, loginEmail, loginGoogle, logout, esperarAuthListo, registerEmail, resetPassword, reenviarVerificacion, recargarUsuario };