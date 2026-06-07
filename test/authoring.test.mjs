import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

import { buildClientApp } from '../src/build/buildClientApp.mjs'
import { createFixtureSite } from './helpers.mjs'
import { assertAllowedAuthor, verifyGitHubToken } from '../src/github/auth.mjs'
import { createAuthoringPost, parseTags, validateAuthoringPost } from '../src/authoring/postModel.mjs'
import { savePostThroughGitHub } from '../src/authoring/savePost.mjs'
import { uploadImageThroughGitHub } from '../src/authoring/uploadImage.mjs'

test('verifyGitHubToken returns the GitHub login and allowedAuthors gate rejects unknown users', async () => {
  const calls = []
  const identity = await verifyGitHubToken({
    token: 'runtime-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return { ok: true, json: async () => ({ login: 'MonoBhvr' }) }
    }
  })
  assert.equal(identity.login, 'MonoBhvr')
  assert.equal(calls[0].url, 'https://api.github.com/user')
  assert.equal(calls[0].init.headers.Authorization, 'Bearer runtime-token')
  assert.equal(assertAllowedAuthor(identity.login, ['MonoBhvr']), true)
  assert.throws(() => assertAllowedAuthor('SomeoneElse', ['MonoBhvr']), /allowedAuthors/)
})

test('verifyGitHubToken reports invalid token failures clearly', async () => {
  await assert.rejects(() => verifyGitHubToken({
    token: 'bad-token',
    fetchImpl: async () => ({ ok: false, status: 401, text: async () => 'Bad credentials' })
  }), /유효하지 않거나 만료/)
})

test('createAuthoringPost preserves Korean text and normalizes slugs and tags', () => {
  assert.deepEqual(parseTags('MarkNote, Markdown, Parser'), ['MarkNote', 'Markdown', 'Parser'])
  const post = createAuthoringPost({
    title: '블록 문법 설계',
    slug: 'Block System',
    description: '설명',
    date: '2026-06-03',
    tags: 'MarkNote, Parser',
    order: '2',
    draft: true
  })
  assert.equal(post.slug, 'block-system')
  assert.deepEqual(post.tags, ['MarkNote', 'Parser'])
  assert.equal(post.title, '블록 문법 설계')
  assert.equal(post.draft, true)
  assert.deepEqual(validateAuthoringPost({ projectSlug: 'marknote', seriesSlug: 'syntax', post, content: '# 본문' }), [])
})

test('savePostThroughGitHub fetches sha and writes post files serially', async () => {
  const calls = []
  const client = {
    async getFile (path) {
      calls.push(['get', path])
      if (path.endsWith('post.json')) return { sha: 'post-sha' }
      const error = new Error('not found')
      error.status = 404
      throw error
    },
    async putFile (file) {
      calls.push(['put', file.path, file.sha || null])
      return { content: { path: file.path } }
    }
  }
  await savePostThroughGitHub({
    client,
    projectSlug: 'marknote',
    seriesSlug: 'syntax',
    postSlug: 'block-system',
    post: { title: '블록 문법 설계', slug: 'block-system', date: '2026-06-03', tags: [], order: 1, draft: false },
    content: '# 블록 문법 설계 {#}'
  })
  assert.deepEqual(calls, [
    ['get', 'content/projects/marknote/series/syntax/posts/block-system/post.json'],
    ['put', 'content/projects/marknote/series/syntax/posts/block-system/post.json', 'post-sha'],
    ['get', 'content/projects/marknote/series/syntax/posts/block-system/content.mnote'],
    ['put', 'content/projects/marknote/series/syntax/posts/block-system/content.mnote', null]
  ])
})

test('uploadImageThroughGitHub uploads base64 image once and then updates assets.json', async () => {
  const calls = []
  const client = {
    async getFile (path) {
      calls.push(['get', path])
      if (path.endsWith('assets.json')) return { sha: 'assets-sha', text: JSON.stringify({ images: {} }) }
      const error = new Error('not found')
      error.status = 404
      throw error
    },
    async putFile (file) {
      calls.push(['put', file.path, file.content, file.encoding || 'text', file.sha || null])
      return { content: { path: file.path } }
    }
  }
  const result = await uploadImageThroughGitHub({
    client,
    projectSlug: 'marknote',
    alias: 'Block Diagram',
    extension: 'png',
    bytes: new Uint8Array([105, 109, 103]),
    createdAt: '2026-06-03'
  })
  assert.equal(result.marknote, '[image[block-diagram]]')
  assert.deepEqual(calls.map(call => call[0]), ['get', 'get', 'put', 'put'])
  assert.deepEqual(calls[2][2], { base64: 'aW1n' })
  assert.equal(calls[2][3], 'base64')
  assert.equal(calls[3][4], 'assets-sha')
})

test('buildClientApp emits write page and browser assets without embedded secrets', async () => {
  const fixture = await createFixtureSite()
  try {
    await buildClientApp({ rootDir: fixture.root })
    const loginPage = await readFile(join(fixture.root, 'login/index.html'), 'utf8')
    const writePage = await readFile(join(fixture.root, 'write/index.html'), 'utf8')
    const script = await readFile(join(fixture.root, 'assets/scripts/authoring.js'), 'utf8')
    assert.match(loginPage, /관리자 로그인/)
    assert.match(loginPage, /GitHub 로그인/)
    assert.match(loginPage, /data-authoring-mode="login"/)
    assert.match(loginPage, /data-login-panel/)
    assert.match(loginPage, /data-token/)
    assert.match(loginPage, /content\/manifest\.json/)
    assert.match(loginPage, /\.\.\/assets\/scripts\/authoring\.js/)
    assert.match(writePage, /글쓰기/)
    assert.match(writePage, /data-authoring-mode="write"/)
    assert.match(writePage, /data-write-guard hidden/)
    assert.doesNotMatch(writePage, /관리자 로그인이 필요합니다/)
    assert.doesNotMatch(writePage, /글쓰기는 관리자 로그인 후 사용할 수 있습니다/)
    assert.match(writePage, /data-logout/)
    assert.match(writePage, /data-session-status/)
    assert.match(writePage, /data-writing-workspace hidden/)
    assert.match(writePage, /data-preview/)
    assert.match(writePage, /data-image-name/)
    assert.doesNotMatch(writePage, /data-image-alias/)
    assert.doesNotMatch(writePage, /data-image-alt/)
    assert.doesNotMatch(writePage, /data-image-description/)
    assert.doesNotMatch(writePage, /data-login-panel/)
    assert.doesNotMatch(writePage, /data-token/)
    assert.doesNotMatch(loginPage + writePage, /type="module"/)
    assert.match(script, /allowedAuthors/)
    assert.match(script, /devnote-authoring-token:/)
    assert.match(script, /localStorage\.getItem/)
    assert.match(script, /localStorage\.setItem/)
    assert.match(script, /localStorage\.removeItem/)
    assert.match(script, /disabled/)
    assert.doesNotMatch(script, /data-image-alt/)
    assert.doesNotMatch(script, /data-image-description/)
    assert.doesNotMatch(loginPage + writePage + script, /client_secret|ghp_|github_pat_/i)
  } finally {
    await fixture.cleanup()
  }
})
