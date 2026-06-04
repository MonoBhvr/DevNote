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
    if (!response.ok) throw new Error(`GitHub Contents API failed for ${path}`)
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
