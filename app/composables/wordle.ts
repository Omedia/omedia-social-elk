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
 * The server only keeps the first submission per (puzzle, account).
 */
export async function submitWordleScore(payload: WordleScorePayload): Promise<boolean> {
  const account = currentUser.value?.account
  if (!account?.acct)
    return false

  try {
    await $fetch('/api/wordle/score', {
      method: 'POST',
      body: {
        puzzleNumber: payload.puzzleNumber,
        status: payload.status,
        guesses: payload.guesses,
        account: {
          acct: account.acct,
          displayName: account.displayName,
          avatar: account.avatar,
        },
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
