## Installation

    $ npm install ../config-it

## Quick Start

 option 1: environment
 create config.<environment>.js file (e.g. production/development/lab)
 require the module:
 var config = require('config-it');

 run your app with desired environment: NODE_ENV=<environment> node app.js
 note: the default environment is development

 option 2: inheritance
 create config.base.js file
 var config = require('config-it').config({useBase: true});
 now the environment config file will inherit from the base file and merge the configs

## Features

  * Environment based
  * Inheritance

## Viewing Examples

// config.base.js file

var config = module.exports = {};

config.settings = {
    port: 1500
};

// config.<environment>.js file
var config = module.exports = {};

config.settings = {
    host: "127.0.0.1"
};

the result will be:

config.settings = {
    host: "127.0.0.1",
    port: 1500
};


## Running Tests

see test.js file

## Contributors

Created by Nassi on 16/11/15.

## License

RMS
