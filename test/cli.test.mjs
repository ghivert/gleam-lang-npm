import * as assert from 'node:assert/strict'
import * as childProcess from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as test from 'node:test'
import { executable, fakeGleam, project } from './helpers.mjs'

const cli = path.resolve(import.meta.dirname, '../bin/cli.mjs')
const windows = process.platform === 'win32'

/** @param {string} binDir @param {Record<string, string>} [extra] */
function environment(binDir, extra) {
  const home = project({})
  const system = process.env.SystemRoot
  return {
    PATH: binDir,
    HOME: home,
    LOCALAPPDATA: home,
    ...(system ? { SystemRoot: system } : {}),
    ...extra,
  }
}

/** @param {string} cwd @param {string} binDir @param {string[]} args @param {Record<string, string>} [extra] */
function run(cwd, binDir, args, extra) {
  return childProcess.spawnSync(process.execPath, [cli, ...args], {
    cwd,
    env: environment(binDir, extra),
    encoding: 'utf-8',
  })
}

/** @param {() => number | false} read */
async function waitFor(read) {
  for (let i = 0; i < 250; i++) {
    const value = read()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error('The fake gleam did not start.')
}

/** @param {string} file */
function pidIn(file) {
  try {
    return Number(fs.readFileSync(file, 'utf-8')) || false
  } catch {
    return false
  }
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

  // exec keeps the pid of the script for sleep, so the file names the
  // process that must die with the wrapper.
  test.it('forwards a signal to gleam', { skip: windows }, async () => {
    const bin = project({})
    const pidFile = path.join(bin, 'pid')
    executable(bin, 'gleam', `echo $$ > "${pidFile}"; exec sleep 30`)
    const child = childProcess.spawn(process.execPath, [cli], {
      cwd: project({}),
      env: environment(`${bin}${path.delimiter}/usr/bin${path.delimiter}/bin`),
      stdio: 'ignore',
    })
    const exited = new Promise(resolve => child.on('exit', resolve))
    const pid = await waitFor(() => pidIn(pidFile))
    assert.equal(child.exitCode, null, 'the wrapper exited before the signal')
    child.kill('SIGTERM')
    assert.equal(await exited, 128 + 15)
    assert.throws(() => process.kill(pid, 0), /ESRCH/)
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
