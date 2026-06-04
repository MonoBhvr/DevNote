import { createGitHubContentsClient } from '../../github/githubApi.mjs'
import { verifyGitHubToken, assertAllowedAuthor } from '../../github/auth.mjs'
import { createAuthoringPost, validateAuthoringPost } from '../../authoring/postModel.mjs'
import { savePostThroughGitHub } from '../../authoring/savePost.mjs'
import { uploadImageThroughGitHub } from '../../authoring/uploadImage.mjs'
import { renderMarkdownToHtml } from './marknote-browser-entry.mjs'

const config = JSON.parse(document.getElementById('devnote-authoring-config').textContent)
const root = document.querySelector('[data-authoring-root]')
const tokenInput = root.querySelector('[data-token]')
const authStatus = root.querySelector('[data-auth-status]')
const saveStatus = root.querySelector('[data-save-status]')
const imageStatus = root.querySelector('[data-image-status]')
const projectSelect = root.querySelector('[data-project]')
const seriesSelect = root.querySelector('[data-series]')
const loginPanel = root.querySelector('[data-login-panel]')
const writingWorkspace = root.querySelector('[data-writing-workspace]')
const contentInput = root.querySelector('[data-content]')
const titleInput = root.querySelector('[data-title]')
const dateInput = root.querySelector('[data-date]')
const tagsInput = root.querySelector('[data-tags]')
const preview = root.querySelector('[data-preview]')
let token = ''
let login = ''

function setStatus (node, message) {
  node.textContent = message
}

function escapeHtml (value) {
  return String(value || '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char])
}

function updatePreview () {
  const title = titleInput.value.trim()
  const date = dateInput.value
  const tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(Boolean)
  const content = contentInput.value.trim()
  const meta = [date ? `<time>${escapeHtml(date)}</time>` : '', tags.length ? `<ul class="tag-list">${tags.map(tag => `<li>${escapeHtml(tag)}</li>`).join('')}</ul>` : ''].filter(Boolean).join('')
  const body = content ? renderMarkdownToHtml(content) : '<p class="muted">작성한 MarkNote가 여기에 렌더링됩니다.</p>'
  preview.innerHTML = `${title ? `<h1>${escapeHtml(title)}</h1>` : '<h1 class="muted">제목을 입력하세요</h1>'}${meta}${body}`
}

function insertSnippet (kind) {
  const snippets = {
    heading1: '# 제목 {#}',
    heading2: '## 소제목 {#section}',
    heading3: '### 항목 {#item}',
    bold: '**강조**',
    italic: '*기울임*',
    quote: '> 인용문',
    link: '[링크](https://example.com)',
    code: '```js\nconsole.log("DevNote")\n```'
  }
  const snippet = snippets[kind]
  if (!snippet) return
  const start = contentInput.selectionStart
  const end = contentInput.selectionEnd
  contentInput.value = `${contentInput.value.slice(0, start)}${snippet}${contentInput.value.slice(end)}`
  contentInput.focus()
  contentInput.setSelectionRange(start + snippet.length, start + snippet.length)
  updatePreview()
}

function parseRepo (value) {
  const [owner, repo] = String(value || '').split('/')
  if (!owner || !repo) throw new Error('config/site.json의 repository를 owner/repo 형식으로 설정하세요.')
  return { owner, repo }
}

function selectedProject () {
  return config.projects.find(project => project.slug === projectSelect.value)
}

function fillProjects () {
  projectSelect.innerHTML = config.projects.map(project => `<option value="${project.slug}">${project.title}</option>`).join('')
  fillSeries()
}

function fillSeries () {
  const project = selectedProject()
  seriesSelect.innerHTML = (project?.series || []).map(series => `<option value="${series.slug}">${series.title}</option>`).join('')
}

function client () {
  const repo = parseRepo(config.repo)
  return createGitHubContentsClient({ ...repo, token, branch: config.branch })
}

root.querySelector('[data-login]').addEventListener('click', async () => {
  try {
    token = tokenInput.value.trim()
    const identity = await verifyGitHubToken({ token })
    assertAllowedAuthor(identity.login, config.allowedAuthors)
    login = identity.login
    setStatus(authStatus, `${login} 계정으로 로그인되었습니다.`)
    loginPanel.hidden = true
    writingWorkspace.hidden = false
    titleInput.focus()
    updatePreview()
  } catch (error) {
    token = ''
    login = ''
    loginPanel.hidden = false
    writingWorkspace.hidden = true
    setStatus(authStatus, `로그인 실패: ${error.message}`)
  }
})

root.querySelector('[data-post-form]').addEventListener('submit', async (event) => {
  event.preventDefault()
  try {
    if (!login) throw new Error('먼저 로그인하세요.')
    const post = createAuthoringPost({
      title: root.querySelector('[data-title]').value,
      slug: root.querySelector('[data-slug]').value,
      description: root.querySelector('[data-description]').value,
      date: root.querySelector('[data-date]').value,
      tags: root.querySelector('[data-tags]').value,
      order: root.querySelector('[data-order]').value,
      draft: root.querySelector('[data-draft]').checked
    })
    const content = contentInput.value
    const errors = validateAuthoringPost({ projectSlug: projectSelect.value, seriesSlug: seriesSelect.value, post, content })
    if (errors.length > 0) throw new Error(errors.join(' '))
    setStatus(saveStatus, '저장 중...')
    await savePostThroughGitHub({ client: client(), projectSlug: projectSelect.value, seriesSlug: seriesSelect.value, postSlug: post.slug, post, content, contentRoot: config.contentRoot, manifestPath: config.manifestPath })
    setStatus(saveStatus, '저장되었습니다. GitHub Pages 반영 후 새로고침하면 공개 페이지에 표시됩니다.')
  } catch (error) {
    setStatus(saveStatus, `저장 실패: ${error.message}`)
  }
})

root.querySelector('[data-upload-image]').addEventListener('click', async () => {
  try {
    if (!login) throw new Error('먼저 로그인하세요.')
    const file = root.querySelector('[data-image-file]').files[0]
    if (!file) throw new Error('이미지를 선택하세요.')
    const extension = file.name.split('.').pop().toLowerCase()
    if (!['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(extension)) throw new Error('지원하지 않는 이미지 형식입니다.')
    setStatus(imageStatus, '업로드 중...')
    const result = await uploadImageThroughGitHub({
      client: client(),
      projectSlug: projectSelect.value,
      alias: root.querySelector('[data-image-alias]').value || file.name.replace(/\.[^.]+$/, ''),
      extension,
      bytes: await file.arrayBuffer(),
      alt: root.querySelector('[data-image-alt]').value,
      description: root.querySelector('[data-image-description]').value,
      createdAt: new Date().toISOString().slice(0, 10),
      overwrite: root.querySelector('[data-image-overwrite]').checked,
      contentRoot: config.contentRoot
    })
    contentInput.value += `\n\n${result.marknote}\n`
    updatePreview()
    setStatus(imageStatus, `${result.marknote} 삽입 완료`)
  } catch (error) {
    setStatus(imageStatus, `업로드 실패: ${error.message}`)
  }
})

projectSelect.addEventListener('change', fillSeries)
root.querySelectorAll('[data-title], [data-date], [data-tags], [data-content]').forEach(node => node.addEventListener('input', updatePreview))
root.querySelectorAll('[data-insert]').forEach(button => button.addEventListener('click', () => insertSnippet(button.dataset.insert)))
dateInput.value = new Date().toISOString().slice(0, 10)
fillProjects()
updatePreview()
