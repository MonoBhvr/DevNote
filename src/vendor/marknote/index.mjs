import hljs from 'highlight.js'

import MarkNoteEngine from './lib/index.mjs'
import { escapeHtml } from './lib/common/utils.mjs'
import marknotePlugin from './lib/marknote/index.mjs'

const markNoteEngine = new MarkNoteEngine({
  html: false,
  linkify: false,
  typographer: false,
  highlight (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
    }

    return escapeHtml(str)
  }
})

markNoteEngine.use(marknotePlugin)

export function renderMarkdownToHtml (markdown) {
  if (typeof markdown !== 'string') {
    throw new TypeError('Input data should be a String')
  }

  return markNoteEngine.render(markdown)
}

export default { renderMarkdownToHtml }
