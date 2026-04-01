export interface NightRecord {
  id: string
  timestamp: number
  text: string
  source: 'voice' | 'text'
}

export interface BriefResult {
  todos: string[]
  ideas: string[]
  mood: string
}