import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createFixtureSite } from './helpers.mjs'
import { loadContent } from '../src/content/loadContent.mjs'

test('loadContent builds the project/series/post tree and excludes drafts', async () => {
  const fixture = await createFixtureSite()
  try {
    const site = await loadContent({ rootDir: fixture.root })
    assert.equal(site.user.displayName, 'MonoBhvr DevLog')
    assert.equal(site.projects.length, 1)
    assert.equal(site.projects[0].series.length, 1)
    assert.equal(site.projects[0].series[0].posts.length, 1)
    assert.equal(site.posts[0].post.slug, 'block-system')
    assert.equal(site.posts[0].url, '/projects/marknote/syntax/block-system/')
    assert.equal(site.posts[0].prev, null)
    assert.equal(site.posts[0].next, null)
    assert.equal(site.assetsByProject.marknote.images['block-diagram'].alt, '블록 다이어그램')
  } finally {
    await fixture.cleanup()
  }
})
