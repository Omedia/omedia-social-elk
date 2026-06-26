export interface WordleTodayEntry {
  acct: string
  displayName: string
  avatar: string
  status: 'won' | 'lost'
  guesses: number
}

export interface WordleAllTimeEntry {
  acct: string
  displayName: string
  avatar: string
  played: number
  won: number
  winRate: number
  avgGuesses: number | null
  currentStreak: number
  maxStreak: number
}

export interface WordleLeaderboardData {
  today: WordleTodayEntry[]
  allTime: WordleAllTimeEntry[]
}

export interface WordleScorePayload {
  puzzleNumber: number
  status: 'won' | 'lost'
  guesses: number
}

/** Bumped after a successful score submission so the leaderboard can refresh. */
export const wordleResultSignal = ref(0)

/**
 * Submit the current user's result for a puzzle. No-op for guests.
 * The access token is sent so the server can resolve the account itself —
 * identity is never taken from the request body. The server only keeps the
 * first submission per (puzzle, account).
 */
export async function submitWordleScore(payload: WordleScorePayload): Promise<boolean> {
  const user = currentUser.value
  if (!user?.token || !user.account?.acct)
    return false

  try {
    await $fetch('/api/wordle/score', {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.token}` },
      body: {
        puzzleNumber: payload.puzzleNumber,
        status: payload.status,
        guesses: payload.guesses,
      },
    })
    wordleResultSignal.value++
    return true
  }
  catch {
    return false
  }
}

export function useWordleLeaderboard(puzzleNumber: MaybeRefOrGetter<number>) {
  const data = ref<WordleLeaderboardData>({ today: [], allTime: [] })
  const pending = ref(false)

  async function refresh() {
    pending.value = true
    try {
      data.value = await $fetch<WordleLeaderboardData>('/api/wordle/leaderboard', {
        params: { puzzle: toValue(puzzleNumber) },
      })
    }
    catch {
      // keep last known data on error
    }
    finally {
      pending.value = false
    }
  }

  return { data, pending, refresh }
}
