import * as fs from 'node:fs'
import * as path from 'node:path'
import * as tar from 'tar'
import * as environment from './environment.mjs'
import * as gleam from './gleam.mjs'

export async function install(options) {
  const { dirname, bin, cache } = directories()
  const data = await prepareDownload(dirname, cache)
  try {
    await fs.promises.mkdir(cache, { recursive: true })
    await gleam.compiler.download(data)
    await tar.extract({ file: data.tgzPath, cwd: bin })
  } catch (error) {
    const isBadArchive = error.message.includes('TAR_BAD_ARCHIVE')
    const shouldRetry = !(options?.propagateErrors ?? false)
    const archiveExists = fs.existsSync(data.tgzPath)
    if (isBadArchive && shouldRetry && archiveExists) {
      await fs.promises.rm(data.tgzPath)
      return install({ propagateErrors: true })
    }
    console.error(error)
    console.error(
      [
        '--- ERROR -----------------------------------------------------',
        'It looks like your operating system does not support Gleam yet.',
        'Currently, Gleam supports macOS, Linux and Windows.            ',
        '---------------------------------------------------------------',
      ].join('\n')
    )
  }
}

function directories() {
  const dirname = environment.dirname()
  const bin = path.resolve(dirname, '..', 'bin')
  const cache = environment.cachedir('gleam-npm')
  if (!cache) throw new Error()
  return { dirname, bin, cache }
}

async function prepareDownload(dirname, cache) {
  const { arch, version, platform } = await environment.infos(dirname)
  if (!arch || !platform) throw new Error('Impossible to detect the env.')
  const fileName = `gleam-${version}-${arch}-${platform}.tgz`
  const tgzPath = path.resolve(cache, fileName)
  return { tgzPath, arch, version, platform }
}
