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
  if (!response.ok) throw new Error('GitHub login failed')
  const user = await response.json()
  if (!user.login) throw new Error('GitHub login response did not include login')
  return { login: user.login, avatarUrl: user.avatar_url || '', htmlUrl: user.html_url || '' }
}

export function assertAllowedAuthor (login, allowedAuthors = []) {
  if (!allowedAuthors.includes(login)) throw new Error(`${login} is not allowed to write this blog`)
  return true
}
