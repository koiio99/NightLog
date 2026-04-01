import { WebSocket } from 'ws'
import crypto from 'crypto'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')
function loadEnvLocal() {
  if (!existsSync(envPath)) return
  const text = readFileSync(envPath, 'utf8')
  for (const line of text.split('\n')) {
    const m = line.match(/^(\w+)=(.*)$/)
    if (m) process.env[m[1]] = m[2].trim()
  }
}
loadEnvLocal()

const apiKey = process.env.VITE_XFYUN_API_KEY || ''
const secretRaw = process.env.VITE_XFYUN_API_SECRET || ''
if (!apiKey || !secretRaw) {
  console.error('Missing VITE_XFYUN_API_KEY / VITE_XFYUN_API_SECRET in .env.local')
  process.exit(1)
}

function buildUrl(secret) {
  const host = 'iat-api.xfyun.cn'
  const date = new Date().toUTCString()
  const requestLine = 'GET /v2/iat HTTP/1.1'
  const signatureOrigin = ['host: ' + host, 'date: ' + date, requestLine].join('\n')
  const hmac = crypto.createHmac('sha256', secret).update(signatureOrigin).digest('base64')
  const authorizationOrigin =
    `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${hmac}"`
  const authorization = Buffer.from( authorizationOrigin, 'utf8').toString('base64')
  const q = new URLSearchParams({ authorization, date, host })
  return `wss://iat-api.xfyun.cn/v2/iat?${q.toString()}`
}

function tryConnect(label, secret) {
  return new Promise((resolve) => {
    const url = buildUrl(secret)
    const ws = new WebSocket(url)
    const t = setTimeout(() => {
      try {
        ws.close()
      } catch {
        void 0
      }
      resolve(`${label}: timeout`)
    }, 12000)
    ws.on('open', () => {
      clearTimeout(t)
      ws.close()
      resolve(`${label}: OPEN OK`)
    })
    ws.on('error', (e) => {
      clearTimeout(t)
      resolve(`${label}: error ${e.message}`)
    })
  })
}

let secretDecoded
try {
  secretDecoded = Buffer.from(secretRaw, 'base64').toString('utf8')
} catch {
  secretDecoded = ''
}

console.log('Secret raw length', secretRaw.length)
console.log('Base64 decode as utf8', JSON.stringify(secretDecoded))

const a = await tryConnect('hmac_key=env_string_as_is', secretRaw)
console.log(a)
const b = await tryConnect('hmac_key=base64_decoded_utf8', secretDecoded)
console.log(b)
