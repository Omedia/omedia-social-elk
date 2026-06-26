<script setup lang="ts">
import type { mastodon } from 'masto'

const props = defineProps<{
  reply: mastodon.v1.Status
  nested?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  update: [status: mastodon.v1.Status]
}>()

const { client } = useMasto()
const userSettings = useUserSettings()
const useStarFavoriteIcon = usePreferences('useStarFavoriteIcon')
const hideFavoriteCount = computed(() => getPreferences(userSettings.value, 'hideFavoriteCount'))

const editing = ref(false)
const editText = ref('')
const savingEdit = ref(false)
const editError = ref('')
const favouriting = ref(false)

function isOwnReply() {
  return props.reply.account.id === currentUser.value?.account.id
}

function replyPlainText(reply: mastodon.v1.Status) {
  return htmlToText(reply.content)
}

function canSaveEdit() {
  return editText.value.trim().length > 0 || (props.reply.mediaAttachments?.length ?? 0) > 0
}

function startEdit() {
  if (!isOwnReply())
    return
  editing.value = true
  editText.value = replyPlainText(props.reply)
  editError.value = ''
  nextTick(() => {
    const el = document.querySelector<HTMLInputElement>(`[data-comment-edit="${props.reply.id}"]`)
    el?.focus()
  })
}

function cancelEdit() {
  editing.value = false
  editText.value = ''
  editError.value = ''
}

async function saveEdit() {
  if (!editing.value || savingEdit.value || !canSaveEdit())
    return

  savingEdit.value = true
  editError.value = ''
  try {
    const updated = await client.value.v1.statuses.$select(props.reply.id).update({
      status: editText.value.trim(),
      mediaAttributes: props.reply.mediaAttachments?.map(media => ({
        id: media.id,
        description: media.description,
      })),
    })
    emit('update', updated)
    cacheStatus(updated, undefined, true)
    cancelEdit()
  }
  catch (e) {
    console.error('[StatusInlineCommentBubble] Failed to edit comment', e)
    editError.value = (e as Error).message || 'Failed to edit comment. Please try again.'
  }
  finally {
    savingEdit.value = false
  }
}

async function toggleFavourite() {
  if (!checkLogin() || favouriting.value || props.disabled || editing.value)
    return

  favouriting.value = true
  const wasFavourited = props.reply.favourited
  const prevCount = props.reply.favouritesCount
  const optimistic = {
    ...props.reply,
    favourited: !wasFavourited,
    favouritesCount: props.reply.favouritesCount + (wasFavourited ? -1 : 1),
  }
  emit('update', optimistic)
  cacheStatus(optimistic, undefined, true)

  try {
    const updated = await client.value.v1.statuses.$select(props.reply.id)[wasFavourited ? 'unfavourite' : 'favourite']()
    if (wasFavourited && updated.favouritesCount === prevCount)
      updated.favouritesCount -= 1
    emit('update', updated)
    cacheStatus(updated, undefined, true)
  }
  catch (e) {
    console.error('[StatusInlineCommentBubble] Failed to favourite comment', e)
    emit('update', props.reply)
    cacheStatus(props.reply, undefined, true)
  }
  finally {
    favouriting.value = false
  }
}

function timeSince(dateStr: string): string {
  // Clamp to 0: a just-posted comment's server timestamp can be a hair ahead of
  // the local clock, which would otherwise render as "-1s".
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000))
  if (seconds < 5)
    return 'now'
  if (seconds < 60)
    return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60)
    return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)
    return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7)
    return `${days}d`
  return new Date(dateStr).toLocaleDateString()
}
</script>

<template>
  <div flex="~ gap-2" items-start :class="nested ? 'ml-10' : ''">
    <NuxtLink :to="getAccountRoute(reply.account)" shrink-0>
      <AccountAvatar :account="reply.account" :class="nested ? 'w-6 h-6' : 'w-8 h-8'" />
    </NuxtLink>
    <div flex="~ col" flex-1 bg-card rounded-3 px-3 py-2 text-sm min-w-0>
      <NuxtLink :to="getAccountRoute(reply.account)" font-bold text-sm hover:underline>
        {{ reply.account.displayName || reply.account.username }}
      </NuxtLink>
      <template v-if="editing">
        <input
          v-model="editText"
          type="text"
          :data-comment-edit="reply.id"
          flex-1 bg-transparent py-1 text-sm outline-none min-w-0 border-b border-base
          :disabled="savingEdit"
          @keydown.enter.prevent="saveEdit"
          @keydown.esc.prevent="cancelEdit"
        >
        <div v-if="reply.mediaAttachments?.length" mt-2 max-w-60>
          <StatusMedia :status="reply" />
        </div>
        <p v-if="editError" text-xs text-red-500 m-0 mt-1>
          {{ editError }}
        </p>
        <div flex="~ gap-2" items-center mt-2>
          <button
            type="button"
            text-xs text-secondary hover:text-primary
            :disabled="savingEdit"
            @click="cancelEdit"
          >
            {{ $t('polls.cancel') }}
          </button>
          <button
            type="button"
            text-xs font-medium text-primary hover:underline
            :disabled="savingEdit || !canSaveEdit()"
            @click="saveEdit"
          >
            <span v-if="savingEdit" flex items-center gap-1>
              <div i-ri:loader-2-fill animate-spin />
              {{ $t('action.save') }}
            </span>
            <span v-else>{{ $t('action.save') }}</span>
          </button>
        </div>
      </template>
      <template v-else>
        <div v-if="reply.content" class="comment-content" v-html="reply.content" />
        <div v-if="reply.mediaAttachments?.length" mt-2 max-w-60>
          <StatusMedia :status="reply" />
        </div>
        <div flex="~ gap-2" items-center text-xs text-secondary mt-1>
          <span>{{ timeSince(reply.createdAt) }}</span>
          <StatusEditIndicator :status="reply" inline />
          <div v-if="isHydrated && currentUser" flex items-center gap-0.5>
            <button
              type="button"
              flex items-center
              :class="reply.favourited
                ? (useStarFavoriteIcon ? 'text-yellow' : 'text-rose')
                : (useStarFavoriteIcon ? 'hover:text-yellow' : 'hover:text-rose')"
              :disabled="favouriting || disabled"
              :aria-label="$t(reply.favourited ? 'action.favourited' : 'action.favourite')"
              @click="toggleFavourite"
            >
              <div
                :class="reply.favourited
                  ? (useStarFavoriteIcon ? 'i-ri:star-fill' : 'i-ri:heart-3-fill')
                  : (useStarFavoriteIcon ? 'i-ri:star-line' : 'i-ri:heart-3-line')"
              />
            </button>
            <button
              v-if="reply.favouritesCount && !hideFavoriteCount"
              type="button"
              hover:underline
              :aria-label="$t('status.favourited_by')"
              @click="openReactedByDialog(reply.id)"
            >
              <CommonLocalizedNumber
                keypath="action.favourite_count"
                :count="reply.favouritesCount"
              />
            </button>
          </div>
          <button
            v-if="isOwnReply()"
            type="button"
            hover:text-primary
            :disabled="disabled"
            @click="startEdit"
          >
            {{ $t('action.edit') }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.comment-content :deep(p) {
  margin: 0;
}
.comment-content :deep(p + p) {
  margin-top: 0.25rem;
}
.comment-content :deep(a) {
  color: var(--c-primary);
}
.comment-content :deep(a:hover) {
  text-decoration: underline;
}
</style>
