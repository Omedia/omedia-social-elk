<script setup lang="ts">
const emit = defineEmits<{
  (event: 'close'): void
}>()

const vAutoFocus = (el: HTMLElement) => el.focus()
</script>

<template>
  <div my-8 px-3 sm:px-8 md:max-w-200 flex="~ col gap-4" relative>
    <button v-auto-focus type="button" btn-action-icon absolute top--8 right-0 m1 :aria-label="$t('action.close')" @click="emit('close')">
      <span i-ri:close-line />
    </button>

    <img :alt="$t('app_logo')" :src="`/${''}logo.svg`" w-20 h-20 height="80" width="80" mxa class="rtl-flip">
    <h1 mxa text-4xl mb4>
      {{ $t('help.title') }}
    </h1>
    <p>
      {{ $t('help.desc_para1') }}
    </p>
    <p>
      <b text-primary>{{ $t('help.desc_highlight') }}</b>
    </p>

    <button type="button" btn-solid mxa @click="emit('close')">
      {{ $t('action.enter_app') }}
    </button>
  </div>
</template>
