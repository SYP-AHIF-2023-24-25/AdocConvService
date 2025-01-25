import { useCurrentFileStore } from '@/stores/current-file'
import { useCurrentUserStore } from '@/stores/current-user'
import { useEditorUpdateWSClient } from '@/stores/editor-update-ws-client'
import { useOverlayStateStore } from '@/stores/overlay-state'
import { connectToWSIfPossible } from '@/scripts/editor/sds'
import { createOrJoinChannelForFile } from '@/scripts/editor/channel'
import { useLoadingStore } from '@/stores/loading'
import { useRenderDataStore } from '@/stores/render-data'
import type { File } from '@/services/phoenix/gen/phoenix-rest-service'
import type { Router } from 'vue-router'
import { usePreviewLoadingStore } from '@/stores/preview-loading'
import { useInitStateStore } from '@/stores/init-state'

const currentFileStore = useCurrentFileStore()
const currentUserStore = useCurrentUserStore()
const editorUpdateWSClient = useEditorUpdateWSClient()
const loadingStore = useLoadingStore()
const renderDataStore = useRenderDataStore()
const previewLoadingStore = usePreviewLoadingStore()
const overlayStateStore = useOverlayStateStore()
const initStateStore = useInitStateStore()

/**
 * Opens a file in the editor.
 * @param $router The router to use to redirect to the editor.
 * @param file The file to open up.
 * @since 1.0.0
 */
export async function openFileInEditor($router: Router, file: File): Promise<void> {
  loadingStore.setLoading(true)
  await closeEditorRemoteFileConnection()

  // We set the file but to ensure consistency we need to make sure we fetch the newest version if there is one
  currentFileStore.setFile(file)
  await currentFileStore.fetchNewestRemoteFileVersionIfPossible(currentUserStore.bearer!)

  initStateStore.setInit(true)
  previewLoadingStore.setPreviewLoading(false)
  renderDataStore.clear()
  await $router.push('/editor')
}

/**
 * Close the current remote file connection and resets all file-related stores.
 *
 * If there was no websocket connection, we will still reset the file store just to be safe.
 * @returns True if the connection was closed, false otherwise. (e.g. no connection was present)
 * @since 0.7.0
 */
export async function closeEditorRemoteFileConnection(): Promise<boolean> {
  overlayStateStore.resetAll()
  await currentFileStore.closeFileGlobally()
  if (editorUpdateWSClient.wsClient) {
    await editorUpdateWSClient.disconnectWSClient()
    return true
  }
  return false
}

/**
 * Create a new remote file connection and populates the channel store.
 * @returns True if the connection was successful, false otherwise. (e.g. no file or user is present which is required
 * for the connection)
 * @since 0.7.0
 */
export async function createEditorRemoteFileConnection(): Promise<boolean> {
  overlayStateStore.resetAll()
  const sdsConnected = await connectToWSIfPossible()
  if (
    sdsConnected &&
    currentFileStore.remoteFile &&
    currentFileStore.raw &&
    currentUserStore.currentUser
  ) {
    await currentFileStore.fetchNewestRemoteFileVersionIfPossible(currentUserStore.bearer!)
    await createOrJoinChannelForFile(
      <File>currentFileStore.raw, // Since this is a remote file we know it's not a LocalFile
      currentUserStore.bearer!,
      currentFileStore.shareURLId,
    )
    return true
  } else {
    return false
  }
}
