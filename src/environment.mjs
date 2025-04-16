import * as fs from 'node:fs'
import * as path from 'node:path'

export { cachedir } from './environment/cachedir.mjs'

export async function infos(dirname) {
  const arch = getArch()
  const platform = getPlatform()
  const version = await getVersion(dirname)
  return { arch, platform, version }
}

export function dirname() {
  const file = new URL(import.meta.url)
  const dirname = path.dirname(file.pathname)
  return dirname
}

async function getVersion(dirname) {
  const pack = path.resolve(dirname, '../package.json')
  const content = await fs.promises.readFile(pack, 'utf-8')
  const package_ = JSON.parse(content)
  return `v${package_.version}`
}

function getArch() {
  switch (process.arch) {
    case 'arm64':
      return 'aarch64'
    case 'x64':
      return 'x86_64'
    default:
      return null
  }
}

function getPlatform() {
  switch (process.platform) {
    case 'darwin':
      return 'apple-darwin'
    case 'win32':
      return 'pc-windows-msvc'
    case 'aix':
    case 'android':
    case 'freebsd':
    case 'linux':
    case 'netbsd':
    case 'openbsd':
    case 'sunos':
      return 'unknown-linux-musl'
    default:
      return null
  }
}
