import katex from 'katex'

import { escapeHtml } from '../common/utils.mjs'
import { typstMathToLatex } from './typst-math.mjs'

const SPECIAL_ESCAPE_RE = /^[\\$[\]>{}=#*_`!()+\-.|^~:]/
const WORD_CHAR_RE = /[\p{L}\p{N}_]/u
const EMBED_ATTRS = new Set(['image', 'web', 'html', 'card'])
const CARD_LAYOUT_ATTRS = new Set(['classic', 'row', 'notion'])
const TYPE_ATTRS = new Set(['?', '!', 'i', 'b'])
const TYPE_LABELS = {
  '?': '?',
  '!': '!',
  i: 'i',
  b: 'B'
}
const COLOR_ATTRS = new Set(['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'gray'])
const HEX_COLOR_RE = /^#?(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i
const BLOCK_ALIGN_ATTRS = new Set(['left', 'center', 'right'])
const BLOCK_SIZE_RE = /^(?:auto|\d+(?:\.\d+)?(?:px|%))$/i

function renderMath (source, displayMode) {
  try {
    const latex = typstMathToLatex(source.trim())
    return katex.renderToString(latex, {
      displayMode,
      output: 'html',
      throwOnError: false,
      trust: false,
      strict: 'ignore'
    })
  } catch (error) {
    return `<code class="marknote-math-error">${escapeHtml(source)}</code>`
  }
}

function normalizeAnchor (value) {
  return value.trim().replace(/\s+/g, '-').replace(/[^\w\-.\u00A0-\uFFFF]/g, '')
}

function escapeRegExp (value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isWordChar (value) {
  return Boolean(value && WORD_CHAR_RE.test(value))
}

function textContent (tokens) {
  let out = ''
  for (const token of tokens || []) {
    if (token.type === 'text' || token.type === 'code_inline') out += token.content
    if (token.children) out += textContent(token.children)
  }
  return out
}

function stripComments (src) {
  const lines = src.split('\n')
  let inFence = false
  let fence = ''
  let inBlockComment = false
  const out = []

  for (const line of lines) {
    const trimmed = line.trimStart()

    if (!inBlockComment && /^(```|~~~)/.test(trimmed)) {
      const marker = trimmed.slice(0, 3)
      if (!inFence) {
        inFence = true
        fence = marker
      } else if (marker === fence) {
        inFence = false
        fence = ''
      }
      out.push(line)
      continue
    }

    if (inFence) {
      out.push(line)
      continue
    }

    let current = line
    if (inBlockComment) {
      const end = current.indexOf('*/')
      if (end < 0) continue
      current = current.slice(end + 2)
      inBlockComment = false
    }

    for (;;) {
      const start = current.indexOf('/*')
      if (start < 0) break
      const end = current.indexOf('*/', start + 2)
      if (end < 0) {
        current = current.slice(0, start)
        inBlockComment = true
        break
      }
      current = current.slice(0, start) + current.slice(end + 2)
    }

    if (/^\s*\/\/\s/.test(current)) continue
    out.push(current)
  }

  return out.join('\n')
}

function extractDictionary (src, env) {
  const lines = src.split('\n')
  const dictionary = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const match = /^@([^:]+):\s*(.*)$/.exec(line)
    if (!match) break
    dictionary.push({ term: match[1].trim(), description: match[2].trim() })
    index++
  }

  if (dictionary.length > 0 && lines[index] === '') index++
  if (dictionary.length > 0) env.marknoteDictionary = dictionary
  return lines.slice(index).join('\n')
}

function preprocess (state) {
  state.src = extractDictionary(stripComments(state.src), state.env)
}

function marknoteEscape (state, silent) {
  const pos = state.pos
  const src = state.src
  if (src.charCodeAt(pos) !== 0x5C) return false

  const next = src[pos + 1]
  if (!next) return false

  let content = null
  let end = pos + 2

  if (next === 'n' || next === 't') {
    if (!silent) state.push(next === 'n' ? 'marknote_escape_newline' : 'marknote_escape_tab', '', 0)
    state.pos = end
    return true
  } else if (src.startsWith('\\//', pos)) {
    content = '//'
    end = pos + 3
  } else if (next === '{') {
    const close = src.indexOf('\\}', pos + 2)
    if (close < 0) return false
    content = src.slice(pos + 2, close)
    end = close + 2
  } else if (SPECIAL_ESCAPE_RE.test(next)) {
    content = next
  }

  if (content === null) return false
  if (!silent) {
    const token = state.push('text_special', '', 0)
    token.content = content
    token.markup = src.slice(pos, end)
    token.info = 'marknote_escape'
  }
  state.pos = end
  return true
}

function inlineMath (state, silent) {
  const start = state.pos
  const src = state.src
  if (src[start] !== '$' || src[start + 1] === '$') return false
  if (start > 0 && src[start - 1] === '\\') return false

  let end = start + 1
  while ((end = src.indexOf('$', end)) >= 0) {
    if (src[end - 1] !== '\\') break
    end++
  }
  if (end < 0 || end === start + 1) return false

  if (!silent) {
    const token = state.push('marknote_math_inline', '', 0)
    token.content = src.slice(start + 1, end)
  }
  state.pos = end + 1
  return true
}

function highlight (state, silent) {
  const start = state.pos
  const src = state.src
  if (src[start] !== '=') return false
  const marker = src.startsWith('===', start) ? '===' : src.startsWith('==', start) ? '==' : null
  if (!marker) return false
  const end = src.indexOf(marker, start + marker.length)
  if (end < 0 || end === start + marker.length) return false
  if (!silent) {
    const open = state.push('marknote_highlight_open', 'mark', 1)
    open.attrSet('class', marker.length === 3 ? 'marknote-highlight-strong' : 'marknote-highlight')
    state.pos = start + marker.length
    state.posMax = end
    state.md.inline.tokenize(state)
    state.push('marknote_highlight_close', 'mark', -1)
  }
  state.pos = end + marker.length
  state.posMax = src.length
  return true
}

function footnote (state, silent) {
  const start = state.pos
  const src = state.src
  if (!src.startsWith('[^', start)) return false

  let depth = 0
  let end = -1
  for (let pos = start + 2; pos < src.length; pos++) {
    if (src[pos] === '\\') {
      pos++
    } else if (src[pos] === '[') {
      depth++
    } else if (src[pos] === ']') {
      if (depth === 0) {
        end = pos
        break
      }
      depth--
    }
  }
  if (end < 0) return false
  const raw = src.slice(start + 2, end).trim()
  if (!raw) return false
  let name = ''
  let content = raw
  const named = /^\(([^)]+)\)\s*(.*)$/.exec(raw)
  if (named) {
    name = named[1].trim()
    content = named[2].trim()
  }
  if (!content) return false

  if (!silent) {
    if (!state.env.marknoteFootnotes) state.env.marknoteFootnotes = []
    const index = state.env.marknoteFootnotes.length + 1
    state.env.marknoteFootnotes.push({ index, name, content })
    const token = state.push('marknote_footnote_ref', '', 0)
    token.meta = { index, name }
  }
  state.pos = end + 1
  return true
}

function inlineAnchor (state, silent) {
  const start = state.pos
  const match = /^\{#([^}]+)\}/.exec(state.src.slice(start))
  if (!match) return false
  const id = normalizeAnchor(match[1])
  if (!id) return false
  if (!silent) {
    const token = state.push('marknote_anchor', '', 0)
    token.meta = { id }
  }
  state.pos = start + match[0].length
  return true
}

function displayMath (state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine]
  const max = state.eMarks[startLine]
  if (state.src.slice(pos, max).trim() !== '$$') return false
  if (silent) return true

  let nextLine = startLine + 1
  while (nextLine < endLine) {
    pos = state.bMarks[nextLine] + state.tShift[nextLine]
    if (state.src.slice(pos, state.eMarks[nextLine]).trim() === '$$') break
    nextLine++
  }
  if (nextLine >= endLine) return false

  const token = state.push('marknote_math_block', '', 0)
  token.block = true
  token.content = state.getLines(startLine + 1, nextLine, state.blkIndent, false)
  token.map = [startLine, nextLine + 1]
  state.line = nextLine + 1
  return true
}

function findBlockOpeningEnd (src, start) {
  if (src[start] !== '[') return -1
  const attrEnd = src.indexOf('[', start + 1)
  if (attrEnd < 0) return -1
  const attr = src.slice(start + 1, attrEnd).trim()
  if (attr.includes('[') || attr.includes(']') || attr.includes('\n')) return -1
  return attrEnd
}

function findBlockStyleClose (src, start) {
  if (src[start] !== ']' || src[start + 1] !== '@' || src[start + 2] !== '{') return null
  const styleEnd = src.indexOf('}]', start + 3)
  if (styleEnd < 0) return null
  return {
    style: src.slice(start + 3, styleEnd).trim(),
    end: styleEnd + 1
  }
}

function parseBlockSource (state, startLine) {
  const start = state.bMarks[startLine] + state.tShift[startLine]
  const attrEnd = findBlockOpeningEnd(state.src, start)
  if (attrEnd < 0) return null
  const attr = state.src.slice(start + 1, attrEnd).trim()

  let depth = 1
  let pos = attrEnd + 1
  while (pos < state.src.length) {
    if (state.src[pos] === '\\') {
      pos += 2
      continue
    }

    const nestedAttrEnd = findBlockOpeningEnd(state.src, pos)
    if (nestedAttrEnd >= 0) {
      depth++
      pos = nestedAttrEnd + 1
      continue
    }

    const styleClose = findBlockStyleClose(state.src, pos)
    if (styleClose) {
      depth--
      if (depth === 0) {
        const content = state.src.slice(attrEnd + 1, pos)
        const line = state.src.slice(0, styleClose.end + 1).split('\n').length
        return { attr, content, style: styleClose.style, nextLine: line }
      }
      pos = styleClose.end
    } else if (state.src[pos] === ']' && state.src[pos + 1] === ']') {
      depth--
      if (depth === 0) {
        const content = state.src.slice(attrEnd + 1, pos)
        const line = state.src.slice(0, pos + 2).split('\n').length
        return { attr, content, style: '', nextLine: line }
      }
      pos++
    }
    pos++
  }
  return null
}

function splitEmbed (content) {
  const parts = content.split('|')
  return { value: parts[0].trim(), label: parts.slice(1).join('|').trim() }
}

function splitFold (content) {
  const normalized = content.replace(/^\r?\n/, '')
  const lines = normalized.split('\n')
  return {
    summary: lines[0]?.trim() || 'Fold',
    body: lines.slice(1).join('\n')
  }
}

function parseCardAttr (token) {
  if (token === 'card') return { embed: 'card', layout: '' }
  const match = /^card\((classic|row|notion)\)$/.exec(token)
  return match ? { embed: 'card', layout: match[1] } : null
}

function parseBlockStyle (style) {
  const out = { width: '', height: '', align: '' }
  for (const declaration of style.split(/[;,]/)) {
    const match = /^\s*([a-z]+)\s*:\s*([^;,]+?)\s*$/i.exec(declaration)
    if (!match) continue
    const key = match[1].toLowerCase()
    const value = match[2].trim()
    if ((key === 'width' || key === 'height') && BLOCK_SIZE_RE.test(value)) out[key] = value
    if (key === 'align' && BLOCK_ALIGN_ATTRS.has(value.toLowerCase())) out.align = value.toLowerCase()
  }
  return out
}

function parseBlockAttrs (attr, style = '') {
  const tokens = attr.split(/\s+/).map(token => token.trim()).filter(Boolean)
  const cardAttrs = tokens.map(parseCardAttr).filter(Boolean)
  const embeds = tokens
    .filter(token => EMBED_ATTRS.has(token) && token !== 'card')
    .concat(cardAttrs.map(card => card.embed))
  const color = tokens.find(token => COLOR_ATTRS.has(token.toLowerCase()) || HEX_COLOR_RE.test(token)) || ''
  const foldToken = tokens.find(token => /^(?:fold|>)[+-]?$/.test(token)) || ''
  const cardLayout = cardAttrs.find(card => card.layout)?.layout || tokens.find(token => CARD_LAYOUT_ATTRS.has(token)) || 'classic'

  return {
    fold: Boolean(foldToken),
    foldOpen: foldToken.endsWith('+'),
    embed: embeds.length === 1 ? embeds[0] : '',
    embedConflict: embeds.length > 1,
    cardLayout,
    type: tokens.find(token => TYPE_ATTRS.has(token)) || '',
    color: color.toLowerCase(),
    style: parseBlockStyle(style)
  }
}

function blockLayoutStyle (style) {
  const declarations = []
  if (style.width) declarations.push(`width: ${escapeHtml(style.width)}`)
  if (style.height) declarations.push(`height: ${escapeHtml(style.height)}`)
  if (style.align === 'center') declarations.push('margin-left: auto', 'margin-right: auto')
  if (style.align === 'right') declarations.push('margin-left: auto')
  return declarations.length > 0 ? ` style="${declarations.join('; ')}"` : ''
}

function blockStyleAttr (color, style) {
  const declarations = []
  if (color && HEX_COLOR_RE.test(color)) {
    const value = color.startsWith('#') ? color : `#${color}`
    declarations.push(`--marknote-block-color: ${escapeHtml(value)}`)
  }
  if (style.width) declarations.push(`width: ${escapeHtml(style.width)}`)
  if (style.height) declarations.push(`height: ${escapeHtml(style.height)}`)
  if (style.align === 'center') declarations.push('margin-left: auto', 'margin-right: auto')
  if (style.align === 'right') declarations.push('margin-left: auto')
  return declarations.length > 0 ? ` style="${declarations.join('; ')}"` : ''
}

function cardStyleDataAttrs (style) {
  const attrs = []
  if (style.width) attrs.push(`data-marknote-card-width="${escapeHtml(style.width)}"`)
  if (style.height) attrs.push(`data-marknote-card-height="${escapeHtml(style.height)}"`)
  if (style.align) attrs.push(`data-marknote-card-align="${escapeHtml(style.align)}"`)
  return attrs.length > 0 ? ` ${attrs.join(' ')}` : ''
}

function blockClass (attrs) {
  const classes = ['marknote-block']
  if (attrs.type) {
    classes.push('marknote-block-has-type')
    classes.push(`marknote-block-type-${attrs.type === '?' ? 'question' : attrs.type === '!' ? 'warning' : attrs.type}`)
  }
  if (attrs.color && COLOR_ATTRS.has(attrs.color)) classes.push(`marknote-block-color-${attrs.color}`)
  if (attrs.color && HEX_COLOR_RE.test(attrs.color)) classes.push('marknote-block-color-custom')
  return classes.join(' ')
}

function foldClass (attrs) {
  return ['marknote-fold', blockClass(attrs)].join(' ')
}

function decorateBlock (content, attrs) {
  const marker = attrs.type ? `<span class="marknote-block-marker" aria-hidden="true">${TYPE_LABELS[attrs.type]}</span>` : ''
  return `<div class="${blockClass(attrs)}"${blockStyleAttr(attrs.color, attrs.style)}>${marker}<div class="marknote-block-content">${content}</div></div>\n`
}

function renderEmbed (embed, content, attrs) {
  if (embed === 'image') {
    const { value, label } = splitEmbed(content)
    return `<figure class="marknote-embed marknote-embed-image"${blockLayoutStyle(attrs.style)}><img src="${escapeHtml(value)}" alt="${escapeHtml(label)}">${label ? `<figcaption>${escapeHtml(label)}</figcaption>` : ''}</figure>\n`
  }
  if (embed === 'web') {
    const { value, label } = splitEmbed(content)
    return `<figure class="marknote-embed marknote-embed-web"${blockLayoutStyle(attrs.style)}><iframe sandbox="allow-same-origin allow-scripts" src="${escapeHtml(value)}" title="${escapeHtml(label || value)}"></iframe>${label ? `<figcaption>${escapeHtml(label)}</figcaption>` : ''}</figure>\n`
  }
  if (embed === 'html') return `<iframe class="marknote-embed marknote-embed-html" sandbox srcdoc="${escapeHtml(content)}"${blockLayoutStyle(attrs.style)}></iframe>\n`
  if (embed === 'card') {
    const { value, label } = splitEmbed(content)
    const title = label || value
    return `<a class="marknote-card" href="${escapeHtml(value)}" data-marknote-card-url="${escapeHtml(value)}" data-marknote-card-title="${escapeHtml(title)}" data-marknote-card-layout="${escapeHtml(attrs.cardLayout)}"${cardStyleDataAttrs(attrs.style)}${blockLayoutStyle(attrs.style)}>${escapeHtml(title)}</a>\n`
  }
  return ''
}

function renderBlockBody (state, attrs, content) {
  if (attrs.embed) return renderEmbed(attrs.embed, content, attrs)
  return state.md.render(content, state.env)
}

function block (state, startLine, endLine, silent) {
  const parsed = parseBlockSource(state, startLine)
  if (!parsed) return false
  if (silent) return true

  const attrs = parseBlockAttrs(parsed.attr, parsed.style)
  const token = state.push('marknote_raw_block', '', 0)
  token.block = true

  if (attrs.fold) {
    const { summary, body } = splitFold(parsed.content)
    const bodyContent = renderBlockBody(state, attrs, body)
    const marker = attrs.type ? `<span class="marknote-block-marker" aria-hidden="true">${TYPE_LABELS[attrs.type]}</span>` : ''
    token.content = `<details class="${foldClass(attrs)}"${attrs.foldOpen ? ' open' : ''}${blockStyleAttr(attrs.color, attrs.style)}><summary>${marker}<span>${state.md.renderInline(summary, state.env)}</span></summary><div class="marknote-block-content">${bodyContent}</div></details>\n`
  } else if (attrs.embed && !attrs.type && !attrs.color) {
    token.content = renderEmbed(attrs.embed, parsed.content, attrs)
  } else {
    token.content = decorateBlock(renderBlockBody(state, attrs, parsed.content), attrs)
  }

  state.line = parsed.nextLine
  return true
}

function applyDictionary (state) {
  const dictionary = [...(state.env.marknoteDictionary || [])]
    .filter(entry => entry.term)
    .sort((a, b) => b.term.length - a.term.length)
  if (dictionary.length === 0) return

  for (const blockToken of state.tokens) {
    if (blockToken.type !== 'inline' || !blockToken.children) continue
    const next = []
    for (const child of blockToken.children) {
      if (child.type !== 'text') {
        next.push(child)
        continue
      }
      let segments = [{ text: child.content }]
      for (const entry of dictionary) {
        const pattern = new RegExp(escapeRegExp(entry.term), 'gu')
        segments = segments.flatMap(segment => {
          if (!segment.text) return [segment]
          const out = []
          let lastIndex = 0
          let match
          while ((match = pattern.exec(segment.text)) !== null) {
            const before = segment.text[match.index - 1]
            const after = segment.text[match.index + match[0].length]
            if (isWordChar(before) || isWordChar(after)) continue
            if (match.index > lastIndex) out.push({ text: segment.text.slice(lastIndex, match.index) })
            out.push({ term: match[0], description: entry.description })
            lastIndex = match.index + match[0].length
          }
          if (lastIndex < segment.text.length) out.push({ text: segment.text.slice(lastIndex) })
          return out.length > 0 ? out : [segment]
        })
      }
      for (const segment of segments) {
        const token = new state.Token(segment.term ? 'html_inline' : 'text', '', 0)
        token.content = segment.term
          ? `<span class="marknote-term" title="${escapeHtml(segment.description)}">${escapeHtml(segment.term)}</span>`
          : segment.text
        next.push(token)
      }
    }
    blockToken.children = next
  }
}

function removeHeadingAnchor (inline) {
  if (!inline.children) return null
  const title = textContent(inline.children).replace(/\s*\{#[^}]*\}\s*$/, '').trim()

  for (let index = inline.children.length - 1; index >= 0; index--) {
    const child = inline.children[index]
    if (child.type === 'text' && child.content.trim() === '') continue

    if (child.type === 'marknote_anchor') {
      inline.children.splice(index, 1)
      if (index > 0 && inline.children[index - 1].type === 'text') {
        inline.children[index - 1].content = inline.children[index - 1].content.replace(/\s+$/, '')
      }
      inline.content = inline.content.replace(/\s*\{#[^}]+\}\s*$/, '')
      return { id: child.meta.id, title }
    }

    if (child.type === 'text') {
      const match = /\s*\{#([^}]*)\}\s*$/.exec(child.content)
      if (match) {
        child.content = child.content.slice(0, match.index)
        inline.content = inline.content.replace(/\s*\{#[^}]*\}\s*$/, '')
        const explicit = match[1].trim()
        return { id: normalizeAnchor(explicit || title), title }
      }
    }

    break
  }

  return null
}

function reserveAnchor (usedAnchors, id) {
  if (!id || usedAnchors.has(id)) return false
  usedAnchors.add(id)
  return true
}

function assemble (state) {
  const usedAnchors = state.env.marknoteUsedAnchors || new Set()
  state.env.marknoteUsedAnchors = usedAnchors
  state.env.marknoteToc = state.env.marknoteToc || []

  for (let i = 0; i < state.tokens.length; i++) {
    const token = state.tokens[i]
    if (token.type === 'heading_open') {
      const inline = state.tokens[i + 1]
      if (!inline || inline.type !== 'inline') continue
      const anchor = removeHeadingAnchor(inline)
      if (!anchor) continue
      if (reserveAnchor(usedAnchors, anchor.id)) {
        token.attrSet('id', anchor.id)
        state.env.marknoteToc.push({
          level: Number(token.tag.slice(1)),
          id: anchor.id,
          title: anchor.title
        })
      }
    }
  }

  for (const blockToken of state.tokens) {
    if (blockToken.type !== 'inline' || !blockToken.children) continue
    for (const child of blockToken.children) {
      if (child.type !== 'marknote_anchor') continue
      child.meta.skip = !reserveAnchor(usedAnchors, child.meta.id)
    }
  }

  applyDictionary(state)

  const footnotes = state.env.marknoteFootnotes || []
  if (footnotes.length > 0) {
    const token = new state.Token('marknote_footnotes', '', 0)
    token.block = true
    token.meta = { footnotes }
    state.tokens.push(token)
  }
}

export default function marknotePlugin (md) {
  md.core.ruler.before('normalize', 'marknote_preprocess', preprocess)
  md.core.ruler.after('inline', 'marknote_assemble', assemble)
  md.block.ruler.before('fence', 'marknote_math_block', displayMath, { alt: ['paragraph', 'reference', 'blockquote', 'list'] })
  md.block.ruler.before('paragraph', 'marknote_block', block, { alt: ['paragraph', 'reference', 'blockquote', 'list'] })
  md.inline.ruler.before('escape', 'marknote_escape', marknoteEscape)
  md.inline.ruler.before('escape', 'marknote_math_inline', inlineMath)
  md.inline.ruler.before('emphasis', 'marknote_highlight', highlight)
  md.inline.ruler.before('link', 'marknote_footnote', footnote)
  md.inline.ruler.before('text', 'marknote_anchor', inlineAnchor)

  md.renderer.rules.marknote_math_inline = (tokens, idx) => renderMath(tokens[idx].content, false)
  md.renderer.rules.marknote_math_block = (tokens, idx) => `<div class="marknote-math-block">${renderMath(tokens[idx].content, true)}</div>\n`
  md.renderer.rules.marknote_raw_block = (tokens, idx) => tokens[idx].content
  md.renderer.rules.marknote_escape_newline = () => '<br>\n'
  md.renderer.rules.marknote_escape_tab = () => '&emsp;'
  md.renderer.rules.marknote_footnote_ref = (tokens, idx) => {
    const { index, name } = tokens[idx].meta
    return `<sup class="marknote-footnote-ref" id="fnref-${index}"><a href="#fn-${index}" title="${escapeHtml(name || `Footnote ${index}`)}">${index}</a></sup>`
  }
  md.renderer.rules.marknote_anchor = (tokens, idx) => tokens[idx].meta.skip ? '' : `<span id="${escapeHtml(tokens[idx].meta.id)}"></span>`
  md.renderer.rules.marknote_footnotes = (tokens, idx) => {
    const items = tokens[idx].meta.footnotes.map(note => `<li id="fn-${note.index}">${md.renderInline(note.content)} <a href="#fnref-${note.index}">back</a></li>`).join('')
    return `<section class="marknote-footnotes"><ol>${items}</ol></section>\n`
  }
}
