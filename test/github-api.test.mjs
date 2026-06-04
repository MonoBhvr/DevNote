import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createGitHubContentsClient } from '../src/github/githubApi.mjs'
import { createPostFiles, normalizeImageAlias } from '../src/github/savePost.mjs'
import { createImageUploadFiles, updateAssetsMap } from '../src/github/uploadImage.mjs'

test('createPostFiles maps post metadata and mnote content to GitHub Contents API payloads', () => {
  const files = createPostFiles({
    projectSlug: 'marknote',
    seriesSlug: 'syntax',
    postSlug: 'block-system',
    post: { title: '블록 문법 설계', slug: 'block-system', date: '2026-06-03', tags: [], order: 1, draft: false },
    content: '# 블록 문법 설계 {#}'
  })
  assert.deepEqual(files.map(file => file.path), [
    'content/projects/marknote/series/syntax/posts/block-system/post.json',
    'content/projects/marknote/series/syntax/posts/block-system/content.mnote'
  ])
  assert.equal(files[0].message, 'Add post: 블록 문법 설계')
})

test('normalizeImageAlias follows lowercase hyphen rules', () => {
  assert.equal(normalizeImageAlias('Parser Flow 01'), 'parser-flow-01')
})

test('GitHub contents client encodes content and includes sha when provided', async () => {
  const calls = []
  const client = createGitHubContentsClient({
    owner: 'MonoBhvr',
    repo: 'devnote-blog',
    token: 'token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return { ok: true, json: async () => ({ content: { sha: 'next' } }) }
    }
  })
  await client.putFile({ path: 'content/user.json', content: '{}', message: 'Update user', sha: 'abc' })
  const body = JSON.parse(calls[0].init.body)
  assert.equal(body.content, Buffer.from('{}').toString('base64'))
  assert.equal(body.sha, 'abc')
  assert.match(calls[0].url, /repos\/MonoBhvr\/devnote-blog\/contents\/content%2Fuser\.json/)
})

test('createImageUploadFiles writes image bytes and updated assets map paths', () => {
  const currentAssets = { images: {} }
  const image = createImageUploadFiles({
    projectSlug: 'marknote',
    alias: 'Block Diagram',
    extension: 'png',
    bytes: Buffer.from('image-bytes'),
    alt: '블록 다이어그램',
    description: '파서 구조',
    currentAssets,
    createdAt: '2026-06-03'
  })
  assert.equal(image.alias, 'block-diagram')
  assert.deepEqual(image.files.map(file => file.path), [
    'content/projects/marknote/assets/images/block-diagram.png',
    'content/projects/marknote/assets.json'
  ])
  assert.equal(image.files[0].content, Buffer.from('image-bytes').toString('base64'))
  assert.match(image.files[1].content, /\.\/assets\/images\/block-diagram\.png/)
})

test('updateAssetsMap rejects duplicate image aliases unless overwrite is true', () => {
  const currentAssets = { images: { 'block-diagram': { path: './assets/images/block-diagram.png' } } }
  assert.throws(() => updateAssetsMap({ currentAssets, alias: 'block-diagram', extension: 'png' }), /already exists/)
  const updated = updateAssetsMap({ currentAssets, alias: 'block-diagram', extension: 'png', overwrite: true })
  assert.equal(updated.images['block-diagram'].path, './assets/images/block-diagram.png')
})
