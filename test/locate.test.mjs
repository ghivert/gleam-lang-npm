import * as assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as test from 'node:test'
import * as locate from '../src/locate.mjs'
import { executable, gleamName, project } from './helpers.mjs'

const windows = process.platform === 'win32'

test.describe('gleam in PATH', () => {
  test.it('finds an executable gleam', () => {
    const dir = project({})
    const file = executable(dir, gleamName, 'exit 0')
    assert.equal(locate.inPath({ env: { PATH: dir }, self: '' }), file)
  })

  test.it('skips node_modules/.bin', () => {
    const dir = project({})
    const bin = path.join(dir, 'node_modules', '.bin')
    executable(bin, gleamName, 'exit 0')
    assert.equal(locate.inPath({ env: { PATH: bin }, self: '' }), null)
  })

  test.it('skips itself', () => {
    const dir = project({})
    const self = executable(dir, gleamName, 'exit 0')
    assert.equal(locate.inPath({ env: { PATH: dir }, self }), null)
  })

  test.it('skips itself through a symlink', { skip: windows }, () => {
    const dir = project({})
    const self = executable(dir, 'cli.mjs', 'exit 0')
    const bin = path.join(dir, 'bin')
    fs.mkdirSync(bin)
    fs.symlinkSync(self, path.join(bin, gleamName))
    assert.equal(locate.inPath({ env: { PATH: bin }, self }), null)
  })

  test.it('goes on to the next directory after skipping itself', () => {
    const dir = project({})
    const first = path.join(dir, 'first')
    const self = executable(first, gleamName, 'exit 0')
    const second = path.join(dir, 'second')
    const real = executable(second, gleamName, 'exit 0')
    const env = { PATH: [first, second].join(path.delimiter) }
    assert.equal(locate.inPath({ env, self }), real)
  })

  test.it('does nothing when called by a gleam it started', () => {
    const dir = project({})
    executable(dir, gleamName, 'exit 0')
    const env = { PATH: dir, CHOUQUETTE_GLEAM_WRAPPED: '1' }
    assert.equal(locate.inPath({ env, self: '' }), null)
  })

  test.it('ignores a file that is not executable', { skip: windows }, () => {
    const dir = project({ gleam: '' })
    assert.equal(locate.inPath({ env: { PATH: dir }, self: '' }), null)
  })

  test.it('ignores a directory named gleam', () => {
    const dir = project({ [`${gleamName}/file`]: '' })
    assert.equal(locate.inPath({ env: { PATH: dir }, self: '' }), null)
  })
})
