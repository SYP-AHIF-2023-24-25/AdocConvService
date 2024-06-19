import { defineStore } from 'pinia'
import { SDSClient } from '@/services/phoenix/ws-client'
import type { EditorChannel } from '@/services/phoenix/editor-channel'

export const useEditorUpdateWSClient = defineStore('editorUpdateWSClient', {
  state: () => {
    return {
      wsClient: <undefined | SDSClient>undefined,
      currentChannel: <EditorChannel | undefined>undefined,
    }
  },
  getters: {
    hasActiveChannelConnection(): boolean {
      return this.wsClient?.channelHealthy ?? false
    },
  },
  actions: {
    createWSClient(url: string, userToken?: string, onOpen?: () => Promise<void>) {
      return (this.wsClient = new SDSClient(url, userToken, onOpen))
    },
    disconnectWSClient() {
      if (this.wsClient) {
        this.wsClient.disconnect()
        this.wsClient = undefined
      }
    },
    setCurrentChannel(channel: EditorChannel) {
      this.currentChannel = channel
    },
    resetCurrentChannel() {
      this.currentChannel = undefined
    },
  },
})
