// The public landing page (R071), deployed to GitHub Pages under /vibedoc.
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://quanghoangf.github.io',
  base: '/vibedoc',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
})
