// Canonical leaderboard identity. A local user's handle can show up bare
// ("alice") or fully-qualified ("alice@omedia.social", "alice@mastodon.omedia.social")
// depending on where it was captured, which would split one player into multiple
// leaderboard rows. This is a single-instance team game — every recorded player is
// a local account — so the bare username is the unique identity. Strip any domain.
export function canonicalAcct(acct: string): string {
  return (acct || '').trim().toLowerCase().split('@')[0] || ''
}
