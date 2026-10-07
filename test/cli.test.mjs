import * as assert from 'node:assert/strict'
import * as childProcess from 'node:child_process'
import * as path from 'node:path'
import * as test from 'node:test'
import { executable, project } from './helpers.mjs'

const cli = path.resolve(import.meta.dirname, '../bin/cli.mjs')

/** @param {string} cwd @param {string} binDir @param {string[]} args */
function run(cwd, binDir, args) {
  const home = project({})
  const env = { PATH: binDir, HOME: home, LOCALAPPDATA: home }
  return childProcess.spawnSync(process.execPath, [cli, ...args], {
    cwd,
    env,
    encoding: 'utf-8',
  })
}

test.describe('cli', { skip: process.platform === 'win32' }, () => {
  test.it('runs the gleam of the PATH and keeps its exit code', () => {
    const bin = project({})
    executable(bin, 'gleam', 'echo "gleam $@"; exit 3')
    const result = run(project({}), bin, ['build', '--target', 'js'])
    assert.equal(result.stdout.trim(), 'gleam build --target js')
    assert.equal(result.status, 3)
  })

  test.it('fails cleanly when the project asks for an unknown release', () => {
    const cwd = project({ 'gleam.toml': 'gleam = ">= 99.0.0"\n' })
    const result = run(cwd, project({}), [])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /No Gleam release matches/)
    assert.doesNotMatch(result.stderr, /at \S+ \(/)
  })

  test.it('ignores the PATH when the project pins a version', () => {
    const bin = project({})
    executable(bin, 'gleam', 'echo from path')
    const cwd = project({ 'gleam.toml': 'gleam = ">= 99.0.0"\n' })
    const result = run(cwd, bin, [])
    assert.equal(result.status, 1)
    assert.doesNotMatch(result.stdout, /from path/)
  })
})
