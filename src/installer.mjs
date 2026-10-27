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
  if (!cache || !arch || !platform) {
    throw new Error(
      `Gleam has no build for ${process.platform} on ${process.arch}.`
    )
  }
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

const stale = 60 * 60 * 1000

// Temporary directories of installs that were killed are removed after an
// hour. Younger ones may belong to an install still running.
/** @param {string} cache */
async function sweep(cache) {
  const entries = await fs.promises.readdir(cache)
  for (const entry of entries) {
    if (!entry.startsWith('install-')) continue
    const dir = path.join(cache, entry)
    const stat = await fs.promises.stat(dir).catch(() => null)
    if (stat && Date.now() - stat.mtimeMs > stale) {
      await fs.promises.rm(dir, { recursive: true, force: true })
    }
  }
}

// Moving the directory into place is the last step, so one that exists is
// complete, unless its binary is missing: a leftover of a failed install.
/** @param {string} out @param {string} binDir @param {string} binPath */
async function move(out, binDir, binPath) {
  try {
    await fs.promises.rename(out, binDir)
  } catch (error) {
    if (fs.existsSync(binPath)) return
    await fs.promises.rm(binDir, { recursive: true, force: true })
    await fs.promises.rename(out, binDir)
  }
}

// Everything happens in a temporary directory, moved into place at the end:
// a half-installed compiler is never visible, and two processes installing at
// the same time cannot corrupt each other.
/** @param {ReturnType<typeof prepare>} data */
export async function install(data) {
  console.error(`Downloading Gleam v${data.release.version}...`)
  const archive = await gleam.compiler.download(data.release)
  await fs.promises.mkdir(data.cache, { recursive: true })
  await sweep(data.cache)
  const tmp = await fs.promises.mkdtemp(path.join(data.cache, 'install-'))
  try {
    const file = path.join(tmp, data.release.file)
    const out = path.join(tmp, 'out')
    await fs.promises.writeFile(file, archive)
    await fs.promises.mkdir(out)
    await extract(file, out)
    await move(out, data.binDir, data.binPath)
  } catch (error) {
    if (!fs.existsSync(data.binPath)) throw error
  } finally {
    await fs.promises.rm(tmp, { recursive: true, force: true })
  }
}
