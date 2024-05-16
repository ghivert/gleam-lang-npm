import * as cachedir from 'cachedir'
import * as fs from 'fs'
import * as path from 'path'
import * as tar from 'tar'

function getArch() {
  switch (process.arch) {
    case 'arm64':
      return 'aarch64'
    case 'x64':
      return 'x86_64'
    default:
      null
  }
}

function getPlatform() {
  switch (process.platform) {
    case 'darwin':
      return 'apple-darwin'
    case 'linux':
      return 'unknown-linux-musl'
    case 'win32':
      return 'pc-windows-msvc'
    default:
      return null
  }
}

function generateEndpoint(version, arch, platform) {
  return `https://github.com/gleam-lang/gleam/releases/download/${version}/gleam-${version}-${arch}-${platform}.tar.gz`
}

async function install() {
  try {
    const file = new URL(import.meta.url)
    const dirname = path.dirname(file.pathname)
    const { version, bin } = await fs.promises
      .readFile(path.resolve(dirname, '../package.json'), 'utf-8')
      .then(JSON.parse)
      .then(package_ => ({
        version: `v${package_.version}`,
        bin: path.dirname(package_.bin.gleam),
      }))
    const binDir = path.resolve(dirname, '..', bin)
    await fs.promises.mkdir(binDir, { recursive: true })
    const arch = getArch()
    const platform = getPlatform()
    const endpoint = generateEndpoint(version, arch, platform)
    const cacheDir = cachedir('gleam-npm')
    const fileName = `gleam-${version}-${arch}-${platform}.tgz`
    const tgzPath = path.resolve(cacheDir, fileName)
    if (!fs.existsSync(tgzPath)) {
      const tgz = await fetch(endpoint).then(res => res.arrayBuffer())
      await fs.promises.writeFile(tgzPath, Buffer.from(tgz))
    }
    await tar.extract({ file: tgzPath, cwd: binDir })
  } catch (error) {
    console.error(error)
    console.error(
      [
        '--- ERROR ----------------------------------------',
        'It looks your computer does not support gleam yet.',
        'Currently, gleam support macOS, Linux and Windows.',
        '--------------------------------------------------',
      ].join('\n')
    )
  }
}

install()
