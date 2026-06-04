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
  assert.throws(() => assertAllowedAuthor('SomeoneElse', ['MonoBhvr']), /not allowed/)
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
    alt: '블록 다이어그램',
    description: '설명',
    createdAt: '2026-06-03'
  })
  assert.equal(result.marknote, '[image[block-diagram | 블록 다이어그램]]')
  assert.deepEqual(calls.map(call => call[0]), ['get', 'get', 'put', 'put'])
  assert.deepEqual(calls[2][2], { base64: 'aW1n' })
  assert.equal(calls[2][3], 'base64')
  assert.equal(calls[3][4], 'assets-sha')
})

test('buildClientApp emits write page and browser assets without embedded secrets', async () => {
  const fixture = await createFixtureSite()
  try {
    await buildClientApp({ rootDir: fixture.root })
    const page = await readFile(join(fixture.root, 'write/index.html'), 'utf8')
    const script = await readFile(join(fixture.root, 'assets/scripts/authoring.js'), 'utf8')
    assert.match(page, /GitHub 토큰 로그인/)
    assert.match(page, /글쓰기/)
    assert.match(page, /data-login-panel/)
    assert.match(page, /data-writing-workspace hidden/)
    assert.match(page, /data-preview/)
    assert.match(page, /content\/manifest\.json/)
    assert.match(page, /\.\.\/assets\/scripts\/authoring\.js/)
    assert.doesNotMatch(page, /type="module"/)
    assert.match(script, /allowedAuthors/)
    assert.doesNotMatch(page + script, /client_secret|ghp_|github_pat_/i)
  } finally {
    await fixture.cleanup()
  }
})
