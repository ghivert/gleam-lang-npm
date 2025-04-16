#!/usr/bin/env node
import * as child_process from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

// Replaces __dirname.
const file = new URL(import.meta.url)
const dirname = path.dirname(file.pathname)
const binaryPath = path.resolve(dirname, 'gleam')

// User can run install with ignore scripts, compiler should be
// downloaded before using it.
const isExec = fs.existsSync(binaryPath)
if (!isExec) {
  const installer = await import('../src/installer.mjs')
  await installer.install()
}

// Run the compiler.
child_process
  .spawn(binaryPath, process.argv.slice(2), { stdio: 'inherit' })
  .on('exit', process.exit)
