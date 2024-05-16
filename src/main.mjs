import cachedir from 'cachedir'
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

function getDirname() {
  const file = new URL(import.meta.url)
  const dirname = path.dirname(file.pathname)
  return dirname
}

async function getVersion(dirname) {
  return await fs.promises
    .readFile(path.resolve(dirname, '../package.json'), 'utf-8')
    .then(JSON.parse)
    .then(package_ => `v1.0.0`)
}

async function getInfos(dirname) {
  const arch = getArch()
  const platform = getPlatform()
  const version = await getVersion(dirname)
  return { arch, platform, version }
}

async function getArchivePath(dirname, cacheDir) {
  const { arch, version, platform } = await getInfos(dirname)
  const fileName = `gleam-${version}-${arch}-${platform}.tgz`
  const tgzPath = path.resolve(cacheDir, fileName)
  return { tgzPath, arch, version, platform }
}

async function dlCompilerArchive({ tgzPath, version, arch, platform }) {
  const endpoint = generateEndpoint(version, arch, platform)
  const tgz = await fetch(endpoint).then(res => {
    if (!res.ok) throw new Error('Unreachable')
    return res.arrayBuffer()
  })
  await fs.promises.writeFile(tgzPath, Buffer.from(tgz))
}

async function install(options) {
  const dirname = getDirname()
  const binDir = path.resolve(dirname, '..', 'bin')

  const cacheDir = cachedir('gleam-npm')
  await fs.promises.mkdir(cacheDir, { recursive: true })

  try {
    const data = await getArchivePath(dirname, cacheDir)
    if (!fs.existsSync(data.tgzPath)) await dlCompilerArchive(data)
    await tar.extract({ file: data.tgzPath, cwd: binDir })
  } catch (error) {
    const isBadArchive = error.message.includes('TAR_BAD_ARCHIVE')
    if (isBadArchive && !options?.propagateErrors) {
      const { tgzPath } = await getArchivePath(dirname, cacheDir)
      if (fs.existsSync(tgzPath)) {
        await fs.promises.rm(tgzPath)
        return install({ propagateErrors: true })
      }
    }
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
