import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const res = await fetch('/api/v1/firebase-config');
const firebaseConfig = await res.json();

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

// ─────────────────────────────────────────────────────────
// PUENTE: expone Firebase para scripts regulares (app.js, api.js)
// window._firebaseAuth  → instancia de auth
// window._authReady     → Promise que resuelve con el usuario (o null)
// ─────────────────────────────────────────────────────────
window._firebaseAuth = auth;

window._authReady = new Promise((resolve) => {
  const unsub = onAuthStateChanged(auth, async (user) => {
    unsub();
    if (user) {
      const token = await user.getIdToken(true);
      localStorage.setItem('fb_token', token);
    } else {
      localStorage.removeItem('fb_token');
    }
    resolve(user);
  });
});

// Escucha continua para refrescar el token cuando Firebase lo renueva
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const token = await user.getIdToken();
    localStorage.setItem('fb_token', token);
  }
});

// ─────────────────────────────────────────────────────────
// Funciones de login/logout (usadas por login.html)
// ─────────────────────────────────────────────────────────
async function loginEmail(email, password) {
  const cred  = await signInWithEmailAndPassword(auth, email, password);
  const token = await cred.user.getIdToken();
  localStorage.setItem('fb_token', token);
  return cred.user;
}

async function loginGoogle() {
  const cred  = await signInWithPopup(auth, provider);
  const token = await cred.user.getIdToken();
  localStorage.setItem('fb_token', token);
  return cred.user;
}

async function logout() {
  await signOut(auth);
  localStorage.removeItem('fb_token');
  window.location.href = '/login';
}

// Waits for Firebase — used in login.html to detect an active session
function esperarAuthListo() {
  return window._authReady;
}

// ─────────────────────────────────────────────────────────
// Sign up with email and password
// ─────────────────────────────────────────────────────────
async function registerEmail(email, password) {
  const { createUserWithEmailAndPassword } = await import(
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"
  );
  const cred  = await createUserWithEmailAndPassword(auth, email, password);
  const token = await cred.user.getIdToken();
  localStorage.setItem('fb_token', token);
  return cred.user;
}

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

export { auth, loginEmail, loginGoogle, logout, esperarAuthListo, registerEmail, resetPassword };