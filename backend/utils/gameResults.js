const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeName = (value) => String(value || '').trim();

const getGameParticipants = (game) => {
  const participants = [normalizeName(game?.host_name), normalizeName(game?.guest_name)].filter(Boolean);
  return Array.from(new Set(participants));
};

const normalizeParticipantName = (candidate, game) => {
  const normalizedCandidate = normalizeName(candidate);
  if (!normalizedCandidate) return null;

  const participants = getGameParticipants(game);
  const canonical = participants.find(
    (participant) => participant.toLowerCase() === normalizedCandidate.toLowerCase()
  );

  return canonical || null;
};

const sanitizeScoreSubmission = (scoreSubmission) => {
  const score = Math.max(0, Math.floor(toSafeNumber(scoreSubmission?.score)));
  const roundsWon = Math.max(0, Math.floor(toSafeNumber(scoreSubmission?.roundsWon)));
  const durationMs = Math.max(0, Math.floor(toSafeNumber(scoreSubmission?.durationMs)));
  const submittedAt =
    typeof scoreSubmission?.submittedAt === 'string' && scoreSubmission.submittedAt
      ? scoreSubmission.submittedAt
      : new Date().toISOString();

  return {
    score,
    roundsWon,
    durationMs,
    submittedAt,
  };
};

const pickWinnerFromResults = (results, participants) => {
  const normalizedParticipants = (participants || []).map((name) => normalizeName(name)).filter(Boolean);
  if (normalizedParticipants.length < 2) return null;

  const participantByLower = new Map(
    normalizedParticipants.map((participant) => [participant.toLowerCase(), participant])
  );

  const entries = Object.entries(results || {})
    .map(([name, payload]) => {
      const canonical = participantByLower.get(normalizeName(name).toLowerCase());
      return canonical ? [canonical, payload] : null;
    })
    .filter(Boolean);

  const deduped = new Map();
  for (const [name, payload] of entries) {
    deduped.set(name, payload);
  }

  if (deduped.size < 2) return null;

  const sortableEntries = Array.from(deduped.entries());
  sortableEntries.sort((a, b) => {
    const scoreDiff = toSafeNumber(b[1]?.score) - toSafeNumber(a[1]?.score);
    if (scoreDiff !== 0) return scoreDiff;

    const roundsDiff = toSafeNumber(b[1]?.roundsWon) - toSafeNumber(a[1]?.roundsWon);
    if (roundsDiff !== 0) return roundsDiff;

    const aDuration = toSafeNumber(a[1]?.durationMs, Number.MAX_SAFE_INTEGER);
    const bDuration = toSafeNumber(b[1]?.durationMs, Number.MAX_SAFE_INTEGER);
    if (aDuration !== bDuration) return aDuration - bDuration;

    const aSubmitted = new Date(a[1]?.submittedAt || 0).getTime();
    const bSubmitted = new Date(b[1]?.submittedAt || 0).getTime();
    if (aSubmitted !== bSubmitted) return aSubmitted - bSubmitted;

    return a[0].localeCompare(b[0], 'tr');
  });

  return sortableEntries[0]?.[0] || null;
};

module.exports = {
  getGameParticipants,
  normalizeParticipantName,
  sanitizeScoreSubmission,
  pickWinnerFromResults,
};
