import { normalizeImageAlias } from '../github/savePost.mjs'

export function parseTags (value) {
  if (Array.isArray(value)) return value.map(tag => String(tag).trim()).filter(Boolean)
  return String(value || '').split(',').map(tag => tag.trim()).filter(Boolean)
}

export function createAuthoringPost ({ title, slug, description = '', date, updatedAt = '', tags = '', cover = '', order = 1, draft = false }) {
  return {
    title: String(title || '').trim(),
    slug: normalizeImageAlias(slug || title || ''),
    description: String(description || '').trim(),
    date: date || new Date().toISOString().slice(0, 10),
    ...(updatedAt ? { updatedAt } : {}),
    tags: parseTags(tags),
    ...(cover ? { cover: normalizeImageAlias(cover) } : {}),
    order: Number(order || 1),
    draft: Boolean(draft)
  }
}

export function validateAuthoringPost ({ projectSlug, seriesSlug, post, content }) {
  const errors = []
  if (!projectSlug) errors.push('프로젝트를 선택하세요.')
  if (!seriesSlug) errors.push('시리즈를 선택하세요.')
  if (!post.title) errors.push('제목을 입력하세요.')
  if (!post.slug) errors.push('slug를 입력하세요.')
  if (!post.date) errors.push('작성일을 입력하세요.')
  if (!content || !String(content).trim()) errors.push('본문을 입력하세요.')
  return errors
}
