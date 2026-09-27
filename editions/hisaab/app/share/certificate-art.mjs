/** One visual contract for the live certificate and its PNG. Portrait proportions concern only the image strip. */
const CAPTIONS = Object.freeze([
  'Big smile. Small fact-check.', 'Degree in forwards. Minor in receipts.', 'The volume is down. The questions are up.',
  'Neutral face. Interesting questions.', 'One receipt can change the expression.', 'The reply is still pending.',
  'Reading the fine print has consequences.', 'Every crore. Every tukda.', 'Your face. Your facts. Your frame.',
]);
export function certificateArt(band, hidden = false) {
  const level = Number.isInteger(band) ? Math.max(0, Math.min(8, band)) : 0;
  const portrait = hidden ? 90 : 30 + level * 7.5;
  return Object.freeze({ band: level, portrait, mascot: 100 - portrait, frame: hidden ? 5 : [0, 0, 1, 1, 2, 3, 3, 4, 5][level],
    medal: hidden ? '★' : String(level === 8 ? 10 : level + 1).padStart(2, '0'),
    caption: hidden ? 'Receipts out. Tears in.' : CAPTIONS[level],
    expression: hidden ? 'crying' : ['beaming', 'smiling', 'confident', 'uncertain', 'surprised', 'worried', 'alarmed', 'tearful', 'crying'][level],
  });
}

export function mascotAsset(base = '/') {
  return `${base.replace(/\/?$/, '/')}assets/hisaab/mascot-expressions.png`;
}

export function spriteCrop(frame, width, height) {
  const index = Number.isInteger(frame) ? Math.max(0, Math.min(5, frame)) : 0;
  return { x: (index % 3) * width / 3, y: Math.floor(index / 3) * height / 2, width: width / 3, height: height / 2 };
}

export function honourLine(grant) {
  if (!grant) return '';
  const source = grant.source === 'savings' ? 'UPI tax savings leader' : grant.source === 'tournament' ? 'Tournament top 10' : 'Leaderboard top 10';
  return `${source} · #${grant.rank} · until ${new Date(grant.expiresAt).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}
