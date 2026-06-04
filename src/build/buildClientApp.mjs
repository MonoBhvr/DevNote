import { mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

import { loadContent } from '../content/loadContent.mjs'
import { copyIfExists, readJson, resetDir, writeTextFile } from '../utils/fs.mjs'
import { renderLayout } from '../components/Layout.mjs'
import { renderWritePage } from './writePage.mjs'

const sourceRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

function relativeAppHtml (html) {
  return html
    .replaceAll('href="/projects/"', 'href="index.html#/projects"')
    .replaceAll('href="/write/"', 'href="write/index.html"')
    .replaceAll('href="/"', 'href="index.html"')
    .replaceAll('href="/DevNote/', 'href="')
    .replaceAll('src="/DevNote/', 'src="')
    .replaceAll('href="/assets/', 'href="assets/')
    .replaceAll('src="/assets/', 'src="assets/')
    .replaceAll('href="/write/', 'href="write/')
}

function relativeWriteHtml (html) {
  return relativeAppHtml(html)
    .replaceAll('href="assets/', 'href="../assets/')
    .replaceAll('src="assets/', 'src="../assets/')
    .replaceAll('href="index.html', 'href="../index.html')
    .replaceAll('href="write/index.html"', 'href="index.html"')
}

function appShell (site) {
  return relativeAppHtml(renderLayout({
    site,
    title: site.siteConfig.title,
    description: site.user.description,
    body: `<section id="app" class="app-loading"><p>콘텐츠를 불러오는 중입니다.</p></section>
    <script src="assets/scripts/content-data.js"></script>
    <script src="assets/scripts/app.js"></script>`
  }))
}

function manifestForSite (site) {
  return {
    user: 'content/user.json',
    site: 'content/site.json',
    projects: site.projects.map(projectNode => ({
      title: projectNode.project.title,
      slug: projectNode.project.slug,
      json: `content/projects/${projectNode.project.slug}/project.json`,
      assets: `content/projects/${projectNode.project.slug}/assets.json`,
      series: projectNode.series.map(seriesNode => ({
        title: seriesNode.series.title,
        slug: seriesNode.series.slug,
        json: `content/projects/${projectNode.project.slug}/series/${seriesNode.series.slug}/series.json`,
        posts: seriesNode.posts.map(postNode => ({
          title: postNode.post.title,
          slug: postNode.post.slug,
          json: `content/projects/${projectNode.project.slug}/series/${seriesNode.series.slug}/posts/${postNode.post.slug}/post.json`,
          content: `content/projects/${projectNode.project.slug}/series/${seriesNode.series.slug}/posts/${postNode.post.slug}/content.mnote`
        }))
      }))
    }))
  }
}

async function contentSnapshot (rootDir, manifest) {
  const snapshot = { 'content/manifest.json': manifest }
  snapshot[manifest.user] = await readJson(join(rootDir, manifest.user))
  const sitePath = join(rootDir, 'config/site.json')
  snapshot[manifest.site] = await readJson(sitePath).catch(() => ({ title: 'DevNote', basePath: '/', defaultTheme: 'dark' }))
  for (const project of manifest.projects) {
    snapshot[project.json] = await readJson(join(rootDir, project.json))
    snapshot[project.assets] = await readJson(join(rootDir, project.assets)).catch(() => ({ images: {} }))
    for (const series of project.series) {
      snapshot[series.json] = await readJson(join(rootDir, series.json))
      for (const post of series.posts) {
        snapshot[post.json] = await readJson(join(rootDir, post.json))
        snapshot[post.content] = await readFile(join(rootDir, post.content), 'utf8')
      }
    }
  }
  return snapshot
}

async function prepareOutput (rootDir, outDir) {
  if (outDir === rootDir) {
    await rm(join(outDir, 'assets'), { recursive: true, force: true })
    await rm(join(outDir, 'write'), { recursive: true, force: true })
    await rm(join(outDir, 'index.html'), { force: true })
    await rm(join(outDir, 'content/manifest.json'), { force: true })
    await rm(join(outDir, 'content/site.json'), { force: true })
    await mkdir(outDir, { recursive: true })
    return
  }
  await resetDir(outDir)
  await copyIfExists(join(rootDir, 'content'), join(outDir, 'content'))
}

export async function buildClientApp ({ rootDir = process.cwd(), outDir = rootDir, docsDir } = {}) {
  outDir = docsDir || outDir
  const site = await loadContent({ rootDir, basePath: '/' })
  await prepareOutput(rootDir, outDir)
  await copyIfExists(join(sourceRoot, 'src/styles'), join(outDir, 'assets/styles'))
  await copyIfExists(join(sourceRoot, 'src/public/scripts'), join(outDir, 'assets/scripts'))
  await build({
    entryPoints: [join(sourceRoot, 'src/public/scripts/app.js')],
    outfile: join(outDir, 'assets/scripts/app.js'),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    legalComments: 'none'
  })
  await build({
    entryPoints: [join(sourceRoot, 'src/public/scripts/authoring.js')],
    outfile: join(outDir, 'assets/scripts/authoring.js'),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    legalComments: 'none'
  })
  await rm(join(outDir, 'assets/scripts/marknote-browser-entry.mjs'), { force: true })

  const siteConfig = await readJson(join(rootDir, 'config/site.json')).catch(() => ({ title: 'DevNote', basePath: '/', defaultTheme: 'dark' }))
  const manifest = manifestForSite(site)
  await writeTextFile(join(outDir, 'content/site.json'), `${JSON.stringify({ ...siteConfig, basePath: '/' }, null, 2)}\n`)
  await writeTextFile(join(outDir, 'content/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await writeTextFile(join(outDir, 'assets/scripts/content-data.js'), `globalThis.DEVNOTE_CONTENT = ${JSON.stringify(await contentSnapshot(rootDir, manifest))};\n`)
  await writeTextFile(join(outDir, 'index.html'), appShell(site))
  await writeTextFile(join(outDir, '.nojekyll'), '')
  await writeTextFile(join(outDir, 'write/index.html'), relativeWriteHtml(renderWritePage(site)))
  return { pages: 2, outDir }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await buildClientApp()
  console.log(`Built client-rendered template into ${result.outDir}`)
  console.log(['index.html', 'write/index.html', 'assets/scripts/app.js', 'assets/scripts/content-data.js', 'content/manifest.json', '.nojekyll'].join('\n'))
}
