import React, { useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { getRecentRecords } from '../storage'
import { generateMorningBrief } from '../services/difyService'
import { BriefResult } from '../types'

interface BriefPageProps {
  onBack: () => void
}

export default function BriefPage({ onBack }: BriefPageProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BriefResult | null>(null)

  const [checkedTodos, setCheckedTodos] = useState<Record<number, boolean>>({})

  const toggleTodo = (index: number) => {
    setCheckedTodos(prev => ({ ...prev, [index]: !prev[index] }))
  }

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    try {
      const records = getRecentRecords(24)
      if (records.length === 0) {
        throw new Error('最近24小时内没有记录，无法生成简报')
      }
      const recordsText = records
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(r => {
          const d = new Date(r.timestamp)
          const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
          return `${time} ${r.text}`
        })
        .join('\n')

      const res = await generateMorningBrief(recordsText)
      setResult(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '生成失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full h-full bg-[#0a0a0a] flex flex-col">
      <div className="flex items-center p-4 bg-[#0a0a0a] sticky top-0 z-10 border-b border-slate-800">
        <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-200">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-medium text-slate-200 ml-2">ai晨间简报</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!result && !loading && !error && (
          <div className="h-full flex items-center justify-center">
            <button
              onClick={handleGenerate}
              className="bg-gradient-to-r from-yellow-600 to-amber-500 text-white rounded-2xl px-8 py-4 font-medium shadow-lg hover:opacity-90 transition-opacity"
            >
              生成今日简报
            </button>
          </div>
        )}

        {loading && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-yellow-500" />
            <p>AI 正在整理你的想法...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-950/50 border border-red-900 rounded-2xl p-6 text-center">
            <p className="text-red-400 mb-6">{error}</p>
            <button
              onClick={handleGenerate}
              className="bg-red-900 text-red-100 px-6 py-2 rounded-full text-sm"
            >
              重试
            </button>
          </div>
        )}

        {result && (
          <div className="space-y-4 pb-8">
            {/* Todos */}
            {result.todos && result.todos.length > 0 && (
              <div className="bg-slate-900 rounded-2xl p-4">
                <h2 className="text-lg font-medium text-slate-200 mb-4">✅ 今日待办</h2>
                <div className="space-y-3">
                  {result.todos.map((todo, i) => (
                    <label key={i} className="flex items-start gap-3 cursor-pointer group">
                      <div className="mt-0.5">
                        <input
                          type="checkbox"
                          checked={!!checkedTodos[i]}
                          onChange={() => toggleTodo(i)}
                          className="w-5 h-5 rounded border-slate-600 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-slate-900 bg-slate-800"
                        />
                      </div>
                      <span className={`text-base flex-1 transition-all ${checkedTodos[i] ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                        {todo}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Ideas */}
            {result.ideas && result.ideas.length > 0 && (
              <div className="bg-slate-900 rounded-2xl p-4">
                <h2 className="text-lg font-medium text-slate-200 mb-4">💡 值得深思</h2>
                <ul className="space-y-3">
                  {result.ideas.map((idea, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-300">
                      <span className="shrink-0">💡</span>
                      <span className="flex-1">{idea}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mood */}
            {result.mood && (
              <div className="bg-slate-900 rounded-2xl p-4">
                <h2 className="text-lg font-medium text-slate-200 mb-3">🌙 昨晚情绪</h2>
                <p className="text-slate-300 leading-relaxed">
                  {result.mood}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
