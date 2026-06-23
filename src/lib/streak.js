// Consecutive-day learning streak from session rows (each with a start_time).
// Counts back from today — or yesterday, if the most recent session was
// yesterday — and stops at the first day-gap. Single source of truth for the
// streak that used to be copy-pasted across the student pages.
export function calculateDayStreak(sessions) {
  if (!sessions || sessions.length === 0) return 0;
  const DAY = 1000 * 60 * 60 * 24;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sessionDates = sessions
    .map((s) => {
      const date = new Date(s.start_time);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    })
    .filter((date, index, self) => self.indexOf(date) === index)
    .sort((a, b) => b - a);
  if (sessionDates.length === 0) return 0;

  const mostRecent = sessionDates[0];
  const daysSinceRecent = Math.floor((today.getTime() - mostRecent) / DAY);
  if (daysSinceRecent > 1) return 0;

  let streak = 0;
  let expectedDate = today.getTime();
  if (daysSinceRecent === 1) expectedDate = today.getTime() - DAY;

  for (const sessionDate of sessionDates) {
    const diff = Math.floor((expectedDate - sessionDate) / DAY);
    if (diff === 0) {
      streak++;
      expectedDate = sessionDate - DAY;
    } else if (diff > 0) {
      break;
    }
  }
  return streak;
}
