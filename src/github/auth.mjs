export async function verifyGitHubToken ({ token, fetchImpl = globalThis.fetch }) {
  if (!token) throw new Error('GitHub token is required')
  if (!fetchImpl) throw new Error('fetch implementation is required')
  const response = await fetchImpl('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    if (response.status === 401) throw new Error('GitHub token이 유효하지 않거나 만료되었습니다.')
    if (response.status === 403) throw new Error('GitHub token 권한이 부족하거나 rate limit에 걸렸습니다.')
    throw new Error(`GitHub 로그인 확인 실패 (${response.status})${detail ? `: ${detail}` : ''}`)
  }
  const user = await response.json()
  if (!user.login) throw new Error('GitHub login response did not include login')
  return { login: user.login, avatarUrl: user.avatar_url || '', htmlUrl: user.html_url || '' }
}

export function assertAllowedAuthor (login, allowedAuthors = []) {
  if (!allowedAuthors.includes(login)) throw new Error(`${login} 계정은 이 블로그의 allowedAuthors에 없습니다.`)
  return true
}
