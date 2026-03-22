// scripts/lib/categorize.js
const PLAYOFF_KEYWORDS = ['playoff', 'quarterfinal', 'semifinal', 'final'];

export function categorizeEvent(event) {
  const round = (event.strRound || '').toLowerCase();

  if (PLAYOFF_KEYWORDS.some(kw => round.includes(kw))) {
    return 'ehl-sluttspill';
  }

  if (!round && event.dateEvent) {
    const [year, month] = event.dateEvent.split('-').map(Number);
    // Hockey season runs Oct-Apr; playoff months are March (3) and April (4)
    // Games in Oct-Dec are regular season even though month > March of prior year
    if (month >= 3 && month <= 8) return 'ehl-sluttspill';
  }

  return 'ehl';
}
