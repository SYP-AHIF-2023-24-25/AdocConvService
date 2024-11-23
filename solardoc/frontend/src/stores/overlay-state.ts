import { defineStore } from 'pinia'

export const useOverlayStateStore = defineStore('fullScreenPreview', {
  state: () => {
    return {
      fullScreenPreview: false,
      currentChannel: false,
      createShareUrl: false,
      settings: false,
      exportView: false,
    }
  },
  actions: {
    setFullScreenPreview(fullScreenPreview: boolean) {
      this.resetAll()
      this.fullScreenPreview = fullScreenPreview
    },
    setCurrentChannel(currentChannel: boolean) {
      this.resetAll()
      this.currentChannel = currentChannel
    },
    setShareUrlView(createShareUrl: boolean) {
      this.resetAll()
      this.createShareUrl = createShareUrl
    },
    setSettings(settings: boolean) {
      this.resetAll()
      this.settings = settings
    },
    setExportView(exportView: boolean) {
      this.resetAll()
      this.exportView = exportView
    },
    resetAll() {
      this.currentChannel = false
      this.createShareUrl = false
      this.fullScreenPreview = false
      this.settings = false
      this.exportView = false
    },
  },
})
