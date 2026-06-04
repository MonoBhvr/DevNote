import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

import { buildClientApp } from '../src/build/buildClientApp.mjs'
import { createFixtureSite } from './helpers.mjs'

test('buildClientApp emits a client-rendered app shell, content manifest, and write page', async () => {
  const fixture = await createFixtureSite()
  try {
    await buildClientApp({ rootDir: fixture.root })
    const home = await readFile(join(fixture.root, 'index.html'), 'utf8')
    const manifest = await readFile(join(fixture.root, 'content/manifest.json'), 'utf8')
    const appScript = await readFile(join(fixture.root, 'assets/scripts/app.js'), 'utf8')
    const contentData = await readFile(join(fixture.root, 'assets/scripts/content-data.js'), 'utf8')
    const write = await readFile(join(fixture.root, 'write/index.html'), 'utf8')
    await stat(join(fixture.root, 'assets/styles/colors.css'))
    assert.match(home, /href="assets\/styles\/global\.css"/)
    assert.match(home, /href="write\/index\.html"/)
    assert.match(home, /data-theme="system"/)
    assert.match(home, /data-theme-select/)
    assert.match(home, /assets\/scripts\/app\.js/)
    assert.doesNotMatch(home, /type="module"/)
    assert.match(manifest, /content\/projects\/marknote\/series\/syntax\/posts\/block-system\/content\.mnote/)
    assert.match(appScript, /DEVNOTE_CONTENT/)
    assert.match(contentData, /content\/projects\/marknote\/series\/syntax\/posts\/block-system\/content\.mnote/)
    assert.match(write, /GitHub 토큰 로그인/)
    assert.match(write, /GitHub 로그인/)
    assert.match(write, /data-login-panel/)
    assert.match(write, /data-writing-workspace hidden/)
    assert.match(write, /data-editor-pane/)
    assert.match(write, /data-preview-pane/)
    assert.match(write, /marknote-content/)
    assert.doesNotMatch(home, /\/DevNote\//)
  } finally {
    await fixture.cleanup()
  }
})
