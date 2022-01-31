const moment = require('moment');

module.exports = [
    {
        "name": "test1",
        "nodes": [
            {
                "nodeName": "green",
                "algorithmName": "green-alg",
                "input": []
            }
        ],
        "flowInput": {
            "metadata": {},
            "storageInfo": {
                "Key": "key1",
                "Bucket": "hkube"
            }
        },
        "options": {
            "batchTolerance": 100,
            "progressVerbosityLevel": "debug"
        },
        "webhooks": {
            "progress": "http://localhost:3003/webhook/progress",
            "result": "http://localhost:3003/webhook/result"
        },
        "priority": 3,
        "startTime": 1532506623299
    },
    {
        "name": "test2",
        "nodes": [
            {
                "nodeName": "green",
                "algorithmName": "green-alg",
                "input": []
            }
        ],
        "flowInput": {
            "metadata": {},
            "storageInfo": {
                "Key": "key1",
                "Bucket": "hkube"
            }
        },
        "options": {
            "batchTolerance": 100,
            "progressVerbosityLevel": "debug"
        },
        "webhooks": {
            "progress": "http://localhost:3003/webhook/progress",
            "result": "http://localhost:3003/webhook/result"
        },
        "priority": 3,
        "startTime": 1532506623299
    },
    {
        "name": "test3",
        "nodes": [
            {
                "nodeName": "green",
                "algorithmName": "green-alg",
                "input": []
            }
        ],
        "flowInput": {
            "metadata": {},
            "storageInfo": {
                "Key": "key1",
                "Bucket": "hkube"
            }
        },
        "options": {
            "batchTolerance": 100,
            "progressVerbosityLevel": "debug",
            "ttl": 3800
        },
        "webhooks": {
            "progress": "http://localhost:3003/webhook/progress",
            "result": "http://localhost:3003/webhook/result"
        },
        "priority": 3,
        "startTime": Date.now()
    },
    {
        "name": "test4",
        "nodes": [
            {
                "nodeName": "green",
                "algorithmName": "green-alg",
                "input": []
            }
        ],
        "flowInput": {
            "metadata": {},
            "storageInfo": {
                "Key": "key1",
                "Bucket": "hkube"
            }
        },
        "options": {
            "batchTolerance": 100,
            "progressVerbosityLevel": "debug",
            "ttl": 3800
        },
        "webhooks": {
            "progress": "http://localhost:3003/webhook/progress",
            "result": "http://localhost:3003/webhook/result"
        },
        "priority": 3,
        "startTime": Date.now()
    },
    {
        "name": "expired pipeline1",
        "nodes": [
            {
                "nodeName": "green",
                "algorithmName": "green-alg",
                "input": []
            }
        ],
        "flowInput": {
            "metadata": {},
            "storageInfo": {
                "Key": "key1",
                "Bucket": "hkube"
            }
        },
        "options": {
            "batchTolerance": 100,
            "progressVerbosityLevel": "debug",
            "ttl": 20
        },
        "webhooks": {
            "progress": "http://localhost:3003/webhook/progress",
            "result": "http://localhost:3003/webhook/result"
        },
        "priority": 3,
        "startTime": moment().subtract(60, 'seconds').toDate().getTime()
    },
    {
        "name": "expired pipeline2",
        "nodes": [
            {
                "nodeName": "green",
                "algorithmName": "green-alg",
                "input": []
            }
        ],
        "flowInput": {
            "metadata": {},
            "storageInfo": {
                "Key": "key1",
                "Bucket": "hkube"
            }
        },
        "options": {
            "batchTolerance": 100,
            "progressVerbosityLevel": "debug",
            "ttl": 30
        },
        "webhooks": {
            "progress": "http://localhost:3003/webhook/progress",
            "result": "http://localhost:3003/webhook/result"
        },
        "priority": 3,
        "startTime": moment().subtract(60, 'seconds').toDate().getTime()
    },
    {
        "name": "active expired",
        "nodes": [
            {
                "nodeName": "green",
                "algorithmName": "green-alg",
                "input": []
            }
        ],
        "flowInput": {
            "metadata": {},
            "storageInfo": {
                "Key": "key1",
                "Bucket": "hkube"
            }
        },
        "options": {
            "batchTolerance": 100,
            "progressVerbosityLevel": "debug",
            "ttl": 90,
            "activeTtl": 30
        },
        "webhooks": {
            "progress": "http://localhost:3003/webhook/progress",
            "result": "http://localhost:3003/webhook/result"
        },
        "priority": 3,
        "startTime": moment().subtract(60, 'seconds').toDate().getTime(),
        "activeTime": moment().subtract(40, 'seconds').toDate().getTime()
    },
    {
        "name": "active not expired",
        "nodes": [
            {
                "nodeName": "green",
                "algorithmName": "green-alg",
                "input": []
            }
        ],
        "flowInput": {
            "metadata": {},
            "storageInfo": {
                "Key": "key1",
                "Bucket": "hkube"
            }
        },
        "options": {
            "batchTolerance": 100,
            "progressVerbosityLevel": "debug",
            "ttl": 90,
            "activeTtl": 50
        },
        "webhooks": {
            "progress": "http://localhost:3003/webhook/progress",
            "result": "http://localhost:3003/webhook/result"
        },
        "priority": 3,
        "startTime": moment().subtract(60, 'seconds').toDate().getTime(),
        "activeTime": moment().subtract(40, 'seconds').toDate().getTime()
    },
    {
        "name": "debug4",
        "nodes": [
            {
                "nodeName": "debug-4",
                "algorithmName": "debug-4",
                "input": []
            }
        ],
        "flowInput": {
            "metadata": {},
            "storageInfo": {
                "Key": "key1",
                "Bucket": "hkube"
            }
        },
        "options": {
            "batchTolerance": 100,
            "progressVerbosityLevel": "debug"
        },
        "webhooks": {
            "progress": "http://localhost:3003/webhook/progress",
            "result": "http://localhost:3003/webhook/result"
        },
        "priority": 3,
        "startTime": 1532506623299
    },
    {
        "name": "gt-alg4",
        "nodes": [
            {
                "nodeName": "gt-alg4",
                "algorithmName": "gt-alg4",
                "input": []
            }
        ],
        "flowInput": {
            "metadata": {},
            "storageInfo": {
                "Key": "key1",
                "Bucket": "hkube"
            }
        },
        "options": {
            "batchTolerance": 100,
            "progressVerbosityLevel": "debug"
        },
        "webhooks": {
            "progress": "http://localhost:3003/webhook/progress",
            "result": "http://localhost:3003/webhook/result"
        },
        "priority": 3,
        "startTime": 1532506623299
    }
]