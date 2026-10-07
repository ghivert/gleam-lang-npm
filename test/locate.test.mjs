import * as assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as test from 'node:test'
import * as locate from '../src/locate.mjs'
import { executable, project } from './helpers.mjs'

const skip = process.platform === 'win32'

test.describe('gleam in PATH', { skip }, () => {
  test.it('finds an executable gleam', () => {
    const dir = project({})
    const file = executable(dir, 'gleam', 'exit 0')
    assert.equal(locate.inPath({ env: { PATH: dir }, self: '' }), file)
  })

  test.it('skips node_modules/.bin', () => {
    const dir = project({})
    executable(path.join(dir, 'node_modules', '.bin'), 'gleam', 'exit 0')
    const env = { PATH: path.join(dir, 'node_modules', '.bin') }
    assert.equal(locate.inPath({ env, self: '' }), null)
  })

  test.it('skips itself, even through a symlink', () => {
    const dir = project({})
    const self = executable(dir, 'cli.mjs', 'exit 0')
    const bin = path.join(dir, 'bin')
    fs.mkdirSync(bin)
    fs.symlinkSync(self, path.join(bin, 'gleam'))
    assert.equal(locate.inPath({ env: { PATH: bin }, self }), null)
  })

  test.it('goes on to the next directory after skipping itself', () => {
    const dir = project({})
    const self = executable(dir, 'cli.mjs', 'exit 0')
    const first = path.join(dir, 'first')
    fs.mkdirSync(first)
    fs.symlinkSync(self, path.join(first, 'gleam'))
    const real = executable(path.join(dir, 'second'), 'gleam', 'exit 0')
    const env = { PATH: [first, path.dirname(real)].join(path.delimiter) }
    assert.equal(locate.inPath({ env, self }), real)
  })

  test.it('does nothing when called by a gleam it started', () => {
    const dir = project({})
    executable(dir, 'gleam', 'exit 0')
    const env = { PATH: dir, CHOUQUETTE_GLEAM_WRAPPED: '1' }
    assert.equal(locate.inPath({ env, self: '' }), null)
  })

  test.it('ignores a file that is not executable', () => {
    const dir = project({ gleam: '' })
    assert.equal(locate.inPath({ env: { PATH: dir }, self: '' }), null)
  })
})
