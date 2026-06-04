export function normalizeImageAlias (value) {
  return value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export function createPostFiles ({ projectSlug, seriesSlug, postSlug, post, content, contentRoot = 'content' }) {
  const base = `${contentRoot}/projects/${projectSlug}/series/${seriesSlug}/posts/${postSlug}`
  const message = `${post.draft ? 'Update' : 'Add'} post: ${post.title}`
  return [
    {
      path: `${base}/post.json`,
      content: `${JSON.stringify(post, null, 2)}\n`,
      message
    },
    {
      path: `${base}/content.mnote`,
      content,
      message
    }
  ]
}
