<script setup lang="ts">
useHydratedHead({ title: () => 'Wordle' })

const activeTab = ref<'game' | 'leaderboard'>('game')

// Refresh leaderboard when switching tabs (scores may have been submitted on the game tab).
watch(activeTab, (tab) => {
  if (tab === 'leaderboard')
    wordleResultSignal.value++
})
</script>

<template>
  <MainContent>
    <template #title>
      <MainTitle as="router-link" to="/wordle" icon="i-ri:gamepad-line">
        Wordle
      </MainTitle>
    </template>
    <div py-6 px-3>
      <div mx-auto w-full max-w-130 bg-card border border-base rounded-xl of-hidden>
        <div flex w-full items-center lg:text-lg border="b base">
          <button
            type="button"
            flex flex-auto cursor-pointer px3 m1 rounded transition-all
            hover:bg-active transition-100
            @click="activeTab = 'game'"
          >
            <span
              mxa px4 py3 text-center border-b-3
              :class="activeTab === 'game' ? 'font-bold border-primary' : 'op50 hover:op50 border-transparent'"
            >
              Game
            </span>
          </button>
          <button
            type="button"
            flex flex-auto cursor-pointer px3 m1 rounded transition-all
            hover:bg-active transition-100
            @click="activeTab = 'leaderboard'"
          >
            <span
              mxa px4 py3 text-center border-b-3
              :class="activeTab === 'leaderboard' ? 'font-bold border-primary' : 'op50 hover:op50 border-transparent'"
            >
              Leaderboard
            </span>
          </button>
        </div>

        <section v-show="activeTab === 'game'" p4 min-w-0>
          <WordleBoard mx-auto w-full />
        </section>

        <section v-show="activeTab === 'leaderboard'" p4 min-w-0>
          <WordleLeaderboard />
        </section>
      </div>
    </div>
  </MainContent>
</template>
