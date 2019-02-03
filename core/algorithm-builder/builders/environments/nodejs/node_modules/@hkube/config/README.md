# config.hkube

[![Build Status](https://travis-ci.org/kube-HPC/config.hkube.svg?branch=master)](https://travis-ci.org/kube-HPC/config.hkube)
[![Coverage Status](https://coveralls.io/repos/github/kube-HPC/config.hkube/badge.svg?branch=master)](https://coveralls.io/github/kube-HPC/config.hkube?branch=master)


## Installation

    $ npm install ../config-it

## Quick Start

 option 1: environment
 create config.<environment>.js file (e.g. production/development/lab)
 require the module:

  ```js
const configIt = require('config-it');
const config = configIt.load();
```

 run your app with desired environment: NODE_ENV=<environment> node app.js
 note: the default environment is development

 option 2: inheritance
 create config.base.js file
 ```js
const configIt = require('config-it')
const config = configIt.load();
```

 now the environment config file will inherit from the base file and merge the configs

## Features

  * Environment based
  * Inheritance

## Viewing Examples

```js
// config.base.js file
const config = module.exports = {};
config.settings = {
    port: 1500
};

// config.<environment>.js file
const config = module.exports = {};
config.settings = {
    host: "127.0.0.1"
};

// the result will be:
config.settings = {
    host: "127.0.0.1",
    port: 1500
};
```

## Running Tests

see test.js file

## Contributors

Created by Nassi on 16/11/15.

## License

RMS
