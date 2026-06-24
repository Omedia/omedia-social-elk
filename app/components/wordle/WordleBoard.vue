<script setup lang="ts">
import { getDailyWord, getPuzzleNumber, WORDLE_WORD_SET } from '~/constants/wordle-words'

type Verdict = 'correct' | 'present' | 'absent'

interface CompletedRow {
  word: string
  verdicts: Verdict[]
}

interface GameState {
  puzzleNumber: number
  // Only the guessed words are stored; tile colors are recomputed against the
  // current answer on restore, so a changed answer can never show stale colors.
  words: string[]
}

const MAX_GUESSES = 6
const WORD_LENGTH = 5
const STORAGE_KEY = 'omedia-wordle-v2'
const SUBMITTED_KEY_PREFIX = 'omedia-wordle-submitted-'
const LETTER_RE = /^[A-Z]$/
const SINGLE_LETTER_RE = /^[a-z]$/i

const answer = ref(getDailyWord())
const puzzleNumber = ref(getPuzzleNumber())
const rows = ref<CompletedRow[]>([])
const current = ref('')
const status = ref<'playing' | 'won' | 'lost'>('playing')
const flash = ref<string | null>(null)

const remainingRows = computed(() => Math.max(0, MAX_GUESSES - rows.value.length - (status.value === 'playing' ? 1 : 0)))

const keyboardState = computed(() => {
  const map: Record<string, Verdict> = {}
  const rank: Record<Verdict, number> = { absent: 0, present: 1, correct: 2 }
  for (const row of rows.value) {
    for (let i = 0; i < row.word.length; i++) {
      const letter = row.word[i]
      const v = row.verdicts[i]
      if (!map[letter] || rank[v] > rank[map[letter]])
        map[letter] = v
    }
  }
  return map
})

function evaluate(guess: string, target: string): Verdict[] {
  const result = Array.from({ length: WORD_LENGTH }).fill('absent') as Verdict[]
  const counts: Record<string, number> = {}
  for (const ch of target)
    counts[ch] = (counts[ch] || 0) + 1
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === target[i]) {
      result[i] = 'correct'
      counts[guess[i]]--
    }
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === 'correct')
      continue
    if (counts[guess[i]] > 0) {
      result[i] = 'present'
      counts[guess[i]]--
    }
  }
  return result
}

function persist() {
  if (typeof window === 'undefined')
    return
  const state: GameState = {
    puzzleNumber: puzzleNumber.value,
    words: rows.value.map(r => r.word),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function restore() {
  if (typeof window === 'undefined')
    return
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw)
    return
  try {
    const state = JSON.parse(raw) as GameState
    if (state.puzzleNumber !== puzzleNumber.value)
      return
    const restored: CompletedRow[] = []
    let restoredStatus: 'playing' | 'won' | 'lost' = 'playing'
    for (const word of state.words ?? []) {
      restored.push({ word, verdicts: evaluate(word, answer.value) })
      if (word === answer.value)
        restoredStatus = 'won'
    }
    if (restoredStatus !== 'won' && restored.length >= MAX_GUESSES)
      restoredStatus = 'lost'
    rows.value = restored
    status.value = restoredStatus
  }
  catch {}
}

function showFlash(msg: string) {
  flash.value = msg
  setTimeout(() => {
    if (flash.value === msg)
      flash.value = null
  }, 1500)
}

// Submit the finished game to the team leaderboard, once per puzzle.
// No-op for guests or while still playing; retries when the user signs in.
async function maybeSubmitScore() {
  const finalStatus = status.value
  const acct = currentUser.value?.account?.acct
  if (typeof window === 'undefined' || finalStatus === 'playing')
    return
  if (!acct) {
    showFlash('Sign in to submit your score to the leaderboard')
    return
  }
  const key = `${SUBMITTED_KEY_PREFIX}${puzzleNumber.value}:${acct}`
  if (localStorage.getItem(key))
    return
  const ok = await submitWordleScore({
    puzzleNumber: puzzleNumber.value,
    status: finalStatus,
    guesses: rows.value.length,
  })
  if (ok)
    localStorage.setItem(key, '1')
  else
    showFlash('Could not submit score — try again')
}

function commit() {
  if (status.value !== 'playing')
    return
  if (current.value.length !== WORD_LENGTH) {
    showFlash('Not enough letters')
    return
  }
  if (!WORDLE_WORD_SET.has(current.value)) {
    showFlash('Not in word list')
    return
  }
  const verdicts = evaluate(current.value, answer.value)
  rows.value = [...rows.value, { word: current.value, verdicts }]
  if (current.value === answer.value)
    status.value = 'won'
  else if (rows.value.length >= MAX_GUESSES)
    status.value = 'lost'
  current.value = ''
  persist()
  if (status.value !== 'playing')
    maybeSubmitScore()
}

function press(key: string) {
  if (status.value !== 'playing')
    return
  if (key === 'ENTER') {
    commit()
    return
  }
  if (key === 'BACKSPACE') {
    current.value = current.value.slice(0, -1)
    return
  }
  if (LETTER_RE.test(key) && current.value.length < WORD_LENGTH)
    current.value = current.value + key
}

function handleKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey)
    return
  const target = e.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable))
    return
  const isWordleKey = e.key === 'Enter' || e.key === 'Backspace' || SINGLE_LETTER_RE.test(e.key)
  if (!isWordleKey)
    return
  e.preventDefault()
  e.stopImmediatePropagation()
  e.stopPropagation()
  if (e.key === 'Enter')
    press('ENTER')
  else if (e.key === 'Backspace')
    press('BACKSPACE')
  else press(e.key.toUpperCase())
}

function buildShare(): string {
  const header = `Omedia Wordle #${puzzleNumber.value} ${status.value === 'won' ? rows.value.length : 'X'}/${MAX_GUESSES}`
  const emoji: Record<Verdict, string> = { correct: '🟩', present: '🟨', absent: '⬛' }
  const grid = rows.value.map(r => r.verdicts.map(v => emoji[v]).join('')).join('\n')
  return `${header}\n${grid}`
}

function shareToFeed() {
  const text = buildShare()
  navigator.clipboard?.writeText(text).catch(() => {})
  openPublishDialog('dialog', getDefaultDraftItem({ status: text }))
}

function copyResult() {
  navigator.clipboard?.writeText(buildShare()).catch(() => {})
  showFlash('Copied to clipboard')
}

const TOP = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P']
const MID = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L']
const BOT = ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE']

onMounted(() => {
  restore()
  maybeSubmitScore()
  window.addEventListener('keydown', handleKey, { capture: true })
})

watch(() => currentUser.value?.account?.acct, () => {
  maybeSubmitScore()
})

watch(status, (s) => {
  if (s !== 'playing')
    maybeSubmitScore()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKey, { capture: true })
})

function tileClass(v: Verdict | 'pending' | 'empty'): string {
  switch (v) {
    case 'correct': return 'bg-[var(--c-wordle-correct)] text-white border-transparent'
    case 'present': return 'bg-[var(--c-wordle-present)] text-white border-transparent'
    case 'absent': return 'bg-[var(--c-wordle-absent)] text-white border-transparent'
    case 'pending': return 'border-strong'
    default: return 'border-base'
  }
}

function keyClass(letter: string): string {
  if (letter === 'ENTER' || letter === 'BACKSPACE')
    return 'bg-[var(--c-wordle-key)] text-base px-3'
  const v = keyboardState.value[letter]
  if (v === 'correct')
    return 'bg-[var(--c-wordle-correct)] text-white'
  if (v === 'present')
    return 'bg-[var(--c-wordle-present)] text-white'
  if (v === 'absent')
    return 'bg-[var(--c-wordle-absent)] text-white'
  return 'bg-[var(--c-wordle-key)] text-base'
}
</script>

<template>
  <div class="wordle-board" flex="~ col" items-center gap-4 select-none tabindex="0">
    <div flex="~ col" items-center gap-1>
      <h2 text-xl font-bold>
        Wordle #{{ puzzleNumber }}
      </h2>
      <p text-sm text-secondary>
        Guess the 5-letter word in 6 tries.
      </p>
    </div>

    <div
      v-if="flash"
      px-3 py-1 rounded-2 text-sm
      :style="{ background: 'var(--c-text-base)', color: 'var(--c-bg-base)' }"
    >
      {{ flash }}
    </div>

    <div flex="~ col gap-1.5">
      <div
        v-for="(row, ri) in rows"
        :key="`done-${ri}`"
        flex="~ gap-1.5"
      >
        <div
          v-for="(letter, ci) in row.word"
          :key="ci"
          w-12 h-12 flex items-center justify-center text-2xl font-bold uppercase rounded-2 border-2
          :class="tileClass(row.verdicts[ci])"
        >
          {{ letter }}
        </div>
      </div>

      <div v-if="status === 'playing'" flex="~ gap-1.5">
        <div
          v-for="i in WORD_LENGTH"
          :key="`cur-${i}`"
          w-12 h-12 flex items-center justify-center text-2xl font-bold uppercase rounded-2 border-2
          :class="tileClass(current[i - 1] ? 'pending' : 'empty')"
        >
          {{ current[i - 1] || '' }}
        </div>
      </div>

      <div
        v-for="i in remainingRows"
        :key="`empty-${i}`"
        flex="~ gap-1.5"
      >
        <div
          v-for="j in WORD_LENGTH"
          :key="j"
          w-12 h-12 rounded-2 border-2 border-base
        />
      </div>
    </div>

    <div v-if="status !== 'playing'" flex="~ col" items-center gap-2 mt-2>
      <p v-if="status === 'won'" text-lg font-bold>
        You got it in {{ rows.length }}!
      </p>
      <p v-else text-lg font-bold>
        The word was <span text-primary>{{ answer }}</span>
      </p>
      <div flex="~ gap-2">
        <button btn-solid rounded-2 @click="shareToFeed">
          Share to feed
        </button>
        <button btn-outline rounded-2 @click="copyResult">
          Copy result
        </button>
      </div>
    </div>

    <div flex="~ col gap-1.5" w-full max-w-100>
      <div flex="~ gap-1" justify-center>
        <button v-for="k in TOP" :key="k" h-12 min-w-8 px-2 rounded-2 font-bold text-sm uppercase :class="keyClass(k)" @click="press(k)">
          {{ k }}
        </button>
      </div>
      <div flex="~ gap-1" justify-center>
        <button v-for="k in MID" :key="k" h-12 min-w-8 px-2 rounded-2 font-bold text-sm uppercase :class="keyClass(k)" @click="press(k)">
          {{ k }}
        </button>
      </div>
      <div flex="~ gap-1" justify-center>
        <button v-for="k in BOT" :key="k" h-12 min-w-8 px-2 rounded-2 font-bold text-xs uppercase :class="keyClass(k)" @click="press(k)">
          <div v-if="k === 'BACKSPACE'" i-ri:delete-back-2-line text-lg />
          <span v-else>{{ k }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style>
.wordle-board {
  --c-wordle-correct: #538d4e;
  --c-wordle-present: #b59f3b;
  --c-wordle-absent: #6b7280;
  --c-wordle-key: var(--c-bg-card);
}
</style>
