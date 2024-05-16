#!/usr/bin/env node
import * as child_process from 'child_process'
import * as path from 'path'

const file = new URL(import.meta.url)
const dirname = path.dirname(file.pathname)
const binaryPath = path.resolve(dirname, 'gleam')
child_process.spawn(binaryPath, process.argv.slice(2), { stdio: 'inherit' }).on('exit', process.exit)
