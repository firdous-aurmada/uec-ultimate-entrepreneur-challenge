// Cloud persistence on the dedicated uec-game Supabase project:
// profile sync, the global leaderboard, and live-match result reporting.
//
// Trust model: clients may edit their own identity columns only. Stats are
// written exclusively by the report_match() RPC on the server, and a match
// only counts when BOTH signed-in players independently report mirror-image
// results for the same room — so the global board reflects real, confirmed
// human-vs-human matches and can't be inflated from the console.

import { getSupabase } from './online.js';
import { currentUser } from '../auth.js';
import { Save } from '../state.js';

// Push the local profile's identity (never stats) up to the cloud.
export async function syncProfileUp() {
  const user = currentUser();
  const p = Save.profile;
  if (!user || !p) return false;
  let handle = (p.name || '').trim().slice(0, 18);
  if (handle.length < 2) handle = 'Founder';
  try {
    const sb = await getSupabase();
    const { error } = await sb.from('profiles').upsert({
      id: user.id,
      handle,
      company: (p.company || '').trim().slice(0, 22) || null,
      base_id: p.baseId || 'jobz',
      c1: /^#[0-9a-fA-F]{6}$/.test(p.c1 || '') ? p.c1 : null,
      c2: /^#[0-9a-fA-F]{6}$/.test(p.c2 || '') ? p.c2 : null,
      special: p.special || null,
      photo: p.photo && p.photo.length < 100000 && p.photo.startsWith('data:image/') ? p.photo : null,
    });
    return !error;
  } catch (e) {
    return false;
  }
}

// Global board rows (view already filters to matches > 0 and caps at 200).
export async function fetchLeaderboard() {
  const sb = await getSupabase();
  const { data, error } = await sb.from('leaderboard').select('*');
  if (error) throw error;
  return data || [];
}

// Report a finished LIVE match. Returns the server's verdict:
// 'applied' (both sides agreed — stats updated) · 'pending' (waiting for the
// rival's report) · 'already-applied' · 'error' / validation codes.
export async function reportOnlineMatch({ roomId, opponentUid, iWon, myRounds, oppRounds, koRounds }) {
  try {
    const sb = await getSupabase();
    const { data, error } = await sb.rpc('report_match', {
      p_room_id: roomId,
      p_opponent: opponentUid,
      p_i_won: iWon,
      p_rounds_won: myRounds,
      p_rounds_lost: oppRounds,
      p_ko_rounds: koRounds,
    });
    return error ? 'error' : data;
  } catch (e) {
    return 'error';
  }
}
