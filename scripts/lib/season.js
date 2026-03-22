export function getCurrentSeason(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-based
  if (month >= 6) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}
