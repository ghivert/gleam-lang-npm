import * as assert from 'node:assert/strict'
import * as crypto from 'node:crypto'
import * as test from 'node:test'
import * as compiler from '../src/gleam/compiler.mjs'

const body = Buffer.from('archive')
const sha256 = crypto.createHash('sha256').update(body).digest('hex')
const release = { version: '1.19.0', file: 'gleam.tar.gz', sha256 }

test.afterEach(() => test.mock.restoreAll())

test.it('returns an archive that matches the checksum', async () => {
  const fetch = test.mock.method(
    globalThis,
    'fetch',
    async () => new Response(body)
  )
  assert.deepEqual(await compiler.download(release), body)
  const url = fetch.mock.calls[0]?.arguments[0]
  assert.equal(
    url,
    'https://github.com/gleam-lang/gleam/releases/download/v1.19.0/gleam.tar.gz'
  )
})

test.it('refuses an archive that does not match', async () => {
  test.mock.method(globalThis, 'fetch', async () => new Response('tampered'))
  await assert.rejects(compiler.download(release), /Checksum mismatch/)
})

test.it('reports a failed request', async () => {
  test.mock.method(
    globalThis,
    'fetch',
    async () => new Response('', { status: 404 })
  )
  await assert.rejects(compiler.download(release), /404/)
})
