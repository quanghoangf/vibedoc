// Builds the desktop installers (R112 T581): `pnpm --dir desktop run dist` (this OS) or `dist:all` (mac, win, linux;
// best on macOS: Windows' installer step may need wine elsewhere. CI builds each OS on its own runner).
// 1. The VibeDoc npm package as the root would publish it (`npm pack`; needs `pnpm build`, `build:playwright` and
//    `build:cli` done first) is installed with its production dependencies into build/server-<os>-<cpu>.
// 2. electron-builder packs the app with the server for its OS + CPU, at the root package.json's version.
// Flags: --all, --publish (upload to the GitHub release v<version>: needs GH_TOKEN), --dir (unpacked app only, fast).
// No signing secrets → an unsigned build (CSC_IDENTITY_AUTO_DISCOVERY=false), which never fails the job.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const desktop = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = path.join(desktop, '..')
const args = process.argv.slice(2)
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const run = (cmd, argv, cwd) => execFileSync(cmd, argv, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })

for (const built of ['.next/BUILD_ID', 'dist/cli/check.mjs']) {
  if (!existsSync(path.join(root, built))) {
    console.error(`✗ ${built} is missing: run pnpm build && pnpm build:playwright && pnpm build:cli in the repo root first`)
    process.exit(1)
  }
}

// 1. the server, one copy per OS + CPU the installers target (electron-builder.yml): its native packages (Next's
// swc, sharp) differ, so each is installed with npm's --os / --cpu
const platforms = args.includes('--all') ? ['darwin', 'win32', 'linux'] : [process.platform]
const arches = { darwin: ['arm64', 'x64'], win32: ['x64'], linux: ['x64'] }
const serverDir = (platform, arch) => path.join(desktop, 'build', `server-${platform}-${arch}`)
const build = path.join(desktop, 'build')
mkdirSync(build, { recursive: true })
for (const f of readdirSync(build)) if (f.startsWith('server') || f.endsWith('.tgz')) rmSync(path.join(build, f), { recursive: true, force: true })
console.log(`Packing vibedoc ${version} for the app...`)
run(npm, ['pack', '--ignore-scripts', '--pack-destination', build], root)
const tgz = path.join(build, readdirSync(build).find((f) => f.endsWith('.tgz')))
for (const platform of platforms) {
  for (const arch of arches[platform]) {
    const server = serverDir(platform, arch)
    mkdirSync(server, { recursive: true })
    writeFileSync(path.join(server, 'package.json'), '{ "private": true }\n')
    console.log(`Installing the server for ${platform}-${arch}...`)
    run(npm, ['install', '--omit=dev', '--no-package-lock', '--no-audit', '--no-fund', '--no-update-notifier', `--os=${platform}`, `--cpu=${arch}`, tgz], server)
    rmSync(path.join(server, 'package.json'))
    // source maps only help reading a stack trace: 140 MB the installer doesn't need
    for (const f of readdirSync(server, { recursive: true })) if (f.endsWith('.map')) rmSync(path.join(server, f))
  }
}
rmSync(tgz)

// 2. the app
const signing = ['CSC_LINK', 'WIN_CSC_LINK'].some((k) => process.env[k])
if (!signing) {
  process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
  console.log('No signing certificate set (CSC_LINK / WIN_CSC_LINK): unsigned build')
}
const builder = await import('electron-builder')
await builder.build({
  ...(args.includes('--all') ? { mac: [], win: [], linux: [] } : {}),
  ...(args.includes('--dir') ? { dir: true } : {}),
  publish: args.includes('--publish') ? 'always' : 'never',
  // electron-builder.yml, at the version semantic-release gave the root package
  config: {
    extends: path.join(desktop, 'electron-builder.yml'),
    extraMetadata: { version },
    // build/server → <Resources>/server, before signing and the installer (desktop/bin-path.mjs reads it there)
    afterPack: ({ appOutDir, packager, electronPlatformName, arch }) => {
      const resources = electronPlatformName === 'darwin'
        ? path.join(appOutDir, `${packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
        : path.join(appOutDir, 'resources')
      cpSync(serverDir(electronPlatformName, builder.Arch[arch]), path.join(resources, 'server'), { recursive: true, verbatimSymlinks: true })
    },
  },
})
console.log(`✓ VibeDoc ${version} desktop build in ${path.join(desktop, 'dist')}`)
