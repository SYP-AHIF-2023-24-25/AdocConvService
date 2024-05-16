import { defineStore } from 'pinia'
import type {
  OTrans,
  OTransReqDto,
  OTransRespDto,
  RawDeleteOTrans,
  RawInsertOTrans,
} from '@/services/phoenix/ot-trans'
import type { File } from '@/services/phoenix/api-service'
import * as phoenixRestService from '@/services/phoenix/api-service'
import {
  type ActualPhxErrorResp,
  PhoenixBadRequestError,
  PhoenixInternalError,
  PhoenixNotAuthorisedError,
} from '@/services/phoenix/errors'
import constants from '@/plugins/constants'
import { v4 as uuidv4 } from 'uuid'

export type Unknown = null
export type NoPermissions = 0
export type ReadPermission = 1
export type WritePermission = 3
export type Permission = Unknown | NoPermissions | ReadPermission | WritePermission
export const Permissions = {
  Unknown: null,
  None: 0,
  Read: 1,
  Write: 3,
} as const satisfies {[key: string]: Permission}

export const useCurrentFileStore = defineStore('currentFile', {
  state: () => {
    const storedFileId = localStorage.getItem(constants.localStorageFileIdKey)
    const storedFileOwner = localStorage.getItem(constants.localStorageFileOwnerKey)
    let storedFileName = localStorage.getItem(constants.localStorageFileNameKey)
    let storedFileContent = localStorage.getItem(constants.localStorageFileContentKey)
    let localStorageLastModified = localStorage.getItem(constants.localStorageLastModifiedKey)
    let storedPermissions = localStorage.getItem(constants.localStorageFilePermissionsKey)

    // Ensure the default is populated if the stored content is empty or the file name is empty
    if (!storedFileName || storedFileName === '') {
      storedFileName = constants.defaultFileName
      localStorage.setItem(constants.localStorageFileNameKey, constants.defaultFileName)
    }

    if (!storedFileContent || storedFileContent === '') {
      storedFileContent = constants.defaultFileContent
      localStorage.setItem(constants.localStorageFileContentKey, constants.defaultFileContent)
    }

    if (!localStorageLastModified) {
      localStorageLastModified = new Date().toISOString()
      localStorage.setItem(constants.localStorageLastModifiedKey, localStorageLastModified)
    }

    if (!storedPermissions) {
      storedPermissions = null
      localStorage.setItem(constants.localStorageFilePermissionsKey, "")
    }

    return {
      fileId: <string | undefined>storedFileId || undefined,
      fileName: storedFileName,
      ownerId: storedFileOwner || undefined,
      saveState: storedFileId ? constants.saveStates.server : constants.saveStates.local,
      content: storedFileContent,
      permissions: <Permission>(storedPermissions ? parseInt(storedPermissions) : null),
      oTransStack: new Map<string, OTrans>(),
      oTransNotAcked: new Map<string, OTransReqDto>(),
      lastTrans: <OTrans | undefined>undefined,
      lastModified: new Date(localStorageLastModified),
    }
  },
  getters: {
    /**
     * Returns true if a remotely opened file is currently being edited.
     * @since 0.6.0
     */
    remoteFileOpened(): boolean {
      return this.fileId !== undefined
    },
  },
  actions: {
    ensureUserIsAuthorisedForFile(userId: string) {
      if (!this.fileId || !this.ownerId) {
        this.clearFileId()
        this.clearOwnerId()
        this.setOnlineSaveState(false) // For safety
        return
      }

      if (this.ownerId !== userId) {
        this.closeFile()
      }
    },
    async storeOnServer(bearer: string) {
      if (this.fileId === undefined) {
        await this.createFile(bearer)
      } else {
        await this.updateFile(bearer)
      }
      this.setOnlineSaveState(true)
    },
    async createFile(bearer: string) {
      let resp: Awaited<ReturnType<typeof phoenixRestService.postV1Files>>
      try {
        resp = await phoenixRestService.postV1Files(bearer, {
          file_name: this.fileName,
          content: this.content,
        })
      } catch (e) {
        throw new PhoenixInternalError(
          'Critically failed to create file. Cause: ' + (<Error>e).message,
        )
      }

      if (resp.status === 201) {
        this.setFileId(resp.data.id)
        this.setOwnerId(resp.data.owner_id)
      } else if (resp.status === 400) {
        throw new PhoenixBadRequestError(
          `Server rejected request to create and upload file`,
          resp.data as ActualPhxErrorResp,
        )
      } else if (resp.status === 401) {
        throw new PhoenixNotAuthorisedError('Server rejected request to create and upload file')
      }
    },
    async updateFile(bearer: string) {
      if (this.fileId === undefined) {
        return await this.createFile(bearer)
      }

      let resp: Awaited<ReturnType<typeof phoenixRestService.putV1FilesById>>
      try {
        resp = await phoenixRestService.putV1FilesById(bearer, this.fileId, {
          file_name: this.fileName,
          content: this.content,
        })
      } catch (e) {
        throw new PhoenixInternalError(
          'Critically failed to put file. Cause: ' + (<Error>e).message,
        )
      }

      if (resp.status === 400) {
        throw new PhoenixBadRequestError(
          'Server rejected request to save file',
          resp.data as ActualPhxErrorResp,
        )
      } else if (resp.status === 401) {
        throw new PhoenixNotAuthorisedError('Server rejected request to save file')
      }
    },
    initOTransStackFromServerTrans(initOTransDto: OTransRespDto) {
      this.clearOTransStack()
      this.pushOTrans({
        ...initOTransDto,
        acknowledged: true,
        init: true,
      })
    },
    /**
     * "Pushes" an OTrans object to the {@link oTransStack stack of transformations}.
     *
     * This will also modify the {@link lastTrans}.
     * @param oTrans The OTrans object to push.
     * @since 0.5.0
     * @see lastTrans
     * @see oTransStack
     */
    pushOTrans(oTrans: OTrans) {
      this.lastTrans = oTrans
      this.oTransStack.set(oTrans.id, oTrans)
    },
    /**
     * "Pushes" an OTrans to the {@link oTransStack stack of transformations}.
     *
     * This will check whether a current transformation is waiting to be acknowledged and if so, it will update that
     * transaction with the timestamp and then push the new transformation to the stack.
     * @param oTrans The OTrans object to push.
     * @since 0.5.0
     */
    pushOTransResp(oTrans: OTransRespDto) {
      const oTransWaiting = this.oTransNotAcked.get(oTrans.id)
      if (oTransWaiting) {
        const ackedTrans: OTrans = {
          ...oTransWaiting,
          user_id: oTrans.user_id,
          timestamp: oTrans.timestamp,
          acknowledged: true,
          init: false,
        }
        this.pushOTrans(ackedTrans)
      } else {
        // This is a new transformation
        const newTrans: OTrans = {
          ...oTrans,
          acknowledged: true,
          init: false,
        }
        this.pushOTrans(newTrans)

        // Perform the transformation on the current content
        if (oTrans.trans.type === 'insert') {
          this.setContent(
            this.content.slice(0, oTrans.trans.pos) +
            oTrans.trans.content +
            this.content.slice(oTrans.trans.pos)
          )
        } else if (oTrans.trans.type === 'delete') {
          this.setContent(
            this.content.slice(0, oTrans.trans.pos) +
            this.content.slice(oTrans.trans.pos + oTrans.trans.length)
          )
        }
      }
    },
    /**
     * Pushes an OTrans to the stack of transformations which are not yet acknowledged, but have been already applied
     * to the content.
     * @param oTrans The OTrans object to push.
     * @since 0.5.0
     */
    pushOTransReq(oTrans: OTransReqDto) {
      this.oTransNotAcked.set(oTrans.id, oTrans)
    },
    /**
     * Creates an OTrans object which represents a change to the content.
     * @param insertOrDeleteTrans The raw insert or delete OTrans.
     * @returns The OTrans object.
     * @since 0.5.0
     */
    createOTrans(insertOrDeleteTrans: RawInsertOTrans | RawDeleteOTrans): OTransReqDto {
      return {
        id: uuidv4(),
        trans: insertOrDeleteTrans,
      }
    },
    createInsertOTrans(pos: number, content: string): OTransReqDto {
      return this.createOTrans({ type: 'insert', pos, content })
    },
    createDeleteOTrans(pos: number, length: number): OTransReqDto {
      return this.createOTrans({ type: 'delete', pos, length })
    },
    setOnlineSaveState(value: boolean) {
      this.saveState = value ? 'Saved Remotely' : 'Saved Locally'
    },
    setFile(file: Required<File>, perm: Permission = Permissions.Unknown) {
      this.setFileId(file.id)
      this.setOwnerId(file.owner_id)
      this.setFileName(file.file_name)
      this.setContent(file.content)
      this.setOnlineSaveState(true)
      this.setLastModified(new Date(file.last_edited))
      this.setPermissions(perm)
    },
    setFileId(fileId: string) {
      this.fileId = fileId
      localStorage.setItem(constants.localStorageFileIdKey, fileId)
    },
    setOwnerId(ownerId: string) {
      this.ownerId = ownerId
      localStorage.setItem(constants.localStorageFileOwnerKey, ownerId)
    },
    clearFileId() {
      this.fileId = undefined
      localStorage.removeItem(constants.localStorageFileIdKey)
    },
    clearOwnerId() {
      this.ownerId = undefined
      localStorage.removeItem(constants.localStorageFileOwnerKey)
    },
    setFileName(fileName: string) {
      this.fileName = fileName
      localStorage.setItem(constants.localStorageFileNameKey, fileName)
    },
    setContent(content: string) {
      this.content = content
      localStorage.setItem(constants.localStorageFileContentKey, content)
    },
    setLastModified(lastModified: Date) {
      this.lastModified = lastModified
      localStorage.setItem(constants.localStorageLastModifiedKey, lastModified.toISOString())
    },
    resetLastModified() {
      this.setLastModified(new Date())
    },
    setPermissions(permissions: Permission) {
      this.permissions = permissions
      localStorage.setItem(constants.localStorageFilePermissionsKey, permissions ? String(permissions) : "")
    },
    closeFile() {
      this.clearFileId()
      this.setFileName(constants.defaultFileName)
      this.setContent(constants.defaultFileContent)
      this.setOnlineSaveState(false)
      this.clearOTransStack()
      this.setPermissions(Permissions.Unknown)
    },
    clearOTransStack() {
      this.oTransStack = new Map<string, OTrans>()
      this.oTransNotAcked = new Map<string, OTransReqDto>()
      this.lastTrans = undefined
    },
  },
})
