// localStorage-backed session resume.
//
// Each (student, subunit, session_type) tuple gets a single saved snapshot:
//   { step, videoTime, updatedAt }
// Snapshots auto-expire after 7 days so abandoned partial sessions don't
// linger forever.
//
// Usage:
//   loadResume(userId, subunitId, "new_topic")  →  null | snapshot
//   saveResume(userId, subunitId, "new_topic", { step: "video", videoTime: 42 })
//   clearResume(userId, subunitId, "new_topic")

const PREFIX = 'quest:session:';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function key(userId, subunitId, sessionType) {
  return `${PREFIX}${sessionType || 'new_topic'}:${subunitId}:${userId}`;
}

export function loadResume(userId, subunitId, sessionType) {
  if (!userId || !subunitId) return null;
  try {
    const raw = localStorage.getItem(key(userId, subunitId, sessionType));
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (!snap || typeof snap !== 'object') return null;
    if (snap.updatedAt && Date.now() - snap.updatedAt > MAX_AGE_MS) {
      clearResume(userId, subunitId, sessionType);
      return null;
    }
    return snap;
  } catch {
    return null;
  }
}

export function saveResume(userId, subunitId, sessionType, snapshot) {
  if (!userId || !subunitId) return;
  try {
    const payload = { ...snapshot, updatedAt: Date.now() };
    localStorage.setItem(key(userId, subunitId, sessionType), JSON.stringify(payload));
  } catch { /* quota / private mode — ignore */ }
}

export function clearResume(userId, subunitId, sessionType) {
  if (!userId || !subunitId) return;
  try {
    localStorage.removeItem(key(userId, subunitId, sessionType));
  } catch { /* ignore */ }
}
