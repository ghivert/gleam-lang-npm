import * as assert from 'node:assert/strict'
import * as test from 'node:test'
import * as version from '../src/version.mjs'
import { project } from './helpers.mjs'

/** @param {string} requirement */
function fromGleamToml(requirement) {
  const dir = project({ 'gleam.toml': `gleam = "${requirement}"\n` })
  return version.fromProject(dir)?.version
}

test.describe('gleam.toml requirements', () => {
  const cases = [
    ['>= 1.0.0 and < 1.10.0', '1.9.1'],
    ['~> 1.6', '1.19.0'],
    ['~> 1.6.0', '1.6.3'],
    ['== 1.8.0', '1.8.0'],
    ['1.8.0', '1.8.0'],
    ['>= 1.18.0 and != 1.19.0', '1.18.1'],
    ['< 1.1.0 or == 1.5.0', '1.5.0'],
    ['>= 1.0.0', '1.19.0'],
  ]
  for (const [requirement, expected] of cases) {
    test.it(`${requirement} resolves to ${expected}`, () => {
      assert.equal(fromGleamToml(requirement ?? ''), expected)
    })
  }

  test.it('rejects a release newer than the manifest', () => {
    assert.throws(() => fromGleamToml('>= 99.0.0'), /No Gleam release matches/)
  })

  test.it('rejects a syntax Gleam does not accept', () => {
    assert.throws(() => fromGleamToml('^1.6'), /Invalid Gleam version/)
  })
})

test.describe('other sources', () => {
  test.it('reads engines.gleam from package.json', () => {
    const dir = project({ 'package.json': '{"engines":{"gleam":"^1.6.0"}}' })
    assert.equal(version.fromProject(dir)?.version, '1.19.0')
  })

  test.it('reads mise.toml, where 1.15 means any 1.15.x', () => {
    const dir = project({ 'mise.toml': '[tools]\ngleam = "1.15"\n' })
    assert.equal(version.fromProject(dir)?.version, '1.15.4')
  })

  test.it('reads .tool-versions', () => {
    const dir = project({
      '.tool-versions': 'erlang 27.0\ngleam 1.12.0 # ci\n',
    })
    assert.equal(version.fromProject(dir)?.version, '1.12.0')
  })

  test.it('reads the mise forms: list, table, comments, CRLF', () => {
    const forms = [
      '[tools]\ngleam = ["1.12", "1.11"]\n',
      '[tools]\ngleam = { version = "1.12", os = ["linux"] }\n',
      '[tools]\r\nerlang = "27"\r\ngleam = \'1.12\' # pinned\r\n',
      'tools.gleam = "1.12"\n',
    ]
    for (const form of forms) {
      const dir = project({ 'mise.toml': form })
      assert.equal(version.fromProject(dir)?.version, '1.12.0', form)
    }
  })

  test.it('ignores a gleam key that is not in [tools]', () => {
    const dir = project({
      'mise.toml': 'gleam = "1.12"\n[env]\ngleam = "1.11"\n',
    })
    assert.equal(version.fromProject(dir), null)
  })

  test.it('ignores a gleam.toml that is not valid TOML', () => {
    const dir = project({ 'gleam.toml': 'gleam = = 1' })
    assert.equal(version.fromProject(dir), null)
  })

  test.it('accepts latest from mise', () => {
    const dir = project({ 'mise.toml': '[tools]\ngleam = "latest"\n' })
    assert.equal(version.fromProject(dir)?.version, '1.19.0')
  })
})

test.describe('order and lookup', () => {
  const all = {
    'gleam.toml': 'gleam = "== 1.1.0"\n',
    'package.json': '{"engines":{"gleam":"1.2.0"}}',
    'mise.toml': '[tools]\ngleam = "1.3.0"\n',
    '.tool-versions': 'gleam 1.4.0\n',
  }

  test.it(
    'prefers gleam.toml, then engines, then mise, then .tool-versions',
    () => {
      const { 'gleam.toml': a, ...withoutGleam } = all
      const { 'package.json': b, ...withoutEngines } = withoutGleam
      const { 'mise.toml': c, ...withoutMise } = withoutEngines
      assert.equal(version.fromProject(project(all))?.version, '1.1.0')
      assert.equal(version.fromProject(project(withoutGleam))?.version, '1.2.0')
      assert.equal(
        version.fromProject(project(withoutEngines))?.version,
        '1.3.0'
      )
      assert.equal(version.fromProject(project(withoutMise))?.version, '1.4.0')
    }
  )

  test.it('looks in parent directories', () => {
    const dir = project({ 'gleam.toml': 'gleam = "1.7.0"\n', 'a/b/file': '' })
    assert.equal(version.fromProject(`${dir}/a/b`)?.version, '1.7.0')
  })

  test.it('skips a file that does not set a version', () => {
    const dir = project({
      'package.json': '{"engines":{"gleam":"1.9.0"}}',
      'app/gleam.toml': 'name = "app"\n',
      'app/package.json': '{"name":"app"}',
    })
    assert.equal(version.fromProject(`${dir}/app`)?.version, '1.9.0')
  })

  test.it('returns null when nothing sets a version', () => {
    assert.equal(version.fromProject(project({ file: '' })), null)
  })

  test.it('knows the latest release', () => {
    assert.equal(version.latest(), '1.19.0')
  })
})
