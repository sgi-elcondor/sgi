// Have I Been Pwned "Pwned Passwords" check via k-anonymity: only the first 5 hex characters of
// the SHA-1 hash of the password ever leave the browser — the real password is never
// transmitted, logged, or sent to our backend. Fails open (returns false) on any network/API
// error: this is a defense-in-depth nicety, not a hard security boundary, and a third-party
// outage must never block registration or a password reset.
async function isPasswordPwned(password) {
  try {
    const enc  = new TextEncoder().encode(password);
    const hash = await crypto.subtle.digest('SHA-1', enc);
    const hex  = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const prefix = hex.slice(0, 5);
    const suffix = hex.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!res.ok) return false;

    const text = await res.text();
    return text.split('\n').some(line => line.split(':')[0].trim() === suffix);
  } catch {
    return false;
  }
}

export { isPasswordPwned };
