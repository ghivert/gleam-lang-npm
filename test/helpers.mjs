import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as test from 'node:test'

/** @param {Record<string, string>} files */
export function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chouquette-'))
  test.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(dir, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
  }
  return dir
}

/** @param {string} dir @param {string} name @param {string} script */
export function executable(dir, name, script) {
  const file = path.join(dir, name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, `#!/bin/sh\n${script}\n`, { mode: 0o755 })
  return file
}

export const gleamName = process.platform === 'win32' ? 'gleam.exe' : 'gleam'

// A shell script cannot be an executable on Windows, so node stands in for
// gleam there. A preloaded file tells it to print its arguments and exit.
const withNode =
  process.platform === 'win32' || Boolean(process.env.FAKE_GLEAM_WITH_NODE)

/** @param {string} dir @param {number} code */
export function fakeGleam(dir, code) {
  if (!withNode) {
    const file = executable(dir, 'gleam', `echo "gleam $@"; exit ${code}`)
    return { file, env: {} }
  }
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, gleamName)
  if (process.platform === 'win32') fs.copyFileSync(process.execPath, file)
  else fs.symlinkSync(process.execPath, file)
  const preload = path.join(dir, 'fake-gleam.cjs')
  fs.writeFileSync(
    preload,
    `const path = require('node:path')
if (path.basename(process.argv0, '.exe') === 'gleam') {
  const args = [path.basename(process.argv[1] ?? ''), ...process.argv.slice(2)]
  console.log(['gleam', ...args].join(' '))
  process.exit(${code})
}
`
  )
  const forward = preload.replaceAll('\\', '/')
  return { file, env: { NODE_OPTIONS: `--require "${forward}"` } }
}
