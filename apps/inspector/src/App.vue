<script setup lang="ts">
import { useDark, useToggle } from '@vueuse/core'
import { RouterView } from 'vue-router'

const isDark = useDark()
const toggleDark = useToggle(isDark)
</script>

<template>
  <div relative h-full max-h="100dvh" w-full flex flex-col items-center overflow-y-hidden>
    <div bg="white dark:neutral-900" class="border-2 border-neutral-100 border-solid dark:border-transparent" fixed top-4 z-100 h-fit w-fit flex items-center gap-8 rounded-xl px-4 py-2 shadow="none dark:lg">
      <div flex items-center gap-2 text-center>
        <img src="/favicon.svg" class="h-6 w-6">
        <div>
          HuggingFace Inspector
        </div>
      </div>
      <div flex justify-end gap-2>
        <a href="https://github.com/moeru-ai/huggingface-inspector" decoration-none outline-none>
          <div
            i-simple-icons:github
            transition="all duration-300 ease-in-out"
            class="text-primary"
          />
        </a>
        <button text-lg outline-none @click="() => toggleDark()">
          <div
            v-if="isDark"
            i-solar:moon-stars-bold-duotone
            transition="all duration-300 ease-in-out"
            text-primary
          />
          <div
            v-else
            i-solar:sun-bold
            transition="all duration-300 ease-in-out"
            text-primary
          />
        </button>
      </div>
    </div>
    <div mt-12 h-full w-full flex flex-col items-center gap-2>
      <RouterView />
    </div>
  </div>
</template>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
  overscroll-behavior: none;
}

html {
  transition: all 0.3s ease-in-out;
  background: white;
}

html.dark {
  color-scheme: dark;
  background: #212121;
}
</style>
