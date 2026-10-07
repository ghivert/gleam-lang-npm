import * as assert from 'node:assert/strict'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as test from 'node:test'
import * as tar from 'tar'
import * as installer from '../src/installer.mjs'
import * as releases from '../src/manifest.mjs'
import { executable, project } from './helpers.mjs'

test.afterEach(() => test.mock.restoreAll())

/** @param {string} cache @param {string} sha256 */
function fake(cache, sha256) {
  const binDir = path.join(cache, 'gleam-v0.0.0')
  const provenance = /** @type {const} */ ('sha256-only')
  const release = { version: '0.0.0', file: 'gleam.tar.gz', sha256, provenance }
  return { cache, binDir, binPath: path.join(binDir, 'gleam'), release }
}

async function archive() {
  const dir = project({})
  executable(dir, 'gleam', 'echo gleam')
  const file = path.join(dir, 'gleam.tar.gz')
  await tar.create({ gzip: true, file, cwd: dir }, ['gleam'])
  const body = fs.readFileSync(file)
  return {
    body,
    sha256: crypto.createHash('sha256').update(body).digest('hex'),
  }
}

test.describe('prepare', () => {
  test.it('describes a release of the manifest', () => {
    const data = installer.prepare('1.19.0')
    const asset = Object.values(releases.manifest.versions['1.19.0'] ?? {})
    assert.ok(asset.some(({ sha256 }) => sha256 === data.release.sha256))
    assert.match(data.binPath, /gleam-v1\.19\.0-.+[\\/]gleam(\.exe)?$/)
  })

  test.it('refuses a version missing from the manifest', () => {
    assert.throws(() => installer.prepare('0.0.1'), /has no build for/)
  })
})

test.describe('install', { skip: process.platform === 'win32' }, () => {
  test.it('extracts a verified archive', async () => {
    test.mock.method(console, 'error', () => {})
    const { body, sha256 } = await archive()
    test.mock.method(globalThis, 'fetch', async () => new Response(body))
    const data = fake(project({}), sha256)
    await installer.install(data)
    assert.ok(fs.existsSync(data.binPath))
    assert.deepEqual(fs.readdirSync(data.cache), ['gleam-v0.0.0'])
  })

  test.it('survives two installs at the same time', async () => {
    test.mock.method(console, 'error', () => {})
    const { body, sha256 } = await archive()
    test.mock.method(globalThis, 'fetch', async () => new Response(body))
    const data = fake(project({}), sha256)
    await Promise.all([installer.install(data), installer.install(data)])
    assert.ok(fs.existsSync(data.binPath))
    assert.deepEqual(fs.readdirSync(data.cache), ['gleam-v0.0.0'])
  })

  test.it('leaves nothing behind when the checksum is wrong', async () => {
    test.mock.method(console, 'error', () => {})
    const { body } = await archive()
    test.mock.method(globalThis, 'fetch', async () => new Response(body))
    const data = fake(project({}), 'f'.repeat(64))
    await assert.rejects(installer.install(data), /Checksum mismatch/)
    assert.deepEqual(fs.readdirSync(data.cache), [])
  })
})
