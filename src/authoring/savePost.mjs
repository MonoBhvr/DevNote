import { createPostFiles } from '../github/savePost.mjs'

async function getSha (client, path) {
  try {
    return (await client.getFile(path)).sha || null
  } catch (error) {
    if (error.status === 404 || /failed/i.test(error.message)) return null
    throw error
  }
}

async function updateManifest (client, manifestPath, projectSlug, seriesSlug, post) {
  if (!manifestPath) return null
  const file = await client.getFile(manifestPath)
  const manifest = JSON.parse(file.text)
  const project = manifest.projects.find(item => item.slug === projectSlug)
  const series = project?.series.find(item => item.slug === seriesSlug)
  if (!series) throw new Error('manifest에서 프로젝트/시리즈를 찾을 수 없습니다.')
  if (!series.posts.some(item => item.slug === post.slug)) {
    const base = `content/projects/${projectSlug}/series/${seriesSlug}/posts/${post.slug}`
    series.posts.push({ title: post.title, slug: post.slug, json: `${base}/post.json`, content: `${base}/content.mnote` })
  }
  return client.putFile({ path: manifestPath, content: `${JSON.stringify(manifest, null, 2)}\n`, message: `Update manifest: ${post.title}`, sha: file.sha })
}

export async function savePostThroughGitHub ({ client, projectSlug, seriesSlug, postSlug, post, content, contentRoot = 'content', manifestPath = '' }) {
  const files = createPostFiles({ projectSlug, seriesSlug, postSlug, post, content, contentRoot })
  const results = []
  for (const file of files) {
    const sha = await getSha(client, file.path)
    results.push(await client.putFile({ ...file, sha }))
  }
  const manifestResult = await updateManifest(client, manifestPath, projectSlug, seriesSlug, post)
  if (manifestResult) results.push(manifestResult)
  return results
}
