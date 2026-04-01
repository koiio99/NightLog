import { NightRecord } from './types'

const KEY = 'nightlog_records'

export function getRecords(): NightRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveRecord(text: string, source: 'voice' | 'text'): NightRecord {
  const record: NightRecord = {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    timestamp: Date.now(),
    text: text.trim(),
    source,
  }
  const records = getRecords()
  records.unshift(record)
  localStorage.setItem(KEY, JSON.stringify(records))
  return record
}

export function deleteRecord(id: string): void {
  const records = getRecords().filter(r => r.id !== id)
  localStorage.setItem(KEY, JSON.stringify(records))
}

export function getRecentRecords(hours: number = 24): NightRecord[] {
  const cutoff = Date.now() - hours * 60 * 60 * 1000
  return getRecords().filter(r => r.timestamp > cutoff)
}