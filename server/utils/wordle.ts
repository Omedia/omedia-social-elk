// @ts-expect-error virtual import
import { driver } from '#storage-config'

import kv from 'unstorage/drivers/cloudflare-kv-http'
import fs from 'unstorage/drivers/fs'
import memory from 'unstorage/drivers/memory'
import vercelKVDriver from 'unstorage/drivers/vercel-kv'

export interface WordleResult {
  acct: string
  displayName: string
  avatar: string
  puzzleNumber: number
  status: 'won' | 'lost'
  guesses: number
  ts: number
}

const storage = useStorage<WordleResult>()

if (driver === 'fs') {
  const config = useRuntimeConfig()
  storage.mount('wordle', fs({ base: `${config.storage.fsBase}-wordle` }))
}
else if (driver === 'cloudflare') {
  const config = useRuntimeConfig()
  storage.mount('wordle', kv({
    accountId: config.cloudflare.accountId,
    namespaceId: config.cloudflare.namespaceId,
    apiToken: config.cloudflare.apiToken,
  }))
}
else if (driver === 'vercel') {
  const config = useRuntimeConfig()
  storage.mount('wordle', vercelKVDriver({
    url: config.vercel.url,
    token: config.vercel.token,
    env: config.vercel.env,
    base: config.vercel.base,
  }))
}
else if (driver === 'memory') {
  storage.mount('wordle', memory())
}

const RESULT_PREFIX = 'wordle:result:'

function resultKey(puzzleNumber: number, acct: string) {
  return `${RESULT_PREFIX}${puzzleNumber}:${acct}`
}

async function readKeys(keys: string[]) {
  const items = await Promise.all(keys.map(key => storage.getItem(key)))
  return items.filter((item): item is WordleResult => !!item && typeof item === 'object')
}

/**
 * Store a result. Write-once per (puzzle, account): a player's first submission
 * for a puzzle is kept, so reloading or replaying can't overwrite it.
 * Returns true when a new record was written.
 */
export async function recordResult(entry: WordleResult): Promise<boolean> {
  const key = resultKey(entry.puzzleNumber, entry.acct)
  if (await storage.hasItem(key))
    return false
  await storage.setItem(key, entry)
  return true
}

export async function getResultsForPuzzle(puzzleNumber: number): Promise<WordleResult[]> {
  const keys = await storage.getKeys(`${RESULT_PREFIX}${puzzleNumber}:`)
  return readKeys(keys)
}

export async function getAllResults(): Promise<WordleResult[]> {
  const keys = await storage.getKeys(RESULT_PREFIX)
  return readKeys(keys)
}
