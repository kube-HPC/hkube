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

### Schema

The createJob method will validate the options against the schema

```js
const schema = {
    "properties": {
        "job": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "required": true,
                    "description": "the job type"
                },
                "waitingTimeout": {
                    "type": "integer",
                    "description": "time wait before the job is active/failed/completed"
                },
                "resolveOnStart": {
                    "type": "boolean",
                    "description": "should resolve when the job is in active state"
                },
                "resolveOnComplete": {
                    "type": "boolean",
                    "description": "should resolve when the job is in completed state"
                }
            }
        },
        "queue": {
            "type": "object",
            "properties": {
                "priority": {
                    "type": "integer",
                    "description": "ranges from 1 (highest) to MAX_INT"
                },
                "delay": {
                    "type": "integer",
                    "description": "miliseconds to wait until this job can be processed."
                },
                "timeout": {
                    "type": "integer",
                    "description": "milliseconds after which the job should be fail with a timeout error"
                },
                "attempts": {
                    "type": "integer",
                    "description": "total number of attempts to try the job until it completes"
                },
                "removeOnComplete": {
                    "type": "boolean",
                    "description": "If true, removes the job when it successfully completes",
                    "default": false
                },
                "removeOnFail": {
                    "type": "boolean",
                    "description": "If true, removes the job when it fails after all attempts",
                    "default": false
                }
            }
        },
        "setting": {
            "type": "object",
            "properties": {
                "prefix": {
                    "type": "string",
                    "default": "queue",
                    "description": "prefix for all queue keys"
                }
            }
        }
    }
}
```

## Events

```js
const { producer } = require('raf-tasq');
producer.on('job-failed', (jobID, err) => {       
}).on('job-completed', (jobID, result) => {           
}).on('job-active', (jobID) => {             
});
producer.createJob(options);

const options = {
    job: {
        type: 'test-job',
        data: { action: 'bla' },
    }
}
const job = await producer.createJob(options);
```

## Full Detailed Example

```js
const { producer } = require('raf-tasq');
const options = {
    job: {
        resolveOnStart: false,
        resolveOnComplete: false,
        type: 'test-job',
        data: { action: 'bla' },
        waitingTimeout: 5000
    },
    queue: {
        priority: 1,
        delay: 1000,
        timeout: 5000,
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: false
    },
    setting: {
        prefix: 'sf-queue',
        createClient: function (type) {
            return new Redis([{ host: '127.0.0.1', port: 6379 }])
        }
    }
}

const job = await producer.createJob(options);

```

## Logging


## Feedback Requested


## Credits


## License

Copyright 

