# AGENTS.md

`@chouquette/gleam` is an npm wrapper around the Gleam compiler. The first time
`bin/cli.mjs` runs, it downloads the official release from GitHub into a cache
directory, then runs it. The package has no install script, and nothing must run
at install time.

## Layout

- `bin/cli.mjs`: the `gleam` executable. Downloads the compiler when it is not
  cached yet, then spawns it.
- `src/version.mjs`: picks the version to run from `gleam.toml`, `package.json`
  `engines`, mise files and `.tool-versions`, or falls back to the latest.
- `src/locate.mjs`: finds a gleam installed in `PATH`, skipping this package.
- `src/installer.mjs`: cache paths, atomic install in a temporary directory.
- `src/environment.mjs`, `src/environment/cachedir.mjs`: arch, platform and
  cache directory detection.
- `src/gleam/compiler.mjs`: release URL, download and checksum verification.
- `src/manifest.mjs`: generated, see below.
- `scripts/manifest.mjs`: maintainer tool that generates `src/manifest.mjs`.
- `test/`: tests, run with `npm test` (`node:test`, no network).

## Commands

```
npm ci
npx tsc --noEmit
npm test
npx prettier --check src bin scripts test package.json README.md AGENTS.md
```

The package supports Node 22 and later (`engines`). Keep `@types/node` on the
same major, so `tsc` flags APIs Node 22 does not have.

npm is the only package manager. Commit `package-lock.json`, never a Yarn or
pnpm lockfile.

## Style

Follow the surrounding code before anything else. Prettier enforces the
formatting (no semicolons, single quotes, 80 columns); do not hand-format.

- Plain ES modules in `.mjs`. Types are JSDoc, checked by `tsc` in strict mode
  (`checkJs`). Only erasable TypeScript syntax is allowed.
- Import Node built-ins and packages as namespaces, with the `node:` prefix:
  `import * as fs from 'node:fs'`. Use the `#chouquette/*` alias from `bin/`,
  relative paths inside `src/`.
- Small functions, early returns, `export function` for what other modules use.
  Constants are camelCase, never `UPPER_CASE`.
- JSDoc stays on one line when it fits: `/** @param {string} id */`.
- Comments are rare. Write one only to explain a reason that the code cannot
  show, as a short plain sentence ending with a period. No banners, no
  commentary on what the next line does, no section dividers.
- Errors are `throw new Error(...)` with a short message.
- Runtime dependencies are `tar`, `semver` and `smol-toml`. Use a maintained
  package for a format or a spec (versions, TOML, archives) instead of writing a
  parser, and do not add one for something a few lines of Node can do.

## Security

The package runs a binary it downloaded. Treat anything that touches that path
as security sensitive.

- Download only from `https://github.com/gleam-lang/gleam/releases`. Never build
  the URL from user input or environment variables.
- Never weaken or bypass integrity checks. A failed check must stop the install
  with a clear error, not fall back silently.
- A gleam found in `PATH` is run without any check, on purpose: the user
  installed it. Downloaded archives are always checked against the manifest.
- Spawn processes with an argument array (`spawn`, `execFile`), never through a
  shell string.
- Keep `npm audit` at zero vulnerabilities, and bump `tar` promptly when it
  reports one.

## Manifest

`src/manifest.mjs` lists, for each Gleam version and platform, the archive name,
its SHA-256 and the strength of the proof behind it. Never edit it by hand.

```
npm run manifest -- add 1.19.0
```

The script needs the GitHub CLI (`gh`). For each archive it checks the SHA-256
against the `.sha256` published by Gleam and, when a `.sigstore` bundle exists,
verifies the attestation against the `gleam-lang/gleam` release workflow.
Versions before 1.10.0 have no attestation and are recorded as `sha256-only`. If
a check fails, the script stops and writes nothing for that version.

## Git

- Commit messages: short, imperative, no prefix (`Bump tar to ^7.5.22`). Release
  commits are just the version (`v1.19.0`).
- One concern per pull request. Do not mix a dependency bump, a tooling change
  and a feature.
- This package mirrors stable Gleam releases only, never release candidates.
