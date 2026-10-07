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
