import React, {useCallback, useEffect, useRef} from 'react'
import {AgoraEduSDK} from '@/edu-sdk'
import { useAppStore, useHomeStore } from '@/hooks'
import { AgoraEduEvent } from '@/edu-sdk/declare'
import { EduRoleType, EduRoleTypeEnum } from 'agora-rte-sdk'
import { observer } from 'mobx-react'
import { ClassRoom, ClassRoomAbstractStore, controller } from '@/edu-sdk/controller'
import { AppStore } from '@/stores/app'
import { useHistory } from 'react-router-dom'
import { isEmpty } from 'lodash'
import { RtmTokenBuilder, RtmRole } from 'agora-access-token'
import { eduSDKApi } from '@/services/edu-sdk-api'

//@ts-ignore
window.controller = controller

export const LaunchPage = observer(() => {

  const homeStore = useHomeStore()

  const history = useHistory()

  const launchOption = homeStore.launchOption

  const roomRef = useRef<ClassRoom<ClassRoomAbstractStore> | null>(null)

  useEffect(() => {
    if (!launchOption || isEmpty(launchOption)) {
      history.push('/')
      return 
    }
  }, [])

  const mountLaunch = useCallback(async (dom: any) => {
    if (dom) {
      // AgoraEduSDK.setParameters(JSON.stringify({"edu.apiUrl":"https://api-solutions-dev.bj2.agoralab.co"}))
      AgoraEduSDK.config({
        appId: `${REACT_APP_AGORA_APP_ID}`,
      })

      const appCertificate = `${REACT_APP_AGORA_APP_CERTIFICATE}`
      if(appCertificate) {
        launchOption.rtmToken = RtmTokenBuilder.buildToken(
          `${REACT_APP_AGORA_APP_ID}`,
          appCertificate,
          launchOption.userUuid,
          RtmRole.Rtm_User,
          0
        )
      }

      roomRef.current = await AgoraEduSDK.launch(dom, {
        ...launchOption,
        listener: (evt: AgoraEduEvent) => {
          console.log("launch#listener ", evt)
          if (evt === AgoraEduEvent.ready) {
            const {recordLanguage, roomUuid} = launchOption
            if (recordLanguage) {
              eduSDKApi.setRoomProperties({
                roomUuid,
                data: {
                  language: recordLanguage
                }
              })
            }
          }
          if (evt === AgoraEduEvent.destroyed) {
            history.push('/')
          }
        }
      })
    }
    return () => {
      if (roomRef.current) {
        roomRef.current.destroy()
      }
    }
  }, [AgoraEduSDK])

  return (
    <div ref={mountLaunch} id="app" style={{width: '100%', height: '100%'}}></div>
  )
})