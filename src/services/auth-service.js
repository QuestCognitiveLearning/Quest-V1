/**
 * @file   auth-service.js
 * @desc   Auth-related operations — login, signup, signout, role assignment,
 *         password reset. Wraps quest.auth so components don't reach into the
 *         SDK directly.
 * @author Quest Learning core team
 */

import { quest } from '@/api/questClient';
import { supabase } from '@/components/lib/supabase-client.jsx';
import { ACCOUNT_TYPE } from '@/constants';

/**
 * Return the current authenticated user row, or null if not signed in.
 * @returns {Promise<object|null>}
 */
export async function getCurrentUser() {
  try {
    return await quest.auth.me();
  } catch (err) {
    if (err?.code === 'NOT_AUTHENTICATED') return null;
    throw err;
  }
}

/**
 * Sign the user out and redirect to the given URL.
 * @param {string} [redirectUrl='/'] - Where to send the user after logout.
 * @returns {Promise<void>}
 */
export async function signOut(redirectUrl = '/') {
  await supabase.auth.signOut();
  window.location.href = redirectUrl;
}

/**
 * Mark the current user as a teacher.
 * @returns {Promise<object>} the updated user row
 */
export async function setRoleTeacher() {
  return quest.auth.updateMe({ account_type: ACCOUNT_TYPE.TEACHER });
}

/**
 * Mark the current user as a student.
 * @returns {Promise<object>} the updated user row
 */
export async function setRoleStudent() {
  return quest.auth.updateMe({ account_type: ACCOUNT_TYPE.STUDENT });
}

/**
 * Send a password reset link to the given email address.
 * @param {string} email - User's email address.
 * @returns {Promise<{ok: boolean, error: string|null}>}
 */
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/ResetPassword`,
  });
  return { ok: !error, error: error?.message ?? null };
}
