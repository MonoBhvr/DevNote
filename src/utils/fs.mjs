import { mkdir, readFile, readdir, rm, writeFile, cp } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function readJson (path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

export async function writeTextFile (path, content) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

export async function listDirectories (path) {
  try {
    const entries = await readdir(path, { withFileTypes: true })
    return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

export async function resetDir (path) {
  await rm(path, { recursive: true, force: true })
  await mkdir(path, { recursive: true })
}

export async function copyIfExists (from, to) {
  try {
    await cp(from, to, { recursive: true })
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}
