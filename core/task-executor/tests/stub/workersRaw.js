// INFO: 6 Workers raw from ETCD, one working (print-every-10-sec algo) and the other 5 ready (print-every-10-sec, green-alg, yellow-alg, eval-alg, black-alg)
// Also, green-alg, yellow-alg, eval-alg, black-alg are hot workers.
// This file is in sync with podsRaw and jobsRaw.
module.exports = [
  {
    "workerStatus": "ready",
    "isMaster": false,
    "workerStartingTime": "2025-08-13T11:39:47.023Z",
    "jobCurrentTime": "2025-08-13T11:39:47.447Z",
    "workerPaused": false,
    "hotWorker": false,
    "workerId": "6f7a0fcf-21eb-482f-b559-66faf6611014",
    "algorithmName": "print-every-10-sec",
    "podName": "print-every-10-sec-shi9j-2grfl",
    "workerImage": "hkube/worker:v2.9.2-stopProcessing-changes-16903637601",
    "algorithmImage": "docker.io/hkubedevtest/print-every-10-sec:vokska3od",
    "streamingDiscovery": {
        "host": "100.96.3.189",
        "port": 9022
    },
    "algorithmVersion": "wp8rjl368s"
  },
  {
    "jobId": "wymasg7smvh6",
    "taskId": "gz0y32tz",
    "pipelineName": "print-every-10-sec",
    "jobData": {
        "nodeName": "print-every-10-sec",
        "batchIndex": 0
    },
    "nodeName": "print-every-10-sec",
    "workerStatus": "working",
    "isMaster": false,
    "workerStartingTime": "2025-08-13T11:38:12.816Z",
    "jobCurrentTime": "2025-08-13T11:38:13.247Z",
    "workerPaused": false,
    "hotWorker": false,
    "error": null,
    "workerId": "f6a9614f-53ff-420a-8e59-295ed4998739",
    "algorithmName": "print-every-10-sec",
    "podName": "print-every-10-sec-7gn0f-j76qh",
    "workerImage": "hkube/worker:v2.9.2-stopProcessing-changes-16903637601",
    "algorithmImage": "docker.io/hkubedevtest/print-every-10-sec:vokska3od",
    "streamingDiscovery": {
        "host": "100.96.2.19",
        "port": 9022
    },
    "algorithmVersion": "wp8rjl368s"
  },
  {
    "workerStatus": "ready",
    "isMaster": false,
    "workerStartingTime": "2025-08-13T11:12:11.612Z",
    "jobCurrentTime": null,
    "workerPaused": false,
    "hotWorker": true,
    "error": null,
    "workerId": "568c1b68-8ad8-48a6-9abc-39a14ca40bb7",
    "algorithmName": "yellow-alg",
    "podName": "yellow-alg-hd3u5-bwvvs",
    "workerImage": "hkube/worker:v2.9.2-stopProcessing-changes-16903637601",
    "algorithmImage": "hkube/algorithm-example-python:v2.9.1",
    "streamingDiscovery": {
        "host": "100.96.3.185",
        "port": 9022
    },
    "algorithmVersion": "vkbcni7gf6"
  },
  {
    "workerStatus": "ready",
    "isMaster": false,
    "workerStartingTime": "2025-08-13T11:11:16.511Z",
    "jobCurrentTime": null,
    "workerPaused": false,
    "hotWorker": true,
    "error": null,
    "workerId": "81ae050a-56d2-4d41-b7f8-2bca2b3fdd31",
    "algorithmName": "eval-alg",
    "podName": "eval-alg-idhi2-5dw7l",
    "workerImage": "hkube/worker:v2.9.2-stopProcessing-changes-16903637601",
    "algorithmImage": "hkube/algorunner:v2.9.1",
    "streamingDiscovery": {
        "host": "100.96.2.16",
        "port": 9022
    },
    "algorithmVersion": "3mte3mgvv5"
  },
  {
    "workerStatus": "ready",
    "isMaster": false,
    "workerStartingTime": "2025-08-13T11:12:26.034Z",
    "jobCurrentTime": null,
    "workerPaused": false,
    "hotWorker": true,
    "error": null,
    "workerId": "a1b9545a-da79-4ef6-bc99-e91d2c245f73",
    "algorithmName": "black-alg",
    "podName": "black-alg-ielrj-982xv",
    "workerImage": "hkube/worker:v2.9.2-stopProcessing-changes-16903637601",
    "algorithmImage": "hkube/algorithm-example-python:v2.9.1",
    "streamingDiscovery": {
        "host": "100.96.2.17",
        "port": 9022
    },
    "algorithmVersion": "leezz7mg0c"
  },
  {
    "workerStatus": "ready",
    "isMaster": false,
    "workerStartingTime": "2025-08-13T11:10:50.940Z",
    "jobCurrentTime": null,
    "workerPaused": false,
    "hotWorker": true,
    "error": null,
    "workerId": "b0ebbe66-6513-4cea-bd0f-4093c5519df8",
    "algorithmName": "green-alg",
    "podName": "green-alg-5cno8-sr8xn",
    "workerImage": "hkube/worker:v2.9.2-stopProcessing-changes-16903637601",
    "algorithmImage": "hkube/algorithm-example-python:v2.9.1",
    "streamingDiscovery": {
        "host": "100.96.3.184",
        "port": 9022
    },
    "algorithmVersion": "lm5mznqqq4"
  }
]
