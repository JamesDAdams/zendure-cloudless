import { ZendureDevice } from '../adapters/ZendureDevice.js'

export function createDevice(config) {
  const brand = config.brand?.toLowerCase()
  if (brand === 'zendure') return new ZendureDevice(config)
  throw new Error(`Unsupported brand: ${config.brand}`)
}

export function getBrands() {
  return ['zendure']
}
