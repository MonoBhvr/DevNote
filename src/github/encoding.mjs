export function textToBase64 (value) {
  const bytes = new TextEncoder().encode(value)
  return bytesToBase64(bytes)
}

export function bytesToBase64 (bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of view) binary += String.fromCharCode(byte)
  if (typeof btoa === 'function') return btoa(binary)
  return globalThis.Buffer.from(view).toString('base64')
}

export function base64ToText (value) {
  const binary = typeof atob === 'function' ? atob(value) : globalThis.Buffer.from(value, 'base64').toString('binary')
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
