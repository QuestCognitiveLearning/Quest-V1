// Public Edge Function. Anyone with a valid session code can join — no
// account required. We accept code + displayName, look up the session,
// create a participant row (anonymous when there's no signed-in user),
// and return the session metadata the client needs to start playing.
//
// Identity model:
//   - Authenticated visitor → student_id = users.id (RLS visibility kept).
//   - Anonymous visitor    → student_id = NULL, is_anonymous = true,
//                             display_name carries the join name.
//
// Rate-limit aggressive: this is a public endpoint that touches the
// database. 30 joins/min per IP is plenty for a class of students sharing
// a single wifi while preventing abuse.

import { handlePreflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/client.ts';
import { getMe } from '../_shared/auth.ts';
import { clientIp, rateLimitByIp, tooManyRequestsResponse } from '../_shared/rateLimit.ts';
import { validate } from '../_shared/validator.ts';

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 30, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const { ok, value, errors } = validate(await req.json(), {
    code:        { type: 'string', required: true, maxLength: 16 },
    displayName: { type: 'string', required: true, minLength: 1, maxLength: 50 },
  });
  if (!ok) return json({ error: 'Invalid request', details: errors }, 400);

  const code = value.code.trim().toUpperCase();
  const displayName = value.displayName.trim().slice(0, 50);

  const admin = adminClient();

  // Find the session by code. session_code is the modern column;
  // join_code is the legacy alias. Try both.
  const { data: sessions, error: sErr } = await admin
    .from('live_sessions')
    .select('id, session_code, join_code, session_name, subunit_name, status, teacher_id')
    .or(`session_code.eq.${code},join_code.eq.${code}`)
    .limit(1);
  if (sErr || !sessions || sessions.length === 0) {
    return json({ error: 'No live session matches that code.' }, 404);
  }
  const session = sessions[0];

  if (session.status === 'completed' || session.status === 'ended') {
    return json({ error: 'This session has already ended.' }, 410);
  }

  // Resolve the joiner.
  const user = await getMe(req); // null when anonymous
  let participantPayload: Record<string, unknown> = {
    live_session_id: session.id,
    display_name: displayName,
    is_anonymous: !user,
    total_points: 0,
    current_phase: 'lobby',
  };
  if (user) {
    participantPayload.student_id = user.id;
  }

  // Avoid duplicating a row if the same user/display already joined.
  let { data: existing } = await admin
    .from('live_session_participants')
    .select('id')
    .eq('live_session_id', session.id)
    .eq(user ? 'student_id' : 'display_name', user ? user.id : displayName)
    .maybeSingle();

  let participantId: string;
  if (existing?.id) {
    participantId = existing.id;
  } else {
    const { data: inserted, error: pErr } = await admin
      .from('live_session_participants')
      .insert(participantPayload)
      .select('id')
      .single();
    if (pErr || !inserted) {
      console.error('[joinLiveSession] participant insert failed:', pErr);
      return json({ error: 'Could not join the session.' }, 500);
    }
    participantId = inserted.id;
  }

  return json({
    ok: true,
    sessionId: session.id,
    sessionCode: session.session_code || session.join_code,
    sessionName: session.session_name,
    topic: session.subunit_name,
    status: session.status,
    participantId,
    displayName,
    anonymous: !user,
  });
});
