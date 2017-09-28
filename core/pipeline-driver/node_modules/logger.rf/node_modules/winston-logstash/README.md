# winston-logstash

[![Build Status](https://travis-ci.org/jaakkos/winston-logstash.png?branch=master)](https://travis-ci.org/jaakkos/winston-logstash)

A [Logstash TCP][0] transport for [winston][1].

## Usage

### Node

``` js
  var winston = require('winston');

  //
  // Requiring `winston-logstash` will expose
  // `winston.transports.Logstash`
  //
  require('winston-logstash');

  winston.add(winston.transports.Logstash, {
    port: 28777,
    node_name: 'my node name',
    host: '127.0.0.1'
  });
```

### Logstash config

``` ruby
  input {
    # Sample input over TCP
    tcp { port => 28777 type=>"sample" }
  }
  output {
    stdout { debug => true }
  }

  filter {
    json {
      source => "message"
    }
  }

```

## Inspiration
[winston-loggly][2]

## Run Tests

```
  NODE_TLS_REJECT_UNAUTHORIZED=0 npm test
```

## TODO

1. Rethink logstash integration ( https://github.com/flatiron/winston/blob/master/lib/winston/common.js#L149 )
2. Rewrite
3. Release major after rewrite

N. Clean up tests ( refactor )

#### Author: [Jaakko Suutarla](https://github.com/jaakkos)

#### License: MIT

See LICENSE for the full license text.

[0]: http://logstash.net/
[1]: https://github.com/flatiron/winston
[2]: https://github.com/indexzero/winston-loggly
