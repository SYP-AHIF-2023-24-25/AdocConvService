<script lang="ts" setup>
import Dropdown from 'v-dropdown'
import SandwichMenuSVG from '@/components/icons/SandwichMenuSVG.vue'
import SandwichMenuDarkModeSVG from '@/components/icons/SandwichMenuDarkModeSVG.vue'
import { useDarkModeStore } from '@/stores/dark-mode'
import { useOverlayStateStore } from '@/stores/overlay-state'
import { useCurrentFileStore } from '@/stores/current-file'
import { useCurrentUserStore } from '@/stores/current-user'
import { showInfoNotifFromObj } from '@/scripts/show-notif'
import { ensureLoggedIn } from '@/scripts/ensure-logged-in'
import { interceptErrors } from '@/errors/handler/error-handler'
import { useLoadingStore } from '@/stores/loading'
import constants from '@/plugins/constants'
import { useRouter } from 'vue-router'
import { ref } from 'vue'
import { createEditorRemoteFileConnection } from '@/scripts/editor/file'
import { handleCopy } from '@/scripts/handle-copy'
import { openInNewWindow } from '@/router/open'
import * as phoenixBackend from '@/services/phoenix/api-service'

const darkModeStore = useDarkModeStore()
const currentUserStore = useCurrentUserStore()
const currentFileStore = useCurrentFileStore()
const overlayStateStore = useOverlayStateStore()
const loadingStore = useLoadingStore()

const dropdown = ref(null)
const $router = useRouter()

function closeDropdown() {
  ;(
    dropdown.value as {
      close: () => void
    } | null
  )?.close()
}

function handleNewFileButtonClick() {
  closeDropdown()
  openInNewWindow($router, { name: 'local-editor', query: { new: 'true' } })
}

async function handleSaveButtonClick() {
  closeDropdown()

  // Indicates whether this is a new file or an existing file
  const wasAlreadyUploaded = !!currentFileStore.fileId

  loadingStore.lockLoading()
  loadingStore.pushMsg(
    wasAlreadyUploaded
      ? constants.loadingMessages.savingFileName
      : constants.loadingMessages.uploadingFile,
  )
  try {
    await interceptErrors(
      ensureLoggedIn($router).then(
        async () => await currentFileStore.storeOnServer(currentUserStore.bearer!),
      ),
    )
    if (wasAlreadyUploaded) {
      showInfoNotifFromObj(constants.notifMessages.fileSaved)
      loadingStore.popMsg(constants.loadingMessages.savingFileName)
    } else {
      // Set the path to the editor for remote files (won't cause a real reload but simply change the path)
      await $router.push({
        name: 'remote-editor',
        params: { fileId: currentFileStore.fileId },
      })

      showInfoNotifFromObj(constants.notifMessages.fileUploaded)
      loadingStore.popMsg(constants.loadingMessages.uploadingFile)
      loadingStore.pushMsg(constants.loadingMessages.loadingEditor)

      // Ensure the phoenix backend is reachable and create a connection to the remote SDS server
      await phoenixBackend.ensurePhoenixBackendIsReachable()
      await createEditorRemoteFileConnection()

      loadingStore.popMsg(constants.loadingMessages.loadingEditor)
    }
  } catch (e) {
    loadingStore.unlockLoading()
    throw e
  }
  loadingStore.unlockLoading()
}

let copyButtonTimeout: null | ReturnType<typeof setTimeout> = null
const copyButtonContent = ref('Copy')

function handleCopyButtonClick() {
  handleCopy(currentFileStore.content)
  copyButtonContent.value = 'Copied!'
  if (copyButtonTimeout) {
    clearTimeout(copyButtonTimeout)
  }
  copyButtonTimeout = setTimeout(() => {
    copyButtonContent.value = 'Copy'
  }, 1000)
}

function handleDownloadButtonClick() {
  overlayStateStore.setExportView(true)
}

function handleShareButtonClick() {
  overlayStateStore.setShareUrlView(true)
}

function handleCurrentChannelClick() {
  overlayStateStore.setCurrentChannel(true)
  closeDropdown()
}

function handleSettingsClick() {
  overlayStateStore.setSettings(true)
  closeDropdown()
}
</script>

<template>
  <Dropdown ref="dropdown">
    <template #trigger="{ visible }">
      <!-- @vue-expect-error The types from the library seem to be wrong. Property "visible" can only be used when
      "value" is also used.
      -->
      <button
        id="sandwich-menu-button"
        :class="{ highlighted: visible.value }"
        class="sandwich-button"
      >
        <SandwichMenuDarkModeSVG v-show="darkModeStore.darkMode" />
        <SandwichMenuSVG v-show="!darkModeStore.darkMode" />
      </button>
    </template>
    <div
      id="dropdown-elements"
      v-tooltip="{
        theme: {
          placement: 'top',
          offset: ['left'],
        },
      }"
    >
      <div class="dropdown-element" @click="handleCopyButtonClick()">{{ copyButtonContent }}</div>
      <div
        class="dropdown-element"
        @click="handleNewFileButtonClick()"
        v-tooltip="'Create a new file for another project'"
      >
        New File
      </div>
      <div
        class="dropdown-element"
        v-if="!currentFileStore.shareFile"
        @click="handleSaveButtonClick()"
        v-tooltip="currentFileStore.remoteFile ? 'Update File Name' : 'Upload your file'"
      >
        {{ currentFileStore.remoteFile ? 'Update File Name' : 'Save Remotely' }}
      </div>
      <div
        v-if="!currentFileStore.shareFile"
        class="dropdown-element"
        @click="handleShareButtonClick()"
        v-tooltip="'Share your file with others'"
      >
        Share...
      </div>
      <div
        class="dropdown-element"
        @click="handleDownloadButtonClick()"
        v-tooltip="'Export source code or presentation'"
      >
        Export...
      </div>
      <div
        class="dropdown-element"
        @click="handleCurrentChannelClick()"
        v-tooltip="'View channel info & server info'"
      >
        Current Channel
      </div>
      <div class="dropdown-element" @click="handleSettingsClick()">File Settings</div>
    </div>
  </Dropdown>
</template>

<style lang="scss" scoped>
@use '@/assets/core/var' as var;
@use '@/assets/core/mixins/link-hover-presets' as *;

#dropdown-elements {
  width: 200px;
  background-color: var.$overlay-background-color;
  box-shadow: 0 0 10px 0 var.$box-shadow-color;

  &,
  * {
    overflow: visible;
    z-index: 100;
  }

  @media (max-width: 600px) {
    width: calc(100vw - 2rem);
    padding: 1rem;
  }

  .dropdown-element {
    @include link-hover-presets-with-background;
    padding: 0.6rem 0.6rem 0.6rem 1rem;
    cursor: pointer;

    // We add a border except for the last element
    &:not(:last-child) {
      border-bottom: 1px solid #e0e0e0;
    }
  }
}
</style>
