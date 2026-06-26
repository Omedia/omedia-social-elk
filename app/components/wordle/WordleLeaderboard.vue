<script setup lang="ts">
import { getPuzzleNumber } from '~/constants/wordle-words'

const puzzleNumber = getPuzzleNumber()
const { data, pending, refresh } = useWordleLeaderboard(puzzleNumber)
const { profiles, resolveProfiles } = useAccountProfiles()

const tab = ref<'today' | 'all'>('today')
const isSignedIn = computed(() => !!currentUser.value?.account?.acct)

onMounted(refresh)
watch(wordleResultSignal, refresh)
watch(data, (d) => {
  resolveProfiles([...d.today, ...d.allTime].map(e => e.acct))
}, { immediate: true })

function rankLabel(i: number): string {
  return ['1', '2', '3'][i] ?? String(i + 1)
}

function profileRoute(acct: string) {
  return `/@${acct}`
}

function shortHandle(acct: string) {
  return accountToShortHandle(acct)
}

// Prefer the player's live profile; fall back to the stored snapshot, and when
// that's just the handle, show the bare username (never user@domain).
function nameFor(entry: { displayName: string, acct: string }): string {
  const live = profiles.value[entry.acct]?.displayName
  if (live)
    return live
  const name = entry.displayName?.trim()
  if (!name || name === entry.acct || name.includes('@'))
    return entry.acct.split('@')[0]
  return name
}

function avatarFor(entry: { avatar: string, acct: string }): string {
  return profiles.value[entry.acct]?.avatar || entry.avatar
}
</script>

<template>
  <div bg-card rounded-lg border border-base of-hidden flex="~ col">
    <header flex justify-between items-center px-4 py-3 border-b border-base>
      <h2 font-bold flex="~ gap-2" items-center>
        <div i-ri:trophy-line text-primary />
        Team leaderboard
      </h2>
      <button
        type="button"
        btn-action-icon
        aria-label="Refresh leaderboard"
        :class="{ 'animate-spin': pending }"
        @click="refresh"
      >
        <div i-ri:refresh-line />
      </button>
    </header>

    <div flex border-b border-base text-sm>
      <button
        type="button"
        flex-1 py-2 font-medium
        :class="tab === 'today' ? 'text-primary border-b-2 border-primary' : 'text-secondary'"
        @click="tab = 'today'"
      >
        Today
      </button>
      <button
        type="button"
        flex-1 py-2 font-medium
        :class="tab === 'all' ? 'text-primary border-b-2 border-primary' : 'text-secondary'"
        @click="tab = 'all'"
      >
        All-time
      </button>
    </div>

    <!-- Today -->
    <div v-if="tab === 'today'">
      <p v-if="!data.today.length" px-4 py-6 text-center text-sm text-secondary>
        {{ isSignedIn ? 'No scores yet today. Be the first!' : 'Sign in to submit your score to the leaderboard.' }}
      </p>
      <ol v-else>
        <li
          v-for="(entry, i) in data.today"
          :key="entry.acct"
          flex items-center gap-3 px-4 py-2 border-b border-base
        >
          <span w-6 text-center font-bold text-secondary shrink-0>{{ rankLabel(i) }}</span>
          <NuxtLink
            :to="profileRoute(entry.acct)"
            flex items-center gap-3 min-w-0 flex-1 rounded-lg -mx-1 px-1
            hover:bg-active transition-100
          >
            <img :src="avatarFor(entry)" :alt="nameFor(entry)" w-8 h-8 rounded-full bg-base shrink-0>
            <div flex="~ col" min-w-0>
              <span font-medium truncate>{{ nameFor(entry) }}</span>
              <span text-xs text-secondary truncate>{{ shortHandle(entry.acct) }}</span>
            </div>
          </NuxtLink>
          <span
            font-bold font-mono shrink-0
            :class="entry.status === 'won' ? 'text-primary' : 'text-secondary'"
          >
            {{ entry.status === 'won' ? `${entry.guesses}/6` : 'X/6' }}
          </span>
        </li>
      </ol>
    </div>

    <!-- All-time -->
    <div v-else>
      <p v-if="!data.allTime.length" px-4 py-6 text-center text-sm text-secondary>
        No games played yet.
      </p>
      <ol v-else>
        <li
          v-for="(entry, i) in data.allTime"
          :key="entry.acct"
          flex items-center gap-3 px-4 py-2 border-b border-base
        >
          <span w-6 text-center font-bold text-secondary shrink-0>{{ rankLabel(i) }}</span>
          <NuxtLink
            :to="profileRoute(entry.acct)"
            flex items-center gap-3 min-w-0 flex-1 rounded-lg -mx-1 px-1
            hover:bg-active transition-100
          >
            <img :src="avatarFor(entry)" :alt="nameFor(entry)" w-8 h-8 rounded-full bg-base shrink-0>
            <div flex="~ col" min-w-0>
              <span font-medium truncate>{{ nameFor(entry) }}</span>
              <span text-xs text-secondary truncate>
                {{ entry.won }}/{{ entry.played }} won · {{ entry.winRate }}%<template v-if="entry.avgGuesses !== null"> · avg {{ entry.avgGuesses }}</template>
              </span>
            </div>
          </NuxtLink>
          <span flex="~ gap-1" items-center font-bold text-primary shrink-0 title="Current streak">
            <div i-ri:fire-line />
            {{ entry.currentStreak }}
          </span>
        </li>
      </ol>
    </div>
  </div>
</template>
