<script setup lang="ts">
const buildInfo = useBuildInfo()
const { t } = useI18n()

useHydratedHead({
  title: () => `${t('settings.about.label')} | ${t('nav.settings')}`,
})

const showCommit = ref(buildInfo.env !== 'release' && buildInfo.env !== 'dev')
const builtTime = useFormattedDateTime(buildInfo.time)

function handleShowCommit() {
  setTimeout(() => {
    showCommit.value = true
  }, 50)
}
</script>

<template>
  <MainContent back="small-only">
    <template #title>
      <MainTitle as="h1" secondary>
        {{ $t('settings.about.label') }}
      </MainTitle>
    </template>

    <div flex="~ col gap4" w-full items-center justify-center my5>
      <img :alt="$t('app_logo')" :src="`${''}/logo.svg`" w-24 h-24 class="rtl-flip">
      <p text-lg>
        {{ $t('app_desc_short') }}
      </p>
    </div>

    <template v-if="isHydrated">
      <SettingsItem
        :text="$t('settings.about.version')"
        @click="handleShowCommit"
      >
        <template #content>
          <div font-mono>
            <span>{{ buildInfo.env === 'release' ? `v${buildInfo.version}` : buildInfo.env }}</span>
            <span v-if="showCommit"> ({{ buildInfo.shortCommit }}@{{ buildInfo.branch }})</span>
          </div>
        </template>
      </SettingsItem>

      <SettingsItem :text="$t('settings.about.built_at')" :content="builtTime" />
    </template>

    <div h-1px bg-border my2 />

    <SettingsItem
      :text="$t('nav.show_intro')"
      icon="i-ri:article-line"
      cursor-pointer large
      @click="openPreviewHelp"
    />
  </MainContent>
</template>
