import axios from 'axios'

const initialPath = typeof window !== 'undefined' && window.location
  ? (window.location.pathname.endsWith('/')
      ? window.location.pathname
      : window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1))
  : '/'

export const api = axios.create({ baseURL: `${initialPath}api`.replace(/\/+/g, '/') })
