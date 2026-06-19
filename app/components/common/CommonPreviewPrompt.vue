<script setup lang="ts">
const build = useBuildInfo()
</script>

<template>
  <div
    m-2 p5 bg-rose:10 relative
    rounded-lg of-hidden
    flex="~ col gap-3"
  >
    <h2 font-bold text-rose>
      {{ $t('help.build_preview.title') }}
    </h2>
    <p>
      <i18n-t keypath="help.build_preview.desc1">
        <code text-rose>{{ build.shortCommit }}</code>
      </i18n-t>
    </p>
    <p>{{ $t('help.build_preview.desc2') }}</p>
    <p font-bold>
      {{ $t('help.build_preview.desc3') }}
    </p>
    <div i-ri-git-pull-request-line absolute text-10em bottom--10 inset-ie--10 text-rose op10 class="-z-1" />
  </div>
</template>
