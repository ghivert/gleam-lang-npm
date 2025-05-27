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
yarn add @chouquette/gleam
```

## Usage

```
yarn gleam --help
```

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
