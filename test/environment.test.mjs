import * as assert from 'node:assert/strict'
import * as test from 'node:test'
import * as environment from '../src/environment.mjs'

/** @param {string} platform @param {() => void} body */
function onPlatform(platform, body) {
  const original = process.platform
  Object.defineProperty(process, 'platform', { value: platform })
  try {
    body()
  } finally {
    Object.defineProperty(process, 'platform', { value: original })
  }
}

test.describe('platform', () => {
  test.it('maps the platforms Gleam builds for', () => {
    onPlatform('linux', () => {
      assert.equal(environment.infos().platform, 'unknown-linux-musl')
    })
    onPlatform('darwin', () => {
      assert.equal(environment.infos().platform, 'apple-darwin')
    })
    onPlatform('win32', () => {
      assert.equal(environment.infos().platform, 'pc-windows-msvc')
    })
  })

  // A static Linux binary runs on Android, not on the BSDs.
  test.it('knows which platforms have no build', () => {
    onPlatform('android', () => {
      assert.equal(environment.infos().platform, 'unknown-linux-musl')
    })
    for (const platform of ['freebsd', 'openbsd', 'netbsd', 'sunos', 'aix']) {
      onPlatform(platform, () => {
        assert.equal(environment.infos().platform, null, platform)
      })
    }
  })
})
