<script setup lang="ts">
import { useRenderDataStore } from '@/stores/render-data'
import { usePreviewLoadingStore } from '@/stores/preview-loading'
import { usePreviewSelectedSlideStore } from '@/stores/preview-selected-slide'
import { storeToRefs } from 'pinia'

defineProps({
  slideIndex: {
    type: Number,
    required: true,
  },
  subSlideIndex: {
    type: Number,
    required: true,
  },
})

const renderDataStore = useRenderDataStore()
const previewLoadingStore = usePreviewLoadingStore()
const previewSelectedSlide = usePreviewSelectedSlideStore()

const { previewURL } = storeToRefs(renderDataStore)
</script>

<template>
  <div
    :id="'slide-manager-sub-slide-preview-' + slideIndex + '-' + subSlideIndex"
    :class="`slide-manager-sub-slide-preview ${previewLoadingStore.previewLoading ? 'loading' : ''}`"
    @click="previewSelectedSlide.setSlide(slideIndex, true, subSlideIndex)"
  >
    <h2 id="loading-wrapper" v-if="previewLoadingStore.previewLoading">
      <span class="dot-dot-dot-flashing"></span>
    </h2>
    <template v-else>
      <p id="slide-index">{{ slideIndex + 1 }}.{{ subSlideIndex + 1 }}</p>
      <iframe
        :src="`${previewURL}?static=true&slide=${slideIndex}/${subSlideIndex + 1}#/${slideIndex}/${
          subSlideIndex + 1
        }`"
      ></iframe>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/core/mixins/screen-size' as *;
@use '@/assets/core/mixins/align-center' as *;
@use '@/assets/core/var' as var;

.slide-manager-sub-slide-preview {
  flex: 0 0 auto;
  margin: 0 0 var.$editor-slides-manager-sub-slides-navigator-list-element-margin 0;
  position: relative;
  overflow: hidden;
  border-radius: 0.5rem;

  $width: calc(100vw - 2 * var(--editor-slides-manager-sub-slides-navigator-list-element-margin));
  height: calc($width / 2);
  width: $width;
  @include r-min(var.$window-medium) {
    margin: 0 var.$editor-slides-manager-sub-slides-navigator-list-element-margin 0 0;
    height: var.$editor-slides-manager-sub-slides-navigator-list-element-height;
    width: var.$editor-slides-manager-sub-slides-navigator-list-element-width;
  }

  &:last-child {
    margin: 0;
  }

  &:hover {
    cursor: pointer;
    border: 3px solid var.$scheme-cs-2;
  }

  &:active {
    transform: scale(0.99);
  }

  &.loading {
    @include align-center;
    border: 2px solid var.$scheme-cs-2;
  }

  #slide-index {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    z-index: 1;
    color: rgba(255, 255, 255, 0.6);
  }

  iframe {
    width: 100%;
    height: 100%;
    border: none;

    &,
    & * {
      overflow: hidden !important;
      pointer-events: none !important;
    }
  }
}
</style>
