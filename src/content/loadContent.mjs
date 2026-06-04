import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { loadAssets } from './loadAssets.mjs'
import { assertArray, assertString, byOrderThenTitle, byPostOrderThenDate } from './types.mjs'
import { listDirectories, readJson } from '../utils/fs.mjs'

function normalizeBasePath (basePath = '/') {
  if (!basePath.startsWith('/')) basePath = `/${basePath}`
  return basePath.endsWith('/') ? basePath : `${basePath}/`
}

function validateUser (user, file) {
  assertString(user.name, 'name', file)
  assertString(user.displayName, 'displayName', file)
  assertArray(user.allowedAuthors, 'allowedAuthors', file)
}

function validateProject (project, file) {
  assertString(project.title, 'title', file)
  assertString(project.slug, 'slug', file)
}

function validateSeries (series, file) {
  assertString(series.title, 'title', file)
  assertString(series.slug, 'slug', file)
}

function validatePost (post, file) {
  assertString(post.title, 'title', file)
  assertString(post.slug, 'slug', file)
  assertString(post.date, 'date', file)
  assertArray(post.tags, 'tags', file)
}

function absoluteUrl (path) {
  return path.endsWith('/') ? path : `${path}/`
}

export async function loadContent ({ rootDir = process.cwd(), basePath } = {}) {
  const siteConfig = await readJson(join(rootDir, 'config/site.json')).catch(error => {
    if (error.code === 'ENOENT') return { title: 'DevNote', basePath: '/', defaultTheme: 'dark' }
    throw error
  })
  siteConfig.basePath = normalizeBasePath(basePath || siteConfig.basePath || '/')

  const userFile = join(rootDir, 'content/user.json')
  const user = await readJson(userFile)
  validateUser(user, userFile)

  const projects = []
  const posts = []
  const assetsByProject = {}
  const projectSlugs = await listDirectories(join(rootDir, 'content/projects'))

  for (const projectDirName of projectSlugs) {
    const projectDir = join(rootDir, 'content/projects', projectDirName)
    const projectFile = join(projectDir, 'project.json')
    const project = await readJson(projectFile)
    validateProject(project, projectFile)
    const assets = await loadAssets({ projectDir, projectSlug: project.slug, basePath: siteConfig.basePath })
    assetsByProject[project.slug] = assets
    const projectNode = { project, assets, series: [], url: absoluteUrl(`/projects/${project.slug}`) }

    const seriesSlugs = await listDirectories(join(projectDir, 'series'))
    for (const seriesDirName of seriesSlugs) {
      const seriesDir = join(projectDir, 'series', seriesDirName)
      const seriesFile = join(seriesDir, 'series.json')
      const series = await readJson(seriesFile)
      validateSeries(series, seriesFile)
      const seriesNode = { series, posts: [], url: absoluteUrl(`/projects/${project.slug}/${series.slug}`) }

      const postSlugs = await listDirectories(join(seriesDir, 'posts'))
      for (const postDirName of postSlugs) {
        const postDir = join(seriesDir, 'posts', postDirName)
        const postFile = join(postDir, 'post.json')
        const contentPath = join(postDir, 'content.mnote')
        const post = await readJson(postFile)
        validatePost(post, postFile)
        if (post.draft) continue
        const source = await readFile(contentPath, 'utf8')
        const postNode = {
          project,
          series,
          post,
          projectUrl: projectNode.url,
          seriesUrl: seriesNode.url,
          contentPath,
          source,
          url: absoluteUrl(`/projects/${project.slug}/${series.slug}/${post.slug}`),
          prev: null,
          next: null
        }
        seriesNode.posts.push(postNode)
        posts.push(postNode)
      }
      seriesNode.posts.sort(byPostOrderThenDate)
      for (let index = 0; index < seriesNode.posts.length; index++) {
        seriesNode.posts[index].prev = index > 0 ? seriesNode.posts[index - 1] : null
        seriesNode.posts[index].next = index < seriesNode.posts.length - 1 ? seriesNode.posts[index + 1] : null
      }
      projectNode.series.push(seriesNode)
    }
    projectNode.series.sort((left, right) => byOrderThenTitle(left.series, right.series))
    projects.push(projectNode)
  }

  projects.sort((left, right) => byOrderThenTitle(left.project, right.project))
  posts.sort((left, right) => String(right.post.date).localeCompare(String(left.post.date)) || byPostOrderThenDate(left, right))

  return { rootDir, siteConfig, user, projects, posts, assetsByProject }
}
