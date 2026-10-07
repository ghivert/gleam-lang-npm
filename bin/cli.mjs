#!/usr/bin/env node
import * as installer from '#chouquette/installer'
import * as locate from '#chouquette/locate'
import * as version from '#chouquette/version'
import * as childProcess from 'node:child_process'
import * as fs from 'node:fs'

const args = process.argv.slice(2)

/** @param {unknown} error */
function fail(error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

/** @param {string} binPath @param {NodeJS.ProcessEnv} env */
function run(binPath, env) {
  childProcess
    .spawn(binPath, args, { stdio: 'inherit', env })
    .on('error', fail)
    .on('exit', code => process.exit(code ?? 1))
}

try {
  const project = version.fromProject(process.cwd())
  // A gleam installed by the user wins over the one this package downloads.
  const local = project ? null : locate.inPath()
  if (local) {
    run(local, { ...process.env, CHOUQUETTE_GLEAM_WRAPPED: '1' })
  } else {
    const data = installer.prepare(project?.version ?? version.latest())
    if (!fs.existsSync(data.binPath)) {
      if (!project) {
        console.error(
          'No Gleam version found in gleam.toml, package.json or mise.toml, ' +
            `and no gleam in PATH. Using the latest release, v${data.release.version}. ` +
            'Set `gleam` in gleam.toml to pin it.'
        )
      }
      await installer.install(data)
    }
    run(data.binPath, process.env)
  }
} catch (error) {
  fail(error)
}
