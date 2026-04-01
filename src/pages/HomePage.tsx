import React, { useState, useEffect } from 'react'
import { Mic, Square, Moon, BookOpen, Send } from 'lucide-react'
import { saveRecord } from '../storage'
import { useSpeech } from '../hooks/useSpeech'

interface HomePageProps {
  onGoSleep: () => void
  onGoHistory: () => void
}

export default function HomePage({ onGoSleep, onGoHistory }: HomePageProps) {
  const [inputText, setInputText] = useState('')
  const [interimText, setInterimText] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const { isListening, start, stop } = useSpeech({
    mode: 'single',
    onResult: (text) => {
      // 过滤掉单独的句号或问号
      const cleanText = text.replace(/^[。？！.?!]+$/, '').trim()
      if (cleanText) {
        saveRecord(cleanText, 'voice')
      }
      setInterimText('')
    },
    onInterim: (text) => {
      setInterimText(text)
    },
    onError: (msg) => {
      setErrorMsg(msg)
    }
  })

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [errorMsg])

  const toggleRecording = () => {
    if (isListening) {
      // 主动点击停止时，直接停掉录音和连接即可
      // 最终结果会在 ws.onmessage 或者最后发帧时处理并调用 onResult
      stop()
      setInterimText('')
    } else {
      start()
    }
  }

  const handleSendText = () => {
    if (inputText.trim()) {
      saveRecord(inputText, 'text')
      setInputText('')
    }
  }

  return (
    <div className="w-full h-full bg-[#000000] flex flex-col items-center relative p-6">
      {/* Top Header */}
      <div className="w-full flex justify-between items-center mb-12 mt-4">
        <div className="w-8"></div>
        <h1 className="text-2xl font-light tracking-widest bg-gradient-to-r from-slate-200 to-yellow-100 bg-clip-text text-transparent">
          NightLog
        </h1>
        <button onClick={onGoSleep} className="p-2 text-slate-400 hover:text-yellow-100 transition-colors">
          <Moon className="w-6 h-6" />
        </button>
      </div>

      {/* Center Record Button Area */}
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        {errorMsg && (
          <div className="text-red-400 text-sm mb-4 h-5 transition-opacity duration-300">
            {errorMsg}
          </div>
        )}
        {!errorMsg && <div className="h-5 mb-4"></div>}

        <button
          onClick={toggleRecording}
          className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 ${
            isListening 
              ? 'bg-red-950 border-2 border-red-800 animate-pulse' 
              : 'bg-slate-800 hover:bg-slate-700'
          }`}
        >
          {isListening ? (
            <Square className="w-16 h-16 text-red-400" fill="currentColor" />
          ) : (
            <Mic className="w-16 h-16 text-slate-300" />
          )}
        </button>

        <div className="mt-8 h-10 w-full px-4 text-center">
          <p className="text-slate-500 text-sm truncate">
            {interimText || (isListening ? '正在倾听...' : '点击麦克风开始说话')}
          </p>
        </div>
      </div>

      {/* Bottom Input Area */}
      <div className="w-full mt-auto mb-4 flex items-center gap-2">
        <button onClick={onGoHistory} className="p-3 text-slate-400 hover:text-slate-200 bg-slate-900 rounded-full">
          <BookOpen className="w-6 h-6" />
        </button>
        <div className="flex-1 flex items-center bg-slate-900 border border-slate-700 rounded-full px-4 py-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="或者输入文字..."
            className="flex-1 bg-transparent text-slate-200 outline-none placeholder-slate-500"
            onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
          />
          <button 
            onClick={handleSendText}
            disabled={!inputText.trim()}
            className="ml-2 text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
