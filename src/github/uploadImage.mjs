import { normalizeImageAlias } from './savePost.mjs'
import { bytesToBase64 } from './encoding.mjs'

export function updateAssetsMap ({ currentAssets = { images: {} }, alias, extension, createdAt = '', overwrite = false }) {
  const normalizedAlias = normalizeImageAlias(alias)
  if (!normalizedAlias) throw new Error('Image name is required')
  if (!/^[a-z0-9-]+$/.test(normalizedAlias)) throw new Error(`Invalid image name: ${alias}`)
  if (currentAssets.images?.[normalizedAlias] && !overwrite) throw new Error(`Image name already exists: ${normalizedAlias}`)

  return {
    ...currentAssets,
    images: {
      ...(currentAssets.images || {}),
      [normalizedAlias]: {
        path: `./assets/images/${normalizedAlias}.${extension}`,
        ...(createdAt ? { createdAt } : {})
      }
    }
  }
}

export function createImageUploadFiles ({ projectSlug, alias, extension, bytes, currentAssets = { images: {} }, createdAt = '', overwrite = false, contentRoot = 'content' }) {
  const normalizedAlias = normalizeImageAlias(alias)
  const assets = updateAssetsMap({ currentAssets, alias: normalizedAlias, extension, createdAt, overwrite })
  return {
    alias: normalizedAlias,
    files: [
      {
        path: `${contentRoot}/projects/${projectSlug}/assets/images/${normalizedAlias}.${extension}`,
        content: bytesToBase64(bytes),
        message: `Add image: ${normalizedAlias}`,
        encoding: 'base64'
      },
      {
        path: `${contentRoot}/projects/${projectSlug}/assets.json`,
        content: `${JSON.stringify(assets, null, 2)}\n`,
        message: 'Update image asset map'
      }
    ]
  }
}
