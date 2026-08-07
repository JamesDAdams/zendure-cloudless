import { Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import ModesPage from './pages/ModesPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'
import DevicesPage from './pages/DevicesPage'
import { useStore } from './store/useStore'
import { useWebSocket } from './hooks/useWebSocket'
import { X } from 'lucide-react'

export default function App() {
  const fetchDevices = useStore((s) => s.fetchDevices)
  const error = useStore((s) => s.error)
  const clearError = useStore((s) => s.clearError)
  useWebSocket()

  useEffect(() => { fetchDevices() }, [fetchDevices])

  return (
    <div className="flex min-h-screen bg-bg text-white font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/modes" element={<ModesPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-900/90 border border-red-500/50 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-red-200 shadow-lg z-50">
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-white shrink-0"><X size={16} /></button>
        </div>
      )}
    </div>
  )
}
