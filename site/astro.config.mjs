// The public landing page (R071) and docs (R074), deployed to GitHub Pages under /vibedoc.
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import sitemap from '@astrojs/sitemap'
import starlight from '@astrojs/starlight'
import { TOOLS } from '../src/lib/mcp-tools'

export default defineConfig({
  site: 'https://quanghoangf.github.io',
  base: '/vibedoc',
  trailingSlash: 'ignore',
  integrations: [
    starlight({
      title: 'VibeDoc docs',
      logo: { src: './src/assets/logo.svg', alt: 'VibeDoc' },
      favicon: '/favicon.svg',
      customCss: ['./src/styles/docs.css'],
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/quanghoangf/vibedoc' }],
      editLink: { baseUrl: 'https://github.com/quanghoangf/vibedoc/edit/main/site/' },
      sidebar: [
        { label: 'Start', items: [{ slug: 'docs' }, { slug: 'docs/ai-install' }, { slug: 'docs/skills' }, { slug: 'docs/troubleshooting' }, { label: 'Changelog', link: '/changelog/' }] },
        { label: 'Concepts', items: [{ autogenerate: { directory: 'docs/concepts' } }] },
        {
          label: 'MCP tools',
          collapsed: true,
          items: [{ label: 'All tools', link: '/docs/tools/' }, ...TOOLS.map((t) => ({ label: t.name, link: `/docs/tools/${t.name}/` }))],
        },
      ],
    }),
    sitemap(),
  ],
  vite: { plugins: [tailwindcss()] },
})
