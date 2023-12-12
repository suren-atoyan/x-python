## 0.0.10

###### _Dec 13, 2023_

- pin `jedi` to `black` versions

## 0.0.9

###### _May 22, 2023_

- add `options` to `format` method
- replace deprecated `pyodide.isProxy` with `instanceof pyodide.ffi.PyProxy`
- import `PyProxy` from `pyodide/ffi` instead of `pyodide`
- update `pyodide` to `0.23.2`

## 0.0.8

###### _Apr 9, 2023_

- update `pyodide` to `0.23.0`

## 0.0.7

###### _Apr 9, 2023_

- export all types

## 0.0.6

###### _Jan 4, 2023_

- fix `husky` issue by making `pre-commit` script executable
- make context-aware js functions available in python environment
- implement `interrupt` method with `interruptBuffer` (`SharedArrayBuffer`)

## 0.0.5

###### _Dec 28, 2022_

- remove `immer` from dependencies
- add separate types for all callbacks
- add `removeCallback` and `addCallback` utility functions
- replace `immer` with `removeCallback` and `addCallback` utility functions

## 0.0.4

###### _Dec 28, 2022_

- create a separate field in config for `loadPyodide` options
- fully pass `config.loadPyodideOptions` to `loadPyodide`

## 0.0.3

###### _Dec 28, 2022_

- add cjs version of the bundle

## 0.0.2

###### _Dec 28, 2022_

- add file references for unpkg/jsdelivr/module/main
- rename bundle prefix (to x-python)

## 0.0.1

###### _Dec 28, 2022_

🎉 First release
