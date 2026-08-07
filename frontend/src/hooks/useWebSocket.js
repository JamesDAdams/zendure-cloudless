import { useEffect } from 'react'
import { useStore } from '../store/useStore'

export function useWebSocket() {
  const applyWsMessage = useStore((s) => s.applyWsMessage)
  const setWsConnected = useStore((s) => s.setWsConnected)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const initialPath = window.location.pathname.endsWith('/')
      ? window.location.pathname
      : window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1)
    const cleanPath = (initialPath + 'ws').replace(/\/+/g, '/')
    const url = `${protocol}://${window.location.host}${cleanPath}`
    let ws
    let retryTimer

    const connect = () => {
      ws = new WebSocket(url)

      ws.onopen = () => setWsConnected(true)
      ws.onclose = () => {
        setWsConnected(false)
        retryTimer = setTimeout(connect, 3000)
      }
      ws.onmessage = (e) => {
        try { applyWsMessage(JSON.parse(e.data)) } catch {}
      }
    }

    connect()
    return () => {
      clearTimeout(retryTimer)
      ws?.close()
    }
  }, [])
}
