export function formatTimestamp() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  return `[${year}-${month}-${day} ${hours}:${minutes}:${seconds}]`
}

export function initLogger() {
  if (console._timestamped) return
  console._timestamped = true

  const origLog = console.log
  const origWarn = console.warn
  const origError = console.error
  const origInfo = console.info

  console.log = function (...args) {
    origLog.call(console, formatTimestamp(), ...args)
  }
  console.warn = function (...args) {
    origWarn.call(console, formatTimestamp(), ...args)
  }
  console.error = function (...args) {
    origError.call(console, formatTimestamp(), ...args)
  }
  console.info = function (...args) {
    origInfo.call(console, formatTimestamp(), ...args)
  }
}
