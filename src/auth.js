// Sign-in via Supabase Auth: Google, Microsoft (Azure) and email magic links.
//
// AUTH.REQUIRED gates the whole game behind sign-in. It is ON: the providers
// and redirect URLs are live in the Supabase dashboard. Flip it to false only
// to re-open guest play (see README → "Enabling sign-in").
export const AUTH = { REQUIRED: true };

import { getSupabase } from './net/online.js';
import { DEBUG } from './config.js';

let session = null;
const listeners = new Set();

function emit() {
  for (const cb of listeners) cb(session);
}

export function onAuthChange(cb) {
  listeners.add(cb);
  cb(session);
}

export function currentUser() {
  return session?.user || null;
}

// Debug-only (?debug=1): fake a signed-in user so the auth-gated flows — the
// profile gate, first-run onboarding, deferred invites — are testable without
// completing a real OAuth round-trip. Inert unless DEBUG is on.
export function __debugSignIn(user) {
  if (!DEBUG) return false;
  session = user ? { user } : null;
  emit();
  return true;
}

export async function initAuth() {
  try {
    const sb = await getSupabase();
    const { data } = await sb.auth.getSession();
    session = data.session || null;
    sb.auth.onAuthStateChange((_event, s) => {
      session = s;
      emit();
    });
    emit();
    return session;
  } catch (e) {
    return null;
  }
}

const redirectTo = () => location.origin + location.pathname;

export async function signInGoogle() {
  const sb = await getSupabase();
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectTo() },
  });
  if (error) throw error;
}

export async function signInMicrosoft() {
  const sb = await getSupabase();
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'azure',
    options: { redirectTo: redirectTo(), scopes: 'email' },
  });
  if (error) throw error;
}

export async function signInEmail(email) {
  const sb = await getSupabase();
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo(), shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function signOut() {
  try {
    const sb = await getSupabase();
    await sb.auth.signOut();
  } catch (e) { /* session already gone */ }
}

// Friendly display handle for a signed-in user.
export function userHandle() {
  const u = currentUser();
  if (!u) return null;
  return u.user_metadata?.full_name || u.user_metadata?.name || (u.email ? u.email.split('@')[0] : 'Founder');
}
