import * as assert from 'node:assert/strict'
import * as path from 'node:path'
import * as test from 'node:test'
import * as semver from 'semver'
import * as releases from '../src/manifest.mjs'
import * as version from '../src/version.mjs'
import { project } from './helpers.mjs'

/** @param {string} dir */
function pick(dir) {
  const found = version.fromProject(dir)
  return found && 'version' in found ? found.version : null
}

/** @param {string} requirement */
function fromGleamToml(requirement) {
  const dir = project({ 'gleam.toml': `gleam = "${requirement}"\n` })
  return pick(dir)
}

test.describe('gleam.toml requirements', () => {
  const cases = [
    ['>= 1.0.0 and < 1.10.0', '1.9.1'],
    ['~> 1.6', version.latest()],
    ['~> 1.6.0', '1.6.3'],
    ['== 1.8.0', '1.8.0'],
    ['1.8.0', '1.8.0'],
    ['>= 1.18.0 and < 1.19.0', '1.18.1'],
    ['>= 1.18.0 and < 1.19.0 and != 1.18.1', '1.18.0'],
    ['< 1.1.0 or == 1.5.0', '1.5.0'],
    ['>= 1.0.0', version.latest()],
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
    assert.equal(pick(dir), version.latest())
  })

  test.it('reads mise.toml, where 1.15 means any 1.15.x', () => {
    const dir = project({ 'mise.toml': '[tools]\ngleam = "1.15"\n' })
    assert.equal(pick(dir), '1.15.4')
  })

  test.it('reads .tool-versions', () => {
    const dir = project({
      '.tool-versions': 'erlang 27.0\ngleam 1.12.0 # ci\n',
    })
    assert.equal(pick(dir), '1.12.0')
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
      assert.equal(pick(dir), '1.12.0', form)
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

  test.it('reads system from mise and .tool-versions', () => {
    const mise = project({ 'mise.toml': '[tools]\ngleam = "system"\n' })
    const asdf = project({ '.tool-versions': 'gleam system\n' })
    assert.deepEqual(version.fromProject(mise), {
      system: true,
      file: path.join(mise, 'mise.toml'),
    })
    assert.deepEqual(version.fromProject(asdf), {
      system: true,
      file: path.join(asdf, '.tool-versions'),
    })
  })

  test.it('accepts latest from mise', () => {
    const dir = project({ 'mise.toml': '[tools]\ngleam = "latest"\n' })
    assert.equal(pick(dir), version.latest())
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
      assert.equal(pick(project(all)), '1.1.0')
      assert.equal(pick(project(withoutGleam)), '1.2.0')
      assert.equal(pick(project(withoutEngines)), '1.3.0')
      assert.equal(pick(project(withoutMise)), '1.4.0')
    }
  )

  test.it('looks in parent directories', () => {
    const dir = project({ 'gleam.toml': 'gleam = "1.7.0"\n', 'a/b/file': '' })
    assert.equal(pick(`${dir}/a/b`), '1.7.0')
  })

  test.it('skips a file that does not set a version', () => {
    const dir = project({
      'package.json': '{"engines":{"gleam":"1.9.0"}}',
      'app/gleam.toml': 'name = "app"\n',
      'app/package.json': '{"name":"app"}',
    })
    assert.equal(pick(`${dir}/app`), '1.9.0')
  })

  test.it('returns null when nothing sets a version', () => {
    assert.equal(version.fromProject(project({ file: '' })), null)
  })

  test.it('knows the latest release', () => {
    assert.ok(version.latest() in releases.manifest.versions)
    assert.ok(semver.gte(version.latest(), '1.19.2'))
  })
})
