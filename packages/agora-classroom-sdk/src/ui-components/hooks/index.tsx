import { useAppStore, useBoardStore, usePretestStore, useRoomStore, useSceneStore, useSmallClassStore, useUIStore } from "@/hooks"
import { useEffectOnce } from "@/hooks/utils"
import { mapFileType } from "@/services/upload-service"
import { EduMediaStream } from "@/stores/app/scene"
import { StorageCourseWareItem } from "@/stores/storage"
import { EduLogger, EduRoleTypeEnum, EduStream } from "agora-rte-sdk"
import { Button, CameraPlaceHolder, formatFileSize, StudentInfo, t, useI18nContext, ZoomItemType } from "agora-scenario-ui-kit"
import MD5 from "js-md5"
import { get } from "lodash"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useHistory } from "react-router-dom"
import { BehaviorSubject } from "rxjs"
import { PPTKind } from "white-web-sdk"
import { RendererPlayer } from "../common-comps/renderer-player"
import { calcUploadFilesMd5, uploadFileInfoProps } from "../common-containers/cloud-driver"
import { Exit } from "../common-containers/dialog"

export const useToastContext = () => {
  const uiStore = useUIStore()
  return {
    toastQueue: uiStore.toastQueue,
    removeToast: (id: string) => {
      uiStore.removeToast(`${id}`)
    }
  }
}

export const useToolCabinetContext = () => {

  const sceneStore = useSceneStore()

  const boardStore = useBoardStore()

  return {
    onClick: async (id: any) => {
      switch (id) {
        case 'screenShare': {
            await sceneStore.startOrStopSharing()
        }
        case 'laserPoint': {
            await boardStore.setLaserPoint()
        }
      }
    }
  }
}

export type VideoAction = (uid: any) => Promise<any>

export type VideoContainerContext = {
  teacherStream: EduMediaStream,
  studentStreams: EduMediaStream[],
  firstStudent: EduMediaStream,
  videoStreamList: any[],
  onCameraClick: VideoAction,
  onMicClick: VideoAction,
  onSendStar: VideoAction,
  sceneVideoConfig: {
    hideOffPodium: boolean,
    isHost: boolean,
  },
  onWhiteboardClick: VideoAction,
  onOffPodiumClick: VideoAction
}

export const useVideoControlContext = (): VideoContainerContext => {

  const sceneStore = useSceneStore()
  const boardStore = useBoardStore()
  const isHost = sceneStore.isHost
  const teacherStream = sceneStore.teacherStream
  const studentStreams = sceneStore.studentStreams

  const firstStudent = studentStreams[0]

  const sceneVideoConfig = sceneStore.sceneVideoConfig

  const userRole = sceneStore.roomInfo.userRole

  const onCameraClick = useCallback(async (userUuid: any) => {
    const targetStream = sceneStore.streamList.find((stream: EduStream) => get(stream.userInfo, 'userUuid', 0) === userUuid)
    if (targetStream) {
      const isLocal = sceneStore.roomInfo.userUuid === userUuid
      if (targetStream.hasVideo) {
        await sceneStore.muteVideo(userUuid, isLocal)
      } else {
        await sceneStore.unmuteVideo(userUuid, isLocal)
      }
    }
  }, [userRole, sceneStore, sceneStore.streamList, sceneStore.roomInfo.userUuid])

  const onMicClick = useCallback(async (userUuid: any) => {
    const targetStream = sceneStore.streamList.find((stream: EduStream) => get(stream.userInfo, 'userUuid', 0) === userUuid)
    if (targetStream) {
      const isLocal = sceneStore.roomInfo.userUuid === userUuid
      if (targetStream.hasAudio) {
        await sceneStore.muteAudio(userUuid, isLocal)
      } else {
        await sceneStore.unmuteAudio(userUuid, isLocal)
      }
    }
  }, [userRole, sceneStore, sceneStore.streamList, sceneStore.roomInfo.userUuid])

  const onSendStar = useCallback(async (uid: any) => {

  }, [userRole, sceneStore])

  const onWhiteboardClick = useCallback(async (userUuid: any) => {
    const targetUser = boardStore.grantUsers.find((uid: string) => uid === userUuid)
    if (isHost) {
      if (targetUser) {
        await boardStore.revokeUserPermission(userUuid)
      } else {
        await boardStore.grantUserPermission(userUuid)
      }
    }
  }, [isHost, boardStore])

  const videoStreamList = useMemo(() => {

    //@ts-ignore TODO: student stream empty workaround need fix design
    if (firstStudent && firstStudent.defaultStream === true) {
      return []
    }

    return studentStreams.map((stream: EduMediaStream) => ({
      isHost: isHost,
      hideOffPodium: sceneVideoConfig.hideOffPodium,
      username: stream.account,
      stars: stream.stars,
      uid: stream.userUuid,
      micEnabled: stream.audio,
      cameraEnabled: stream.video,
      whiteboardGranted: stream.whiteboardGranted,
      micVolume: stream.micVolume,
      controlPlacement: 'bottom',
      hideControl: stream.hideControl,
      children: (
        <>
        <CameraPlaceHolder state={stream.holderState} />
        {
          stream.renderer && stream.video ?
          <RendererPlayer
            key={stream.renderer && stream.renderer.videoTrack ? stream.renderer.videoTrack.getTrackId() : ''} track={stream.renderer} id={stream.streamUuid} className="rtc-video"
          />
          : null
        }
        </>
      )
      }))
  }, [
    firstStudent,
    studentStreams,
    sceneVideoConfig.hideOffPodium,
    sceneVideoConfig.isHost
  ])

  const onOffPodiumClick = useCallback(async (userUuid: any) => {
    // const sceneStore = sceneStore.grantUsers.find((uid: string) => uid === userUuid)
    if (isHost) {
      // if (targetUser) {
      //   await sceneStore.revokeUserPermission(userUuid)
      // } else {
      //   await sceneStore.grantUserPermission(userUuid)
      // }
    }
  }, [isHost, sceneStore])

  return {
    teacherStream,
    firstStudent,
    studentStreams,
    onCameraClick,
    onMicClick,
    onSendStar,
    onWhiteboardClick,
    onOffPodiumClick,
    sceneVideoConfig,
    videoStreamList,
  }
}

export const useChatContext = () => {
  const boardStore = useBoardStore()
  const roomStore = useRoomStore()
  const sceneStore = useSceneStore()
  const uiStore = useUIStore()

  const [nextId, setNextID] = useState('')

  const isMounted = useRef<boolean>(true)

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [isMounted])

  const fetchMessage = async () => {
    const res = nextId !== 'last' && await roomStore.getHistoryChatMessage({ nextId, sort: 0 })
    isMounted.current && setNextID(get(res, 'nextId', 'last'))
  }

  useEffect(() => {
    if (roomStore.joined) {
      fetchMessage()
    }
  }, [roomStore.joined])

  const [text, setText] = useState<string>('')

  const handleSendText = useCallback(async (): Promise<void> => {
    const message = await roomStore.sendMessage(text)
    roomStore.addChatMessage(message)
    setText('')
  }, [text, setText])

  const onCanChattingChange = useCallback(async (canChatting: boolean) => {
    if (canChatting) {
      await sceneStore.muteChat()
    } else {
      await sceneStore.unmuteChat()
    }
  }, [sceneStore])

  useEffect(() => {
    if (boardStore.isFullScreen) {
      uiStore.chatCollapse = false
    } else {
      uiStore.chatCollapse = true
    }
  }, [boardStore.isFullScreen, uiStore])

  const onChangeCollapse = useCallback(() => {
    uiStore.toggleChatMinimize()
  }, [uiStore])

  const handleScrollTop = useCallback(() => {

  }, [uiStore])

  return {
    meUid: roomStore.roomInfo.userUuid,
    messageList: roomStore.chatMessageList,
    text,
    onChangeText: (textValue: any) => {
      setText(textValue)
    },
    canChatting: !sceneStore.isMuted,
    isHost: sceneStore.isHost,
    handleSendText,
    onCanChattingChange,
    onChangeCollapse,
    minimize: uiStore.chatCollapse,
    handleScrollTop
  }
}

export const useSettingContext = () => {

  const {t} = useI18nContext()

  const pretestStore = usePretestStore()
  const uiStore = useUIStore()
  const {visibleSetting} = uiStore

  const [cameraError, setCameraError] = useState<boolean>(false)
  const [microphoneError, setMicrophoneError] = useState<boolean>(false)
  const [isMirror, setMirror] = useState<boolean>(false)

  const onChangeDevice = useCallback(async (deviceType: string, value: any) => {
      switch (deviceType) {
          case 'camera': {
              await pretestStore.changeTestCamera(value)
              break;
          }
          case 'microphone': {
              await pretestStore.changeTestMicrophone(value)
              break;
          }
          case 'speaker': {
              await pretestStore.changeTestSpeaker(value)
              break;
          }
      }
  }, [pretestStore])

  useEffect(() => {
      const uninstall = pretestStore.onDeviceTestError(({type, error}) => {
          if (type === 'video') {
              setCameraError(error)
          }
          if (type === 'audio') {
              setMicrophoneError(error)
          }
      })
      // TODO: need pipe
      pretestStore.init({video: true, audio: true})
      pretestStore.openTestCamera()
      pretestStore.openTestMicrophone()
      return () => {
          pretestStore.closeTestCamera()
          pretestStore.closeTestMicrophone()
          uninstall()
      }
  }, [setCameraError, setMicrophoneError])

  const {
      cameraList,
      microphoneList,
      speakerList,
      cameraId,
      microphoneId,
      speakerId,
      cameraRenderer,
      microphoneLevel,
  } = pretestStore

  const onChangeAudioVolume = useCallback(async (deviceType: string, value: any) => {
      switch (deviceType) {
          case 'speaker': {
              await pretestStore.changeSpeakerVolume(value)
              break;
          }
          case 'microphone': {
              await pretestStore.changeMicrophoneVolume(value)
              break;
          }
      }
  }, [pretestStore])

  const onSelectMirror = useCallback((evt: any) => {
      setMirror(!isMirror)
  }, [pretestStore, isMirror])


  const VideoPreviewPlayer = useCallback(() => {
      return (
          <RendererPlayer
              className="camera-placeholder"
              style={{width: 320, height: 216}}
              mirror={isMirror}
              key={cameraId}
              id="stream-player"
              track={cameraRenderer}
              preview={true}
          />
      )
  }, [cameraRenderer, cameraId, isMirror])

  const history = useHistory()

  const appStore = useAppStore()

  const handleOk = useCallback(() => {
      // const roomPath = appStore.params.roomPath!
      // history.push(roomPath)
  }, [history])

  const hideSetting = useCallback(() => {
      uiStore.setVisibleSetting(false)
  }, [visibleSetting, uiStore])

  return {
      visibleSetting,
      isNative: false,
      title: t('pretest.title'),
      cameraList,
      microphoneList,
      speakerList,
      finish: t('pretest.finishTest'),
      cameraId,
      microphoneId,
      speakerId,
      onChangeAudioVolume,
      onSelectMirror,
      cameraError,
      microphoneError,
      VideoPreviewPlayer,
      microphoneLevel,
      isMirror,
      hideSetting,
      handleOk,
      onChangeDevice,
      t,
  }
}

export const useScreenSharePlayerContext = () => {
  const sceneStore = useSceneStore()
  const screenShareStream = sceneStore.screenShareStream;
  const screenEduStream = sceneStore.screenEduStream

  return {
    screenShareStream,
    screenEduStream,
    onClick: async () => {
      await sceneStore.startOrStopSharing()
    }
  }
}

export const usePretestContext = () => {

  const {t} = useI18nContext()

  const pretestStore = usePretestStore()

  const [cameraError, setCameraError] = useState<boolean>(false)
  const [microphoneError, setMicrophoneError] = useState<boolean>(false)
  const [isMirror, setMirror] = useState<boolean>(false)

  useEffect(() => {
      const uninstall = pretestStore.onDeviceTestError(({type, error}) => {
          if (type === 'video') {
              setCameraError(error)
          }
          if (type === 'audio') {
              setMicrophoneError(error)
          }
      })
      // TODO: need pipe
      pretestStore.init({video: true, audio: true})
      pretestStore.openTestCamera()
      pretestStore.openTestMicrophone()
      return () => {
          pretestStore.closeTestCamera()
          pretestStore.closeTestMicrophone()
          uninstall()
      }
  }, [setCameraError, setMicrophoneError])

  const {
      cameraList,
      microphoneList,
      speakerList,
      cameraId,
      microphoneId,
      speakerId,
      cameraRenderer,
      microphoneLevel,
  } = pretestStore

  const onChangeDevice = useCallback(async (deviceType: string, value: any) => {
      switch (deviceType) {
          case 'camera': {
              await pretestStore.changeTestCamera(value)
              break;
          }
          case 'microphone': {
              await pretestStore.changeTestMicrophone(value)
              break;
          }
          case 'speaker': {
              await pretestStore.changeTestSpeaker(value)
              break;
          }
      }
  }, [pretestStore])
  const onChangeAudioVolume = useCallback(async (deviceType: string, value: any) => {
      switch (deviceType) {
          case 'speaker': {
              await pretestStore.changeTestSpeakerVolume(value)
              break;
          }
          case 'microphone': {
              await pretestStore.changeTestMicrophoneVolume(value)
              break;
          }
      }
  }, [pretestStore])
  const onSelectMirror = useCallback((evt: any) => {
      setMirror(!isMirror)
  }, [pretestStore, isMirror])


  const VideoPreviewPlayer = useCallback(() => {
      return (
          <RendererPlayer
              className="camera-placeholder camera-muted-placeholder"
              style={{width: 320, height: 216}}
              mirror={isMirror}
              key={cameraId}
              id="stream-player"
              track={cameraRenderer}
              preview={true}
          />
      )
  }, [cameraRenderer, cameraId, isMirror])

  const history = useHistory()

  const appStore = useAppStore()

  const handleOk = useCallback(() => {
      const roomPath = appStore.params.roomPath!
      console.log('history path ', roomPath)
      history.push(roomPath)
  }, [history, appStore.params.roomPath])

  return {
      title: t('pretest.title'),
      cameraList,
      microphoneList,
      speakerList,
      isNative: false,
      finish: t('pretest.finishTest'),
      cameraId,
      microphoneId,
      speakerId,
      onChangeDevice,
      onChangeAudioVolume,
      onSelectMirror,
      cameraError,
      microphoneError,
      VideoPreviewPlayer,
      microphoneLevel,
      isMirror,
      handleOk,
  }
}

export const usePenContext = () => {
  const boardStore = useBoardStore()
  const {t} = useI18nContext()

  const lineSelector = boardStore.lineSelector

  return {
    t,
    lineSelector,
    onClick: (pen: any) => {
      boardStore.updatePen(pen)
    }
  }
}

export const useNavigationBarContext = () => {

  const roomStore = useRoomStore()

  const navigationState = roomStore.navigationState

  const uiStore = useUIStore()

  const handleClick = useCallback(async (type: string) => {
    switch (type) {
      case 'exit': {
        uiStore.addDialog(Exit)
        break
      }
      case 'record': {
        console.log('record')
        console.log(roomStore, roomStore.roomInfo.roomType)
        const urlParams = {
          userUuid: '', // 用户uuid
          userName: 'string', // 用户昵称
          roomUuid: roomStore.roomInfo.roomUuid, // 房间uuid
          roleType: EduRoleTypeEnum.invisible, // 角色
          roomType: roomStore.roomInfo.roomType, // 房间类型
          roomName: 'string', // 房间名称
          listener: 'ListenerCallback', // launch状态 todo 在页面中处理
          pretest: false, // 开启设备检测
          rtmUid: 'string',
          rtmToken: 'string', // rtmToken
          language: 'LanguageEnum', // 国际化
          startTime: 'number', // 房间开始时间
          duration: 'number', // 课程时长
          recordUrl: 'string' // 回放页地址
        }
        const urlParamsStr = Object.keys(urlParams).map(key => key + '=' + encodeURIComponent(urlParams[key])).join('&')
        const url = `https://xxxx?${urlParamsStr}`
        console.log({url}) 
        // todo fetch 
        // await eduSDKApi.updateRecordingState({
        //   roomUuid: '',
        //   state: 1,
        //   url
        // })
        break
      }
      case 'setting': {
        uiStore.setVisibleSetting(true)
        break
      }
      case 'courseControl': {
        console.log('courseControl')
        break
      }
    }
  }, [navigationState.isStarted, uiStore])

  return {
    handleClick,
    navigationState,
  }
}

export const useLoadingContext = () => {

  const uiStore = useUIStore()

  return {
    loading: uiStore.loading
  }
}

export const useCloudDriverContext = (props: any) => {

  const boardStore = useBoardStore()

  const checkList$ = new BehaviorSubject<string[]>([])

  const [checkedList, updateList] = useState<string[]>([])

  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    checkList$.subscribe({
      next: (ids: string[]) => {
        updateList(ids)
      }
    })
    return () => {
      checkList$.unsubscribe()
    }
  }, [])

  const captureCheckedItems = (items: string[]) => {
    checkList$.next(items)
  }

  const [showUploadModal, setShowUploadModal] = useState<boolean>(false)
  const [showUploadToast, setShowUploadToast] = useState<boolean>(false)
  const [uploadFileInfo, setUploadFileInfo] = useState<uploadFileInfoProps>({
    iconType: '',
    fileName: '',
    fileSize: '',
    uploadComplete: false,
  })
  const [currentProgress, setCurrentProgress] = useState<number>(0)

  const onCancel = () => {
    boardStore.setTool('')
    props.actionClose()
  }

  const [activeKey, setActiveKey] = useState<string>('1')

  const handleChange = (key: string) => {
    setActiveKey(key)
  }

  const showToastFn = () => {
    setShowUploadModal(false)
    setShowUploadToast(true)
    setTimeout(() => {
      setShowUploadToast(false)
    }, 1000)
  }

  const handleUpload = async (evt: any) => {

    setUploadFileInfo({
      iconType: '',
      fileName: '',
      fileSize: '',
      uploadComplete: false,
    })
    setCurrentProgress(0)

    const file = evt.target.files[0]
    const md5 = await calcUploadFilesMd5(file)
    const resourceUuid = MD5(`${md5}`)
    const name = file.name.split(".")[0]
    const ext = file.name.split(".").pop()
    // hideToast()
    const supportedFileTypes = ['bmp', 'jpg', 'png', 'gif', 'pdf', 'pptx', 'mp3', 'mp4', 'doc', 'docx']

    const needConvertingFile = ['ppt', 'pptx', 'doc', 'docx', 'pdf']
    const isNeedConverting = needConvertingFile.includes(ext)
    const needDynamicFileType = ['pptx']
    const isDynamic = needDynamicFileType.includes(ext)
    const payload = {
      file: file,
      fileSize: file.size,
      ext: ext,
      resourceName: name,
      resourceUuid: resourceUuid,
      converting: isNeedConverting,
      kind: isDynamic ? PPTKind.Dynamic : PPTKind.Static,
      onProgress: async (evt: any) => {
        const { progress, isTransFile = false, isLastProgress = false } = evt;
        const parent = Math.floor(progress * 100)
        setCurrentProgress(parent)

        if (isTransFile) {
          setUploadFileInfo({
            ...uploadFileInfo,
            fileName: name,
            uploadComplete: true,
          })
        }

        if (isLastProgress && parent === 100) {
          showToastFn()
        }
      },
      pptConverter: boardStore.boardClient.client.pptConverter(boardStore.room.roomToken)
    }
    if (ext === 'pptx') {
      EduLogger.info("upload dynamic pptx")
    }
    // TODO: 渲染UI
    setUploadFileInfo({
      ...uploadFileInfo,
      iconType: 'format-' + mapFileType(ext),
      fileName: name,
      fileSize: formatFileSize(file.size),
      uploadComplete: false,
    })
    setShowUploadModal(true)
    try {
      await boardStore.handleUpload(payload)
      fileRef.current!.value = ""
    } catch (e) {
      fileRef.current!.value = ""
      throw e
    }

  }

  const handleDelete = async () => {
    await boardStore.removeMaterialList(checkList$.getValue())
  }

  // console.log(' driver props ', props)

  useEffect(() => {
    if (activeKey === '2') {
      boardStore.refreshState()
    }
  }, [activeKey, boardStore])

  const triggerUpload = () => {
    if (fileRef.current) {
      fileRef.current.click()
    }
  }

  return {
    handleDelete,
    triggerUpload,
    setShowUploadModal,
    showUploadToast,
    showUploadModal,
    captureCheckedItems,
    uploadFileInfo,
    currentProgress,
    fileRef,
    handleUpload,
    activeKey,
    handleChange,
    onCancel,
  }

}

export const useUploadContext = (handleUpdateCheckedItems: CallableFunction) => {

  const boardStore = useBoardStore()

  const [checkMap, setCheckMap] = useState<Record<string, any>>({})

  useEffect(() => {
    handleUpdateCheckedItems(Object.keys(checkMap))
  }, [checkMap, handleUpdateCheckedItems])

  const items = useMemo(() => {
    return boardStore.personalResources.map((it: any) => ({
      ...it,
      checked: !!checkMap[it.id]
    }))
  },[boardStore.personalResources.length, JSON.stringify(checkMap)])
  // const [items, updateItems] = React.useState<any[]>(boardStore.personalResources)

  const hasSelected: any = useMemo(() => {
    return !!items.find((item: any) => !!item.checked)
  }, [items, checkMap])

  const isSelectAll: any = useMemo(() => {
    const selected = items.filter((item: any) => !!item.checked)
    return selected.length === items.length ? true : false
  }, [items, checkMap])

  const handleSelectAll = useCallback((evt: any) => {
    if (isSelectAll) {
      const ids = items.map((item: any) => ({[`${item.id}`]: 0})).reduce((acc: any, it: any) => ({...acc, ...it}))
      const v = {
        ...checkMap,
        ...ids
      }
      setCheckMap(v)
    } else {
      const ids = items.map((item: any) => ({[`${item.id}`]: 1})).reduce((acc: any, it: any) => ({...acc, ...it}))
      const v = {
        ...checkMap,
        ...ids
      }
      setCheckMap(v)
    }
  }, [items, isSelectAll, checkMap])

  const changeChecked = useCallback((id: any, checked: boolean) => {
    const idx = items.findIndex((item: any) => item.id === id)
    if (idx >= 0) {
      setCheckMap({
        ...checkMap,
        ...{[`${id}`]: +checked},
      })
    }
  }, [items, checkMap])

  return {
    changeChecked,
    handleSelectAll,
    hasSelected,
    setCheckMap,
    checkMap,
    boardStore,
    items,
    isSelectAll,
  }
}

export const useStorageContext = () => {
  const boardStore = useBoardStore()

  const onResourceClick = async (resourceUuid: string) => {
    await boardStore.putSceneByResourceUuid(resourceUuid)
  }

  const itemList = boardStore.personalResources

  useEffect(() => {
    boardStore.refreshState()
  }, [boardStore])

  return {
    itemList,
    onResourceClick
  }
}


export const useColorContext = () => {
  const boardStore = useBoardStore()

  const activeColor = boardStore.currentColor
  const strokeWidth = boardStore.currentStrokeWidth
  return {
    activeColor,
    strokeWidth,
    changeStroke: (width: any) => {
      boardStore.changeStroke(width)
    },
    changeHexColor: (color: any) => {
      boardStore.changeHexColor(color)
    }
  }
}


const getHandsType = (role: EduRoleTypeEnum) => {

  const defaultType = null

  const map = {
      [EduRoleTypeEnum.teacher]: 'manager',
      [EduRoleTypeEnum.student]: 'receiver',
  }

  return map[role] || defaultType
}


export const useHandsUpContext = () => {
  const sceneStore = useSceneStore()

  const userRole = sceneStore.roomInfo.userRole

  return {
      handsType: getHandsType(userRole)
  }
}


export const useHandsUpSender = () => {

  const smallClass = useSmallClassStore()

  const teacherUuid = smallClass.teacherUuid

  const isCoVideo = smallClass.isCoVideo

  const handleClick = useCallback(async () => {
      if (isCoVideo) {
          await smallClass.studentDismissHandsUp(teacherUuid)
      } else {
          await smallClass.studentHandsUp(teacherUuid)
      }
  }, [isCoVideo, smallClass, teacherUuid])

  return {
    isCoVideo,
    handleClick
  }
}

export const useHandsUpManager = () => {

  const smallClassStore = useSmallClassStore()

  const coVideoUsers = smallClassStore.handsUpStudentList

  const handsUpState = 'default' as any

  const handleUpdateList = useCallback(async (type: string, info: StudentInfo) => {
      if (type === 'confirm') {
          await smallClassStore.teacherAcceptHandsUp(info.userUuid)
      }

      if (type === 'cancel') {
          await smallClassStore.teacherRejectHandsUp(info.userUuid)
      }
  }, [coVideoUsers, smallClassStore])

  return {
    handsUpState,
    handleUpdateList,
    coVideoUsers
  }
}



export const useOpenDialogContext = (id: string) => {


  const uiStore = useUIStore()

  const onOK = async () => {
    uiStore.removeDialog(id)
  }

  const onCancel = () => {
    uiStore.removeDialog(id)
  }

  const ButtonGroup = useCallback(() => {
    return [
      <Button type={'secondary'} action="cancel">{t('toast.cancel')}</Button>,
      <Button type={'primary'} action="ok">{t('toast.confirm')}</Button>,
    ]
  }, [t])
  
  return {
    onOK,
    onCancel,
    ButtonGroup
  }
}

export const useCloseConfirmContext = (id: string, resourceName: string) => {

  const uiStore = useUIStore()
  const boardStore = useBoardStore()

  const onOK = async () => {
    boardStore.closeMaterial(resourceName)
    uiStore.removeDialog(id)
  }

  const onCancel = () => {
    uiStore.removeDialog(id)
  }

  const ButtonGroup = useCallback(() => {
    return [
      <Button type={'secondary'} action="cancel">{t('toast.cancel')}</Button>,
      <Button type={'primary'} action="ok">{t('toast.confirm')}</Button>,
    ]
  }, [])

  return {
    onOK,
    onCancel,
    ButtonGroup
  }
}

export const useRoomEndContext = (id: string) => {
  const roomStore = useRoomStore()

  const uiStore = useUIStore()
  const isStarted = roomStore.navigationState.isStarted

  const onOK = async () => {
    uiStore.removeDialog(id)
  }

  const onCancel = () => {
    uiStore.removeDialog(id)
  }

  const ButtonGroup = useCallback(() => {
    return [
      <Button type={isStarted ? 'primary' : 'secondary'} action="cancel">{t('toast.cancel')}</Button>,
      <Button type={!isStarted ? 'primary' : 'secondary'} action="ok">{t('toast.confirm')}</Button>,
    ]
  }, [isStarted])
  
  return {
    onOK,
    onCancel,
    ButtonGroup
  }
}

export const useExitContext = (id: string) => {
  const roomStore = useRoomStore()
  const appStore = useAppStore()

  const uiStore = useUIStore()
  const isStarted = roomStore.navigationState.isStarted

  const onOK = async () => {
    await appStore.destroyRoom()
    uiStore.removeDialog(id)
  }

  const onCancel = () => {
    uiStore.removeDialog(id)
  }

  const ButtonGroup = useCallback(() => {
    return [
      <Button type={isStarted ? 'primary' : 'secondary'} action="cancel">{t('toast.cancel')}</Button>,
      <Button type={!isStarted ? 'primary' : 'secondary'} action="ok">{t('toast.confirm')}</Button>,
    ]
  }, [isStarted])

  return {
    onOK,
    onCancel,
    ButtonGroup
  }
}

export const useKickEndContext = (id: string) => {
  const roomStore = useRoomStore()

  const navigationState = roomStore.navigationState

  const uiStore = useUIStore()
  const isStarted = navigationState.isStarted

  const onOK = async () => {
    uiStore.removeDialog(id)
  }

  const onCancel = () => {
    uiStore.removeDialog(id)
  }

  const ButtonGroup = useCallback(() => {
    return [
      <Button type={!isStarted ? 'primary' : 'secondary'} action="ok">{t('toast.confirm')}</Button>,
    ]
  }, [isStarted])


  return {
    onOK,
    onCancel,
    ButtonGroup
  }
}

export const useDialogContext = () => {
  const uiStore = useUIStore()

  return {
    dialogQueue: uiStore.dialogQueue
  }
}

export const use1v1Store = () => {
  const roomStore = useRoomStore()
  const boardStore = useBoardStore()
  useEffectOnce(() => {
    roomStore.join()
  })

  return {
    isFullScreen: boardStore.isFullScreen
  }
}

export const useWhiteboardState = () => {
  const boardStore = useBoardStore()
  useI18nContext()

  const boardRef = useRef<HTMLDivElement | null>(null)

  const mountToDOM = useCallback((dom: any) => {
    if (dom) {
      boardStore.mount(dom)
    } else {
      boardStore.unmount()
    }
  }, [boardRef.current, boardStore])

  const handleToolBarChange = async (type: string) => {

    console.log('type>>>>handleToolBarChange ', type)

    boardStore.setTool(type)
  }

  const handleZoomControllerChange = async (type: ZoomItemType) => {
    const toolbarMap: Record<ZoomItemType, CallableFunction> = {
      'max': () => {
        boardStore.zoomBoard('fullscreen')
      },
      'min': () => {
        boardStore.zoomBoard('fullscreenExit')
      },
      'zoom-out': () => {
        boardStore.setZoomScale('out')
      },
      'zoom-in': () => {
        boardStore.setZoomScale('in')
      },
      'forward': () => boardStore.changeFooterMenu('next_page'),
      'backward': () => boardStore.changeFooterMenu('prev_page'),
    }
    toolbarMap[type] && toolbarMap[type]()
  }

  return {
    zoomValue: boardStore.zoomValue,
    currentPage: boardStore.currentPage,
    totalPage: boardStore.totalPage,
    courseWareList: [],
    handleToolBarChange,
    handleZoomControllerChange,
    ready: boardStore.ready,
    mountToDOM,
    isFullScreen: boardStore.isFullScreen,
    currentSelector: boardStore.currentSelector,
    tools: boardStore.tools,
    activeMap: boardStore.activeMap,
  }
}

export const useDownloadContext = () => {

  const boardStore = useBoardStore()

  const itemList = boardStore.downloadList.filter((it: StorageCourseWareItem) => it.taskUuid)

  return {
    itemList,
    startDownload: async (taskUuid: string) => {
      await boardStore.startDownload(taskUuid)
    },
    deleteDownload: async (taskUuid: string) => {
      await boardStore.deleteSingle(taskUuid)
    }
  }
}