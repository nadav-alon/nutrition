/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import preact from '@preact/preset-vite'
import Icons from 'unplugin-icons/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { manifest } from './src/pwa-manifest.ts'
import { SEED } from './src/seed.ts'
import { iconSrc } from './src/icon-src.ts'

/** Puts the seed in `<head>` as the browser chrome colour, matching the manifest's `theme_color`. */
const themeColour = (): Plugin => ({
  name: 'theme-colour',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'theme-color', content: SEED }, injectTo: 'head' }],
})

/** Versions the favicon link's PWA icon URL by the icon's content, as the manifest's icons are, so a changed icon is refetched. */
const versionedFavicon = (): Plugin => ({
  name: 'versioned-favicon',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) => html.replace(/(<link rel="icon"[^>]*href="\/)(pwa-[^"?]+\.png)"/, (_, head: string, file: string) => `${head}${iconSrc(file, 'public')}"`),
  },
})

export default defineConfig({
  base: '/nutrition/',
  plugins: [preact(), Icons({ compiler: 'jsx', jsx: 'preact', scale: 1 }), themeColour(), versionedFavicon(), VitePWA({ registerType: 'autoUpdate', manifest })],
  test: {
    environment: 'jsdom',
    env: { TZ: 'America/New_York' },
    setupFiles: ['./src/test/setup.ts'],
  },
})
