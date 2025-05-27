#!/usr/bin/env node
import * as installer from '#chouquette/installer'
import * as childProcess from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

// Replaces __dirname.
const { cache, dirname } = installer.directories()
const data = await installer.prepareDownload(dirname, cache)

// User can run install with ignore scripts, compiler should be
// downloaded before using it.
const isExec = fs.existsSync(data.binPath)
if (!isExec) await installer.install()

// Run the compiler.
const args = process.argv.slice(2)
const options = { stdio: 'inherit' }
childProcess.spawn(data.binPath, args, options).on('exit', process.exit)
