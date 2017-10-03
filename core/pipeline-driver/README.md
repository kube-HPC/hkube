# Producer consumer message queue

producer consumer message queue based on Redis built for Node.js

## Installation

```bash
$ npm install raf-tasq
```

## Features

- Sim

## Documentation



## Getting Help


## Basic usage

```js

Producer

const { producer } = require('raf-tasq');
const options = {
    job: {
        type: 'test-job',
        data: { action: 'bla' },
    }
}
const job = await producer.createJob(options);

```

## License

Copyright 

