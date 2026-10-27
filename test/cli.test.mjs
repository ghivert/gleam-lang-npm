import * as assert from 'node:assert/strict'
import * as childProcess from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as test from 'node:test'
import { executable, fakeGleam, idleGleam, project } from './helpers.mjs'

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

/** @template T @param {() => T | false} read @returns {Promise<T>} */
async function waitFor(read) {
  for (let i = 0; i < 250; i++) {
    const value = read()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error('The fake gleam did not start.')
}

// Windows has no signals. A console sends Ctrl+Break to a process group,
// through system calls PowerShell can make. The wrapper is not a child of the
// test, so its exit code is read from a handle opened before the event.
/** @param {number} wrapper @returns {{ code: number } | 'no console' | 'still running'} */
function interrupt(wrapper) {
  const kernel32 = [
    'bool GenerateConsoleCtrlEvent(uint type, uint group);',
    'IntPtr OpenProcess(uint access, bool inherit, uint pid);',
    'uint WaitForSingleObject(IntPtr handle, uint ms);',
    'bool GetExitCodeProcess(IntPtr handle, out uint code);',
  ]
    .map(f => `[DllImport("kernel32.dll")] public static extern ${f}`)
    .join('\n')
  const script = [
    `Add-Type -Namespace Win32 -Name Kernel -MemberDefinition '${kernel32}'`,
    `$handle = [Win32.Kernel]::OpenProcess(0x101000, $false, ${wrapper})`,
    'if ($handle -eq [IntPtr]::Zero) { exit 2 }',
    `if (-not [Win32.Kernel]::GenerateConsoleCtrlEvent(1, ${wrapper})) { exit 3 }`,
    'if ([Win32.Kernel]::WaitForSingleObject($handle, 10000) -ne 0) { exit 4 }',
    '$code = [uint32]0',
    '[Win32.Kernel]::GetExitCodeProcess($handle, [ref]$code) | Out-Null',
    'Write-Output $code',
  ].join('\n')
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  const args = ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded]
  const result = childProcess.spawnSync('powershell', args, {
    encoding: 'utf-8',
  })
  if (result.status === 3) return 'no console'
  if (result.status === 4) return 'still running'
  if (result.status !== 0) {
    throw new Error(`PowerShell exited ${result.status}: ${result.stderr}`)
  }
  return { code: Number(result.stdout.trim()) }
}

/** @param {string} file @returns {[number, number] | false} */
function pidsIn(file) {
  try {
    const [pid, ppid] = fs.readFileSync(file, 'utf-8').split(' ').map(Number)
    return pid && ppid ? [pid, ppid] : false
  } catch {
    return false
  }
}

/** @param {number} pid */
function end(pid) {
  try {
    process.kill(pid)
  } catch {}
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

  test.it('runs the gleam of the PATH when the project asks for system', () => {
    const bin = project({})
    const { env } = fakeGleam(bin, 0)
    const cwd = project({ 'mise.toml': '[tools]\ngleam = "system"\n' })
    const result = run(cwd, bin, ['build'], env)
    assert.equal(result.stdout.trim(), 'gleam build')
    assert.equal(result.status, 0)
  })

  test.it('fails cleanly when system is asked but PATH has no gleam', () => {
    const cwd = project({ 'mise.toml': '[tools]\ngleam = "system"\n' })
    const result = run(cwd, project({}), [])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /asks for the gleam of the system/)
  })

  // The wrapper must be in a process group of its own that still shares the
  // console, which `start /B` does and Node cannot: `detached` also drops the
  // console. cmd exits at once, the wrapper lives on.
  test.it('interrupts gleam on Ctrl+Break', { skip: !windows }, async t => {
    const bin = project({})
    const pidFile = path.join(bin, 'pid')
    const { env } = idleGleam(bin, pidFile)
    const command = `start /B "" "${process.execPath}" "${cli}" build`
    childProcess.spawnSync(
      process.env.ComSpec ?? 'cmd.exe',
      ['/d', '/c', command],
      {
        cwd: project({}),
        env: environment(bin, env),
        stdio: 'ignore',
        windowsVerbatimArguments: true,
      }
    )
    const [gleam, wrapper] = await waitFor(() => pidsIn(pidFile))
    const result = interrupt(wrapper)
    if (result === 'no console') {
      end(wrapper)
      end(gleam)
      return t.skip('no console to send Ctrl+Break from')
    }
    const alive = (() => {
      try {
        process.kill(gleam, 0)
        return true
      } catch {
        return false
      }
    })()
    end(wrapper)
    end(gleam)
    if (result === 'still running')
      assert.fail('the wrapper ignored Ctrl+Break')
    assert.equal(result.code, 128 + os.constants.signals.SIGINT)
    assert.equal(alive, false, 'gleam outlived the wrapper')
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
