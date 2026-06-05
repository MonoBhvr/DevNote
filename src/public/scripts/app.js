import { renderMarkdownToHtml } from './marknote-browser-entry.mjs'

const app = document.getElementById('app')

function escapeHtml (value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function routePath () {
  const hash = location.hash.replace(/^#/, '')
  return hash || '/'
}

async function json (path) {
  const embedded = embeddedContent(path)
  if (embedded !== undefined) return embedded
  const response = await fetch(path)
  if (!response.ok) throw new Error(`${path} 로드 실패`)
  return response.json()
}

async function text (path) {
  const embedded = embeddedContent(path)
  if (embedded !== undefined) return embedded
  const response = await fetch(path)
  if (!response.ok) throw new Error(`${path} 로드 실패`)
  return response.text()
}

function embeddedContent (path) {
  if (location.protocol !== 'file:') return undefined
  return globalThis.DEVNOTE_CONTENT?.[path]
}

function link (path) {
  return `index.html#${path}`
}

function slugAnchor (value) {
  return value.trim().replace(/\s+/g, '-').replace(/[^\w\-.\u00A0-\uFFFF]/g, '')
}

function inlineMarkNote (value) {
  return escapeHtml(value).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\$([^$]+)\$/g, '<code class="mn-math">$1</code>')
}

function renderMarkNote (source, assets, projectSlug) {
  const toc = extractToc(source)
  const resolvedSource = source.replace(/\[image\[([\s\S]*?)\]\]/g, (match, body) => {
    const [rawAlias, ...captionParts] = body.split('|')
    const alias = rawAlias.trim()
    const caption = captionParts.join('|').trim()
    const asset = assets.images?.[alias]
    if (!asset) return `<div class="marknote-image-broken">이미지 alias 없음: ${escapeHtml(alias)}</div>`
    const src = `content/projects/${projectSlug}/${asset.path.replace(/^\.\//, '')}`
    const label = caption || asset.alt || alias
    return `[image[${src} | ${label}]]`
  })
  return { html: renderMarkdownToHtml(resolvedSource), toc }
}

function extractToc (source) {
  const toc = []
  const headingRe = /^(#{1,6})\s+(.+?)\s+\{#([^}]*)\}\s*$/gm
  let match
  const used = new Set()
  while ((match = headingRe.exec(source)) !== null) {
    const title = match[2].trim()
    const anchor = match[3].trim() ? slugAnchor(match[3]) : slugAnchor(title)
    if (used.has(anchor)) continue
    used.add(anchor)
    toc.push({ level: match[1].length, title, anchor })
  }
  return toc
}

function findProject (state, slug) {
  return state.projects.find(project => project.meta.slug === slug)
}

function findSeries (project, slug) {
  return project.series.find(series => series.meta.slug === slug)
}

function findPost (series, slug) {
  return series.posts.find(post => post.meta.slug === slug)
}

async function loadState () {
  const manifest = await json('content/manifest.json')
  const user = await json(manifest.user)
  const site = await json(manifest.site).catch(() => ({}))
  const projects = []
  for (const projectRef of manifest.projects) {
    const meta = await json(projectRef.json)
    const assets = await json(projectRef.assets).catch(() => ({ images: {} }))
    const series = []
    for (const seriesRef of projectRef.series) {
      const seriesMeta = await json(seriesRef.json)
      const posts = []
      for (const postRef of seriesRef.posts) {
        const postMeta = await json(postRef.json)
        if (!postMeta.draft) posts.push({ meta: postMeta, ref: postRef })
      }
      posts.sort((a, b) => (a.meta.order ?? 0) - (b.meta.order ?? 0))
      series.push({ meta: seriesMeta, ref: seriesRef, posts })
    }
    series.sort((a, b) => (a.meta.order ?? 0) - (b.meta.order ?? 0))
    projects.push({ meta, ref: projectRef, assets, series })
  }
  projects.sort((a, b) => (a.meta.order ?? 0) - (b.meta.order ?? 0))
  return { user, site, projects }
}

function giscusTheme () {
  const theme = document.documentElement.dataset.theme || 'system'
  if (theme === 'dark') return 'dark'
  if (theme === 'light') return 'light'
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function renderGiscusComments (site, post) {
  const giscus = site.giscus || {}
  if (!giscus.enabled) return ''
  if (!giscus.repo || !giscus.repoId || !giscus.category || !giscus.categoryId) {
    return '<section class="comments"><h2>댓글</h2><p class="muted">Giscus 설정에 repoId와 categoryId를 입력하면 댓글이 표시됩니다.</p></section>'
  }
  const term = `${post.ref.content}`
  return `<section class="comments"><h2>댓글</h2><div data-giscus-root data-term="${escapeHtml(term)}"></div></section>`
}

function mountGiscusComments (site) {
  const root = app.querySelector('[data-giscus-root]')
  if (!root) return
  const giscus = site.giscus || {}
  const script = document.createElement('script')
  script.src = 'https://giscus.app/client.js'
  script.async = true
  script.crossOrigin = 'anonymous'
  script.setAttribute('data-repo', giscus.repo)
  script.setAttribute('data-repo-id', giscus.repoId)
  script.setAttribute('data-category', giscus.category)
  script.setAttribute('data-category-id', giscus.categoryId)
  script.setAttribute('data-mapping', giscus.mapping || 'specific')
  script.setAttribute('data-term', root.dataset.term)
  script.setAttribute('data-strict', giscus.strict || '1')
  script.setAttribute('data-reactions-enabled', giscus.reactionsEnabled || '1')
  script.setAttribute('data-emit-metadata', '0')
  script.setAttribute('data-input-position', giscus.inputPosition || 'bottom')
  script.setAttribute('data-theme', giscusTheme())
  script.setAttribute('data-lang', giscus.lang || 'ko')
  root.append(script)
}

function postCard (post, project, series) {
  const url = `/projects/${project.meta.slug}/${series.meta.slug}/${post.meta.slug}`
  return `<article class="card post-card"><a href="${link(url)}"><h3>${escapeHtml(post.meta.title)}</h3></a><time>${escapeHtml(post.meta.date)}</time><p>${escapeHtml(post.meta.description || '')}</p></article>`
}

function renderHome (state) {
  const posts = state.projects.flatMap(project => project.series.flatMap(series => series.posts.map(post => ({ post, project, series })))).sort((a, b) => String(b.post.meta.date).localeCompare(String(a.post.meta.date)))
  app.innerHTML = `<section class="hero"><p class="eyebrow">MarkNote GitBlog Template</p><h1>${escapeHtml(state.user.displayName)}</h1><p>${escapeHtml(state.user.description || '')}</p></section>
  <section class="section"><h2>프로젝트</h2><div class="grid">${state.projects.map(project => `<article class="card"><a href="${link(`/projects/${project.meta.slug}`)}"><h3>${escapeHtml(project.meta.title)}</h3></a><p>${escapeHtml(project.meta.description || '')}</p></article>`).join('')}</div></section>
  <section class="section"><h2>최근 포스트</h2><div class="grid">${posts.map(({ post, project, series }) => postCard(post, project, series)).join('')}</div></section>`
}

function renderProjects (state) {
  app.innerHTML = `<section class="section page-title"><h1>Projects</h1><p>프로젝트별 개발 기록입니다.</p></section><section class="grid">${state.projects.map(project => `<article class="card"><a href="${link(`/projects/${project.meta.slug}`)}"><h2>${escapeHtml(project.meta.title)}</h2></a><p>${escapeHtml(project.meta.description || '')}</p></article>`).join('')}</section>`
}

function renderProject (project) {
  const posts = project.series.flatMap(series => series.posts.map(post => ({ post, series })))
  app.innerHTML = `<section class="hero project-hero"><h1>${escapeHtml(project.meta.title)}</h1><p>${escapeHtml(project.meta.description || '')}</p></section>
  <section class="section"><h2>시리즈</h2><div class="grid">${project.series.map(series => `<article class="card"><a href="${link(`/projects/${project.meta.slug}/${series.meta.slug}`)}"><h3>${escapeHtml(series.meta.title)}</h3></a><p>${escapeHtml(series.meta.description || '')}</p></article>`).join('')}</div></section>
  <section class="section"><h2>프로젝트 내 최근 포스트</h2><div class="grid">${posts.map(({ post, series }) => postCard(post, project, series)).join('')}</div></section>`
}

function renderSeries (project, series) {
  app.innerHTML = `<section class="section page-title"><a class="breadcrumb" href="${link(`/projects/${project.meta.slug}`)}">${escapeHtml(project.meta.title)}</a><h1>${escapeHtml(series.meta.title)}</h1><p>${escapeHtml(series.meta.description || '')}</p></section>
  <section class="section"><h2>시리즈 포스트</h2><div class="grid">${series.posts.map(post => postCard(post, project, series)).join('')}</div></section>`
}

async function renderPost (state, project, series, post) {
  const source = await text(post.ref.content)
  const rendered = renderMarkNote(source, project.assets, project.meta.slug)
  const tree = state.projects.map(projectNode => `<section><a class="tree-project" href="${link(`/projects/${projectNode.meta.slug}`)}">${escapeHtml(projectNode.meta.title)}</a>${projectNode.series.map(seriesNode => `<div class="tree-series"><a href="${link(`/projects/${projectNode.meta.slug}/${seriesNode.meta.slug}`)}">${escapeHtml(seriesNode.meta.title)}</a>${seriesNode.posts.map(postNode => `<a class="tree-post${postNode.meta.slug === post.meta.slug ? ' active' : ''}" href="${link(`/projects/${projectNode.meta.slug}/${seriesNode.meta.slug}/${postNode.meta.slug}`)}">${escapeHtml(postNode.meta.title)}</a>`).join('')}</div>`).join('')}</section>`).join('')
  app.innerHTML = `<article class="post-shell"><header class="post-hero"><p class="eyebrow">${escapeHtml(project.meta.title)} / ${escapeHtml(series.meta.title)}</p><h1>${escapeHtml(post.meta.title)}</h1><time>${escapeHtml(post.meta.date)}</time><p>${escapeHtml(post.meta.description || '')}</p></header>
  <div class="post-layout"><aside class="post-tree">${tree}</aside><div class="post-content marknote-content">${rendered.html}</div><aside class="post-toc"><details open><summary>목차</summary>${rendered.toc.map(item => `<a class="toc-level-${item.level}" href="#${escapeHtml(item.anchor)}">${escapeHtml(item.title)}</a>`).join('')}</details></aside></div>${renderGiscusComments(state.site, post)}</article>`
  mountGiscusComments(state.site)
}

async function render () {
  try {
    const state = await loadState()
    const parts = routePath().split('/').filter(Boolean)
    if (parts.length === 0) return renderHome(state)
    if (parts[0] === 'projects' && parts.length === 1) return renderProjects(state)
    const project = findProject(state, parts[1])
    if (!project) return renderHome(state)
    if (parts.length === 2) return renderProject(project)
    const series = findSeries(project, parts[2])
    if (!series) return renderProject(project)
    if (parts.length === 3) return renderSeries(project, series)
    const post = findPost(series, parts[3])
    if (!post) return renderSeries(project, series)
    return renderPost(state, project, series, post)
  } catch (error) {
    app.innerHTML = `<section class="card"><h1>로드 실패</h1><p>${escapeHtml(error.message)}</p></section>`
  }
}

addEventListener('hashchange', render)
render()
