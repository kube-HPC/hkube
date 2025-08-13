// INFO: 6 Worker jobs raw from K8S, algorithms: print-every-10-sec (twice), green-alg, yellow-alg, eval-alg, black-alg)
// Also, green-alg, yellow-alg, eval-alg, black-alg are hot workers, and print-every-10-sec one of them active and other ready/idle.
// This file is in sync with podsRaw and jobsRaw.
const jobs = [
  {
    "apiVersion": "batch/v1",
    "kind": "Job",
    "metadata": {
      "annotations": {
        "batch.kubernetes.io/job-tracking": ""
      },
      "creationTimestamp": "2025-08-13T11:39:45Z",
      "generation": 1,
      "labels": {
        "algorithm-name": "print-every-10-sec",
        "core": "true",
        "group": "hkube",
        "metrics-group": "workers",
        "type": "worker"
      },
      "name": "print-every-10-sec-shi9j",
      "namespace": "default",
      "resourceVersion": "208212845",
      "uid": "2ff8c344-a3f8-45d5-9255-458fcbf47178"
    },
    "spec": {
      "backoffLimit": 0,
      "completionMode": "NonIndexed",
      "completions": 1,
      "parallelism": 1,
      "selector": {
        "matchLabels": {
          "controller-uid": "2ff8c344-a3f8-45d5-9255-458fcbf47178"
        }
      },
      "suspend": false,
      "template": {
        "metadata": {
          "creationTimestamp": null,
          "labels": {
            "algorithm-name": "print-every-10-sec",
            "controller-uid": "2ff8c344-a3f8-45d5-9255-458fcbf47178",
            "group": "hkube",
            "job-name": "print-every-10-sec-shi9j",
            "metrics-group": "workers",
            "type": "worker"
          }
        },
        "spec": {
          "containers": [
            {
              "env": [
                {
                  "name": "NODE_ENV",
                  "value": "production"
                },
                {
                  "name": "ALGORITHM_TYPE",
                  "value": "print-every-10-sec"
                },
                {
                  "name": "METRICS_PORT",
                  "value": "3001"
                },
                {
                  "name": "INACTIVE_PAUSED_WORKER_TIMEOUT_MS",
                  "value": "10000"
                },
                {
                  "name": "ALGO_METRICS_DIR",
                  "value": "/var/metrics"
                },
                {
                  "name": "POD_ID",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.uid"
                    }
                  }
                },
                {
                  "name": "POD_IP",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.podIP"
                    }
                  }
                },
                {
                  "name": "POD_NAME",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.name"
                    }
                  }
                },
                {
                  "name": "NAMESPACE",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.namespace"
                    }
                  }
                },
                {
                  "name": "DEFAULT_STORAGE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DEFAULT_STORAGE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "ALGORITHM_DISCONNECTED_TIMEOUT_MS",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "ALGORITHM_DISCONNECTED_TIMEOUT_MS",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "STORAGE_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_PORT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_PORT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_TIMEOUT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_TIMEOUT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_MAX_CACHE_SIZE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_MAX_CACHE_SIZE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "STORAGE_MAX_CACHE_SIZE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_MAX_CACHE_SIZE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "WORKER_ALGORITHM_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "WORKER_ALGORITHM_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_SERVING_REPORT_INTERVAL",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_SERVING_REPORT_INTERVAL",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "CLUSTER_NAME",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "CLUSTER_NAME",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "WORKER_SOCKET_MAX_PAYLOAD_BYTES",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "WORKER_SOCKET_MAX_PAYLOAD_BYTES",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "MONGODB_SERVICE_USER_NAME",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "mongodb-username",
                      "name": "mongodb-secret"
                    }
                  }
                },
                {
                  "name": "MONGODB_SERVICE_PASSWORD",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "mongodb-password",
                      "name": "mongodb-secret"
                    }
                  }
                },
                {
                  "name": "MONGODB_DB_NAME",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "mongodb-database",
                      "name": "mongodb-secret"
                    }
                  }
                },
                {
                  "name": "BASE_DATASOURCES_DIRECTORY",
                  "value": "/hkube/datasources-storage"
                },
                {
                  "name": "ALGORITHM_IMAGE",
                  "value": "docker.io/hkubedevtest/print-every-10-sec:vokska3od"
                },
                {
                  "name": "ALGORITHM_VERSION",
                  "value": "wp8rjl368s"
                },
                {
                  "name": "WORKER_IMAGE",
                  "value": "hkube/worker:v2.9.2-stopProcessing-changes-16903637601"
                },
                {
                  "name": "STORAGE_BINARY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_BINARY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "BASE_FS_ADAPTER_DIRECTORY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "BASE_FS_ADAPTER_DIRECTORY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "JAEGER_AGENT_SERVICE_HOST",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.hostIP"
                    }
                  }
                }
              ],
              "image": "hkube/worker:v2.9.2-stopProcessing-changes-16903637601",
              "imagePullPolicy": "IfNotPresent",
              "name": "worker",
              "resources": {},
              "securityContext": {
                "privileged": true
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File",
              "volumeMounts": [
                {
                  "mountPath": "/hkubedata",
                  "name": "storage-volume"
                },
                {
                  "mountPath": "/var/metrics",
                  "name": "algometrics"
                },
                {
                  "mountPath": "/var/lib/docker/containers",
                  "name": "varlibdockercontainers",
                  "readOnly": true
                },
                {
                  "mountPath": "/var/log",
                  "name": "varlog"
                }
              ]
            },
            {
              "env": [
                {
                  "name": "ALGO_METRICS_DIR",
                  "value": "/var/metrics"
                },
                {
                  "name": "POD_IP",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.podIP"
                    }
                  }
                },
                {
                  "name": "DEFAULT_STORAGE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DEFAULT_STORAGE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "STORAGE_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_PORT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_PORT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_TIMEOUT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_TIMEOUT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_MAX_CACHE_SIZE",
                  "value": "512"
                },
                {
                  "name": "STORAGE_MAX_CACHE_SIZE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_MAX_CACHE_SIZE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "WORKER_ALGORITHM_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "WORKER_ALGORITHM_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_SERVING_REPORT_INTERVAL",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_SERVING_REPORT_INTERVAL",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "CLUSTER_NAME",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "CLUSTER_NAME",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "ALGORITHM_TYPE",
                  "value": "print-every-10-sec"
                },
                {
                  "name": "ALGORITHM_ENTRY_POINT",
                  "value": "PrintEvery10Sec.py"
                },
                {
                  "name": "STORAGE_BINARY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_BINARY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "BASE_FS_ADAPTER_DIRECTORY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "BASE_FS_ADAPTER_DIRECTORY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "JAEGER_AGENT_SERVICE_HOST",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.hostIP"
                    }
                  }
                }
              ],
              "image": "docker.io/hkubedevtest/print-every-10-sec:vokska3od",
              "imagePullPolicy": "IfNotPresent",
              "name": "algorunner",
              "resources": {
                "limits": {
                  "cpu": "2800m",
                  "memory": "768Mi"
                },
                "requests": {
                  "cpu": "2800m",
                  "memory": "768Mi"
                }
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File",
              "volumeMounts": [
                {
                  "mountPath": "/hkubedata",
                  "name": "storage-volume"
                },
                {
                  "mountPath": "/var/metrics",
                  "name": "algometrics"
                },
                {
                  "mountPath": "/hkube/datasources-storage",
                  "name": "datasources-storage"
                }
              ]
            }
          ],
          "dnsPolicy": "ClusterFirst",
          "restartPolicy": "Never",
          "schedulerName": "default-scheduler",
          "securityContext": {},
          "serviceAccount": "worker-serviceaccount",
          "serviceAccountName": "worker-serviceaccount",
          "terminationGracePeriodSeconds": 30,
          "volumes": [
            {
              "name": "storage-volume",
              "persistentVolumeClaim": {
                "claimName": "hkube-storage-pvc"
              }
            },
            {
              "emptyDir": {},
              "name": "algometrics"
            },
            {
              "hostPath": {
                "path": "/var/lib/docker/containers",
                "type": ""
              },
              "name": "varlibdockercontainers"
            },
            {
              "hostPath": {
                "path": "/var/log",
                "type": ""
              },
              "name": "varlog"
            },
            {
              "name": "datasources-storage",
              "persistentVolumeClaim": {
                "claimName": "hkube-datasources"
              }
            }
          ]
        }
      }
    },
    "status": {
      "active": 1,
      "startTime": "2025-08-13T11:39:45Z",
      "uncountedTerminatedPods": {}
    }
  },
  {
    "apiVersion": "batch/v1",
    "kind": "Job",
    "metadata": {
      "annotations": {
        "batch.kubernetes.io/job-tracking": ""
      },
      "creationTimestamp": "2025-08-13T11:38:11Z",
      "generation": 1,
      "labels": {
        "algorithm-name": "print-every-10-sec",
        "core": "true",
        "group": "hkube",
        "metrics-group": "workers",
        "type": "worker"
      },
      "name": "print-every-10-sec-7gn0f",
      "namespace": "default",
      "resourceVersion": "208212366",
      "uid": "601f38cf-079c-450c-9ee5-1a1f8bbd70a7"
    },
    "spec": {
      "backoffLimit": 0,
      "completionMode": "NonIndexed",
      "completions": 1,
      "parallelism": 1,
      "selector": {
        "matchLabels": {
          "controller-uid": "601f38cf-079c-450c-9ee5-1a1f8bbd70a7"
        }
      },
      "suspend": false,
      "template": {
        "metadata": {
          "creationTimestamp": null,
          "labels": {
            "algorithm-name": "print-every-10-sec",
            "controller-uid": "601f38cf-079c-450c-9ee5-1a1f8bbd70a7",
            "group": "hkube",
            "job-name": "print-every-10-sec-7gn0f",
            "metrics-group": "workers",
            "type": "worker"
          }
        },
        "spec": {
          "containers": [
            {
              "env": [
                {
                  "name": "NODE_ENV",
                  "value": "production"
                },
                {
                  "name": "ALGORITHM_TYPE",
                  "value": "print-every-10-sec"
                },
                {
                  "name": "METRICS_PORT",
                  "value": "3001"
                },
                {
                  "name": "INACTIVE_PAUSED_WORKER_TIMEOUT_MS",
                  "value": "10000"
                },
                {
                  "name": "ALGO_METRICS_DIR",
                  "value": "/var/metrics"
                },
                {
                  "name": "POD_ID",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.uid"
                    }
                  }
                },
                {
                  "name": "POD_IP",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.podIP"
                    }
                  }
                },
                {
                  "name": "POD_NAME",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.name"
                    }
                  }
                },
                {
                  "name": "NAMESPACE",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.namespace"
                    }
                  }
                },
                {
                  "name": "DEFAULT_STORAGE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DEFAULT_STORAGE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "ALGORITHM_DISCONNECTED_TIMEOUT_MS",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "ALGORITHM_DISCONNECTED_TIMEOUT_MS",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "STORAGE_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_PORT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_PORT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_TIMEOUT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_TIMEOUT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_MAX_CACHE_SIZE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_MAX_CACHE_SIZE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "STORAGE_MAX_CACHE_SIZE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_MAX_CACHE_SIZE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "WORKER_ALGORITHM_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "WORKER_ALGORITHM_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_SERVING_REPORT_INTERVAL",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_SERVING_REPORT_INTERVAL",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "CLUSTER_NAME",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "CLUSTER_NAME",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "WORKER_SOCKET_MAX_PAYLOAD_BYTES",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "WORKER_SOCKET_MAX_PAYLOAD_BYTES",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "MONGODB_SERVICE_USER_NAME",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "mongodb-username",
                      "name": "mongodb-secret"
                    }
                  }
                },
                {
                  "name": "MONGODB_SERVICE_PASSWORD",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "mongodb-password",
                      "name": "mongodb-secret"
                    }
                  }
                },
                {
                  "name": "MONGODB_DB_NAME",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "mongodb-database",
                      "name": "mongodb-secret"
                    }
                  }
                },
                {
                  "name": "BASE_DATASOURCES_DIRECTORY",
                  "value": "/hkube/datasources-storage"
                },
                {
                  "name": "ALGORITHM_IMAGE",
                  "value": "docker.io/hkubedevtest/print-every-10-sec:vokska3od"
                },
                {
                  "name": "ALGORITHM_VERSION",
                  "value": "wp8rjl368s"
                },
                {
                  "name": "WORKER_IMAGE",
                  "value": "hkube/worker:v2.9.2-stopProcessing-changes-16903637601"
                },
                {
                  "name": "STORAGE_BINARY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_BINARY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "BASE_FS_ADAPTER_DIRECTORY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "BASE_FS_ADAPTER_DIRECTORY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "JAEGER_AGENT_SERVICE_HOST",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.hostIP"
                    }
                  }
                }
              ],
              "image": "hkube/worker:v2.9.2-stopProcessing-changes-16903637601",
              "imagePullPolicy": "IfNotPresent",
              "name": "worker",
              "resources": {},
              "securityContext": {
                "privileged": true
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File",
              "volumeMounts": [
                {
                  "mountPath": "/hkubedata",
                  "name": "storage-volume"
                },
                {
                  "mountPath": "/var/metrics",
                  "name": "algometrics"
                },
                {
                  "mountPath": "/var/lib/docker/containers",
                  "name": "varlibdockercontainers",
                  "readOnly": true
                },
                {
                  "mountPath": "/var/log",
                  "name": "varlog"
                }
              ]
            },
            {
              "env": [
                {
                  "name": "ALGO_METRICS_DIR",
                  "value": "/var/metrics"
                },
                {
                  "name": "POD_IP",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.podIP"
                    }
                  }
                },
                {
                  "name": "DEFAULT_STORAGE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DEFAULT_STORAGE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "STORAGE_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_PORT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_PORT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_TIMEOUT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_TIMEOUT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_MAX_CACHE_SIZE",
                  "value": "512"
                },
                {
                  "name": "STORAGE_MAX_CACHE_SIZE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_MAX_CACHE_SIZE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "WORKER_ALGORITHM_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "WORKER_ALGORITHM_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_SERVING_REPORT_INTERVAL",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_SERVING_REPORT_INTERVAL",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "CLUSTER_NAME",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "CLUSTER_NAME",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "ALGORITHM_TYPE",
                  "value": "print-every-10-sec"
                },
                {
                  "name": "ALGORITHM_ENTRY_POINT",
                  "value": "PrintEvery10Sec.py"
                },
                {
                  "name": "STORAGE_BINARY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_BINARY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "BASE_FS_ADAPTER_DIRECTORY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "BASE_FS_ADAPTER_DIRECTORY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "JAEGER_AGENT_SERVICE_HOST",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.hostIP"
                    }
                  }
                }
              ],
              "image": "docker.io/hkubedevtest/print-every-10-sec:vokska3od",
              "imagePullPolicy": "IfNotPresent",
              "name": "algorunner",
              "resources": {
                "limits": {
                  "cpu": "2800m",
                  "memory": "768Mi"
                },
                "requests": {
                  "cpu": "2800m",
                  "memory": "768Mi"
                }
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File",
              "volumeMounts": [
                {
                  "mountPath": "/hkubedata",
                  "name": "storage-volume"
                },
                {
                  "mountPath": "/var/metrics",
                  "name": "algometrics"
                },
                {
                  "mountPath": "/hkube/datasources-storage",
                  "name": "datasources-storage"
                }
              ]
            }
          ],
          "dnsPolicy": "ClusterFirst",
          "restartPolicy": "Never",
          "schedulerName": "default-scheduler",
          "securityContext": {},
          "serviceAccount": "worker-serviceaccount",
          "serviceAccountName": "worker-serviceaccount",
          "terminationGracePeriodSeconds": 30,
          "volumes": [
            {
              "name": "storage-volume",
              "persistentVolumeClaim": {
                "claimName": "hkube-storage-pvc"
              }
            },
            {
              "emptyDir": {},
              "name": "algometrics"
            },
            {
              "hostPath": {
                "path": "/var/lib/docker/containers",
                "type": ""
              },
              "name": "varlibdockercontainers"
            },
            {
              "hostPath": {
                "path": "/var/log",
                "type": ""
              },
              "name": "varlog"
            },
            {
              "name": "datasources-storage",
              "persistentVolumeClaim": {
                "claimName": "hkube-datasources"
              }
            }
          ]
        }
      }
    },
    "status": {
      "active": 1,
      "startTime": "2025-08-13T11:38:11Z",
      "uncountedTerminatedPods": {}
    }
  },
  {
    "apiVersion": "batch/v1",
    "kind": "Job",
    "metadata": {
      "annotations": {
        "batch.kubernetes.io/job-tracking": ""
      },
      "creationTimestamp": "2025-08-13T11:12:09Z",
      "generation": 1,
      "labels": {
        "algorithm-name": "yellow-alg",
        "core": "true",
        "group": "hkube",
        "metrics-group": "workers",
        "type": "worker"
      },
      "name": "yellow-alg-hd3u5",
      "namespace": "default",
      "resourceVersion": "208204488",
      "uid": "5e83fb59-6c8d-4b5a-8798-1fa32fb412e1"
    },
    "spec": {
      "backoffLimit": 0,
      "completionMode": "NonIndexed",
      "completions": 1,
      "parallelism": 1,
      "selector": {
        "matchLabels": {
          "controller-uid": "5e83fb59-6c8d-4b5a-8798-1fa32fb412e1"
        }
      },
      "suspend": false,
      "template": {
        "metadata": {
          "creationTimestamp": null,
          "labels": {
            "algorithm-name": "yellow-alg",
            "controller-uid": "5e83fb59-6c8d-4b5a-8798-1fa32fb412e1",
            "group": "hkube",
            "job-name": "yellow-alg-hd3u5",
            "metrics-group": "workers",
            "type": "worker"
          }
        },
        "spec": {
          "containers": [
            {
              "env": [
                {
                  "name": "NODE_ENV",
                  "value": "production"
                },
                {
                  "name": "ALGORITHM_TYPE",
                  "value": "yellow-alg"
                },
                {
                  "name": "METRICS_PORT",
                  "value": "3001"
                },
                {
                  "name": "INACTIVE_PAUSED_WORKER_TIMEOUT_MS",
                  "value": "10000"
                },
                {
                  "name": "ALGO_METRICS_DIR",
                  "value": "/var/metrics"
                },
                {
                  "name": "POD_ID",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.uid"
                    }
                  }
                },
                {
                  "name": "POD_IP",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.podIP"
                    }
                  }
                },
                {
                  "name": "POD_NAME",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.name"
                    }
                  }
                },
                {
                  "name": "NAMESPACE",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.namespace"
                    }
                  }
                },
                {
                  "name": "DEFAULT_STORAGE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DEFAULT_STORAGE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "ALGORITHM_DISCONNECTED_TIMEOUT_MS",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "ALGORITHM_DISCONNECTED_TIMEOUT_MS",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "STORAGE_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_PORT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_PORT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_TIMEOUT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_TIMEOUT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_MAX_CACHE_SIZE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_MAX_CACHE_SIZE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "STORAGE_MAX_CACHE_SIZE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_MAX_CACHE_SIZE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "WORKER_ALGORITHM_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "WORKER_ALGORITHM_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_SERVING_REPORT_INTERVAL",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_SERVING_REPORT_INTERVAL",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "CLUSTER_NAME",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "CLUSTER_NAME",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "WORKER_SOCKET_MAX_PAYLOAD_BYTES",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "WORKER_SOCKET_MAX_PAYLOAD_BYTES",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "MONGODB_SERVICE_USER_NAME",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "mongodb-username",
                      "name": "mongodb-secret"
                    }
                  }
                },
                {
                  "name": "MONGODB_SERVICE_PASSWORD",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "mongodb-password",
                      "name": "mongodb-secret"
                    }
                  }
                },
                {
                  "name": "MONGODB_DB_NAME",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "mongodb-database",
                      "name": "mongodb-secret"
                    }
                  }
                },
                {
                  "name": "BASE_DATASOURCES_DIRECTORY",
                  "value": "/hkube/datasources-storage"
                },
                {
                  "name": "ALGORITHM_IMAGE",
                  "value": "hkube/algorithm-example-python:v2.9.1"
                },
                {
                  "name": "ALGORITHM_VERSION",
                  "value": "vkbcni7gf6"
                },
                {
                  "name": "WORKER_IMAGE",
                  "value": "hkube/worker:v2.9.2-stopProcessing-changes-16903637601"
                },
                {
                  "name": "HOT_WORKER",
                  "value": "true"
                },
                {
                  "name": "STORAGE_BINARY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_BINARY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "BASE_FS_ADAPTER_DIRECTORY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "BASE_FS_ADAPTER_DIRECTORY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "JAEGER_AGENT_SERVICE_HOST",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.hostIP"
                    }
                  }
                }
              ],
              "image": "hkube/worker:v2.9.2-stopProcessing-changes-16903637601",
              "imagePullPolicy": "IfNotPresent",
              "name": "worker",
              "resources": {},
              "securityContext": {
                "privileged": true
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File",
              "volumeMounts": [
                {
                  "mountPath": "/hkubedata",
                  "name": "storage-volume"
                },
                {
                  "mountPath": "/var/metrics",
                  "name": "algometrics"
                },
                {
                  "mountPath": "/var/lib/docker/containers",
                  "name": "varlibdockercontainers",
                  "readOnly": true
                },
                {
                  "mountPath": "/var/log",
                  "name": "varlog"
                }
              ]
            },
            {
              "env": [
                {
                  "name": "ALGO_METRICS_DIR",
                  "value": "/var/metrics"
                },
                {
                  "name": "POD_IP",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.podIP"
                    }
                  }
                },
                {
                  "name": "DEFAULT_STORAGE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DEFAULT_STORAGE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "STORAGE_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_PORT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_PORT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_TIMEOUT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_TIMEOUT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_MAX_CACHE_SIZE",
                  "value": "512"
                },
                {
                  "name": "STORAGE_MAX_CACHE_SIZE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_MAX_CACHE_SIZE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "WORKER_ALGORITHM_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "WORKER_ALGORITHM_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_SERVING_REPORT_INTERVAL",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_SERVING_REPORT_INTERVAL",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "CLUSTER_NAME",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "CLUSTER_NAME",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "ALGORITHM_TYPE",
                  "value": "yellow-alg"
                },
                {
                  "name": "STORAGE_BINARY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_BINARY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "BASE_FS_ADAPTER_DIRECTORY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "BASE_FS_ADAPTER_DIRECTORY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "JAEGER_AGENT_SERVICE_HOST",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.hostIP"
                    }
                  }
                }
              ],
              "image": "hkube/algorithm-example-python:v2.9.1",
              "imagePullPolicy": "IfNotPresent",
              "name": "algorunner",
              "resources": {
                "limits": {
                  "cpu": "500m",
                  "memory": "640Mi"
                },
                "requests": {
                  "cpu": "500m",
                  "memory": "640Mi"
                }
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File",
              "volumeMounts": [
                {
                  "mountPath": "/hkubedata",
                  "name": "storage-volume"
                },
                {
                  "mountPath": "/var/metrics",
                  "name": "algometrics"
                },
                {
                  "mountPath": "/hkube/datasources-storage",
                  "name": "datasources-storage"
                }
              ]
            }
          ],
          "dnsPolicy": "ClusterFirst",
          "restartPolicy": "Never",
          "schedulerName": "default-scheduler",
          "securityContext": {},
          "serviceAccount": "worker-serviceaccount",
          "serviceAccountName": "worker-serviceaccount",
          "terminationGracePeriodSeconds": 30,
          "volumes": [
            {
              "name": "storage-volume",
              "persistentVolumeClaim": {
                "claimName": "hkube-storage-pvc"
              }
            },
            {
              "emptyDir": {},
              "name": "algometrics"
            },
            {
              "hostPath": {
                "path": "/var/lib/docker/containers",
                "type": ""
              },
              "name": "varlibdockercontainers"
            },
            {
              "hostPath": {
                "path": "/var/log",
                "type": ""
              },
              "name": "varlog"
            },
            {
              "name": "datasources-storage",
              "persistentVolumeClaim": {
                "claimName": "hkube-datasources"
              }
            }
          ]
        }
      }
    },
    "status": {
      "active": 1,
      "startTime": "2025-08-13T11:12:09Z",
      "uncountedTerminatedPods": {}
    }
  },
  {
    "apiVersion": "batch/v1",
    "kind": "Job",
    "metadata": {
      "annotations": {
        "batch.kubernetes.io/job-tracking": ""
      },
      "creationTimestamp": "2025-08-13T11:11:15Z",
      "generation": 1,
      "labels": {
        "algorithm-name": "eval-alg",
        "core": "true",
        "group": "hkube",
        "metrics-group": "workers",
        "type": "worker"
      },
      "name": "eval-alg-idhi2",
      "namespace": "default",
      "resourceVersion": "208204202",
      "uid": "a645a4b2-6b99-4289-836f-bf697f202fa3"
    },
    "spec": {
      "backoffLimit": 0,
      "completionMode": "NonIndexed",
      "completions": 1,
      "parallelism": 1,
      "selector": {
        "matchLabels": {
          "controller-uid": "a645a4b2-6b99-4289-836f-bf697f202fa3"
        }
      },
      "suspend": false,
      "template": {
        "metadata": {
          "creationTimestamp": null,
          "labels": {
            "algorithm-name": "eval-alg",
            "controller-uid": "a645a4b2-6b99-4289-836f-bf697f202fa3",
            "group": "hkube",
            "job-name": "eval-alg-idhi2",
            "metrics-group": "workers",
            "type": "worker"
          }
        },
        "spec": {
          "containers": [
            {
              "env": [
                {
                  "name": "NODE_ENV",
                  "value": "production"
                },
                {
                  "name": "ALGORITHM_TYPE",
                  "value": "eval-alg"
                },
                {
                  "name": "METRICS_PORT",
                  "value": "3001"
                },
                {
                  "name": "INACTIVE_PAUSED_WORKER_TIMEOUT_MS",
                  "value": "10000"
                },
                {
                  "name": "ALGO_METRICS_DIR",
                  "value": "/var/metrics"
                },
                {
                  "name": "POD_ID",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.uid"
                    }
                  }
                },
                {
                  "name": "POD_IP",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.podIP"
                    }
                  }
                },
                {
                  "name": "POD_NAME",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.name"
                    }
                  }
                },
                {
                  "name": "NAMESPACE",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.namespace"
                    }
                  }
                },
                {
                  "name": "DEFAULT_STORAGE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DEFAULT_STORAGE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "ALGORITHM_DISCONNECTED_TIMEOUT_MS",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "ALGORITHM_DISCONNECTED_TIMEOUT_MS",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "STORAGE_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_PORT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_PORT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_TIMEOUT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_TIMEOUT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_MAX_CACHE_SIZE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_MAX_CACHE_SIZE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "STORAGE_MAX_CACHE_SIZE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_MAX_CACHE_SIZE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "WORKER_ALGORITHM_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "WORKER_ALGORITHM_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_SERVING_REPORT_INTERVAL",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_SERVING_REPORT_INTERVAL",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "CLUSTER_NAME",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "CLUSTER_NAME",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "WORKER_SOCKET_MAX_PAYLOAD_BYTES",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "WORKER_SOCKET_MAX_PAYLOAD_BYTES",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "MONGODB_SERVICE_USER_NAME",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "mongodb-username",
                      "name": "mongodb-secret"
                    }
                  }
                },
                {
                  "name": "MONGODB_SERVICE_PASSWORD",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "mongodb-password",
                      "name": "mongodb-secret"
                    }
                  }
                },
                {
                  "name": "MONGODB_DB_NAME",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "mongodb-database",
                      "name": "mongodb-secret"
                    }
                  }
                },
                {
                  "name": "BASE_DATASOURCES_DIRECTORY",
                  "value": "/hkube/datasources-storage"
                },
                {
                  "name": "a",
                  "value": "b"
                },
                {
                  "name": "ALGORITHM_IMAGE",
                  "value": "hkube/algorunner:v2.9.1"
                },
                {
                  "name": "ALGORITHM_VERSION",
                  "value": "3mte3mgvv5"
                },
                {
                  "name": "WORKER_IMAGE",
                  "value": "hkube/worker:v2.9.2-stopProcessing-changes-16903637601"
                },
                {
                  "name": "HOT_WORKER",
                  "value": "true"
                },
                {
                  "name": "STORAGE_BINARY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_BINARY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "BASE_FS_ADAPTER_DIRECTORY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "BASE_FS_ADAPTER_DIRECTORY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "JAEGER_AGENT_SERVICE_HOST",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.hostIP"
                    }
                  }
                }
              ],
              "image": "hkube/worker:v2.9.2-stopProcessing-changes-16903637601",
              "imagePullPolicy": "IfNotPresent",
              "name": "worker",
              "resources": {},
              "securityContext": {
                "privileged": true
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File",
              "volumeMounts": [
                {
                  "mountPath": "/hkubedata",
                  "name": "storage-volume"
                },
                {
                  "mountPath": "/var/metrics",
                  "name": "algometrics"
                },
                {
                  "mountPath": "/var/lib/docker/containers",
                  "name": "varlibdockercontainers",
                  "readOnly": true
                },
                {
                  "mountPath": "/var/log",
                  "name": "varlog"
                }
              ]
            },
            {
              "env": [
                {
                  "name": "ALGO_METRICS_DIR",
                  "value": "/var/metrics"
                },
                {
                  "name": "POD_IP",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.podIP"
                    }
                  }
                },
                {
                  "name": "DEFAULT_STORAGE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DEFAULT_STORAGE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "STORAGE_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_PORT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_PORT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_TIMEOUT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_TIMEOUT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_MAX_CACHE_SIZE",
                  "value": "103"
                },
                {
                  "name": "STORAGE_MAX_CACHE_SIZE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_MAX_CACHE_SIZE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "WORKER_ALGORITHM_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "WORKER_ALGORITHM_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_SERVING_REPORT_INTERVAL",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_SERVING_REPORT_INTERVAL",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "CLUSTER_NAME",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "CLUSTER_NAME",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "ALGORITHM_TYPE",
                  "value": "eval-alg"
                },
                {
                  "name": "STORAGE_BINARY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_BINARY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "BASE_FS_ADAPTER_DIRECTORY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "BASE_FS_ADAPTER_DIRECTORY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "JAEGER_AGENT_SERVICE_HOST",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.hostIP"
                    }
                  }
                }
              ],
              "image": "hkube/algorunner:v2.9.1",
              "imagePullPolicy": "IfNotPresent",
              "name": "algorunner",
              "resources": {
                "limits": {
                  "cpu": "500m",
                  "memory": "614Mi"
                },
                "requests": {
                  "cpu": "500m",
                  "memory": "614Mi"
                }
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File",
              "volumeMounts": [
                {
                  "mountPath": "/hkubedata",
                  "name": "storage-volume"
                },
                {
                  "mountPath": "/var/metrics",
                  "name": "algometrics"
                },
                {
                  "mountPath": "/hkube/datasources-storage",
                  "name": "datasources-storage"
                }
              ]
            }
          ],
          "dnsPolicy": "ClusterFirst",
          "restartPolicy": "Never",
          "schedulerName": "default-scheduler",
          "securityContext": {},
          "serviceAccount": "worker-serviceaccount",
          "serviceAccountName": "worker-serviceaccount",
          "terminationGracePeriodSeconds": 30,
          "volumes": [
            {
              "name": "storage-volume",
              "persistentVolumeClaim": {
                "claimName": "hkube-storage-pvc"
              }
            },
            {
              "emptyDir": {},
              "name": "algometrics"
            },
            {
              "hostPath": {
                "path": "/var/lib/docker/containers",
                "type": ""
              },
              "name": "varlibdockercontainers"
            },
            {
              "hostPath": {
                "path": "/var/log",
                "type": ""
              },
              "name": "varlog"
            },
            {
              "name": "datasources-storage",
              "persistentVolumeClaim": {
                "claimName": "hkube-datasources"
              }
            }
          ]
        }
      }
    },
    "status": {
      "active": 1,
      "startTime": "2025-08-13T11:11:15Z",
      "uncountedTerminatedPods": {}
    }
  },
  {
    "apiVersion": "batch/v1",
    "kind": "Job",
    "metadata": {
      "annotations": {
        "batch.kubernetes.io/job-tracking": ""
      },
      "creationTimestamp": "2025-08-13T11:12:24Z",
      "generation": 1,
      "labels": {
        "algorithm-name": "black-alg",
        "core": "true",
        "group": "hkube",
        "metrics-group": "workers",
        "type": "worker"
      },
      "name": "black-alg-ielrj",
      "namespace": "default",
      "resourceVersion": "208204566",
      "uid": "868b71c1-1c8a-40c1-ae33-8de4fb4597b0"
    },
    "spec": {
      "backoffLimit": 0,
      "completionMode": "NonIndexed",
      "completions": 1,
      "parallelism": 1,
      "selector": {
        "matchLabels": {
          "controller-uid": "868b71c1-1c8a-40c1-ae33-8de4fb4597b0"
        }
      },
      "suspend": false,
      "template": {
        "metadata": {
          "creationTimestamp": null,
          "labels": {
            "algorithm-name": "black-alg",
            "controller-uid": "868b71c1-1c8a-40c1-ae33-8de4fb4597b0",
            "group": "hkube",
            "job-name": "black-alg-ielrj",
            "metrics-group": "workers",
            "type": "worker"
          }
        },
        "spec": {
          "containers": [
            {
              "env": [
                {
                  "name": "NODE_ENV",
                  "value": "production"
                },
                {
                  "name": "ALGORITHM_TYPE",
                  "value": "black-alg"
                },
                {
                  "name": "METRICS_PORT",
                  "value": "3001"
                },
                {
                  "name": "INACTIVE_PAUSED_WORKER_TIMEOUT_MS",
                  "value": "10000"
                },
                {
                  "name": "ALGO_METRICS_DIR",
                  "value": "/var/metrics"
                },
                {
                  "name": "POD_ID",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.uid"
                    }
                  }
                },
                {
                  "name": "POD_IP",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.podIP"
                    }
                  }
                },
                {
                  "name": "POD_NAME",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.name"
                    }
                  }
                },
                {
                  "name": "NAMESPACE",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.namespace"
                    }
                  }
                },
                {
                  "name": "DEFAULT_STORAGE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DEFAULT_STORAGE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "ALGORITHM_DISCONNECTED_TIMEOUT_MS",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "ALGORITHM_DISCONNECTED_TIMEOUT_MS",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "STORAGE_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_PORT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_PORT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_TIMEOUT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_TIMEOUT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_MAX_CACHE_SIZE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_MAX_CACHE_SIZE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "STORAGE_MAX_CACHE_SIZE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_MAX_CACHE_SIZE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "WORKER_ALGORITHM_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "WORKER_ALGORITHM_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_SERVING_REPORT_INTERVAL",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_SERVING_REPORT_INTERVAL",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "CLUSTER_NAME",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "CLUSTER_NAME",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "WORKER_SOCKET_MAX_PAYLOAD_BYTES",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "WORKER_SOCKET_MAX_PAYLOAD_BYTES",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "MONGODB_SERVICE_USER_NAME",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "mongodb-username",
                      "name": "mongodb-secret"
                    }
                  }
                },
                {
                  "name": "MONGODB_SERVICE_PASSWORD",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "mongodb-password",
                      "name": "mongodb-secret"
                    }
                  }
                },
                {
                  "name": "MONGODB_DB_NAME",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "mongodb-database",
                      "name": "mongodb-secret"
                    }
                  }
                },
                {
                  "name": "BASE_DATASOURCES_DIRECTORY",
                  "value": "/hkube/datasources-storage"
                },
                {
                  "name": "ALGORITHM_IMAGE",
                  "value": "hkube/algorithm-example-python:v2.9.1"
                },
                {
                  "name": "ALGORITHM_VERSION",
                  "value": "leezz7mg0c"
                },
                {
                  "name": "WORKER_IMAGE",
                  "value": "hkube/worker:v2.9.2-stopProcessing-changes-16903637601"
                },
                {
                  "name": "HOT_WORKER",
                  "value": "true"
                },
                {
                  "name": "STORAGE_BINARY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_BINARY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "BASE_FS_ADAPTER_DIRECTORY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "BASE_FS_ADAPTER_DIRECTORY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "JAEGER_AGENT_SERVICE_HOST",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.hostIP"
                    }
                  }
                }
              ],
              "image": "hkube/worker:v2.9.2-stopProcessing-changes-16903637601",
              "imagePullPolicy": "IfNotPresent",
              "name": "worker",
              "resources": {},
              "securityContext": {
                "privileged": true
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File",
              "volumeMounts": [
                {
                  "mountPath": "/hkubedata",
                  "name": "storage-volume"
                },
                {
                  "mountPath": "/var/metrics",
                  "name": "algometrics"
                },
                {
                  "mountPath": "/var/lib/docker/containers",
                  "name": "varlibdockercontainers",
                  "readOnly": true
                },
                {
                  "mountPath": "/var/log",
                  "name": "varlog"
                }
              ]
            },
            {
              "env": [
                {
                  "name": "ALGO_METRICS_DIR",
                  "value": "/var/metrics"
                },
                {
                  "name": "POD_IP",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.podIP"
                    }
                  }
                },
                {
                  "name": "DEFAULT_STORAGE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DEFAULT_STORAGE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "STORAGE_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_PORT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_PORT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_TIMEOUT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_TIMEOUT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_MAX_CACHE_SIZE",
                  "value": "52"
                },
                {
                  "name": "STORAGE_MAX_CACHE_SIZE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_MAX_CACHE_SIZE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "WORKER_ALGORITHM_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "WORKER_ALGORITHM_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_SERVING_REPORT_INTERVAL",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_SERVING_REPORT_INTERVAL",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "CLUSTER_NAME",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "CLUSTER_NAME",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "ALGORITHM_TYPE",
                  "value": "black-alg"
                },
                {
                  "name": "STORAGE_BINARY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_BINARY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "BASE_FS_ADAPTER_DIRECTORY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "BASE_FS_ADAPTER_DIRECTORY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "JAEGER_AGENT_SERVICE_HOST",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.hostIP"
                    }
                  }
                }
              ],
              "image": "hkube/algorithm-example-python:v2.9.1",
              "imagePullPolicy": "IfNotPresent",
              "name": "algorunner",
              "resources": {
                "limits": {
                  "cpu": "100m",
                  "memory": "308Mi"
                },
                "requests": {
                  "cpu": "100m",
                  "memory": "308Mi"
                }
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File",
              "volumeMounts": [
                {
                  "mountPath": "/hkubedata",
                  "name": "storage-volume"
                },
                {
                  "mountPath": "/var/metrics",
                  "name": "algometrics"
                },
                {
                  "mountPath": "/hkube/datasources-storage",
                  "name": "datasources-storage"
                }
              ]
            }
          ],
          "dnsPolicy": "ClusterFirst",
          "restartPolicy": "Never",
          "schedulerName": "default-scheduler",
          "securityContext": {},
          "serviceAccount": "worker-serviceaccount",
          "serviceAccountName": "worker-serviceaccount",
          "terminationGracePeriodSeconds": 30,
          "volumes": [
            {
              "name": "storage-volume",
              "persistentVolumeClaim": {
                "claimName": "hkube-storage-pvc"
              }
            },
            {
              "emptyDir": {},
              "name": "algometrics"
            },
            {
              "hostPath": {
                "path": "/var/lib/docker/containers",
                "type": ""
              },
              "name": "varlibdockercontainers"
            },
            {
              "hostPath": {
                "path": "/var/log",
                "type": ""
              },
              "name": "varlog"
            },
            {
              "name": "datasources-storage",
              "persistentVolumeClaim": {
                "claimName": "hkube-datasources"
              }
            }
          ]
        }
      }
    },
    "status": {
      "active": 1,
      "startTime": "2025-08-13T11:12:24Z",
      "uncountedTerminatedPods": {}
    }
  },
  {
    "apiVersion": "batch/v1",
    "kind": "Job",
    "metadata": {
      "annotations": {
        "batch.kubernetes.io/job-tracking": ""
      },
      "creationTimestamp": "2025-08-13T11:10:49Z",
      "generation": 1,
      "labels": {
        "algorithm-name": "green-alg",
        "core": "true",
        "group": "hkube",
        "metrics-group": "workers",
        "type": "worker"
      },
      "name": "green-alg-5cno8",
      "namespace": "default",
      "resourceVersion": "208204057",
      "uid": "546df3c0-ad2a-49e2-8111-f0453752a884"
    },
    "spec": {
      "backoffLimit": 0,
      "completionMode": "NonIndexed",
      "completions": 1,
      "parallelism": 1,
      "selector": {
        "matchLabels": {
          "controller-uid": "546df3c0-ad2a-49e2-8111-f0453752a884"
        }
      },
      "suspend": false,
      "template": {
        "metadata": {
          "creationTimestamp": null,
          "labels": {
            "algorithm-name": "green-alg",
            "controller-uid": "546df3c0-ad2a-49e2-8111-f0453752a884",
            "group": "hkube",
            "job-name": "green-alg-5cno8",
            "metrics-group": "workers",
            "type": "worker"
          }
        },
        "spec": {
          "containers": [
            {
              "env": [
                {
                  "name": "NODE_ENV",
                  "value": "production"
                },
                {
                  "name": "ALGORITHM_TYPE",
                  "value": "green-alg"
                },
                {
                  "name": "METRICS_PORT",
                  "value": "3001"
                },
                {
                  "name": "INACTIVE_PAUSED_WORKER_TIMEOUT_MS",
                  "value": "10000"
                },
                {
                  "name": "ALGO_METRICS_DIR",
                  "value": "/var/metrics"
                },
                {
                  "name": "POD_ID",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.uid"
                    }
                  }
                },
                {
                  "name": "POD_IP",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.podIP"
                    }
                  }
                },
                {
                  "name": "POD_NAME",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.name"
                    }
                  }
                },
                {
                  "name": "NAMESPACE",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.namespace"
                    }
                  }
                },
                {
                  "name": "DEFAULT_STORAGE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DEFAULT_STORAGE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "ALGORITHM_DISCONNECTED_TIMEOUT_MS",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "ALGORITHM_DISCONNECTED_TIMEOUT_MS",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "STORAGE_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_PORT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_PORT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_TIMEOUT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_TIMEOUT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_MAX_CACHE_SIZE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_MAX_CACHE_SIZE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "STORAGE_MAX_CACHE_SIZE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_MAX_CACHE_SIZE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "WORKER_ALGORITHM_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "WORKER_ALGORITHM_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_SERVING_REPORT_INTERVAL",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_SERVING_REPORT_INTERVAL",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "CLUSTER_NAME",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "CLUSTER_NAME",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "WORKER_SOCKET_MAX_PAYLOAD_BYTES",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "WORKER_SOCKET_MAX_PAYLOAD_BYTES",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "MONGODB_SERVICE_USER_NAME",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "mongodb-username",
                      "name": "mongodb-secret"
                    }
                  }
                },
                {
                  "name": "MONGODB_SERVICE_PASSWORD",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "mongodb-password",
                      "name": "mongodb-secret"
                    }
                  }
                },
                {
                  "name": "MONGODB_DB_NAME",
                  "valueFrom": {
                    "secretKeyRef": {
                      "key": "mongodb-database",
                      "name": "mongodb-secret"
                    }
                  }
                },
                {
                  "name": "BASE_DATASOURCES_DIRECTORY",
                  "value": "/hkube/datasources-storage"
                },
                {
                  "name": "INACTIVE_WORKER_TIMEOUT_MS",
                  "value": "6000"
                },
                {
                  "name": "ALGORITHM_IMAGE",
                  "value": "hkube/algorithm-example-python:v2.9.1"
                },
                {
                  "name": "ALGORITHM_VERSION",
                  "value": "lm5mznqqq4"
                },
                {
                  "name": "WORKER_IMAGE",
                  "value": "hkube/worker:v2.9.2-stopProcessing-changes-16903637601"
                },
                {
                  "name": "HOT_WORKER",
                  "value": "true"
                },
                {
                  "name": "STORAGE_BINARY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_BINARY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "BASE_FS_ADAPTER_DIRECTORY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "BASE_FS_ADAPTER_DIRECTORY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "JAEGER_AGENT_SERVICE_HOST",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.hostIP"
                    }
                  }
                }
              ],
              "image": "hkube/worker:v2.9.2-stopProcessing-changes-16903637601",
              "imagePullPolicy": "IfNotPresent",
              "name": "worker",
              "resources": {},
              "securityContext": {
                "privileged": true
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File",
              "volumeMounts": [
                {
                  "mountPath": "/hkubedata",
                  "name": "storage-volume"
                },
                {
                  "mountPath": "/var/metrics",
                  "name": "algometrics"
                },
                {
                  "mountPath": "/var/lib/docker/containers",
                  "name": "varlibdockercontainers",
                  "readOnly": true
                },
                {
                  "mountPath": "/var/log",
                  "name": "varlog"
                }
              ]
            },
            {
              "env": [
                {
                  "name": "ALGO_METRICS_DIR",
                  "value": "/var/metrics"
                },
                {
                  "name": "POD_IP",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.podIP"
                    }
                  }
                },
                {
                  "name": "DEFAULT_STORAGE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DEFAULT_STORAGE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "STORAGE_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_PORT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_PORT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_TIMEOUT",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_TIMEOUT",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_MAX_CACHE_SIZE",
                  "value": "512"
                },
                {
                  "name": "STORAGE_MAX_CACHE_SIZE",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_MAX_CACHE_SIZE",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "WORKER_ALGORITHM_ENCODING",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "WORKER_ALGORITHM_ENCODING",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "DISCOVERY_SERVING_REPORT_INTERVAL",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "DISCOVERY_SERVING_REPORT_INTERVAL",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "CLUSTER_NAME",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "CLUSTER_NAME",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "ALGORITHM_TYPE",
                  "value": "green-alg"
                },
                {
                  "name": "STORAGE_BINARY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "STORAGE_BINARY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "BASE_FS_ADAPTER_DIRECTORY",
                  "valueFrom": {
                    "configMapKeyRef": {
                      "key": "BASE_FS_ADAPTER_DIRECTORY",
                      "name": "task-executor-configmap"
                    }
                  }
                },
                {
                  "name": "JAEGER_AGENT_SERVICE_HOST",
                  "valueFrom": {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "status.hostIP"
                    }
                  }
                }
              ],
              "image": "hkube/algorithm-example-python:v2.9.1",
              "imagePullPolicy": "IfNotPresent",
              "name": "algorunner",
              "resources": {
                "limits": {
                  "cpu": "200m",
                  "memory": "768Mi"
                },
                "requests": {
                  "cpu": "200m",
                  "memory": "768Mi"
                }
              },
              "terminationMessagePath": "/dev/termination-log",
              "terminationMessagePolicy": "File",
              "volumeMounts": [
                {
                  "mountPath": "/hkubedata",
                  "name": "storage-volume"
                },
                {
                  "mountPath": "/var/metrics",
                  "name": "algometrics"
                },
                {
                  "mountPath": "/hkube/datasources-storage",
                  "name": "datasources-storage"
                }
              ]
            }
          ],
          "dnsPolicy": "ClusterFirst",
          "restartPolicy": "Never",
          "schedulerName": "default-scheduler",
          "securityContext": {},
          "serviceAccount": "worker-serviceaccount",
          "serviceAccountName": "worker-serviceaccount",
          "terminationGracePeriodSeconds": 30,
          "volumes": [
            {
              "name": "storage-volume",
              "persistentVolumeClaim": {
                "claimName": "hkube-storage-pvc"
              }
            },
            {
              "emptyDir": {},
              "name": "algometrics"
            },
            {
              "hostPath": {
                "path": "/var/lib/docker/containers",
                "type": ""
              },
              "name": "varlibdockercontainers"
            },
            {
              "hostPath": {
                "path": "/var/log",
                "type": ""
              },
              "name": "varlog"
            },
            {
              "name": "datasources-storage",
              "persistentVolumeClaim": {
                "claimName": "hkube-datasources"
              }
            }
          ]
        }
      }
    },
    "status": {
      "active": 1,
      "startTime": "2025-08-13T11:10:49Z",
      "uncountedTerminatedPods": {}
    }
  }
]

module.exports = jobs;
