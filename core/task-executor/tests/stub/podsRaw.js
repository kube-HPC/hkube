// INFO: 6 Worker pods raw from K8S, algorithms: print-every-10-sec (twice), green-alg, yellow-alg, eval-alg, black-alg)
// Also, green-alg, yellow-alg, eval-alg, black-alg are hot workers, and print-every-10-sec one of them active and other ready/idle.
// This file is in sync with workersRaw and jobsRaw.
const pods = [
  {
    "apiVersion": "v1",
    "kind": "Pod",
    "metadata": {
      "annotations": {
        "kubernetes.io/limit-ranger": "LimitRanger plugin set: cpu request for container worker"
      },
      "creationTimestamp": "2025-08-13T11:39:45Z",
      "finalizers": [
        "batch.kubernetes.io/job-tracking"
      ],
      "generateName": "print-every-10-sec-shi9j-",
      "labels": {
        "algorithm-name": "print-every-10-sec",
        "controller-uid": "2ff8c344-a3f8-45d5-9255-458fcbf47178",
        "group": "hkube",
        "job-name": "print-every-10-sec-shi9j",
        "metrics-group": "workers",
        "type": "worker"
      },
      "name": "print-every-10-sec-shi9j-2grfl",
      "namespace": "default",
      "ownerReferences": [
        {
          "apiVersion": "batch/v1",
          "blockOwnerDeletion": true,
          "controller": true,
          "kind": "Job",
          "name": "print-every-10-sec-shi9j",
          "uid": "2ff8c344-a3f8-45d5-9255-458fcbf47178"
        }
      ],
      "resourceVersion": "208212855",
      "uid": "0d8f3fea-4fbf-4f38-ae96-cd4facc9e47e"
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
          "resources": {
            "requests": {
              "cpu": "100m"
            }
          },
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
            },
            {
              "mountPath": "/var/run/secrets/kubernetes.io/serviceaccount",
              "name": "kube-api-access-l6swp",
              "readOnly": true
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
            },
            {
              "mountPath": "/var/run/secrets/kubernetes.io/serviceaccount",
              "name": "kube-api-access-l6swp",
              "readOnly": true
            }
          ]
        }
      ],
      "dnsPolicy": "ClusterFirst",
      "enableServiceLinks": true,
      "nodeName": "ip-172-20-17-40.eu-west-1.compute.internal",
      "preemptionPolicy": "PreemptLowerPriority",
      "priority": 0,
      "restartPolicy": "Never",
      "schedulerName": "default-scheduler",
      "securityContext": {},
      "serviceAccount": "worker-serviceaccount",
      "serviceAccountName": "worker-serviceaccount",
      "terminationGracePeriodSeconds": 30,
      "tolerations": [
        {
          "effect": "NoExecute",
          "key": "node.kubernetes.io/not-ready",
          "operator": "Exists",
          "tolerationSeconds": 300
        },
        {
          "effect": "NoExecute",
          "key": "node.kubernetes.io/unreachable",
          "operator": "Exists",
          "tolerationSeconds": 300
        }
      ],
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
        },
        {
          "name": "kube-api-access-l6swp",
          "projected": {
            "defaultMode": 420,
            "sources": [
              {
                "serviceAccountToken": {
                  "expirationSeconds": 3607,
                  "path": "token"
                }
              },
              {
                "configMap": {
                  "items": [
                    {
                      "key": "ca.crt",
                      "path": "ca.crt"
                    }
                  ],
                  "name": "kube-root-ca.crt"
                }
              },
              {
                "downwardAPI": {
                  "items": [
                    {
                      "fieldRef": {
                        "apiVersion": "v1",
                        "fieldPath": "metadata.namespace"
                      },
                      "path": "namespace"
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    },
    "status": {
      "conditions": [
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:39:45Z",
          "status": "True",
          "type": "Initialized"
        },
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:39:46Z",
          "status": "True",
          "type": "Ready"
        },
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:39:46Z",
          "status": "True",
          "type": "ContainersReady"
        },
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:39:45Z",
          "status": "True",
          "type": "PodScheduled"
        }
      ],
      "containerStatuses": [
        {
          "containerID": "containerd://6dbcef0858b326eef2c822ff3706a05a8d67e8d430a82a1884bd35cbb5aa4cda",
          "image": "docker.io/hkubedevtest/print-every-10-sec:vokska3od",
          "imageID": "docker.io/hkubedevtest/print-every-10-sec@sha256:335b17e435f6a1fe417a901d6304c8fbeaf24f3d9024c15a84be3e2d7a585262",
          "lastState": {},
          "name": "algorunner",
          "ready": true,
          "restartCount": 0,
          "started": true,
          "state": {
            "running": {
              "startedAt": "2025-08-13T11:39:46Z"
            }
          }
        },
        {
          "containerID": "containerd://3f46849604055272b8d984098d6f3b879f1ccafe3cbe9ad4a2a016fd3ac710cf",
          "image": "docker.io/hkube/worker:v2.9.2-stopProcessing-changes-16903637601",
          "imageID": "docker.io/hkube/worker@sha256:e8a0c0b474d16e39b29c3da1b52cda89aafce4b4792a5a3e0b121c3daf14fd45",
          "lastState": {},
          "name": "worker",
          "ready": true,
          "restartCount": 0,
          "started": true,
          "state": {
            "running": {
              "startedAt": "2025-08-13T11:39:46Z"
            }
          }
        }
      ],
      "hostIP": "172.20.17.40",
      "phase": "Running",
      "podIP": "100.96.3.189",
      "podIPs": [
        {
          "ip": "100.96.3.189"
        }
      ],
      "qosClass": "Burstable",
      "startTime": "2025-08-13T11:39:45Z"
    }
  },
  {
    "apiVersion": "v1",
    "kind": "Pod",
    "metadata": {
      "annotations": {
        "kubernetes.io/limit-ranger": "LimitRanger plugin set: cpu request for container worker"
      },
      "creationTimestamp": "2025-08-13T11:38:11Z",
      "finalizers": [
        "batch.kubernetes.io/job-tracking"
      ],
      "generateName": "print-every-10-sec-7gn0f-",
      "labels": {
        "algorithm-name": "print-every-10-sec",
        "controller-uid": "601f38cf-079c-450c-9ee5-1a1f8bbd70a7",
        "group": "hkube",
        "job-name": "print-every-10-sec-7gn0f",
        "metrics-group": "workers",
        "type": "worker"
      },
      "name": "print-every-10-sec-7gn0f-j76qh",
      "namespace": "default",
      "ownerReferences": [
        {
          "apiVersion": "batch/v1",
          "blockOwnerDeletion": true,
          "controller": true,
          "kind": "Job",
          "name": "print-every-10-sec-7gn0f",
          "uid": "601f38cf-079c-450c-9ee5-1a1f8bbd70a7"
        }
      ],
      "resourceVersion": "208212379",
      "uid": "798a05f6-a804-4b00-af11-c8de11f03468"
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
          "resources": {
            "requests": {
              "cpu": "100m"
            }
          },
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
            },
            {
              "mountPath": "/var/run/secrets/kubernetes.io/serviceaccount",
              "name": "kube-api-access-zm8lr",
              "readOnly": true
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
            },
            {
              "mountPath": "/var/run/secrets/kubernetes.io/serviceaccount",
              "name": "kube-api-access-zm8lr",
              "readOnly": true
            }
          ]
        }
      ],
      "dnsPolicy": "ClusterFirst",
      "enableServiceLinks": true,
      "nodeName": "ip-172-20-16-215.eu-west-1.compute.internal",
      "preemptionPolicy": "PreemptLowerPriority",
      "priority": 0,
      "restartPolicy": "Never",
      "schedulerName": "default-scheduler",
      "securityContext": {},
      "serviceAccount": "worker-serviceaccount",
      "serviceAccountName": "worker-serviceaccount",
      "terminationGracePeriodSeconds": 30,
      "tolerations": [
        {
          "effect": "NoExecute",
          "key": "node.kubernetes.io/not-ready",
          "operator": "Exists",
          "tolerationSeconds": 300
        },
        {
          "effect": "NoExecute",
          "key": "node.kubernetes.io/unreachable",
          "operator": "Exists",
          "tolerationSeconds": 300
        }
      ],
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
        },
        {
          "name": "kube-api-access-zm8lr",
          "projected": {
            "defaultMode": 420,
            "sources": [
              {
                "serviceAccountToken": {
                  "expirationSeconds": 3607,
                  "path": "token"
                }
              },
              {
                "configMap": {
                  "items": [
                    {
                      "key": "ca.crt",
                      "path": "ca.crt"
                    }
                  ],
                  "name": "kube-root-ca.crt"
                }
              },
              {
                "downwardAPI": {
                  "items": [
                    {
                      "fieldRef": {
                        "apiVersion": "v1",
                        "fieldPath": "metadata.namespace"
                      },
                      "path": "namespace"
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    },
    "status": {
      "conditions": [
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:38:11Z",
          "status": "True",
          "type": "Initialized"
        },
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:38:12Z",
          "status": "True",
          "type": "Ready"
        },
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:38:12Z",
          "status": "True",
          "type": "ContainersReady"
        },
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:38:11Z",
          "status": "True",
          "type": "PodScheduled"
        }
      ],
      "containerStatuses": [
        {
          "containerID": "containerd://e23d99a583b7c4af7c83abcd7a8b44e6fe1abd5d3b9abf3beb1a579861448c19",
          "image": "docker.io/hkubedevtest/print-every-10-sec:vokska3od",
          "imageID": "docker.io/hkubedevtest/print-every-10-sec@sha256:335b17e435f6a1fe417a901d6304c8fbeaf24f3d9024c15a84be3e2d7a585262",
          "lastState": {},
          "name": "algorunner",
          "ready": true,
          "restartCount": 0,
          "started": true,
          "state": {
            "running": {
              "startedAt": "2025-08-13T11:38:11Z"
            }
          }
        },
        {
          "containerID": "containerd://254137cb9b45887153fdee83776ec28a851ddb75918483db193297a412ef569f",
          "image": "docker.io/hkube/worker:v2.9.2-stopProcessing-changes-16903637601",
          "imageID": "docker.io/hkube/worker@sha256:e8a0c0b474d16e39b29c3da1b52cda89aafce4b4792a5a3e0b121c3daf14fd45",
          "lastState": {},
          "name": "worker",
          "ready": true,
          "restartCount": 0,
          "started": true,
          "state": {
            "running": {
              "startedAt": "2025-08-13T11:38:11Z"
            }
          }
        }
      ],
      "hostIP": "172.20.16.215",
      "phase": "Running",
      "podIP": "100.96.2.19",
      "podIPs": [
        {
          "ip": "100.96.2.19"
        }
      ],
      "qosClass": "Burstable",
      "startTime": "2025-08-13T11:38:11Z"
    }
  },
  {
    "apiVersion": "v1",
    "kind": "Pod",
    "metadata": {
      "annotations": {
        "kubernetes.io/limit-ranger": "LimitRanger plugin set: cpu request for container worker"
      },
      "creationTimestamp": "2025-08-13T11:12:09Z",
      "finalizers": [
        "batch.kubernetes.io/job-tracking"
      ],
      "generateName": "yellow-alg-hd3u5-",
      "labels": {
        "algorithm-name": "yellow-alg",
        "controller-uid": "5e83fb59-6c8d-4b5a-8798-1fa32fb412e1",
        "group": "hkube",
        "job-name": "yellow-alg-hd3u5",
        "metrics-group": "workers",
        "type": "worker"
      },
      "name": "yellow-alg-hd3u5-bwvvs",
      "namespace": "default",
      "ownerReferences": [
        {
          "apiVersion": "batch/v1",
          "blockOwnerDeletion": true,
          "controller": true,
          "kind": "Job",
          "name": "yellow-alg-hd3u5",
          "uid": "5e83fb59-6c8d-4b5a-8798-1fa32fb412e1"
        }
      ],
      "resourceVersion": "208204499",
      "uid": "5b6282a1-f15b-4da3-a582-a724eb104e06"
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
          "resources": {
            "requests": {
              "cpu": "100m"
            }
          },
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
            },
            {
              "mountPath": "/var/run/secrets/kubernetes.io/serviceaccount",
              "name": "kube-api-access-hc86w",
              "readOnly": true
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
            },
            {
              "mountPath": "/var/run/secrets/kubernetes.io/serviceaccount",
              "name": "kube-api-access-hc86w",
              "readOnly": true
            }
          ]
        }
      ],
      "dnsPolicy": "ClusterFirst",
      "enableServiceLinks": true,
      "nodeName": "ip-172-20-17-40.eu-west-1.compute.internal",
      "preemptionPolicy": "PreemptLowerPriority",
      "priority": 0,
      "restartPolicy": "Never",
      "schedulerName": "default-scheduler",
      "securityContext": {},
      "serviceAccount": "worker-serviceaccount",
      "serviceAccountName": "worker-serviceaccount",
      "terminationGracePeriodSeconds": 30,
      "tolerations": [
        {
          "effect": "NoExecute",
          "key": "node.kubernetes.io/not-ready",
          "operator": "Exists",
          "tolerationSeconds": 300
        },
        {
          "effect": "NoExecute",
          "key": "node.kubernetes.io/unreachable",
          "operator": "Exists",
          "tolerationSeconds": 300
        }
      ],
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
        },
        {
          "name": "kube-api-access-hc86w",
          "projected": {
            "defaultMode": 420,
            "sources": [
              {
                "serviceAccountToken": {
                  "expirationSeconds": 3607,
                  "path": "token"
                }
              },
              {
                "configMap": {
                  "items": [
                    {
                      "key": "ca.crt",
                      "path": "ca.crt"
                    }
                  ],
                  "name": "kube-root-ca.crt"
                }
              },
              {
                "downwardAPI": {
                  "items": [
                    {
                      "fieldRef": {
                        "apiVersion": "v1",
                        "fieldPath": "metadata.namespace"
                      },
                      "path": "namespace"
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    },
    "status": {
      "conditions": [
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:12:09Z",
          "status": "True",
          "type": "Initialized"
        },
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:12:11Z",
          "status": "True",
          "type": "Ready"
        },
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:12:11Z",
          "status": "True",
          "type": "ContainersReady"
        },
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:12:09Z",
          "status": "True",
          "type": "PodScheduled"
        }
      ],
      "containerStatuses": [
        {
          "containerID": "containerd://b78b626d85a32fa84cbf0cdf8f57839abdd6fc0609211de0fb99938ca38d5ec9",
          "image": "docker.io/hkube/algorithm-example-python:v2.9.1",
          "imageID": "docker.io/hkube/algorithm-example-python@sha256:eb4bc1b0d3918935c29a31744d3adbb14fa6c085b1a81a11e30941970baa22ea",
          "lastState": {},
          "name": "algorunner",
          "ready": true,
          "restartCount": 0,
          "started": true,
          "state": {
            "running": {
              "startedAt": "2025-08-13T11:12:10Z"
            }
          }
        },
        {
          "containerID": "containerd://909cf72705d515e2c823fb0d5f603c546650a3f44fa6f7b996480808688c5719",
          "image": "docker.io/hkube/worker:v2.9.2-stopProcessing-changes-16903637601",
          "imageID": "docker.io/hkube/worker@sha256:e8a0c0b474d16e39b29c3da1b52cda89aafce4b4792a5a3e0b121c3daf14fd45",
          "lastState": {},
          "name": "worker",
          "ready": true,
          "restartCount": 0,
          "started": true,
          "state": {
            "running": {
              "startedAt": "2025-08-13T11:12:10Z"
            }
          }
        }
      ],
      "hostIP": "172.20.17.40",
      "phase": "Running",
      "podIP": "100.96.3.185",
      "podIPs": [
        {
          "ip": "100.96.3.185"
        }
      ],
      "qosClass": "Burstable",
      "startTime": "2025-08-13T11:12:09Z"
    }
  },
  {
    "apiVersion": "v1",
    "kind": "Pod",
    "metadata": {
      "annotations": {
        "kubernetes.io/limit-ranger": "LimitRanger plugin set: cpu request for container worker"
      },
      "creationTimestamp": "2025-08-13T11:11:15Z",
      "finalizers": [
        "batch.kubernetes.io/job-tracking"
      ],
      "generateName": "eval-alg-idhi2-",
      "labels": {
        "algorithm-name": "eval-alg",
        "controller-uid": "a645a4b2-6b99-4289-836f-bf697f202fa3",
        "group": "hkube",
        "job-name": "eval-alg-idhi2",
        "metrics-group": "workers",
        "type": "worker"
      },
      "name": "eval-alg-idhi2-5dw7l",
      "namespace": "default",
      "ownerReferences": [
        {
          "apiVersion": "batch/v1",
          "blockOwnerDeletion": true,
          "controller": true,
          "kind": "Job",
          "name": "eval-alg-idhi2",
          "uid": "a645a4b2-6b99-4289-836f-bf697f202fa3"
        }
      ],
      "resourceVersion": "208204240",
      "uid": "f9a160ea-ad9c-422b-a49f-768622bdff07"
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
          "resources": {
            "requests": {
              "cpu": "100m"
            }
          },
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
            },
            {
              "mountPath": "/var/run/secrets/kubernetes.io/serviceaccount",
              "name": "kube-api-access-txxrz",
              "readOnly": true
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
            },
            {
              "mountPath": "/var/run/secrets/kubernetes.io/serviceaccount",
              "name": "kube-api-access-txxrz",
              "readOnly": true
            }
          ]
        }
      ],
      "dnsPolicy": "ClusterFirst",
      "enableServiceLinks": true,
      "nodeName": "ip-172-20-16-215.eu-west-1.compute.internal",
      "preemptionPolicy": "PreemptLowerPriority",
      "priority": 0,
      "restartPolicy": "Never",
      "schedulerName": "default-scheduler",
      "securityContext": {},
      "serviceAccount": "worker-serviceaccount",
      "serviceAccountName": "worker-serviceaccount",
      "terminationGracePeriodSeconds": 30,
      "tolerations": [
        {
          "effect": "NoExecute",
          "key": "node.kubernetes.io/not-ready",
          "operator": "Exists",
          "tolerationSeconds": 300
        },
        {
          "effect": "NoExecute",
          "key": "node.kubernetes.io/unreachable",
          "operator": "Exists",
          "tolerationSeconds": 300
        }
      ],
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
        },
        {
          "name": "kube-api-access-txxrz",
          "projected": {
            "defaultMode": 420,
            "sources": [
              {
                "serviceAccountToken": {
                  "expirationSeconds": 3607,
                  "path": "token"
                }
              },
              {
                "configMap": {
                  "items": [
                    {
                      "key": "ca.crt",
                      "path": "ca.crt"
                    }
                  ],
                  "name": "kube-root-ca.crt"
                }
              },
              {
                "downwardAPI": {
                  "items": [
                    {
                      "fieldRef": {
                        "apiVersion": "v1",
                        "fieldPath": "metadata.namespace"
                      },
                      "path": "namespace"
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    },
    "status": {
      "conditions": [
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:11:15Z",
          "status": "True",
          "type": "Initialized"
        },
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:11:22Z",
          "status": "True",
          "type": "Ready"
        },
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:11:22Z",
          "status": "True",
          "type": "ContainersReady"
        },
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:11:15Z",
          "status": "True",
          "type": "PodScheduled"
        }
      ],
      "containerStatuses": [
        {
          "containerID": "containerd://fe9a5ba2f799b7afadf25e84e2429ef61c3554df8f4510ad132d852acac36866",
          "image": "docker.io/hkube/algorunner:v2.9.1",
          "imageID": "docker.io/hkube/algorunner@sha256:45d2508238599b1babd1517d08892932da7ee372a96ad09a1daca88d3518dc6e",
          "lastState": {},
          "name": "algorunner",
          "ready": true,
          "restartCount": 0,
          "started": true,
          "state": {
            "running": {
              "startedAt": "2025-08-13T11:11:21Z"
            }
          }
        },
        {
          "containerID": "containerd://2647301c6f41b7cc818e06546eacd548f7b61072f8b318e1ee16e7e81dc38a54",
          "image": "docker.io/hkube/worker:v2.9.2-stopProcessing-changes-16903637601",
          "imageID": "docker.io/hkube/worker@sha256:e8a0c0b474d16e39b29c3da1b52cda89aafce4b4792a5a3e0b121c3daf14fd45",
          "lastState": {},
          "name": "worker",
          "ready": true,
          "restartCount": 0,
          "started": true,
          "state": {
            "running": {
              "startedAt": "2025-08-13T11:11:15Z"
            }
          }
        }
      ],
      "hostIP": "172.20.16.215",
      "phase": "Running",
      "podIP": "100.96.2.16",
      "podIPs": [
        {
          "ip": "100.96.2.16"
        }
      ],
      "qosClass": "Burstable",
      "startTime": "2025-08-13T11:11:15Z"
    }
  },
{
  "apiVersion": "v1",
  "kind": "Pod",
  "metadata": {
    "annotations": {
      "kubernetes.io/limit-ranger": "LimitRanger plugin set: cpu request for container worker"
    },
    "creationTimestamp": "2025-08-13T11:12:24Z",
    "finalizers": [
      "batch.kubernetes.io/job-tracking"
    ],
    "generateName": "black-alg-ielrj-",
    "labels": {
      "algorithm-name": "black-alg",
      "controller-uid": "868b71c1-1c8a-40c1-ae33-8de4fb4597b0",
      "group": "hkube",
      "job-name": "black-alg-ielrj",
      "metrics-group": "workers",
      "type": "worker"
    },
    "name": "black-alg-ielrj-982xv",
    "namespace": "default",
    "ownerReferences": [
      {
        "apiVersion": "batch/v1",
        "blockOwnerDeletion": true,
        "controller": true,
        "kind": "Job",
        "name": "black-alg-ielrj",
        "uid": "868b71c1-1c8a-40c1-ae33-8de4fb4597b0"
      }
    ],
    "resourceVersion": "208204640",
    "uid": "78abea06-a864-49ac-96a9-9ad77e5fd5bd"
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
        "resources": {
          "requests": {
            "cpu": "100m"
          }
        },
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
          },
          {
            "mountPath": "/var/run/secrets/kubernetes.io/serviceaccount",
            "name": "kube-api-access-hrb4j",
            "readOnly": true
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
          },
          {
            "mountPath": "/var/run/secrets/kubernetes.io/serviceaccount",
            "name": "kube-api-access-hrb4j",
            "readOnly": true
          }
        ]
      }
    ],
    "dnsPolicy": "ClusterFirst",
    "enableServiceLinks": true,
    "nodeName": "ip-172-20-16-215.eu-west-1.compute.internal",
    "preemptionPolicy": "PreemptLowerPriority",
    "priority": 0,
    "restartPolicy": "Never",
    "schedulerName": "default-scheduler",
    "securityContext": {},
    "serviceAccount": "worker-serviceaccount",
    "serviceAccountName": "worker-serviceaccount",
    "terminationGracePeriodSeconds": 30,
    "tolerations": [
      {
        "effect": "NoExecute",
        "key": "node.kubernetes.io/not-ready",
        "operator": "Exists",
        "tolerationSeconds": 300
      },
      {
        "effect": "NoExecute",
        "key": "node.kubernetes.io/unreachable",
        "operator": "Exists",
        "tolerationSeconds": 300
      }
    ],
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
      },
      {
        "name": "kube-api-access-hrb4j",
        "projected": {
          "defaultMode": 420,
          "sources": [
            {
              "serviceAccountToken": {
                "expirationSeconds": 3607,
                "path": "token"
              }
            },
            {
              "configMap": {
                "items": [
                  {
                    "key": "ca.crt",
                    "path": "ca.crt"
                  }
                ],
                "name": "kube-root-ca.crt"
              }
            },
            {
              "downwardAPI": {
                "items": [
                  {
                    "fieldRef": {
                      "apiVersion": "v1",
                      "fieldPath": "metadata.namespace"
                    },
                    "path": "namespace"
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  },
  "status": {
    "conditions": [
      {
        "lastProbeTime": null,
        "lastTransitionTime": "2025-08-13T11:12:24Z",
        "status": "True",
        "type": "Initialized"
      },
      {
        "lastProbeTime": null,
        "lastTransitionTime": "2025-08-13T11:12:38Z",
        "status": "True",
        "type": "Ready"
      },
      {
        "lastProbeTime": null,
        "lastTransitionTime": "2025-08-13T11:12:38Z",
        "status": "True",
        "type": "ContainersReady"
      },
      {
        "lastProbeTime": null,
        "lastTransitionTime": "2025-08-13T11:12:24Z",
        "status": "True",
        "type": "PodScheduled"
      }
    ],
    "containerStatuses": [
      {
        "containerID": "containerd://da4333ae5e2b13f8e71ce708fa0b09a9029b3a552c2d87195f682c095a4ea17f",
        "image": "docker.io/hkube/algorithm-example-python:v2.9.1",
        "imageID": "docker.io/hkube/algorithm-example-python@sha256:eb4bc1b0d3918935c29a31744d3adbb14fa6c085b1a81a11e30941970baa22ea",
        "lastState": {},
        "name": "algorunner",
        "ready": true,
        "restartCount": 0,
        "started": true,
        "state": {
          "running": {
            "startedAt": "2025-08-13T11:12:37Z"
          }
        }
      },
      {
        "containerID": "containerd://31883b2a78553d4cce57d5b4e111b3489c2d09bdc882d0c799f60a42aa91cd16",
        "image": "docker.io/hkube/worker:v2.9.2-stopProcessing-changes-16903637601",
        "imageID": "docker.io/hkube/worker@sha256:e8a0c0b474d16e39b29c3da1b52cda89aafce4b4792a5a3e0b121c3daf14fd45",
        "lastState": {},
        "name": "worker",
        "ready": true,
        "restartCount": 0,
        "started": true,
        "state": {
          "running": {
            "startedAt": "2025-08-13T11:12:25Z"
          }
        }
      }
    ],
    "hostIP": "172.20.16.215",
    "phase": "Running",
    "podIP": "100.96.2.17",
    "podIPs": [
      {
        "ip": "100.96.2.17"
      }
    ],
    "qosClass": "Burstable",
    "startTime": "2025-08-13T11:12:24Z"
  }
},
  {
    "apiVersion": "v1",
    "kind": "Pod",
    "metadata": {
      "annotations": {
        "kubernetes.io/limit-ranger": "LimitRanger plugin set: cpu request for container worker"
      },
      "creationTimestamp": "2025-08-13T11:10:49Z",
      "finalizers": [
        "batch.kubernetes.io/job-tracking"
      ],
      "generateName": "green-alg-5cno8-",
      "labels": {
        "algorithm-name": "green-alg",
        "controller-uid": "546df3c0-ad2a-49e2-8111-f0453752a884",
        "group": "hkube",
        "job-name": "green-alg-5cno8",
        "metrics-group": "workers",
        "type": "worker"
      },
      "name": "green-alg-5cno8-sr8xn",
      "namespace": "default",
      "ownerReferences": [
        {
          "apiVersion": "batch/v1",
          "blockOwnerDeletion": true,
          "controller": true,
          "kind": "Job",
          "name": "green-alg-5cno8",
          "uid": "546df3c0-ad2a-49e2-8111-f0453752a884"
        }
      ],
      "resourceVersion": "208204123",
      "uid": "e46c7f38-7f9f-421b-a772-04884479f280"
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
          "resources": {
            "requests": {
              "cpu": "100m"
            }
          },
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
            },
            {
              "mountPath": "/var/run/secrets/kubernetes.io/serviceaccount",
              "name": "kube-api-access-plfsf",
              "readOnly": true
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
            },
            {
              "mountPath": "/var/run/secrets/kubernetes.io/serviceaccount",
              "name": "kube-api-access-plfsf",
              "readOnly": true
            }
          ]
        }
      ],
      "dnsPolicy": "ClusterFirst",
      "enableServiceLinks": true,
      "nodeName": "ip-172-20-17-40.eu-west-1.compute.internal",
      "preemptionPolicy": "PreemptLowerPriority",
      "priority": 0,
      "restartPolicy": "Never",
      "schedulerName": "default-scheduler",
      "securityContext": {},
      "serviceAccount": "worker-serviceaccount",
      "serviceAccountName": "worker-serviceaccount",
      "terminationGracePeriodSeconds": 30,
      "tolerations": [
        {
          "effect": "NoExecute",
          "key": "node.kubernetes.io/not-ready",
          "operator": "Exists",
          "tolerationSeconds": 300
        },
        {
          "effect": "NoExecute",
          "key": "node.kubernetes.io/unreachable",
          "operator": "Exists",
          "tolerationSeconds": 300
        }
      ],
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
        },
        {
          "name": "kube-api-access-plfsf",
          "projected": {
            "defaultMode": 420,
            "sources": [
              {
                "serviceAccountToken": {
                  "expirationSeconds": 3607,
                  "path": "token"
                }
              },
              {
                "configMap": {
                  "items": [
                    {
                      "key": "ca.crt",
                      "path": "ca.crt"
                    }
                  ],
                  "name": "kube-root-ca.crt"
                }
              },
              {
                "downwardAPI": {
                  "items": [
                    {
                      "fieldRef": {
                        "apiVersion": "v1",
                        "fieldPath": "metadata.namespace"
                      },
                      "path": "namespace"
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    },
    "status": {
      "conditions": [
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:10:49Z",
          "status": "True",
          "type": "Initialized"
        },
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:11:00Z",
          "status": "True",
          "type": "Ready"
        },
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:11:00Z",
          "status": "True",
          "type": "ContainersReady"
        },
        {
          "lastProbeTime": null,
          "lastTransitionTime": "2025-08-13T11:10:49Z",
          "status": "True",
          "type": "PodScheduled"
        }
      ],
      "containerStatuses": [
        {
          "containerID": "containerd://80f45e7bb8c29bea55a3f70f0767ab12ef01491e4cd7c07122add4cd93095897",
          "image": "docker.io/hkube/algorithm-example-python:v2.9.1",
          "imageID": "docker.io/hkube/algorithm-example-python@sha256:eb4bc1b0d3918935c29a31744d3adbb14fa6c085b1a81a11e30941970baa22ea",
          "lastState": {},
          "name": "algorunner",
          "ready": true,
          "restartCount": 0,
          "started": true,
          "state": {
            "running": {
              "startedAt": "2025-08-13T11:11:00Z"
            }
          }
        },
        {
          "containerID": "containerd://337fe12ce1511c293cb0f738f0e26da7a7da90b95a2dbc9dce89119bb481f9e6",
          "image": "docker.io/hkube/worker:v2.9.2-stopProcessing-changes-16903637601",
          "imageID": "docker.io/hkube/worker@sha256:e8a0c0b474d16e39b29c3da1b52cda89aafce4b4792a5a3e0b121c3daf14fd45",
          "lastState": {},
          "name": "worker",
          "ready": true,
          "restartCount": 0,
          "started": true,
          "state": {
            "running": {
              "startedAt": "2025-08-13T11:10:50Z"
            }
          }
        }
      ],
      "hostIP": "172.20.17.40",
      "phase": "Running",
      "podIP": "100.96.3.184",
      "podIPs": [
        {
          "ip": "100.96.3.184"
        }
      ],
      "qosClass": "Burstable",
      "startTime": "2025-08-13T11:10:49Z"
    }
  }
]

module.exports = pods;
