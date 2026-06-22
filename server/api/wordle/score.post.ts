import type { WordleResult } from '../../utils/wordle'
import { recordResult } from '../../utils/wordle'

interface ScoreBody {
  puzzleNumber?: unknown
  status?: unknown
  guesses?: unknown
  account?: {
    acct?: unknown
    displayName?: unknown
    avatar?: unknown
  }
}

function asString(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<ScoreBody>(event)

    const puzzleNumber = Number(body?.puzzleNumber)
    const status = body?.status
    const guesses = Number(body?.guesses)
    const acct = asString(body?.account?.acct)

    if (!Number.isInteger(puzzleNumber) || puzzleNumber < 0)
      throw createError({ statusCode: 400, statusMessage: 'Invalid puzzleNumber' })

    if (status !== 'won' && status !== 'lost')
      throw createError({ statusCode: 400, statusMessage: 'Invalid status' })

    if (!Number.isInteger(guesses) || guesses < 1 || guesses > 6)
      throw createError({ statusCode: 400, statusMessage: 'Invalid guesses' })

    if (!acct)
      throw createError({ statusCode: 400, statusMessage: 'Missing account' })

    const entry: WordleResult = {
      acct,
      displayName: asString(body?.account?.displayName) || acct,
      avatar: asString(body?.account?.avatar, 1000),
      puzzleNumber,
      status,
      guesses,
      ts: Date.now(),
    }

    const created = await recordResult(entry)
    return { ok: true, created }
  }
  catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error)
      throw error
    console.error('[wordle/score]', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to store Wordle score',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})
