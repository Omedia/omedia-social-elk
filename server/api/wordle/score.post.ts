import type { H3Event } from 'h3'
import type { WordleResult } from '../../utils/wordle'
import { recordResult } from '../../utils/wordle'

interface ScoreBody {
  puzzleNumber?: unknown
  status?: unknown
  guesses?: unknown
}

// Raw Mastodon API (snake_case) — we call verify_credentials directly via $fetch.
interface VerifiedAccount {
  acct?: string
  username?: string
  display_name?: string
  avatar?: string
}

const BEARER_RE = /^Bearer\s+(\S.*)$/i

function bearerToken(event: H3Event): string {
  const header = getHeader(event, 'authorization') || ''
  const match = header.match(BEARER_RE)
  return match?.[1]?.trim() ?? ''
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<ScoreBody>(event)

    const puzzleNumber = Number(body?.puzzleNumber)
    const status = body?.status
    const guesses = Number(body?.guesses)

    if (!Number.isInteger(puzzleNumber) || puzzleNumber < 0)
      throw createError({ statusCode: 400, statusMessage: 'Invalid puzzleNumber' })

    if (status !== 'won' && status !== 'lost')
      throw createError({ statusCode: 400, statusMessage: 'Invalid status' })

    if (!Number.isInteger(guesses) || guesses < 1 || guesses > 6)
      throw createError({ statusCode: 400, statusMessage: 'Invalid guesses' })

    const token = bearerToken(event)
    if (!token)
      throw createError({ statusCode: 401, statusMessage: 'Missing access token' })

    // Identity is resolved from the Mastodon server using the caller's token, never
    // from the request body, so a score can only be recorded for the token's owner.
    // The host is pinned to the configured single instance to avoid SSRF.
    const server = useRuntimeConfig(event).public.defaultServer
    let account: VerifiedAccount
    try {
      account = await $fetch<VerifiedAccount>(`https://${server}/api/v1/accounts/verify_credentials`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    }
    catch {
      throw createError({ statusCode: 401, statusMessage: 'Invalid access token' })
    }

    const acct = account.acct || account.username || ''
    if (!acct)
      throw createError({ statusCode: 401, statusMessage: 'Could not resolve account' })

    const entry: WordleResult = {
      acct,
      displayName: account.display_name?.trim() || account.username || acct,
      avatar: account.avatar || '',
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
    })
  }
})
