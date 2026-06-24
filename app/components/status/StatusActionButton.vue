<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

const { as = 'button', command, disabled, content, icon, textClickable } = defineProps<{
  text?: string | number
  content: string
  color: string
  icon: string
  activeIcon?: string
  inactiveIcon?: string
  hover: string
  elkGroupHover: string
  active?: boolean
  disabled?: boolean
  as?: string
  command?: boolean
  // When set, the count becomes its own click target (e.g. open "who liked")
  // without toggling the main action.
  textClickable?: boolean
}>()

const emit = defineEmits<{
  textClick: []
}>()

defineSlots<{
  text: (props: object) => void
}>()

function onTextActivate(e: Event) {
  if (!textClickable)
    return
  e.stopPropagation()
  e.preventDefault()
  emit('textClick')
}

const el = ref<HTMLDivElement>()

useCommand({
  scope: 'Actions',

  order: -2,
  visible: () => command && !disabled,

  name: () => content,
  icon: () => icon,

  onActivate() {
    if (!checkLogin())
      return
    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
    })
    el.value?.dispatchEvent(clickEvent)
  },
})
</script>

<template>
  <component
    :is="as"
    v-bind="$attrs" ref="el"
    w-fit flex gap-1 items-center transition-all select-none
    rounded
    focus:outline-none
    :class="[
      active ? color : (disabled ? 'op25 cursor-not-allowed' : 'text-secondary'),
      textClickable ? '' : 'group',
    ]"
    :hover="!disabled && !textClickable ? hover : undefined"
    :focus-visible="textClickable ? undefined : hover"
    :aria-label="content"
    :disabled="disabled"
    :aria-disabled="disabled"
  >
    <!-- When the count is its own click target, the icon owns its hover group so
         hovering the count no longer lights up the icon. -->
    <span
      :class="textClickable ? 'group flex rounded-full' : 'contents'"
      :hover="textClickable && !disabled ? hover : undefined"
    >
      <CommonTooltip placement="bottom" :content="content">
        <div
          rounded-full p2
          v-bind="disabled ? {} : {
            'elk-group-hover': elkGroupHover,
            'group-focus-visible': elkGroupHover,
            'group-focus-visible:ring': '2 current',
          }"
        >
          <div :class="active && activeIcon ? activeIcon : (disabled && inactiveIcon ? inactiveIcon : icon)" />
        </div>
      </CommonTooltip>
    </span>

    <CommonAnimateNumber v-if="text !== undefined || $slots.text" :increased="active" text-sm>
      <span
        text-secondary-light
        :class="textClickable ? 'cursor-pointer hover:underline' : ''"
        :role="textClickable ? 'button' : undefined"
        :tabindex="textClickable ? 0 : undefined"
        @click="onTextActivate"
        @keydown.enter="onTextActivate"
      >
        <slot name="text">{{ text }}</slot>
      </span>
      <template #next>
        <span
          :class="[color, textClickable ? 'cursor-pointer hover:underline' : '']"
          :role="textClickable ? 'button' : undefined"
          :tabindex="textClickable ? 0 : undefined"
          @click="onTextActivate"
          @keydown.enter="onTextActivate"
        >
          <slot name="text">{{ text }}</slot>
        </span>
      </template>
    </CommonAnimateNumber>
  </component>
</template>
