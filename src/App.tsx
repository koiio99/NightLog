import React, { useState, useEffect, useCallback } from 'react'
import { StatusBar, Style } from '@capacitor/status-bar'
import HomePage from './pages/HomePage'
import SleepPage from './pages/SleepPage'
import HistoryPage from './pages/HistoryPage'
import BriefPage from './pages/BriefPage'

type PageState = 'home' | 'sleep' | 'history' | 'brief'

function App() {
  const [page, setPage] = useState<PageState>('home')
  const exitSleepToHome = useCallback(() => setPage('home'), [])

  useEffect(() => {
    const initApp = async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark })
        await StatusBar.setBackgroundColor({ color: '#000000' })
      } catch {
        void 0
      }
    }
    initApp()
  }, [])

  return (
    <div className="w-screen h-screen overflow-hidden bg-black text-slate-200">
      {page === 'home' && (
        <HomePage 
          onGoSleep={() => setPage('sleep')} 
          onGoHistory={() => setPage('history')} 
        />
      )}
      {page === 'sleep' && <SleepPage onExit={exitSleepToHome} />}
      {page === 'history' && (
        <HistoryPage 
          onBack={() => setPage('home')} 
          onGoBrief={() => setPage('brief')} 
        />
      )}
      {page === 'brief' && (
        <BriefPage onBack={() => setPage('history')} />
      )}
    </div>
  )
}

export default App
