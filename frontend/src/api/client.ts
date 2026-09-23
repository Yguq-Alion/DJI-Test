/** Ошибка API с текстом из ProblemDetails, пригодным для показа пользователю. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type Params = Record<string, string | number | null | undefined>

export function buildQuery(params: Params): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') search.set(key, String(value))
  }
  return search.toString()
}

export async function apiGet<T>(path: string, params: Params, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/${path}?${buildQuery(params)}`, {
      signal,
      headers: { Accept: 'application/json' },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'Сервер недоступен. Проверьте соединение и попробуйте ещё раз.')
  }

  if (!response.ok) {
    throw new ApiError(response.status, await problemMessage(response))
  }
  return (await response.json()) as T
}

async function problemMessage(response: Response): Promise<string> {
  try {
    const problem = (await response.json()) as {
      title?: string
      detail?: string
      errors?: Record<string, string[]>
    }
    const firstError = problem.errors ? Object.values(problem.errors).flat()[0] : undefined
    return firstError ?? problem.detail ?? problem.title ?? `Ошибка ${response.status}`
  } catch {
    return `Ошибка ${response.status}`
  }
}
