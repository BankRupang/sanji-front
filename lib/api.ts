export const GW = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface ApiResponse {
  ok: boolean
  status: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
}

export async function apiCall(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<ApiResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const opts: RequestInit = { method, headers }
  if (body !== undefined) opts.body = JSON.stringify(body)

  try {
    const res = await fetch(GW + path, opts)
    const txt = await res.text()
    let data: unknown
    try { data = JSON.parse(txt) } catch { data = txt }
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: null }
  }
}
