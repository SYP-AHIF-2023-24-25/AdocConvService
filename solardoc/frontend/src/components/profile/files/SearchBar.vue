<script lang="ts" setup>
import { ref } from 'vue'
import SandwichMenuDarkModeSVG from '@/components/icons/SandwichMenuDarkModeSVG.vue'
import SandwichMenuSVG from '@/components/icons/SandwichMenuSVG.vue'
import { useDarkModeStore } from '@/stores/dark-mode'

const darkModeStore = useDarkModeStore()

const searchQuery = ref('')
</script>

<template>
  <div id="file-searchbar">
    <input
      v-model="searchQuery"
      placeholder="Search..."
      @input="$emit('searchQueryUpdate', searchQuery)"
      type="search"
    />
    <button id="sandwich-menu-button" class="sandwich-button">
      <SandwichMenuDarkModeSVG v-show="darkModeStore.darkMode" />
      <SandwichMenuSVG v-show="!darkModeStore.darkMode" />
    </button>
  </div>
</template>

<style lang="scss" scoped>
@use '@/assets/core/var' as var;
@use '@/assets/core/mixins/hover-background' as *;

#file-searchbar {
  display: flex;
  flex: 0 1;
  padding: var.$searchbar-padding;
  justify-content: space-evenly;
  flex-direction: row;
  width: 100%;
  height: var.$searchbar-height;

  input {
    padding: var.$searchbar-inner-padding;
    color: var.$text-color;
    cursor: pointer;
    background-color: var.$searchbar-background;
    border-color: transparent;
    flex-grow: 1;
    border-radius: var.$searchbar-border-radius;
    min-width: 0;

    &:hover {
      @include hover-background;
    }

    &:focus {
      outline: none;
    }
  }

  #sandwich-menu-button {
    margin: var.$searchbar-sandwich-margin;
    padding: var.$searchbar-sandwich-padding;
    height: var.$searchbar-sandwich-size;
    width: var.$searchbar-sandwich-size;

    svg {
      height: var.$searchbar-sandwich-svg-size;
      width: var.$searchbar-sandwich-svg-size;
    }
  }
}
</style>
