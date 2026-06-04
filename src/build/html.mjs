export function escapeHtml (value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function joinBase (basePath, path = '') {
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`
  const clean = path.replace(/^\//, '')
  return `${base}${clean}`.replace(/\/+/g, '/')
}

export function pagePathToDist (url) {
  const clean = url.replace(/^\//, '').replace(/\/$/, '')
  return clean ? `${clean}/index.html` : 'index.html'
}
