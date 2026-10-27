import * as fs from 'node:fs'
import * as path from 'node:path'

/** @param {string} file */
function isExecutable(file) {
  try {
    if (!fs.statSync(file).isFile()) return false
    fs.accessSync(file, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** @param {string} file */
function realpath(file) {
  try {
    return fs.realpathSync(file)
  } catch {
    return file
  }
}

/** @param {string} dir */
function isNpmBin(dir) {
  const segments = dir.split(/[\\/]/).filter(Boolean)
  return segments.slice(-2).join('/') === 'node_modules/.bin'
}

// Finds a gleam installed by the user. This package's own executable is
// skipped, otherwise it would run itself forever.
/** @param {{ env?: NodeJS.ProcessEnv, self?: string, platform?: string }} [options] */
export function inPath(options) {
  const env = options?.env ?? process.env
  const self = realpath(options?.self ?? process.argv[1] ?? '')
  const name =
    (options?.platform ?? process.platform) === 'win32' ? 'gleam.exe' : 'gleam'
  if (env.CHOUQUETTE_GLEAM_WRAPPED) return null
  for (const dir of (env.PATH ?? '').split(path.delimiter)) {
    if (!dir || isNpmBin(dir)) continue
    const file = path.join(dir, name)
    if (isExecutable(file) && realpath(file) !== self) return file
  }
  return null
}
