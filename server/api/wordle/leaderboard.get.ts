import type { WordleResult } from '../../utils/wordle'
import { canonicalAcct } from '../../utils/acct'
import { getAllResults, getResultsForPuzzle } from '../../utils/wordle'

export interface TodayEntry {
  acct: string
  displayName: string
  avatar: string
  status: 'won' | 'lost'
  guesses: number
}

export interface AllTimeEntry {
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

function buildToday(results: WordleResult[]): TodayEntry[] {
  return results
    .slice()
    .sort((a, b) => {
      // Winners first; among winners fewest guesses first; ties broken by the
      // earliest finish; losers last.
      if (a.status !== b.status)
        return a.status === 'won' ? -1 : 1
      if (a.status === 'won' && a.guesses !== b.guesses)
        return a.guesses - b.guesses
      return a.ts - b.ts
    })
    .map(r => ({
      acct: r.acct,
      displayName: r.displayName,
      avatar: r.avatar,
      status: r.status,
      guesses: r.guesses,
    }))
}

function buildAllTime(results: WordleResult[]): AllTimeEntry[] {
  const byUser = new Map<string, WordleResult[]>()
  for (const r of results) {
    const list = byUser.get(r.acct) ?? []
    list.push(r)
    byUser.set(r.acct, list)
  }

  const entries: AllTimeEntry[] = []
  for (const [acct, list] of byUser) {
    list.sort((a, b) => a.puzzleNumber - b.puzzleNumber)
    const latest = list.at(-1)
    if (!latest)
      continue

    const played = list.length
    const wins = list.filter(r => r.status === 'won')
    const won = wins.length
    const totalWinGuesses = wins.reduce((sum, r) => sum + r.guesses, 0)

    // Streaks over consecutive puzzle numbers; a gap or a loss breaks the run.
    let currentStreak = 0
    let maxStreak = 0
    let prevPuzzle: number | null = null
    for (const r of list) {
      const consecutive = prevPuzzle !== null && r.puzzleNumber === prevPuzzle + 1
      if (r.status === 'won')
        currentStreak = consecutive ? currentStreak + 1 : 1
      else
        currentStreak = 0
      if (currentStreak > maxStreak)
        maxStreak = currentStreak
      prevPuzzle = r.puzzleNumber
    }

    entries.push({
      acct,
      displayName: latest.displayName,
      avatar: latest.avatar,
      played,
      won,
      winRate: played ? Math.round((won / played) * 100) : 0,
      avgGuesses: won ? Math.round((totalWinGuesses / won) * 10) / 10 : null,
      currentStreak,
      maxStreak,
    })
  }

  return entries.sort((a, b) => {
    // Match the streak column shown in the UI, then skill (avg guesses) and volume.
    if (b.currentStreak !== a.currentStreak)
      return b.currentStreak - a.currentStreak
    if (b.maxStreak !== a.maxStreak)
      return b.maxStreak - a.maxStreak
    const ag = a.avgGuesses ?? Number.POSITIVE_INFINITY
    const bg = b.avgGuesses ?? Number.POSITIVE_INFINITY
    if (ag !== bg)
      return ag - bg
    if (b.winRate !== a.winRate)
      return b.winRate - a.winRate
    return b.won - a.won
  })
}

/** Which of two results for the same (player, puzzle) to keep: win > fewer guesses > earlier. */
function isBetter(a: WordleResult, b: WordleResult): boolean {
  if (a.status !== b.status)
    return a.status === 'won'
  if (a.status === 'won')
    return a.guesses < b.guesses
  return a.ts < b.ts
}

/**
 * Normalize each result's handle to its canonical form, then keep one result per
 * (handle, puzzle). This collapses a player who was recorded under both their bare
 * and fully-qualified handle into a single leaderboard identity.
 */
function canonicalizeAndDedupe(results: WordleResult[]): WordleResult[] {
  const best = new Map<string, WordleResult>()
  for (const raw of results) {
    const r: WordleResult = { ...raw, acct: canonicalAcct(raw.acct) }
    const key = `${r.acct}:${r.puzzleNumber}`
    const current = best.get(key)
    if (!current || isBetter(r, current))
      best.set(key, r)
  }
  return [...best.values()]
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const puzzleNumber = Number(query.puzzle)

  const [todayResults, allResults] = await Promise.all([
    Number.isInteger(puzzleNumber) ? getResultsForPuzzle(puzzleNumber) : Promise.resolve([]),
    getAllResults(),
  ])

  return {
    today: buildToday(canonicalizeAndDedupe(todayResults)),
    allTime: buildAllTime(canonicalizeAndDedupe(allResults)),
  }
})
