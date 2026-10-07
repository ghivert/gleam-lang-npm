# Gleam Lang

[Gleam](https://gleam.run) is a functional language that compiles to JavaScript!
More information can be found
[in the documentation](https://gleam.run/documentation/) directly, to get you
started!

## What is this package for?

For stantard development purposes, a classic gleam installation should be done,
[following the official instructions](https://gleam.run/getting-started/installing/).
However, having a gleam package on NPM allows everyone to embed gleam directly
from a `package.json`, for certain scenarios:

- When running on CI, and dependent on the `package.json`.
- When you can't install softwares directly.
- When you want to maintain multiple versions of gleam with NPM.

## Installation

```
npm install @chouquette/gleam
```

## Usage

```
npx gleam --help
```

The compiler is downloaded the first time you run it, not when the package is
installed, so the package has no install script. To fetch it ahead of time, in a
Docker image for instance, run `npx gleam --version` once.

## Which version of gleam runs?

The package looks for a version in the current directory and its parents, in
this order, and uses the first one it finds:

1. `gleam` in `gleam.toml`, with the same syntax as the compiler
   (`>= 1.6.0 and < 2.0.0`, `~> 1.6`).
2. `engines.gleam` in `package.json`, as a semver range (`^1.6.0`).
3. `gleam` in the `[tools]` of `mise.toml` (or `.mise.toml`, `mise.local.toml`),
   or in `.tool-versions`. `1.19` means any 1.19.x.
4. A `gleam` already installed in your `PATH`, which is run as is.
5. The latest release known to the package.

When a range matches several releases, the highest one is used. Each download is
checked against the checksum recorded in the package before it is extracted, so
a new release of gleam needs a new release of this package.

## Goal of the package

This package will mimic main releases of gleam, meaning all intermediates
versions (1.1.0-rc1 for instance) will not be taken into account. Expect a new
version of this package to ship soon after the official releases lands on
GitHub.

## Limitations

Because gleam compiles both to JS and Erlang, the gleam compiler can output both
code. However, do not expect this package to help in Erlang development. This
package is mainly aimed to use in the JS ecosystem, and do not ship Erlang
runtime neither rebar3. Follow the classical installation of gleam and Erlang to
get started with Erlang development!

In case you succeed to use this package in an Erlang workflow, congrats! You
achieved a strong engineering achievement! Do not ask for help if it bug though!
😇
