import { base64ToText, textToBase64 } from './encoding.mjs'

export function createGitHubContentsClient ({ owner, repo, token, branch, fetchImpl = globalThis.fetch }) {
  if (!fetchImpl) throw new Error('fetch implementation is required')
  const base = `https://api.github.com/repos/${owner}/${repo}/contents`

  async function request (path, init) {
    const url = `${base}/${encodeURIComponent(path)}`
    const response = await fetchImpl(url, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.headers || {})
      }
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      if (response.status === 401) throw new Error('GitHub token이 유효하지 않거나 만료되었습니다.')
      if (response.status === 403) throw new Error('GitHub token에 repository Contents 권한이 부족합니다.')
      if (response.status === 404) throw new Error(`${path}를 찾을 수 없습니다. token이 ${owner}/${repo} 저장소에 접근 가능한지 확인하세요.`)
      throw new Error(`GitHub Contents API 실패 (${response.status}) for ${path}${detail ? `: ${detail}` : ''}`)
    }
    return response.json()
  }

  return {
    async getFile (path) {
      const result = await request(path, { method: 'GET' })
      const content = result.content?.content || result.content
      return {
        ...result,
        sha: result.sha || result.content?.sha,
        text: typeof content === 'string' ? base64ToText(content.replace(/\s/g, '')) : undefined
      }
    },
    async putFile ({ path, content, message, sha }) {
      return request(path, {
        method: 'PUT',
        body: JSON.stringify({
          message,
          content: typeof content === 'string' ? textToBase64(content) : content.base64,
          ...(sha ? { sha } : {}),
          ...(branch ? { branch } : {})
        })
      })
    }
  }
}
