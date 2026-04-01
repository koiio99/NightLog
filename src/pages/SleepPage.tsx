import React, { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft } from 'lucide-react'
import { saveRecord } from '../storage'
import { useSpeech } from '../hooks/useSpeech'

interface SleepPageProps {
  onExit: () => void
}

type Step = 'select' | 'listening'

/**
 * 伴眠自动退出：只按「距上次成功保存语音」或「进入录音页」经过的分钟数计时。
 * 计时器全部用 ref + 单一 useEffect(step)，避免父组件传入的 onExit 引用变化导致反复 clearTimeout。
 */
export default function SleepPage({ onExit }: SleepPageProps) {
  const [step, setStep] = useState<Step>('select')
  const [timeoutMinutes, setTimeoutMinutes] = useState(15)
  const [interimText, setInterimText] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [savedCount, setSavedCount] = useState(0)

  const autoExitTimerRef = useRef<number | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const stopRef = useRef<() => void>(() => undefined)
  const onExitRef = useRef(onExit)
  const gapMsRef = useRef(15 * 60 * 1000)

  onExitRef.current = onExit
  gapMsRef.current = timeoutMinutes * 60 * 1000

  const clearAutoExitTimer = () => {
    if (autoExitTimerRef.current !== null) {
      clearTimeout(autoExitTimerRef.current)
      autoExitTimerRef.current = null
    }
  }

  const armAutoExitTimer = useCallback(() => {
    clearAutoExitTimer()
    const ms = gapMsRef.current
    autoExitTimerRef.current = window.setTimeout(() => {
      autoExitTimerRef.current = null
      stopRef.current()
      onExitRef.current()
    }, ms)
  }, [])

  const onResult = useCallback(
    (text: string) => {
      const cleanText = text.replace(/^[。？！.?!]+$/, '').trim()
      if (!cleanText) return
      saveRecord(cleanText, 'voice')
      setSavedCount(c => c + 1)
      armAutoExitTimer()
    },
    [armAutoExitTimer]
  )

  const onInterim = useCallback((text: string) => {
    setErrorMsg('')
    setInterimText(text.length > 30 ? `…${text.slice(-30)}` : text)
  }, [])

  const onError = useCallback((msg: string) => {
    setErrorMsg(msg)
  }, [])

  const { start, stop, isListening } = useSpeech({
    mode: 'continuous',
    onResult,
    onInterim,
    onError,
  })

  stopRef.current = stop

  const startListening = (minutes: number) => {
    setTimeoutMinutes(minutes)
    setStep('listening')
    setSavedCount(0)
    setInterimText('')
    setErrorMsg('')
    start()
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').catch(() => undefined)
    }
  }

  useEffect(() => {
    if (step !== 'listening') {
      clearAutoExitTimer()
      return
    }
    armAutoExitTimer()
    return clearAutoExitTimer
  }, [step, armAutoExitTimer])

  useEffect(() => {
    return () => {
      clearAutoExitTimer()
      if (longPressTimerRef.current !== null) clearTimeout(longPressTimerRef.current)
      stopRef.current()
    }
  }, [])

  const handleExitPressStart = (e?: React.SyntheticEvent) => {
    e?.preventDefault()
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null
      stop()
      onExit()
    }, 1500)
  }

  const handleExitPressEnd = (e?: React.SyntheticEvent) => {
    e?.preventDefault()
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  if (step === 'select') {
    return (
      <div className="w-full h-full bg-[#000000] p-6 flex flex-col relative">
        <button type="button" onClick={onExit} className="absolute top-6 left-6 text-slate-400">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="mt-20 text-center">
          <h2 className="text-2xl font-light text-slate-200 mb-2">伴眠模式</h2>
          <p className="text-slate-500 text-sm mb-12">距上次保存超过多久后自动退出伴眠？</p>
          <div className="flex flex-col gap-4 max-w-xs mx-auto">
            {[1, 15, 30, 60].map(mins => (
              <button
                type="button"
                key={mins}
                onClick={() => startListening(mins)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl py-4 text-lg transition-colors"
              >
                {mins} 分钟
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-[#000000] relative flex items-center justify-center overflow-hidden">
      <div className="absolute top-6 left-0 right-0 px-6 text-center">
        {errorMsg ? (
          <div className="text-red-400 text-sm break-words">{errorMsg}</div>
        ) : (
          <div className="text-slate-500 text-sm">
            {isListening ? '已连接' : '连接中'} · 已保存 {savedCount} 条{interimText ? ` · ${interimText}` : ''}
          </div>
        )}
      </div>
      <div className="absolute w-40 h-40 border border-slate-500 rounded-full opacity-10 animate-ping" style={{ animationDuration: '3s' }} />
      <div className="absolute w-64 h-64 border border-slate-500 rounded-full opacity-10 animate-ping" style={{ animationDuration: '4s' }} />
      <div className="absolute w-96 h-96 border border-slate-500 rounded-full opacity-10 animate-ping" style={{ animationDuration: '5s' }} />

      <div className="absolute bottom-12 w-full flex justify-center">
        <button
          type="button"
          className="text-slate-500 opacity-20 hover:opacity-100 transition-opacity px-6 py-2"
          onContextMenu={e => e.preventDefault()}
          onPointerDown={handleExitPressStart}
          onPointerUp={handleExitPressEnd}
          onPointerCancel={handleExitPressEnd}
          onPointerLeave={handleExitPressEnd}
          onMouseDown={handleExitPressStart}
          onMouseUp={handleExitPressEnd}
          onMouseLeave={handleExitPressEnd}
          onTouchStart={handleExitPressStart}
          onTouchEnd={handleExitPressEnd}
        >
          长按退出
        </button>
      </div>
    </div>
  )
}
