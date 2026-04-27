#!/usr/bin/env node
import * as installer from '#chouquette/installer'
import * as childProcess from 'node:child_process'
import * as fs from 'node:fs'

// Replaces __dirname.
const { cache, dirname } = installer.directories()
const data = await installer.prepareDownload(dirname, cache)

// User can run install with ignore scripts, compiler should be
// downloaded before using it.
const isExec = fs.existsSync(data.binPath)
if (!isExec) await installer.install()

// Run the compiler.
const args = process.argv.slice(2)
childProcess
  .spawn(data.binPath, args, { stdio: 'inherit' })
  .on('exit', process.exit)
