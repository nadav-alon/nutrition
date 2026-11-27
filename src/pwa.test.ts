import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { manifest } from './pwa-manifest.ts'
import { SEED } from './seed.ts'
import { iconFile, iconSrc } from './icon-src.ts'

describe('PWA manifest', () => {
  it('is installable: standalone with a 192 and a 512 icon that exist', () => {
    expect(manifest.display).toBe('standalone')
    const sizes = manifest.icons!.map((i) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    for (const icon of manifest.icons!) {
      expect(existsSync(join('public', iconFile(icon.src)))).toBe(true)
    }
  })
})

describe('production build', () => {
  it('serves the app under /nutrition/ with a service worker precaching the shell', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'nutrition-build-'))
    execFileSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], { stdio: 'pipe' })
    const html = readFileSync(join(outDir, 'index.html'), 'utf8')
    expect(html).toContain('/nutrition/assets/')
    expect(html).toContain(`<meta name="theme-color" content="${SEED}">`)
    expect(readdirSync(outDir)).toContain('manifest.webmanifest')
    const sw = readFileSync(join(outDir, 'sw.js'), 'utf8')
    expect(sw).toContain('index.html')
  }, 60_000)
})

describe('favicon', () => {
  it('is the 192 manifest icon, which draws the apple', () => {
    const href = readFileSync('index.html', 'utf8').match(/<link rel="icon"[^>]*href="\/([^"]+)"/)?.[1]
    expect(href).toBe(iconFile(manifest.icons!.find((i) => i.sizes === '192x192' && !i.purpose)!.src))
  })
})

describe('deploy workflow', () => {
  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8')

  it('publishes to GitHub Pages on push to main', () => {
    expect(workflow).toMatch(/on:\s*\n\s+push:\s*\n\s+branches: \[main\]/)
    expect(workflow).toContain('actions/deploy-pages')
  })

  it('uploads the build output the Vite config serves under /nutrition/', () => {
    expect(workflow).toContain('npm run build')
    expect(workflow).toMatch(/path: dist\b/)
  })
})

describe('manifest icon URLs', () => {
  it('carry a version taken from the icon file content', () => {
    for (const icon of manifest.icons!) {
      expect(icon.src).toBe(iconSrc(iconFile(icon.src), 'public'))
      expect(icon.src).toMatch(/\.png\?v=[0-9a-f]{8}$/)
    }
  })
})
