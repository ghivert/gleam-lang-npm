import * as assert from 'node:assert/strict'
import * as childProcess from 'node:child_process'
import * as path from 'node:path'
import * as test from 'node:test'
import { fakeGleam, project } from './helpers.mjs'

const cli = path.resolve(import.meta.dirname, '../bin/cli.mjs')

/** @param {string} cwd @param {string} binDir @param {string[]} args @param {Record<string, string>} [extra] */
function run(cwd, binDir, args, extra) {
  const home = project({})
  const system = process.env.SystemRoot
  const env = {
    PATH: binDir,
    HOME: home,
    LOCALAPPDATA: home,
    ...(system ? { SystemRoot: system } : {}),
    ...extra,
  }
  return childProcess.spawnSync(process.execPath, [cli, ...args], {
    cwd,
    env,
    encoding: 'utf-8',
  })
}

test.describe('cli', () => {
  test.it('runs the gleam of the PATH and keeps its exit code', () => {
    const bin = project({})
    const { env } = fakeGleam(bin, 3)
    const result = run(project({}), bin, ['build', '--target', 'js'], env)
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
    const { env } = fakeGleam(bin, 0)
    const cwd = project({ 'gleam.toml': 'gleam = ">= 99.0.0"\n' })
    const result = run(cwd, bin, [], env)
    assert.equal(result.status, 1)
    assert.doesNotMatch(result.stdout, /^gleam/)
  })
})
