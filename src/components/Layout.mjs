import { escapeHtml, joinBase } from '../build/html.mjs'

export function renderLayout ({ site, title, description = '', body }) {
  const pageTitle = title === site.siteConfig.title ? title : `${title} · ${site.siteConfig.title}`
  const defaultTheme = site.siteConfig.defaultTheme || 'system'
  return `<!doctype html>
<html lang="ko" data-theme="${escapeHtml(defaultTheme)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <title>${escapeHtml(pageTitle)}</title>
  <script>(()=>{try{const t=localStorage.getItem('devnote-theme')||'${escapeHtml(defaultTheme)}';document.documentElement.dataset.theme=t}catch{document.documentElement.dataset.theme='${escapeHtml(defaultTheme)}'}})()</script>
  <link rel="stylesheet" href="${joinBase(site.siteConfig.basePath, 'assets/styles/colors.css')}">
  <link rel="stylesheet" href="${joinBase(site.siteConfig.basePath, 'assets/styles/global.css')}">
</head>
<body>
  <header class="site-header">
    <a class="brand" href="${site.siteConfig.basePath}">${escapeHtml(site.user.displayName)}</a>
    <nav class="top-nav"><a href="${joinBase(site.siteConfig.basePath, 'projects/')}">Projects</a><a href="${joinBase(site.siteConfig.basePath, 'write/')}">글쓰기</a><label class="theme-select">Theme <select data-theme-select aria-label="색상 모드"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></nav>
  </header>
  <script>(()=>{const s=document.querySelector('[data-theme-select]');if(!s)return;const apply=t=>{document.documentElement.dataset.theme=t;s.value=t;try{localStorage.setItem('devnote-theme',t)}catch{}};s.value=document.documentElement.dataset.theme||'system';s.addEventListener('change',()=>apply(s.value))})()</script>
  <main>${body}</main>
</body>
</html>
`
}
