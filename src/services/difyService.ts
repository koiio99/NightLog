import { BriefResult } from '../types'

export async function generateMorningBrief(recordsText: string): Promise<BriefResult> {
  const apiKey = import.meta.env.VITE_DIFY_API_KEY
  const baseUrl = import.meta.env.VITE_DIFY_BASE_URL

  if (!apiKey || !baseUrl) {
    throw new Error('请先配置 .env.local 文件中的 VITE_DIFY_API_KEY 和 VITE_DIFY_BASE_URL')
  }

  if (!recordsText.trim()) {
    throw new Error('没有可分析的记录内容')
  }

  const response = await fetch(`${baseUrl}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: { records_text: recordsText },
      response_mode: 'blocking',
      user: 'nightlog-user',
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`API请求失败 (${response.status})：${errText}`)
  }

  const data = await response.json()
  const resultText = data?.data?.outputs?.result

  if (!resultText) {
    throw new Error('AI返回内容为空，请检查Dify工作流的结束节点输出变量名是否为 result')
  }

  try {
    const cleaned = resultText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    return JSON.parse(cleaned) as BriefResult
  } catch {
    throw new Error(`AI返回格式解析失败，原始内容：${resultText.slice(0, 100)}`)
  }
}