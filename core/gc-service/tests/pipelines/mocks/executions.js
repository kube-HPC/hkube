const moment = require('moment');

module.exports = [
    {
        "pipeline": {
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
            "startTime": 1532506623299,

        },
        "pdIntervalTimestamp": Date.now(),
        "graph": {
            "jobId": "job-0",
            "timestamp": Date.now(),
            "nodes": [
                {
                    "nodeName": "green",
                    "algorithmName": "green-alg",
                    "taskId": "so7bw5d9",
                    "podName": "green-5a611-9rkc5",
                    "status": "active"
                }

            ]

        }
    },
    {
        "pipeline": {
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
            "startTime": 1532506623299,

        },
        "pdIntervalTimestamp": moment().subtract(2, 'hours').toDate().getTime(),
        "graph":
        {
            "jobId": "job-1",
            "timestamp": Date.now(),
            "nodes": [
                {
                    "nodeName": "green",
                    "algorithmName": "green-alg",
                    "taskId": "6ahx4qad",
                    "podName": "green-ygzyl-hlgtk",
                    "status": "active"
                }

            ]

        }
    },
    {
        "pipeline": {
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
            "startTime": Date.now(),

        },
        "pdIntervalTimestamp": Date.now(),
        "graph": {
            "jobId": "job-2",
            "timestamp": Date.now(),
            "nodes": [
                {
                    "nodeName": "green",
                    "algorithmName": "green-alg",
                    "taskId": "q8sismx6",
                    "podName": "green-rn7ph-24q9k",
                    "status": "active"
                }

            ]

        }
    },
    {
        "pipeline": {
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
            "startTime": Date.now(),

        },
        "pdIntervalTimestamp": moment().subtract(2, 'hours').toDate().getTime(),
        "graph": {
            "jobId": "job-3",
            "timestamp": Date.now(),
            "nodes": [
                {
                    "nodeName": "green",
                    "algorithmName": "green-alg",
                    "taskId": "337w0qdo",
                    "podName": "green-nfbz8-ntvnc",
                    "status": "active"
                }

            ]

        }
    },
    {
        "pipeline": {
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
        "pdIntervalTimestamp": Date.now(),
        "graph": {}
    },
    {
        "pipeline": {
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
        "pdIntervalTimestamp": Date.now(),
        "graph": {}
    },
    {
        "pipeline": {
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
        "pdIntervalTimestamp": Date.now(),
        "graph": {}
    },
    {
        "pipeline": {
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
        "pdIntervalTimestamp": Date.now(),
        "graph": {}
    },
    {
        "pipeline": {
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
        "pdIntervalTimestamp": Date.now(),
        "graph": {}
    },
    {
        "pipeline": {
            "name": "output4",
            "nodes": [
                {
                    "nodeName": "output-4",
                    "algorithmName": "output-4",
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
        "pdIntervalTimestamp": Date.now(),
        "graph": {}
    },
    {
        "pipeline": {
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
        },
        "pdIntervalTimestamp": Date.now(),
        "graph": {}
    }
]