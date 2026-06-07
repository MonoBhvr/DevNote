import { createImageUploadFiles } from '../github/uploadImage.mjs'

async function getJsonFile (client, path, fallback) {
  try {
    const file = await client.getFile(path)
    return { sha: file.sha || null, json: JSON.parse(file.text) }
  } catch (error) {
    if (error.status === 404 || /failed/i.test(error.message)) return { sha: null, json: fallback }
    throw error
  }
}

async function getSha (client, path) {
  try {
    return (await client.getFile(path)).sha || null
  } catch (error) {
    if (error.status === 404 || /failed/i.test(error.message)) return null
    throw error
  }
}

export async function uploadImageThroughGitHub ({ client, projectSlug, alias, extension, bytes, createdAt = '', overwrite = false, contentRoot = 'content' }) {
  const assetsPath = `${contentRoot}/projects/${projectSlug}/assets.json`
  const current = await getJsonFile(client, assetsPath, { images: {} })
  const upload = createImageUploadFiles({ projectSlug, alias, extension, bytes, currentAssets: current.json, createdAt, overwrite, contentRoot })
  const imageFile = upload.files[0]
  const assetsFile = upload.files[1]
  const imageSha = await getSha(client, imageFile.path)
  await client.putFile({ ...imageFile, content: { base64: imageFile.content }, sha: imageSha })
  await client.putFile({ ...assetsFile, sha: current.sha })
  return { alias: upload.alias, marknote: `[image[${upload.alias}]]` }
}
