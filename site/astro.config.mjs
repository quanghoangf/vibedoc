// The public landing page (R071), deployed to GitHub Pages under /vibedoc.
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'https://quanghoangf.github.io',
  base: '/vibedoc',
  trailingSlash: 'ignore',
  vite: { plugins: [tailwindcss()] },
})
