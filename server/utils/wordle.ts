// @ts-expect-error virtual import
import { driver as buildDriver } from '#storage-config'

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
let storageMounted = false
const TRAILING_SLASH_RE = /\/$/

/** Runtime env wins over the driver baked in at build time (CI often sets cloudflare). */
function activeDriver() {
  return process.env.NUXT_STORAGE_DRIVER || buildDriver
}

function wordleStorageBase(fsBase: string) {
  // Inside the main volume (e.g. /elk/data/wordle), not a sibling like /elk/data-wordle.
  return `${fsBase.replace(TRAILING_SLASH_RE, '')}/wordle`
}

function ensureWordleStorage() {
  if (storageMounted)
    return

  const driver = activeDriver()
  const config = useRuntimeConfig()

  if (driver === 'fs') {
    storage.mount('wordle', fs({ base: wordleStorageBase(config.storage.fsBase) }))
  }
  else if (driver === 'cloudflare') {
    storage.mount('wordle', kv({
      accountId: config.cloudflare.accountId,
      namespaceId: config.cloudflare.namespaceId,
      apiToken: config.cloudflare.apiToken,
    }))
  }
  else if (driver === 'vercel') {
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
  else {
    storage.mount('wordle', fs({ base: wordleStorageBase(config.storage.fsBase) }))
  }

  storageMounted = true
}

const RESULT_PREFIX = 'wordle:result:'

function resultKey(puzzleNumber: number, acct: string) {
  // Encode acct so @ and other chars are safe as a filesystem path segment.
  return `${RESULT_PREFIX}${puzzleNumber}:${encodeURIComponent(acct)}`
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
  ensureWordleStorage()
  const key = resultKey(entry.puzzleNumber, entry.acct)
  if (await storage.hasItem(key))
    return false
  await storage.setItem(key, entry)
  return true
}

export async function getResultsForPuzzle(puzzleNumber: number): Promise<WordleResult[]> {
  ensureWordleStorage()
  const keys = await storage.getKeys(`${RESULT_PREFIX}${puzzleNumber}:`)
  return readKeys(keys)
}

export async function getAllResults(): Promise<WordleResult[]> {
  ensureWordleStorage()
  const keys = await storage.getKeys(RESULT_PREFIX)
  return readKeys(keys)
}
