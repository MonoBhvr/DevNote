import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export async function createFixtureSite () {
  const root = await mkdtemp(join(tmpdir(), 'devnote-test-'))
  await mkdir(join(root, 'content/projects/marknote/assets/images'), { recursive: true })
  await mkdir(join(root, 'content/projects/marknote/series/syntax/posts/block-system'), { recursive: true })
  await mkdir(join(root, 'content/projects/marknote/series/syntax/posts/draft-post'), { recursive: true })
  await mkdir(join(root, 'config'), { recursive: true })

  await writeFile(join(root, 'content/user.json'), JSON.stringify({
    name: 'MonoBhvr',
    displayName: 'MonoBhvr DevLog',
    description: 'MarkNote devlog',
    github: 'MonoBhvr',
    allowedAuthors: ['MonoBhvr']
  }, null, 2))
  await writeFile(join(root, 'content/projects/marknote/project.json'), JSON.stringify({
    title: 'MarkNote 개발기',
    slug: 'marknote',
    description: 'MarkNote 기록',
    thumbnail: 'project-cover',
    order: 1,
    createdAt: '2026-06-03',
    updatedAt: '2026-06-03'
  }, null, 2))
  await writeFile(join(root, 'content/projects/marknote/assets.json'), JSON.stringify({
    images: {
      'project-cover': {
        path: './assets/images/project-cover.png'
      },
      'block-cover': {
        path: './assets/images/block-cover.png'
      },
      'block-diagram': {
        path: './assets/images/block-diagram.png'
      }
    }
  }, null, 2))
  await writeFile(join(root, 'content/projects/marknote/series/syntax/series.json'), JSON.stringify({
    title: '문법 설계',
    slug: 'syntax',
    description: '문법 구조',
    order: 1,
    createdAt: '2026-06-03',
    updatedAt: '2026-06-03'
  }, null, 2))
  await writeFile(join(root, 'content/projects/marknote/series/syntax/posts/block-system/post.json'), JSON.stringify({
    title: '블록 문법 설계',
    slug: 'block-system',
    description: '블록 문법 설명',
    date: '2026-06-03',
    updatedAt: '2026-06-03',
    tags: ['MarkNote', 'Parser'],
    cover: 'block-cover',
    order: 1,
    draft: false
  }, null, 2))
  await writeFile(join(root, 'content/projects/marknote/series/syntax/posts/block-system/content.mnote'), '# 블록 문법 설계 {#}\n\n[image[block-diagram | MarkNote 블록 파싱 구조]]\n\n## 하위 목차 {#child}\n\n본문 **강조**와 $x^2$.')
  await writeFile(join(root, 'content/projects/marknote/series/syntax/posts/draft-post/post.json'), JSON.stringify({
    title: '초안',
    slug: 'draft-post',
    date: '2026-06-03',
    tags: [],
    order: 2,
    draft: true
  }, null, 2))
  await writeFile(join(root, 'content/projects/marknote/series/syntax/posts/draft-post/content.mnote'), '# 초안 {#}')
  await writeFile(join(root, 'config/site.json'), JSON.stringify({
    title: 'DevNote',
    basePath: '/DevNote/',
    defaultTheme: 'system',
    repository: 'MonoBhvr/DevNote',
    branch: 'main',
    giscus: {
      enabled: true,
      repo: 'MonoBhvr/devnote-blog',
      repoId: 'R_test',
      category: 'General',
      categoryId: 'DIC_test',
      mapping: 'specific'
    }
  }, null, 2))
  return {
    root,
    cleanup: () => rm(root, { recursive: true, force: true })
  }
}
