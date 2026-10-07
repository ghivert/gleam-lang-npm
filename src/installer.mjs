import * as childProcess from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as util from 'node:util'
import * as tar from 'tar'
import * as environment from './environment.mjs'
import * as gleam from './gleam.mjs'
import * as releases from './manifest.mjs'

const execFile = util.promisify(childProcess.execFile)

/** @param {string} version */
export function prepare(version) {
  const cache = environment.cachedir('gleam-npm')
  const { arch, platform } = environment.infos()
  if (!cache || !arch || !platform)
    throw new Error('Impossible to detect the env.')
  const triple = `${arch}-${platform}`
  const asset = releases.manifest.versions[version]?.[triple]
  if (!asset) throw new Error(`Gleam v${version} has no build for ${triple}.`)
  const binDir = path.resolve(cache, `gleam-v${version}-${triple}`)
  const binName = platform === 'pc-windows-msvc' ? 'gleam.exe' : 'gleam'
  const binPath = path.resolve(binDir, binName)
  return { cache, binDir, binPath, release: { version, ...asset } }
}

// Windows ships zip archives, which its own tar can extract.
/** @param {string} file @param {string} cwd */
async function extract(file, cwd) {
  if (file.endsWith('.zip')) await execFile('tar', ['-xf', file, '-C', cwd])
  else await tar.extract({ file, cwd })
}

// Everything happens in a temporary directory, moved into place at the end:
// a half-installed compiler is never visible, and two processes installing at
// the same time cannot corrupt each other.
/** @param {ReturnType<typeof prepare>} data */
export async function install(data) {
  console.error(`Downloading Gleam v${data.release.version}...`)
  const archive = await gleam.compiler.download(data.release)
  await fs.promises.mkdir(data.cache, { recursive: true })
  const tmp = await fs.promises.mkdtemp(path.join(data.cache, 'install-'))
  try {
    const file = path.join(tmp, data.release.file)
    const out = path.join(tmp, 'out')
    await fs.promises.writeFile(file, archive)
    await fs.promises.mkdir(out)
    await extract(file, out)
    await fs.promises.rename(out, data.binDir)
  } catch (error) {
    if (!fs.existsSync(data.binPath)) throw error
  } finally {
    await fs.promises.rm(tmp, { recursive: true, force: true })
  }
}
