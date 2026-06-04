export function byOrderThenTitle (left, right) {
  return (left.order ?? 0) - (right.order ?? 0) || String(left.title).localeCompare(String(right.title))
}

export function byPostOrderThenDate (left, right) {
  return (left.post.order ?? 0) - (right.post.order ?? 0) || String(right.post.date).localeCompare(String(left.post.date))
}

export function assertString (value, field, file) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${file}: ${field} must be a non-empty string`)
}

export function assertArray (value, field, file) {
  if (!Array.isArray(value)) throw new Error(`${file}: ${field} must be an array`)
}
