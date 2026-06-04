import { join, posix } from 'node:path'

import { readJson } from '../utils/fs.mjs'

export async function loadAssets ({ projectDir, projectSlug, basePath }) {
  let assets = { images: {} }
  try {
    assets = await readJson(join(projectDir, 'assets.json'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }

  const images = {}
  for (const [alias, image] of Object.entries(assets.images || {})) {
    const cleanPath = String(image.path || '').replace(/^\.\//, '')
    const fileName = posix.basename(cleanPath)
    images[alias] = {
      ...image,
      path: cleanPath,
      outputPath: `assets/projects/${projectSlug}/images/${fileName}`,
      publicPath: `${basePath}assets/projects/${projectSlug}/images/${fileName}`.replace(/\/+/g, '/')
    }
  }

  return { images }
}

export function resolveImageAlias (assets, alias) {
  return assets?.images?.[alias] || null
}
