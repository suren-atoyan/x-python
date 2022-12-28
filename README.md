# @x-python/core &middot; [![monthly downloads](https://img.shields.io/npm/dm/@x-python/core)](https://www.npmjs.com/package/@monaco-editor/loader) [![gitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/suren-atoyan/monaco-loader/blob/master/LICENSE) [![npm version](https://img.shields.io/npm/v/@x-python/core.svg?style=flat)](https://www.npmjs.com/package/@x-python/core) [![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/suren-atoyan/x-python/pulls)

<a href="https://github.com/suren-atoyan/x-python/" target="_blank" rel="noreferrer">
  <img align="center" width="30%" height="auto" src="./playground/logo.svg" style="margin-bottom: 10px">
</a>

<p />

A complete solution for python-in-browser. (check the [Usage](#usage) section :point_down:)

<hr />

🔥 A REPL powered by `xPython` as `React` component is coming soon
<br />
⌛️ It's still in beta testing

<hr />

## Synopsis

Clean API to execute Python code, get code completions, format the code, install packages, and many more.

## Motivation

In the past few years we used python in production browser-based applications in quite different scenarios. From just executing a python code to implementing autoformat and autocomplete. And while all of this is possible there are many questionable situations in the implementations. For example, it's been a while since we've had a full `Python` distribution for the browser based on webassembly - [pyodide](https://pyodide.org/en/stable/). `Pyodide` is great! You can just install and use it. But to use it correctly, instead of installing it in the main (UI) thread, it would be desirable to install/run it in a separate thread. Once you've created a separate thread you need to create a channel between main/UI and pyodide worker and come up with some protocol for communication. You also need to do something with error handling, handling standard output streams, non-sequential executions and other all possible corner cases. This was one of the things that `xPython` will handle for you :slightly_smiling_face: It also provides a clean API for code completion, installing packages, and formatting the code... and many more are coming soon. Long story short I tried to provide a clean and complete interface to interact with Python in browser-based applications.

## Documentation

#### Contents

- [Installation](#installation)
- [Usage](#usage)
- [API](#api)
  - [.init](#init)
  - [.exec](#exec)
  - [.complete](#complete)
    - [.repl](#complete)
  - [.format](#format)
  - [.install](#install)
- [Development](#development)

### Installation

```bash
npm install @x-python/core
```

or

```bash
yarn add @x-python/core
```

### Usage

```javascript
import * as xPython from '@x-python/core';

// initialize xPython
await xPython.init();

// execute python code
await xPython.exec({ code: '1 + 1' });
await xPython.exec({ code: 'print("test")' });

// multiline example
await xPython.exec({
  code: `
import sys
sys.version
`,
});

// you can use built-in packages without additionally installing them
await xPython.exec({
  code: `
import numpy as np
np.random.rand()
`,
});

// code completion
await xPython.complete.repl({ code: `import sys; sys.ver` });

// specify the cursor position
await xPython.complete.repl({
  code: `
from math import factorial

test = 8
print(tes)
factorial(x)
`,
  line: 5,
  column: 9,
});

// format the code
const { result } = await xPython.format({
  code: `
def add(a,            b):
  return a +        b

print(add(12,

54))
`,
});

console.log(result);

// install packages
await xPython.install(['nicelog']);

// and use the newly installed package :)
const { stderr } = await xPython.exec({
  code: `
import logging
import sys

from nicelog.formatters import Colorful

# Setup a logger
logger = logging.getLogger('foo')
logger.setLevel(logging.DEBUG)

# Setup a handler, writing colorful output
# to the console
handler = logging.StreamHandler(sys.stderr)
handler.setFormatter(Colorful())
handler.setLevel(logging.DEBUG)
logger.addHandler(handler)

# Now log some messages..
logger.debug('Debug message')
logger.info('Info message')
logger.warning('Warning message')
logger.error('Error message')
logger.critical('Critical message')
try:
    raise ValueError('This is an exception')
except:
    logger.exception("An error occurred")
`,
});

console.log(stderr);
```

## API

#### .init

It will initialize `xPython`. Most importantly it will create a separate thread (dedicated web worker), install `pyodide` inside that thread, create a channel, and setup all necessary packages and functions for further usage.

```javascript
import * as xPython from '@x-python/core';

await xPython.init();
```

Usually, we do initialize `xPython` before using other methods (like `exec`, `complete`, etc), but it's not mandatory :slightly_smiling_face: So, you can go ahead and do `xPython.exec({ code: '...' })` without doing `xPython.init()` - it will do `xPython.init()` on first `xPython.exec` (or `.complete`, `.format` and any other supported method) call if it's not initialized. The aim of the existence of a separate initialize method is to provide full flexibility to developers. The initialization process takes time and it should be possible to handle that time in the way you want. So, you can do `await xPython.init();` at the begging or do it after a certain user action or, if you are okay with your users waiting a little bit more after the first execution then you can skip the initialization process and it will be handled automatically :slightly_smiling_face:

#### .exec

`exec` - one of the most frequently used. Basically, it's for executing python code. A simple usage looks like this:

```javascript
import * as xPython from '@x-python/core';

await xPython.exec({ code: '1 + 1' });
```

You also can provide a `context` with global variables, like:

```javascript
import * as xPython from '@x-python/core';

await xPython.exec({ code: 'x + 1', context: { x: 1 } });
```

But let's take a closer look at what it returns. In both cases we will get something like this:

```js
{ result: 2, error: null, stdout: 'test', stderr: '' }
```

`result` is what is returned from the executed script. But we also have `stdout` (and `stderr`) for standard output streams. If we execute `print("test")` nothing will be returned, but you will have a `stdout`.

```javascript
import * as xPython from '@x-python/core';

await xPython.exec({ code: 'print("test")' });

// { result: undefined, error: null, stdout: 'test', stderr: '' }
```

Of cource you can exec multiline code snippets:

```javascript
import * as xPython from '@x-python/core';

await xPython.exec({
  code: `
import sys

sys.version
`,
});
```

You can directly use `pyodide` built-in package list without installing them. The full list is [here](https://pyodide.org/en/stable/usage/packages-in-pyodide.html)

```javascript
import * as xPython from '@x-python/core';

await xPython.exec({
  code: `
import numpy as np

np.random.rand()
`,
});
```

It will autodetect `numpy` and it will install the `numpy` if it's the first time of its usage.

#### .complete

`.complete` is to get code completions. Simple usage looks like this:

```javascript
import * as xPython from '@x-python/core';

await xPython.complete.repl({ code: 'import sys; sys.ver' });
```

This example will return an array with two possible options: `version` and `version_info` :slightly_smiling_face:

The full signature of this method also includes `line` and `column` options to specify the cursor position. If `line` isn't provided `xPython` will assume it's the last line and, correspondingly, if `column` isn't provided it will assume that it's the last column. So, in the previous example, it assumed that cursor at the end of `sys.var` and returned code completions based on that assumption. An example with cursor position specified:

```javascript
await xPython.complete.repl({
  code: `
from math import factorial

test = 8
print(tes)
factorial(x)
`,
  line: 5,
  column: 9,
});
```

This will return the only available option here: `test`.

The curious eye may notice that instead of `.complete` we called `.complete.repl`. When it comes to code completion at least two environments can be your target: `REPL` and `Script/File/Editor`. And based on the environment code completion can vary. In the current version, we do support only `REPL`, but very soon other options also will be available ⏳

#### .format

Code formatting is an essential part of interacting with your code. A simple usage looks like this:

```javascript
import * as xPython from '@x-python/core';

const { result } = await xPython.format({
  code: `
def add(a,            b):
  return a +        b

print(add(12,

54))
`,
});

console.log(result);
```

**NOTE:** in upcoming versions a full configuration option will be provided.

#### .install

The entire standard library is available out of the box, so you can import `sys`, `math`, or `os` without doing anything special. In addition to this `pyodide` also provides a list of built-in packages, like `numpy`, `pandas`, `scipy`, `matplotlib`, `scikit-learn`, etc. Check the full list [here](https://pyodide.org/en/stable/usage/packages-in-pyodide.html). You can use any package from the above-mentioned list and it will be installed automatically and on demand. And if that's not enough you still can install any pure `Python` packages with wheels available on `PyPI` :slightly_smiling_face: Let's install the package called `nicelog`.

```javascript
import * as xPython from '@x-python/core';

await xPython.install(['nicelog']);
```

That's it :slightly_smiling_face: Now you have `nicelog` installed and it's ready to be used. Not familiar with `nicelog`? Let's check what's inside:

```javascript
import * as xPython from '@x-python/core';

await xPython.complete.repl({ code: 'from nicelog import ' });
```

As it's already installed it should be available for code completion as well :white_check_mark:

Example from the `nicelog` `PyPI` [page](https://pypi.org/project/nicelog/).

```javascript
const { stderr } = await xPython.exec({
  code: `
import logging
import sys

from nicelog.formatters import Colorful

# Setup a logger
logger = logging.getLogger('foo')
logger.setLevel(logging.DEBUG)

# Setup a handler, writing colorful output
# to the console
handler = logging.StreamHandler(sys.stderr)
handler.setFormatter(Colorful())
handler.setLevel(logging.DEBUG)
logger.addHandler(handler)

# Now log some messages..
logger.debug('Debug message')
logger.info('Info message')
logger.warning('Warning message')
logger.error('Error message')
logger.critical('Critical message')
try:
    raise ValueError('This is an exception')
except:
    logger.exception("An error occurred")
`,
});

console.log(stderr);
```

### Development

To play with the library locally do the following steps:

1. clone this repo

```bash
git clone git@github.com:suren-atoyan/x-python.git
```

2. install dependencies

```bash
npm install # or yarn
```

3. run the dev server

```bash
npm run dev
```

That's it :slightly_smiling_face: Under `/playground` folder you can find the `index.html` file which contains a script with the demo code and under `/src` folder you can find the library source code. Enjoy it :tada:

## License

[MIT](./LICENSE)
