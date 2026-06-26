// Resolve a player's CURRENT display name + avatar from their live profile, so
// cached leaderboard snapshots never show a stale name (e.g. before someone set
// a display name). Falls back to the stored snapshot when a lookup fails.
export function useAccountProfiles() {
  const { client } = useMasto()
  const profiles = ref<Record<string, { displayName: string, avatar: string }>>({})
  const inflight = new Set<string>()

  async function resolveProfiles(accts: string[]) {
    if (!client.value)
      return
    const todo = [...new Set(accts)].filter(a => a && !(a in profiles.value) && !inflight.has(a))
    await Promise.all(todo.map(async (acct) => {
      inflight.add(acct)
      try {
        const account = await client.value.v1.accounts.lookup({ acct })
        profiles.value[acct] = {
          displayName: account.displayName?.trim() || account.username || acct,
          avatar: account.avatar,
        }
      }
      catch {
        // leave unresolved → the component keeps the stored snapshot
      }
      finally {
        inflight.delete(acct)
      }
    }))
  }

  return { profiles, resolveProfiles }
}
