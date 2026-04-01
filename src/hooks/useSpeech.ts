import { useState, useRef, useCallback } from 'react' 
import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { utf8ToBytes } from '@noble/hashes/utils.js'
 
 // HMAC-SHA256 签名（使用浏览器 Web Crypto API） 
 async function hmacSha256Base64(secret: string, message: string): Promise<string> { 
  try {
    if (globalThis.crypto?.subtle) {
      const encoder = new TextEncoder() 
      const key = await crypto.subtle.importKey( 
        'raw', 
        encoder.encode(secret), 
        { name: 'HMAC', hash: 'SHA-256' }, 
        false, 
        ['sign'] 
      ) 
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message)) 
      return btoa(String.fromCharCode(...new Uint8Array(sig))) 
    }
  } catch {
    void 0
  }
  const sig = hmac(sha256, utf8ToBytes(secret), utf8ToBytes(message))
  return btoa(String.fromCharCode(...sig)) 
 } 
 
 // 语音听写流式版 WebAPI v2（与文档一致：https://www.xfyun.cn/doc/asr/voicedictation/API.html）
 const XFYUN_IAT_HOST = 'iat-api.xfyun.cn'
 const XFYUN_IAT_PATH = '/v2/iat'
 const XFYUN_IAT_WSS_DIRECT = `wss://${XFYUN_IAT_HOST}${XFYUN_IAT_PATH}`

 async function buildAuthUrl(apiKey: string, apiSecret: string): Promise<string> {
  const key = apiKey?.trim()
  const secret = apiSecret?.trim()

  if (!key || !secret) {
    throw new Error('请在 .env.local 中配置 VITE_XFYUN_API_KEY 和 VITE_XFYUN_API_SECRET')
  }

  const date = new Date().toUTCString()
  const requestLine = `GET ${XFYUN_IAT_PATH} HTTP/1.1`
  const signatureOrigin = `host: ${XFYUN_IAT_HOST}\ndate: ${date}\n${requestLine}`
  const signature = await hmacSha256Base64(secret, signatureOrigin)
  const authorizationOrigin = `api_key="${key}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  const authorization = btoa(authorizationOrigin)

  const q = new URLSearchParams({
    authorization,
    date,
    host: XFYUN_IAT_HOST,
  })
  return `${XFYUN_IAT_WSS_DIRECT}?${q.toString()}`
 }
 
 // Float32Array PCM → Int16 ArrayBuffer 
 function float32ToInt16Buffer(float32Array: Float32Array): ArrayBuffer { 
   const buffer = new ArrayBuffer(float32Array.length * 2) 
   const view = new DataView(buffer) 
   for (let i = 0; i < float32Array.length; i++) { 
     const s = Math.max(-1, Math.min(1, float32Array[i])) 
     view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true) 
   } 
   return buffer 
 } 
 
 // ArrayBuffer → base64 
 function arrayBufferToBase64(buffer: ArrayBuffer): string { 
   const bytes = new Uint8Array(buffer) 
   let binary = '' 
   for (let i = 0; i < bytes.length; i++) { 
     binary += String.fromCharCode(bytes[i]) 
   } 
   return btoa(binary) 
 } 
 
 interface UseSpeechOptions { 
   mode: 'single' | 'continuous' 
   onResult: (text: string) => void 
   onInterim?: (text: string) => void 
   onError?: (msg: string) => void 
 } 
 
 export function useSpeech({ mode, onResult, onInterim, onError }: UseSpeechOptions) { 
   const [isListening, setIsListening] = useState(false) 
  const appId = ((import.meta.env.VITE_XFYUN_APP_ID as string) || '').trim()
  const apiKey = (import.meta.env.VITE_XFYUN_API_KEY as string) || ''
  const apiSecret = (import.meta.env.VITE_XFYUN_API_SECRET as string) || ''
   const wsRef = useRef<WebSocket | null>(null) 
   const audioCtxRef = useRef<AudioContext | null>(null) 
   const processorRef = useRef<ScriptProcessorNode | null>(null) 
   const streamRef = useRef<MediaStream | null>(null) 
   const seqRef = useRef(0) 
   const pcmBufferRef = useRef<number[]>([]) 
   const resultTextRef = useRef<string>('') 
   const isStoppingRef = useRef(false) 
  const reconnectTimerRef = useRef<number | null>(null)
  const lastEmitAtRef = useRef(0)
  const wsOpenedRef = useRef(false)
  const connectTimeoutRef = useRef<number | null>(null)
  const wsErrorRef = useRef(false)
  const flushTimerRef = useRef<number | null>(null)
  const parseErrorRef = useRef(false)
  const closingForReconnectRef = useRef(false)
 
     const stop = useCallback(() => { 
      if (isStoppingRef.current) return
      isStoppingRef.current = true 
      closingForReconnectRef.current = false
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current)
        connectTimeoutRef.current = null
      }
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current)
        flushTimerRef.current = null
      }
  
      // v2：会话结束只发 data.status = 2
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ data: { status: 2 } }))
      }

      // 主动点击停止时，强行把没来得及触发最终结果的字存进去
      if (resultTextRef.current.trim()) {
        onResult(resultTextRef.current.trim())
        resultTextRef.current = ''
        onInterim?.('')
      }
  
      // 清理资源 
      setTimeout(() => { 
        processorRef.current?.disconnect() 
        audioCtxRef.current?.close() 
        streamRef.current?.getTracks().forEach(t => t.stop()) 
        try {
          wsRef.current?.close(1000, 'user-stop')
        } catch {
          wsRef.current?.close()
        }
        processorRef.current = null 
        audioCtxRef.current = null 
        streamRef.current = null 
        wsRef.current = null 
        setIsListening(false) 
      }, 300) 
    }, [appId, onResult, onInterim]) 
 
   const start = useCallback(async () => {
     if (!appId) {
       onError?.('请在 .env.local 中配置 VITE_XFYUN_APP_ID')
       return
     }
     isStoppingRef.current = false 
     closingForReconnectRef.current = false
     seqRef.current = 0 
     pcmBufferRef.current = [] 
     resultTextRef.current = '' 
     lastEmitAtRef.current = Date.now()
     wsErrorRef.current = false
     if (reconnectTimerRef.current) {
       clearTimeout(reconnectTimerRef.current)
       reconnectTimerRef.current = null
     }
 
     // 1. 获取麦克风 
     let stream: MediaStream 
     try { 
       stream = await navigator.mediaDevices.getUserMedia({ audio: true }) 
       streamRef.current = stream 
     } catch { 
       onError?.('麦克风权限被拒绝，请在浏览器地址栏点击锁形图标开启权限') 
       return 
     } 

     const audioCtx = new AudioContext({ sampleRate: 16000 }) 
     audioCtxRef.current = audioCtx 
    audioCtx.resume().catch(() => undefined)
     const source = audioCtx.createMediaStreamSource(stream) 
     const processor = audioCtx.createScriptProcessor(4096, 1, 1) 
     processorRef.current = processor 

    const flushPcm = () => {
      if (isStoppingRef.current) return
      const socket = wsRef.current
      if (!socket || socket.readyState !== WebSocket.OPEN) return
      while (pcmBufferRef.current.length >= 1280) {
        const chunk = pcmBufferRef.current.splice(0, 1280)
        const chunkBuffer = new Uint8Array(chunk).buffer
        const audio = arrayBufferToBase64(chunkBuffer)
        const isFirst = seqRef.current === 0
        const dataStatus = isFirst ? 0 : 1

        const frame = isFirst
          ? {
              common: { app_id: appId },
              business: {
                language: 'zh_cn',
                domain: 'iat',
                accent: 'mandarin',
                eos: 6000,
              },
              data: {
                status: dataStatus,
                format: 'audio/L16;rate=16000',
                encoding: 'raw',
                audio,
              },
            }
          : {
              data: {
                status: dataStatus,
                format: 'audio/L16;rate=16000',
                encoding: 'raw',
                audio,
              },
            }
        socket.send(JSON.stringify(frame))
        seqRef.current++
      }
    }

    processor.onaudioprocess = (e) => { 
       if (isStoppingRef.current) return 
      const socket = wsRef.current
       const float32 = e.inputBuffer.getChannelData(0)

       const int16Buffer = float32ToInt16Buffer(float32) 
       const bytes = new Uint8Array(int16Buffer) 
        
       for (let i = 0; i < bytes.length; i++) { 
         pcmBufferRef.current.push(bytes[i]) 
       } 
      if (pcmBufferRef.current.length > 160000) {
        pcmBufferRef.current.splice(0, pcmBufferRef.current.length - 160000)
      }

      if (!socket || socket.readyState !== WebSocket.OPEN) return 
      flushPcm()
     } 

     source.connect(processor) 
     processor.connect(audioCtx.destination) 

     const connectWs = async () => {
       let url: string
       try {
        url = await buildAuthUrl(apiKey, apiSecret)
       } catch (e: unknown) { 
         const msg = e instanceof Error ? e.message : '鉴权URL生成失败'
         onError?.(msg) 
         return 
       } 

       const ws = new WebSocket(url) 
       wsRef.current = ws 
      const closeForIatReconnect = () => {
        closingForReconnectRef.current = true
        try {
          ws.close(1000, 'iat-session-end')
        } catch {
          void 0
        }
      }
      wsOpenedRef.current = false
      wsErrorRef.current = false
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current)
        connectTimeoutRef.current = null
      }
      connectTimeoutRef.current = window.setTimeout(() => {
        if (isStoppingRef.current) return
        if (wsOpenedRef.current) return
        try {
          ws.close()
        } catch {
          void 0
        }
        onError?.('语音识别连接超时（可能是网络拦截/证书问题），请切换网络后重试')
      }, 8000)

       ws.onerror = () => { 
        wsErrorRef.current = true
       } 

       ws.onclose = (e) => { 
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current)
          connectTimeoutRef.current = null
        }
         if (isStoppingRef.current) { 
           setIsListening(false) 
           return
         }

         if (resultTextRef.current.trim()) { 
           onResult(resultTextRef.current.trim()) 
           resultTextRef.current = '' 
           onInterim?.('') 
         }

         setIsListening(false) 

         if (mode === 'continuous') { 
          if (!wsOpenedRef.current) {
            const hint = wsErrorRef.current ? '（握手失败/网络拦截）' : ''
            onError?.(`语音识别连接失败 (code: ${e.code || 0})${hint}，请检查网络与控制台密钥配置。`)
          } else {
            const deliberate = closingForReconnectRef.current
            closingForReconnectRef.current = false
            if (!deliberate && e.code && e.code !== 1000 && e.code !== 1001) {
              const reason = (e as CloseEvent).reason ? `，${(e as CloseEvent).reason}` : ''
              onError?.(`语音识别连接断开 (code: ${e.code})${reason}`)
            }
          }
           if (reconnectTimerRef.current) { 
             clearTimeout(reconnectTimerRef.current) 
           } 
           reconnectTimerRef.current = window.setTimeout(() => { 
             if (!isStoppingRef.current) { 
               seqRef.current = 0 
               connectWs() 
             } 
          }, wsOpenedRef.current ? 800 : 2000) 
         } else if (!wsOpenedRef.current) {
            const hint = wsErrorRef.current ? '（握手失败/网络拦截）' : ''
            onError?.(`语音识别连接失败 (code: ${e.code || 0})${hint}。`)
          } else if (e.code !== 1000) {
            onError?.(`连接异常关闭 (code: ${e.code})`)
          }
       } 

       ws.onmessage = (event) => {
         try {
           const msg = JSON.parse(event.data)
           if (msg.code !== 0) {
             onError?.(`识别服务返回错误：${msg.message || msg.code}`)
             return
           }
           const result = msg.data?.result
           if (!result?.ws?.length) {
             if (msg.data?.status === 2 && mode === 'single') {
               stop()
             } else if (msg.data?.status === 2 && mode === 'continuous') {
               closeForIatReconnect()
             }
             return
           }

           let text = ''
           for (const w of result.ws) {
             for (const cw of w.cw) {
               text += cw.w
             }
           }

           if (text) {
             resultTextRef.current += text
             const now = Date.now()
             const ls = result.ls === true

             if (mode === 'continuous') {
               onInterim?.(resultTextRef.current)
               if (ls || now - lastEmitAtRef.current > 3000 || resultTextRef.current.length >= 30) {
                 const t = resultTextRef.current.trim()
                 if (t) onResult(t)
                 resultTextRef.current = ''
                 onInterim?.('')
                 lastEmitAtRef.current = now
               }
             } else {
               if (ls) {
                 if (resultTextRef.current.trim()) {
                   onResult(resultTextRef.current.trim())
                 }
                 resultTextRef.current = ''
                 onInterim?.('')
               } else {
                 onInterim?.(resultTextRef.current)
               }
             }
           }

           if (msg.data?.status === 2) {
             if (mode === 'single') {
               stop()
             } else {
               closeForIatReconnect()
             }
           }
         } catch {
          if (!parseErrorRef.current) {
            parseErrorRef.current = true
            onError?.('识别响应解析失败（可能是返回格式变化/网络注入），请打开控制台检查 WebSocket 消息')
          }
          return
         } 
       } 

       ws.onopen = () => { 
         setIsListening(true) 
        wsOpenedRef.current = true
        parseErrorRef.current = false
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current)
          connectTimeoutRef.current = null
        }
        onError?.('')
        onInterim?.('')
         seqRef.current = 0
         lastEmitAtRef.current = Date.now()
        if (flushTimerRef.current) {
          clearInterval(flushTimerRef.current)
        }
        flushTimerRef.current = window.setInterval(() => flushPcm(), 40)
        flushPcm()
       } 
     }

     await connectWs()
   }, [appId, apiKey, apiSecret, mode, onResult, onInterim, onError, stop]) 
 
   return { isListening, start, stop } 
 }
