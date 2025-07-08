<script setup lang="ts">
import { Input, TransitionVertical } from '@proj-airi/ui'
import { useClipboard } from '@vueuse/core'
import { computed, ref } from 'vue'

// --- Component Interface & State ---

interface CacheItem {
  id: string
  type: 'model' | 'dataset' | 'unknown'
  name: string
  path: string
  size: number
  snapshot?: string
  architectures?: string[]
  error?: string
}

const isLoading = ref(false)
const error = ref<string | null>(null)
const cacheItems = ref<CacheItem[]>([])
const selectedItemId = ref<string | null>(null)
const searchTerm = ref('')
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// --- VueUse Composables ---
const { copy, copied, text: copiedText, isSupported } = useClipboard({ legacy: true, source: '' })

// --- Computed Properties ---

const filteredItems = computed(() => {
  if (!searchTerm.value) {
    return cacheItems.value
  }
  return cacheItems.value.filter(item =>
    item.name.toLowerCase().includes(searchTerm.value.toLowerCase()),
  )
})

const totalSize = computed(() => {
  return cacheItems.value.reduce((acc, item) => acc + item.size, 0)
})

// --- Event Handlers & Logic ---

function triggerFileSelect() {
  fileInputRef.value?.click()
}

function onFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    handleFileChange(Array.from(input.files))
  }
  if (input)
    input.value = ''
}

function onDrop(event: DragEvent) {
  isDragging.value = false
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    handleFileChange(Array.from(event.dataTransfer.files))
  }
}

async function handleFileChange(fileList: File[]) {
  if (fileList.length === 0)
    return

  isLoading.value = true
  error.value = null
  cacheItems.value = []

  const isHubDir = fileList.some(f => (f as any).webkitRelativePath.includes('/snapshots/'))
  if (!isHubDir) {
    error.value = 'This does not look like a valid "hub" directory. Please ensure you select the correct folder.'
    isLoading.value = false
    return
  }

  try {
    const items = await processCacheData(fileList)
    cacheItems.value = items
  }
  catch (e: any) {
    error.value = `An error occurred while processing: ${e.message}`
  }
  finally {
    isLoading.value = false
  }
}

function toggleItem(id: string) {
  selectedItemId.value = selectedItemId.value === id ? null : id
}

// --- Data Processing ---

async function processCacheData(fileList: File[]) {
  const fileTree: Record<string, File[]> = {}
  for (const file of fileList) {
    const pathParts = (file as any).webkitRelativePath.split('/')
    if (pathParts.length < 2)
      continue
    const rootDir = pathParts[1]
    if (!fileTree[rootDir])
      fileTree[rootDir] = []
    fileTree[rootDir].push(file)
  }

  const processedItems: CacheItem[] = []
  for (const dirName in fileTree) {
    if (!dirName.startsWith('models--') && !dirName.startsWith('datasets--'))
      continue
    const itemFiles = fileTree[dirName]
    const { type, name } = parseName(dirName)
    let totalSize = 0
    let snapshot: string | undefined
    let architectures: string[] | undefined
    let itemError: string | undefined
    try {
      const blobFiles = itemFiles.filter(f => (f as any).webkitRelativePath.includes('/blobs/'))
      totalSize = blobFiles.reduce((sum, f) => sum + f.size, 0)
      const refFile = itemFiles.find(f => (f as any).webkitRelativePath.endsWith('/refs/main'))
      if (refFile)
        snapshot = (await refFile.text()).trim()
      if (snapshot && type === 'model') {
        const configFile = itemFiles.find(f => (f as any).webkitRelativePath.includes(`/snapshots/${snapshot}/config.json`))
        if (configFile) {
          const configJson = JSON.parse(await configFile.text())
          architectures = configJson.architectures || ['Not specified']
        }
      }
    }
    catch (e: any) { itemError = e.message }
    processedItems.push({ id: dirName, type, name, path: dirName, size: totalSize, snapshot, architectures, error: itemError })
  }
  return processedItems.sort((a, b) => b.size - a.size)
}

// --- Utility Functions ---

function getHuggingFaceUrl(item: CacheItem) {
  const base = 'https://huggingface.co'
  return item.type === 'dataset' ? `${base}/datasets/${item.name}` : `${base}/${item.name}`
}

function getActualPath(item: CacheItem) {
  if (!item.snapshot)
    return null
  return `${item.path}/snapshots/${item.snapshot}`
}

function parseName(dirName: string): { type: CacheItem['type'], name: string } {
  if (dirName.startsWith('models--'))
    return { type: 'model', name: dirName.substring('models--'.length).replace(/--/g, '/') }
  if (dirName.startsWith('datasets--'))
    return { type: 'dataset', name: dirName.substring('datasets--'.length).replace(/--/g, '/') }
  return { type: 'unknown', name: dirName }
}

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes)
    return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`
}
</script>

<template>
  <div class="h-full max-w-7xl w-full flex flex-col gap-6 p-4 lg:p-8 sm:p-6">
    <!-- Initial State: Directory Selector -->
    <div v-if="cacheItems.length === 0 && !isLoading" class="h-full flex flex-1 flex-col items-center justify-center gap-4">
      <p class="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Drop your <code class="rounded bg-neutral-200 p-1 dark:bg-neutral-800">.cache/huggingface/hub</code> directory below to get started.
      </p>
      <label
        class="relative h-full max-w-4xl min-h-[200px] w-full flex flex-col cursor-pointer items-center justify-center border-2 rounded-xl border-dashed p-6 opacity-95 shadow-sm transition-all duration-300 hover:shadow-md"
        :class="[isDragging ? 'border-primary-400 bg-primary-50/5 dark:border-primary-600 dark:bg-primary-900/5' : 'border-neutral-100 bg-white/60 hover:border-primary-300 dark:border-neutral-700 dark:bg-black/30 dark:hover:border-primary-700']"
        @dragover.prevent="isDragging = true" @dragleave.prevent="isDragging = false" @drop.prevent="onDrop"
      >
        <input type="file" webkitdirectory class="absolute inset-0 h-full w-full opacity-0" @change="onFileSelect">
        <div class="pointer-events-none flex flex-col items-center" :class="[isDragging ? 'text-primary-500 dark:text-primary-400' : 'text-neutral-400 dark:text-neutral-500']">
          <div class="i-solar:upload-square-line-duotone mb-2 text-5xl" />
          <p class="text-center text-lg font-medium">Select or Drop Directory</p>
          <p class="text-center text-sm">{{ isDragging ? 'Release to upload' : 'Click to select the "hub" folder' }}</p>
        </div>
      </label>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div class="i-solar:hourglass-line-duotone mx-auto animate-spin text-4xl text-primary-500" />
      <p class="mt-4 text-neutral-600 dark:text-neutral-400">
        Processing directory...
      </p>
    </div>

    <!-- Error State -->
    <div v-if="error" class="border-l-4 border-red-500 rounded bg-red-100 p-4 text-red-700" role="alert">
      <p class="font-bold">
        Error
      </p>
      <p>{{ error }}</p>
    </div>

    <!-- Results State -->
    <div v-if="cacheItems.length > 0" class="flex flex-col gap-4">
      <div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div max-w-full w-full>
          <label flex="~ col gap-1" w-full>
            <Input
              v-model="searchTerm"
              placeholder="Search..."
              class="w-full"
              :required="false"
            />
            <div class="w-full whitespace-nowrap text-right text-sm text-neutral-400 sm:w-auto dark:text-neutral-700">
              Found <strong>{{ filteredItems.length }}</strong> items. Total size: <strong>{{ formatBytes(totalSize) }}</strong>
            </div>
          </label>
        </div>
      </div>

      <div v-auto-animate class="grid grid-cols-1 gap-2 2xl:grid-cols-3 sm:grid-cols-2" max-h="80dvh" overflow-y-auto>
        <div
          v-for="item in filteredItems" :key="item.id"
          class="flex flex-col overflow-hidden border border-2 border-neutral-100 rounded-xl bg-neutral-200/50 shadow-sm transition-all duration-200 dark:border-neutral-800 hover:border-primary-300 dark:bg-neutral-900/50 hover:shadow-md dark:hover:border-primary-700"
        >
          <div class="flex-grow rounded-b-xl bg-neutral-900 bg-white p-3" @click="toggleItem(item.id)">
            <div class="relative cursor-pointer gap-3">
              <div class="min-w-0 flex flex-1 flex-col gap-2">
                <!-- Line 1: Category Icon & Badge -->
                <div class="flex items-center gap-1">
                  <div class="flex-shrink-0">
                    <div v-if="item.type === 'model'" class="i-solar:box-minimalistic-bold-duotone text-xl text-blue-500" />
                    <div v-else-if="item.type === 'dataset'" class="i-solar:database-bold-duotone text-xl text-green-500" />
                  </div>
                  <span :class="{ 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300': item.type === 'model', 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300': item.type === 'dataset' }" class="rounded-full px-2.5 py-1 text-xs font-semibold capitalize">{{ item.type }}</span>
                </div>

                <!-- Line 2: Model ID & Actions -->
                <div class="grid grid-cols-[1fr_auto] min-w-0 gap-2 pl-7">
                  <p class="truncate text-sm text-neutral-800 font-mono dark:text-neutral-200" :title="item.name">
                    {{ item.name }}
                  </p>
                  <div class="flex flex-shrink-0 items-center gap-2">
                    <button v-if="isSupported" title="Copy ID" class="text-neutral-400 transition-colors hover:text-primary-500 dark:hover:text-primary-400" @click.stop="copy(item.name)">
                      <div v-if="copied && copiedText === item.name" class="i-solar:check-read-line-duotone text-green-500" />
                      <div v-else class="i-solar:copy-bold-duotone" />
                    </button>
                    <a :href="getHuggingFaceUrl(item)" target="_blank" rel="noopener noreferrer" title="Open on Hugging Face" class="text-neutral-400 transition-colors hover:text-primary-500 dark:hover:text-primary-400" @click.stop>
                      <div class="i-solar:square-arrow-right-up-line-duotone" />
                    </a>
                  </div>
                </div>

                <!-- Line 3: Metadata Chips -->
                <div class="flex flex-wrap items-center gap-2 pl-7 text-xs text-neutral-600 dark:text-neutral-400">
                  <div class="flex items-center gap-1.5">
                    <div class="i-solar:diskette-line-duotone" />
                    <span>{{ formatBytes(item.size) }}</span>
                  </div>
                  <div v-if="item.type === 'model' && item.architectures?.[0] && item.architectures[0] !== 'Not specified'" class="min-w-0 flex items-center gap-1.5 rounded-full bg-neutral-100 px-2 py-1 dark:bg-neutral-800" :title="item.architectures[0]">
                    <div class="i-solar:cpu-bolt-line-duotone" />
                    <span class="truncate">{{ item.architectures[0] }}</span>
                  </div>
                  <div v-if="item.error" class="flex items-center gap-1.5 rounded-full bg-red-100 px-2 py-1 text-red-600 font-medium dark:bg-red-900/50 dark:text-red-300">
                    <div class="i-solar:danger-triangle-line-duotone" />
                    <span>Error</span>
                  </div>
                  <div class="i-solar:alt-arrow-down-linear text-neutral-500 transition-transform duration-200" :class="{ 'rotate-180': selectedItemId === item.id }" />
                </div>
              </div>
            </div>
          </div>

          <TransitionVertical>
            <div v-if="selectedItemId === item.id" class="px-4 py-3 text-xs dark:border-neutral-800">
              <div class="grid grid-cols-1 gap-x-4 gap-y-2">
                <!-- Symlink Path -->
                <div class="grid grid-cols-[max-content_1fr_auto] items-center gap-x-2">
                  <strong class="text-neutral-600 dark:text-neutral-400">Symlink Path:</strong>
                  <code class="truncate break-all font-mono" :title="item.path">{{ item.path }}</code>
                  <button v-if="isSupported" title="Copy Symlink Path" class="text-neutral-400 transition-colors hover:text-primary-500 dark:hover:text-primary-400" @click.stop="copy(item.path)">
                    <div v-if="copied && copiedText === item.path" class="i-solar:check-read-line-duotone text-green-500" />
                    <div v-else class="i-solar:copy-bold-duotone" />
                  </button>
                </div>
                <!-- Actual Path -->
                <div v-if="getActualPath(item)" class="grid grid-cols-[max-content_1fr_auto] items-center gap-x-2">
                  <strong class="text-neutral-600 dark:text-neutral-400">Actual Path:</strong>
                  <code class="truncate break-all font-mono" :title="getActualPath(item) || ''">{{ getActualPath(item) }}</code>
                  <button v-if="isSupported" title="Copy Actual Path" class="text-neutral-400 transition-colors hover:text-primary-500 dark:hover:text-primary-400" @click.stop="copy(getActualPath(item) || '')">
                    <div v-if="copied && copiedText === getActualPath(item)" class="i-solar:check-read-line-duotone text-green-500" />
                    <div v-else class="i-solar:copy-bold-duotone" />
                  </button>
                </div>
                <!-- Snapshot -->
                <div class="grid grid-cols-[max-content_1fr] items-center gap-x-2">
                  <strong class="text-neutral-600 dark:text-neutral-400">Snapshot:</strong>
                  <code v-if="item.snapshot" class="break-all font-mono">{{ item.snapshot }}</code>
                  <span v-else class="text-neutral-500">N/A</span>
                </div>
                <!-- Architectures -->
                <template v-if="item.type === 'model'">
                  <div class="grid grid-cols-[max-content_1fr] items-start gap-x-2">
                    <strong class="text-neutral-600 dark:text-neutral-400">Architectures:</strong>
                    <div>
                      <ul v-if="item.architectures && item.architectures[0] !== 'Not specified'" class="list-disc list-inside">
                        <li v-for="arch in item.architectures" :key="arch" class="font-mono">
                          {{ arch }}
                        </li>
                      </ul>
                      <span v-else class="text-neutral-500">config.json not found or empty</span>
                    </div>
                  </div>
                </template>
                <!-- Error -->
                <template v-if="item.error">
                  <div class="grid grid-cols-[max-content_1fr] items-start gap-x-2">
                    <strong class="text-red-500">Error Details:</strong>
                    <p class="text-red-500 font-mono">
                      {{ item.error }}
                    </p>
                  </div>
                </template>
              </div>
            </div>
          </TransitionVertical>
        </div>
      </div>
    </div>

    <!-- Floating Action Button -->
    <button
      v-if="cacheItems.length > 0" class="fixed bottom-6 right-6 z-50 h-14 w-14 flex items-center justify-center border-2 border-neutral-100 rounded-xl border-solid bg-white/10 text-neutral-900 backdrop-blur-md transition-transform duration-200 hover:scale-105 dark:border-transparent dark:bg-neutral-900/80 hover:bg-primary-200/20 dark:text-white dark:shadow-lg focus:outline-none focus:ring-4 focus:ring-primary-300 dark:hover:bg-neutral-900/90 dark:focus:ring-primary-800"
      title="Select another directory"
      @click="triggerFileSelect"
    >
      <div class="i-solar:folder-with-files-line-duotone text-2xl" />
    </button>
    <input ref="fileInputRef" type="file" webkitdirectory class="hidden" @change="onFileSelect">
  </div>
</template>
