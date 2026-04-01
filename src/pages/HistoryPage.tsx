import React, { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { getRecords, deleteRecord } from '../storage'
import { NightRecord } from '../types'

interface HistoryPageProps {
  onBack: () => void
  onGoBrief: () => void
}

export default function HistoryPage({ onBack, onGoBrief }: HistoryPageProps) {
  const [records, setRecords] = useState<NightRecord[]>(() => getRecords())

  const handleDelete = (id: string) => {
    if (window.confirm('确定要删除这条记录吗？')) {
      deleteRecord(id)
      setRecords(getRecords())
    }
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  const groupRecords = () => {
    const groups: Record<string, NightRecord[]> = {}
    const todayStr = new Date().toLocaleDateString()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toLocaleDateString()

    records.forEach(r => {
      const dStr = new Date(r.timestamp).toLocaleDateString()
      let key = dStr
      if (dStr === todayStr) key = '今天'
      else if (dStr === yesterdayStr) key = '昨天'
      
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    })
    return groups
  }

  const grouped = groupRecords()
  const hasRecords = records.length > 0

  return (
    <div className="w-full h-full bg-[#0a0a0a] flex flex-col">
      <div className="flex items-center justify-between p-4 bg-[#0a0a0a] sticky top-0 z-10 border-b border-slate-800">
        <div className="flex items-center">
          <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-200">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-medium text-slate-200 ml-2">记录</h1>
        </div>
        {hasRecords && (
          <button onClick={onGoBrief} className="text-yellow-400 font-medium px-4 py-2 text-sm">
            ai晨间简报
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-20">
        {!hasRecords ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center">
            <p className="whitespace-pre-line">还没有记录{'\n'}去主页说点什么吧</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="mb-8">
              <h2 className="text-slate-500 text-sm mb-4 font-medium">{date}</h2>
              <div className="space-y-4">
                {items.map(item => (
                  <div 
                    key={item.id} 
                    className="flex gap-4 group"
                    onContextMenu={(e) => {
                      e.preventDefault()
                      handleDelete(item.id)
                    }}
                  >
                    <div className="text-slate-500 text-sm mt-0.5 shrink-0 w-12">
                      {formatTime(item.timestamp)}
                    </div>
                    <div 
                      className="text-slate-200 text-base leading-relaxed break-words flex-1 cursor-pointer"
                      onClick={() => {
                        // For touch devices, long press is better handled with custom hooks,
                        // but simple prompt on click can work as fallback or we rely on confirm.
                        // Here we just use a simple confirm on click as well for easier mobile interaction
                        // since onContextMenu might not trigger reliably on all mobile browsers without polyfills.
                        if (window.confirm('确定要删除这条记录吗？')) {
                          deleteRecord(item.id)
                          setRecords(getRecords())
                        }
                      }}
                    >
                      {item.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
