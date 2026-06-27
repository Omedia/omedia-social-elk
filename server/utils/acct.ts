// Canonical leaderboard identity. A local user's handle can show up either bare
// ("alice") or fully-qualified ("alice@your.instance") depending on where it was
// captured, which would split one player into two leaderboard rows. Collapse the
// two by stripping the local server suffix (case-insensitive).
export function canonicalAcct(acct: string, server: string): string {
  const a = (acct || '').trim().toLowerCase()
  const suffix = `@${(server || '').trim().toLowerCase()}`
  return suffix.length > 1 && a.endsWith(suffix) ? a.slice(0, -suffix.length) : a
}
