export function haConfigured(config) {
  return !!(config?.homeAssistant?.url && config?.homeAssistant?.token)
}

export function mqttConfigured(config) {
  return !!config?.mqtt?.host
}
