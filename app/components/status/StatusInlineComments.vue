<script setup lang="ts">
import type { mastodon } from 'masto'
import type { GiphyGif } from '~/composables/giphy'

const props = defineProps<{
  status: mastodon.v1.Status
}>()

const { client } = useMasto()
const { downloadAsFile } = useGiphy()
const { isUploading: isUploadingImage, pickImage, uploadImage } = useSingleImageUpload()

const allReplies = ref<mastodon.v1.Status[]>([])
const loading = ref(false)
const expanded = ref(false)
const commentText = ref('')
const posting = ref(false)
const loaded = ref(false)
const pendingGif = ref<GiphyGif | null>(null)
const pendingImage = ref<{ file: File, previewUrl: string } | null>(null)
const uploadingGif = ref(false)
const mediaError = ref('')

const hasPendingMedia = computed(() => pendingGif.value !== null || pendingImage.value !== null)
const isUploadingMedia = computed(() => uploadingGif.value || isUploadingImage.value)

const canSend = computed(() =>
  !posting.value && !isUploadingMedia.value
  && (commentText.value.trim().length > 0 || hasPendingMedia.value),
)

const replyById = computed(() => {
  const map = new Map<string, mastodon.v1.Status>()
  for (const r of allReplies.value)
    map.set(r.id, r)
  return map
})

// Walk up the reply chain to the top-level reply (the one replying directly to
// the status). Replies are shown at a single level of nesting, so a reply to a
// reply-to-a-reply is grouped under its top-level ancestor instead of vanishing.
// Returns null if the chain doesn't lead back to this status.
function topLevelAncestorId(reply: mastodon.v1.Status): string | null {
  let current: mastodon.v1.Status | undefined = reply
  const seen = new Set<string>()
  while (current) {
    if (current.inReplyToId === props.status.id)
      return current.id
    if (!current.inReplyToId || seen.has(current.id))
      return null
    seen.add(current.id)
    current = replyById.value.get(current.inReplyToId)
  }
  return null
}

const directReplies = computed(() =>
  allReplies.value
    .filter(r => r.inReplyToId === props.status.id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
)

const visibleDirectReplies = computed(() => {
  if (expanded.value || directReplies.value.length <= 2)
    return directReplies.value
  return directReplies.value.slice(-2)
})

const visibleReplyCount = computed(() =>
  visibleDirectReplies.value.reduce(
    (sum, r) => sum + 1 + childReplies(r.id).length,
    0,
  ),
)

const totalCount = computed(() =>
  Math.max(allReplies.value.length, props.status.repliesCount || 0),
)

const remainingCount = computed(() =>
  expanded.value ? 0 : Math.max(0, totalCount.value - visibleReplyCount.value),
)

// All descendants of a top-level reply, flattened into one level and ordered by time.
function childReplies(parentId: string) {
  return allReplies.value
    .filter(r => r.id !== parentId && topLevelAncestorId(r) === parentId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

function updateReply(updated: mastodon.v1.Status) {
  const index = allReplies.value.findIndex(r => r.id === updated.id)
  if (index !== -1)
    allReplies.value[index] = updated
}

function clearImage() {
  mediaError.value = ''
  if (pendingImage.value) {
    URL.revokeObjectURL(pendingImage.value.previewUrl)
    pendingImage.value = null
  }
}

async function loadReplies() {
  if (loading.value || loaded.value)
    return
  loading.value = true
  try {
    const context = await client.value.v1.statuses.$select(props.status.id).context.fetch()
    allReplies.value = (context.descendants || [])
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    loaded.value = true
  }
  catch (e) {
    console.error('[StatusInlineComments] Failed to load replies', e)
  }
  finally {
    loading.value = false
  }
}

async function uploadGif(gif: GiphyGif): Promise<string> {
  uploadingGif.value = true
  try {
    const file = await downloadAsFile(gif)
    const media = await client.value.v2.media.create({ file })
    return media.id
  }
  catch (e) {
    console.error('[StatusInlineComments] GIF upload failed', e)
    throw e
  }
  finally {
    uploadingGif.value = false
  }
}

async function postComment() {
  const text = commentText.value.trim()
  const gif = pendingGif.value
  const image = pendingImage.value
  if ((!text && !gif && !image) || posting.value)
    return
  if (!checkLogin())
    return

  posting.value = true
  try {
    const mediaIds: string[] = []
    if (gif) {
      const id = await uploadGif(gif)
      mediaIds.push(id)
    }
    else if (image) {
      const id = await uploadImage(image.file)
      mediaIds.push(id)
    }
    const newReply = await client.value.v1.statuses.create({
      status: text,
      inReplyToId: props.status.id,
      visibility: props.status.visibility,
      mediaIds: mediaIds.length ? mediaIds : undefined,
    })
    allReplies.value.push(newReply)
    commentText.value = ''
    pendingGif.value = null
    clearImage()
    loaded.value = true
  }
  catch (e) {
    console.error('[StatusInlineComments] Failed to post comment', e)
    mediaError.value = (e as Error).message || 'Failed to post comment. Please try again.'
  }
  finally {
    posting.value = false
  }
}

function onPickGif(gif: GiphyGif) {
  mediaError.value = ''
  clearImage()
  pendingGif.value = gif
}

function clearGif() {
  mediaError.value = ''
  pendingGif.value = null
}

function setPendingImage(file: File) {
  mediaError.value = ''
  if (!file.type.startsWith('image/')) {
    mediaError.value = 'Only image files can be added to comments.'
    return
  }
  clearGif()
  clearImage()
  pendingImage.value = {
    file,
    previewUrl: URL.createObjectURL(file),
  }
}

async function onPickImage() {
  mediaError.value = ''
  const file = await pickImage()
  if (!file)
    return
  setPendingImage(file)
}

function handlePaste(evt: ClipboardEvent) {
  mediaError.value = ''
  const files = evt.clipboardData?.files
  if (!files?.length)
    return
  const image = [...files].find(file => file.type.startsWith('image/'))
  if (!image)
    return
  evt.preventDefault()
  setPendingImage(image)
}

const commentInputRef = ref<HTMLInputElement>()

function insertAtCursor(text: string) {
  const el = commentInputRef.value
  if (!el) {
    commentText.value = commentText.value + text
    return
  }
  const start = el.selectionStart ?? commentText.value.length
  const end = el.selectionEnd ?? commentText.value.length
  commentText.value = commentText.value.slice(0, start) + text + commentText.value.slice(end)
  nextTick(() => {
    el.focus()
    const pos = start + text.length
    el.setSelectionRange(pos, pos)
  })
}

function onPickEmoji(code: string) {
  insertAtCursor(code)
}

function onPickCustomEmoji(image: { 'data-emoji-id'?: string }) {
  const shortcode = image['data-emoji-id']
  if (shortcode)
    insertAtCursor(`:${shortcode}:`)
}

const el = ref<HTMLElement>()
onMounted(() => {
  if (!props.status.repliesCount || !el.value)
    return
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      loadReplies()
      observer.disconnect()
    }
  }, { rootMargin: '200px' })
  observer.observe(el.value)
})

onUnmounted(() => {
  clearImage()
})
</script>

<template>
  <div ref="el" mt-3 pt-3 border-t border-base flex="~ col gap-2" @click.stop>
    <button
      v-if="remainingCount > 0"
      type="button"
      text-sm text-secondary text-left hover:text-primary self-start
      @click="expanded = true; loadReplies()"
    >
      View all {{ totalCount }} comments
    </button>

    <div
      v-for="reply in visibleDirectReplies"
      :key="reply.id"
      flex="~ col gap-2"
      border-l="~ base" ml-4 pl-2
    >
      <StatusInlineCommentBubble
        :reply="reply"
        @update="updateReply"
      />
      <StatusInlineCommentBubble
        v-for="nested in childReplies(reply.id)"
        :key="nested.id"
        :reply="nested"
        nested
        @update="updateReply"
      />
    </div>

    <div flex="~ gap-2" items-start mt-1>
      <AccountAvatar v-if="currentUser?.account" :account="currentUser.account" w-8 h-8 shrink-0 mt-1 />
      <div v-else w-8 h-8 rounded-full bg-card shrink-0 mt-1 />
      <div
        flex-1 min-w-0 bg-card px-2
        :class="hasPendingMedia ? 'rounded-3 py-2 flex flex-col gap-2' : 'rounded-full flex gap-1 items-center'"
      >
        <div
          v-if="pendingGif"
          relative w-fit max-w-40 rounded-2 overflow-hidden
        >
          <img :src="pendingGif.preview.url" :alt="pendingGif.title" block w-full>
          <button
            type="button"
            absolute top-1 right-1 w-6 h-6 rounded-full bg-black bg-opacity-60 text-white
            flex items-center justify-center text-xs cursor-pointer
            aria-label="Remove GIF"
            @click="clearGif"
          >
            <div i-ri:close-line />
          </button>
        </div>
        <div
          v-else-if="pendingImage"
          relative w-fit max-w-40 rounded-2 overflow-hidden
        >
          <img :src="pendingImage.previewUrl" :alt="pendingImage.file.name" block w-full>
          <button
            type="button"
            absolute top-1 right-1 w-6 h-6 rounded-full bg-black bg-opacity-60 text-white
            flex items-center justify-center text-xs cursor-pointer
            aria-label="Remove image"
            @click="clearImage"
          >
            <div i-ri:close-line />
          </button>
        </div>
        <p v-if="mediaError" text-xs text-red-500 m-0>
          {{ mediaError }}
        </p>
        <div flex="~ gap-1" items-center w-full>
          <input
            ref="commentInputRef"
            v-model="commentText"
            type="text"
            placeholder="Write a comment…"
            flex-1 bg-transparent px-2 py-2 text-sm outline-none min-w-0
            :disabled="posting || isUploadingMedia"
            @paste="handlePaste"
            @keydown.enter.prevent="postComment"
          >
          <PublishEmojiPicker @select="onPickEmoji" @select-custom="onPickCustomEmoji">
            <button
              type="button"
              flex items-center justify-center w-8 h-8 rounded-full
              hover:bg-active cursor-pointer disabled:opacity-50 disabled:pointer-events-none
              aria-label="Add emoji"
              :disabled="posting || isUploadingMedia"
            >
              <div i-ri:emotion-line text-lg text-secondary />
            </button>
          </PublishEmojiPicker>
          <button
            type="button"
            flex items-center justify-center w-8 h-8 rounded-full
            hover:bg-active cursor-pointer disabled:opacity-50 disabled:pointer-events-none
            :aria-label="$t('tooltip.add_media')"
            :disabled="posting || isUploadingMedia"
            @click="onPickImage"
          >
            <div i-ri:image-add-line text-lg text-secondary />
          </button>
          <PublishGifPicker @select="onPickGif">
            <button
              type="button"
              flex items-center justify-center w-8 h-8 rounded-full
              hover:bg-active cursor-pointer disabled:opacity-50 disabled:pointer-events-none
              aria-label="Add GIF"
              :disabled="posting || isUploadingMedia"
            >
              <div i-ri:file-gif-line text-lg text-secondary />
            </button>
          </PublishGifPicker>
          <button
            type="button"
            flex items-center justify-center w-8 h-8 rounded-full
            cursor-pointer disabled:opacity-50 disabled:pointer-events-none
            :class="canSend ? 'text-primary hover:bg-active' : 'text-secondary'"
            aria-label="Send comment"
            :disabled="!canSend"
            @click="postComment"
          >
            <div v-if="posting || isUploadingMedia" i-ri:loader-2-fill animate-spin />
            <div v-else i-ri:send-plane-fill text-lg />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
