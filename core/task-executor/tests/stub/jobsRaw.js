const twoCompleted = {
  body: {
    apiVersion: 'v1',
    items: [
      {
        apiVersion: 'batch/v1',
        kind: 'Job',
        metadata: {
          creationTimestamp: '2020-04-05T08:17:54Z',
          labels: {
            'algorithm-name': 'eval-alg',
            core: 'true',
            group: 'hkube',
            'metrics-group': 'workers',
            type: 'worker'
          },
          name: 'eval-alg-252e3991290315254b66cb8f8aa0f7',
          namespace: 'hkube',
          resourceVersion: '18268968',
          selfLink: '/apis/batch/v1/namespaces/hkube/jobs/eval-alg-252e3991290315254b66cb8f8aa0f7',
          uid: 'f2e81d51-7715-11ea-8f86-408d5cb60346'
        },
        spec: {
          template: {
            metadata: {
              creationTimestamp: null,
              labels: {
                'algorithm-name': 'eval-alg',
                'controller-uid': 'f2e81d51-7715-11ea-8f86-408d5cb60346',
                group: 'hkube',
                'job-name': 'eval-alg-252e3991290315254b66cb8f8aa0f7',
                'metrics-group': 'workers',
                type: 'worker'
              }
            },
            spec: {
              containers: [
                {
                  image: 'hkube/worker:v1.2.55',
                  imagePullPolicy: 'IfNotPresent',
                  name: 'worker',
                },
                {
                  image: 'hkube/algorunner:v1.2.8',
                  imagePullPolicy: 'IfNotPresent',
                  name: 'algorunner',
                }
              ],
            }
          }
        },
        status: {
          conditions: [
            {
              lastProbeTime: '2020-04-05T08:18:02Z',
              lastTransitionTime: '2020-04-05T08:18:02Z',
              message: 'Job has reached the specified backoff limit',
              reason: 'BackoffLimitExceeded',
              status: 'True',
              type: 'Failed'
            }
          ],
          failed: 1,
          startTime: '2020-04-05T08:17:54Z'
        }
      },
      {
        apiVersion: 'batch/v1',
        kind: 'Job',
        metadata: {
          creationTimestamp: '2018-06-07T08:46:11Z',
          labels: {
            'algorithm-name': 'eval-alg',
            core: 'true',
            group: 'hkube',
            'metrics-group': 'workers',
            type: 'worker'
          },
          name: 'eval-alg-6e07dea9-3c53-4599-97cb-ea7ee4a5c76a',
          namespace: 'default',
          resourceVersion: '6145589',
          selfLink: '/apis/batch/v1/namespaces/default/jobs/eval-alg-6e07dea9-3c53-4599-97cb-ea7ee4a5c76a',
          uid: '3ad4e67f-6a2f-11e8-85bd-000d3ab7e5fc'
        },
        spec: {
          backoffLimit: 4,
          completions: 1,
          parallelism: 1,
          selector: {
            matchLabels: {
              'controller-uid': '3ad4e67f-6a2f-11e8-85bd-000d3ab7e5fc'
            }
          },
          template: {
            metadata: {
              creationTimestamp: null,
              labels: {
                'controller-uid': '3ad4e67f-6a2f-11e8-85bd-000d3ab7e5fc',
                'job-name': 'eval-alg-6e07dea9-3c53-4599-97cb-ea7ee4a5c76a'
              }
            },
            spec: {
              containers: [
                {
                  env: [
                    {
                      name: 'NODE_ENV',
                      value: 'kube'
                    },
                    {
                      name: 'ALGORITHM_TYPE',
                      value: 'eval-alg'
                    },
                    {
                      name: 'METRICS_PORT',
                      value: '3001'
                    },
                    {
                      name: 'INACTIVE_PAUSED_WORKER_TIMEOUT_MS',
                      value: '60000'
                    },
                    {
                      name: 'POD_ID',
                      valueFrom: {
                        fieldRef: {
                          apiVersion: 'v1',
                          fieldPath: 'metadata.uid'
                        }
                      }
                    },
                    {
                      name: 'POD_NAME',
                      valueFrom: {
                        fieldRef: {
                          apiVersion: 'v1',
                          fieldPath: 'metadata.name'
                        }
                      }
                    },
                    {
                      name: 'AWS_ACCESS_KEY_ID',
                      valueFrom: {
                        secretKeyRef: {
                          key: 'awsKey',
                          name: 's3-secret'
                        }
                      }
                    },
                    {
                      name: 'AWS_SECRET_ACCESS_KEY',
                      valueFrom: {
                        secretKeyRef: {
                          key: 'awsSecret',
                          name: 's3-secret'
                        }
                      }
                    },
                    {
                      name: 'S3_ENDPOINT_URL',
                      valueFrom: {
                        secretKeyRef: {
                          key: 'awsEndpointUrl',
                          name: 's3-secret'
                        }
                      }
                    },
                    {
                      name: 'DEFAULT_STORAGE',
                      value: 's3'
                    },
                    {
                      name: 'JAEGER_AGENT_SERVICE_HOST',
                      valueFrom: {
                        fieldRef: {
                          apiVersion: 'v1',
                          fieldPath: 'status.hostIP'
                        }
                      }
                    },
                    {
                      name: 'HKUBE_LOG_LEVEL',
                      value: '1'
                    }
                  ],
                  image: 'hkube/worker:v1.1.25',
                  imagePullPolicy: 'IfNotPresent',
                  name: 'worker',
                  resources: {},
                  securityContext: {
                    privileged: true
                  },
                  terminationMessagePath: '/dev/termination-log',
                  terminationMessagePolicy: 'File',
                  volumeMounts: [
                    {
                      mountPath: '/var/log',
                      name: 'varlog'
                    },
                    {
                      mountPath: '/var/lib/docker/containers',
                      name: 'varlibdockercontainers',
                      readOnly: true
                    }
                  ]
                },
                {
                  image: 'hkube/algorunner:v1.1.3',
                  imagePullPolicy: 'IfNotPresent',
                  name: 'algorunner',
                  resources: {},
                  terminationMessagePath: '/dev/termination-log',
                  terminationMessagePolicy: 'File'
                }
              ],
              dnsPolicy: 'ClusterFirst',
              nodeSelector: {
                worker: 'true'
              },
              restartPolicy: 'Never',
              schedulerName: 'default-scheduler',
              securityContext: {},
              serviceAccount: 'worker-serviceaccount',
              serviceAccountName: 'worker-serviceaccount',
              terminationGracePeriodSeconds: 30,
              volumes: [
                {
                  hostPath: {
                    path: '/var/log',
                    type: ''
                  },
                  name: 'varlog'
                },
                {
                  hostPath: {
                    path: '/var/lib/docker/containers',
                    type: ''
                  },
                  name: 'varlibdockercontainers'
                }
              ]
            }
          }
        },
        status: {
          completionTime: '2018-06-07T08:47:22Z',
          conditions: [
            {
              lastProbeTime: '2018-06-07T08:47:22Z',
              lastTransitionTime: '2018-06-07T08:47:22Z',
              status: 'True',
              type: 'Complete'
            }
          ],
          startTime: '2018-06-07T08:46:11Z',
          succeeded: 1
        }
      },
      {
        apiVersion: 'batch/v1',
        kind: 'Job',
        metadata: {
          creationTimestamp: '2018-06-07T08:46:17Z',
          labels: {
            'algorithm-name': 'eval-alg',
            core: 'true',
            group: 'hkube',
            'metrics-group': 'workers',
            type: 'worker'
          },
          name: 'eval-alg-955837ec-80ca-4e0a-b7bf-c74ab44fa8f2',
          namespace: 'default',
          resourceVersion: '6145599',
          selfLink: '/apis/batch/v1/namespaces/default/jobs/eval-alg-955837ec-80ca-4e0a-b7bf-c74ab44fa8f2',
          uid: '3e7b2b9f-6a2f-11e8-85bd-000d3ab7e5fc'
        },
        spec: {
          backoffLimit: 4,
          completions: 1,
          parallelism: 1,
          selector: {
            matchLabels: {
              'controller-uid': '3e7b2b9f-6a2f-11e8-85bd-000d3ab7e5fc'
            }
          },
          template: {
            metadata: {
              creationTimestamp: null,
              labels: {
                'controller-uid': '3e7b2b9f-6a2f-11e8-85bd-000d3ab7e5fc',
                'job-name': 'eval-alg-955837ec-80ca-4e0a-b7bf-c74ab44fa8f2'
              }
            },
            spec: {
              containers: [
                {
                  env: [
                    {
                      name: 'NODE_ENV',
                      value: 'kube'
                    },
                    {
                      name: 'ALGORITHM_TYPE',
                      value: 'eval-alg'
                    },
                    {
                      name: 'METRICS_PORT',
                      value: '3001'
                    },
                    {
                      name: 'INACTIVE_PAUSED_WORKER_TIMEOUT_MS',
                      value: '60000'
                    },
                    {
                      name: 'POD_ID',
                      valueFrom: {
                        fieldRef: {
                          apiVersion: 'v1',
                          fieldPath: 'metadata.uid'
                        }
                      }
                    },
                    {
                      name: 'POD_NAME',
                      valueFrom: {
                        fieldRef: {
                          apiVersion: 'v1',
                          fieldPath: 'metadata.name'
                        }
                      }
                    },
                    {
                      name: 'AWS_ACCESS_KEY_ID',
                      valueFrom: {
                        secretKeyRef: {
                          key: 'awsKey',
                          name: 's3-secret'
                        }
                      }
                    },
                    {
                      name: 'AWS_SECRET_ACCESS_KEY',
                      valueFrom: {
                        secretKeyRef: {
                          key: 'awsSecret',
                          name: 's3-secret'
                        }
                      }
                    },
                    {
                      name: 'S3_ENDPOINT_URL',
                      valueFrom: {
                        secretKeyRef: {
                          key: 'awsEndpointUrl',
                          name: 's3-secret'
                        }
                      }
                    },
                    {
                      name: 'DEFAULT_STORAGE',
                      value: 's3'
                    },
                    {
                      name: 'JAEGER_AGENT_SERVICE_HOST',
                      valueFrom: {
                        fieldRef: {
                          apiVersion: 'v1',
                          fieldPath: 'status.hostIP'
                        }
                      }
                    },
                    {
                      name: 'HKUBE_LOG_LEVEL',
                      value: '1'
                    }
                  ],
                  image: 'hkube/worker:v1.1.25',
                  imagePullPolicy: 'IfNotPresent',
                  name: 'worker',
                  resources: {},
                  securityContext: {
                    privileged: true
                  },
                  terminationMessagePath: '/dev/termination-log',
                  terminationMessagePolicy: 'File',
                  volumeMounts: [
                    {
                      mountPath: '/var/log',
                      name: 'varlog'
                    },
                    {
                      mountPath: '/var/lib/docker/containers',
                      name: 'varlibdockercontainers',
                      readOnly: true
                    }
                  ]
                },
                {
                  image: 'hkube/algorunner:v1.1.3',
                  imagePullPolicy: 'IfNotPresent',
                  name: 'algorunner',
                  resources: {},
                  terminationMessagePath: '/dev/termination-log',
                  terminationMessagePolicy: 'File'
                }
              ],
              dnsPolicy: 'ClusterFirst',
              nodeSelector: {
                worker: 'true'
              },
              restartPolicy: 'Never',
              schedulerName: 'default-scheduler',
              securityContext: {},
              serviceAccount: 'worker-serviceaccount',
              serviceAccountName: 'worker-serviceaccount',
              terminationGracePeriodSeconds: 30,
              volumes: [
                {
                  hostPath: {
                    path: '/var/log',
                    type: ''
                  },
                  name: 'varlog'
                },
                {
                  hostPath: {
                    path: '/var/lib/docker/containers',
                    type: ''
                  },
                  name: 'varlibdockercontainers'
                }
              ]
            }
          }
        },
        status: {
          completionTime: '2018-06-07T08:47:25Z',
          conditions: [
            {
              lastProbeTime: '2018-06-07T08:47:25Z',
              lastTransitionTime: '2018-06-07T08:47:25Z',
              status: 'True',
              type: 'Complete'
            }
          ],
          startTime: '2018-06-07T08:46:17Z',
          succeeded: 1
        }
      },
      {
        apiVersion: 'batch/v1',
        kind: 'Job',
        metadata: {
          creationTimestamp: '2018-06-07T10:56:48Z',
          labels: {
            'algorithm-name': 'eval-alg',
            core: 'true',
            group: 'hkube',
            'metrics-group': 'workers',
            type: 'worker'
          },
          name: 'eval-alg-742363bf-3b4c-4bf1-860f-c31075fcb3f8',
          namespace: 'default',
          resourceVersion: '6163241',
          selfLink: '/apis/batch/v1/namespaces/default/jobs/eval-alg-742363bf-3b4c-4bf1-860f-c31075fcb3f8',
          uid: '79b25403-6a41-11e8-85bd-000d3ab7e5fc'
        },
        spec: {
          backoffLimit: 4,
          completions: 1,
          parallelism: 1,
          selector: {
            matchLabels: {
              'controller-uid': '79b25403-6a41-11e8-85bd-000d3ab7e5fc'
            }
          },
          template: {
            metadata: {
              creationTimestamp: null,
              labels: {
                'controller-uid': '79b25403-6a41-11e8-85bd-000d3ab7e5fc',
                'job-name': 'eval-alg-742363bf-3b4c-4bf1-860f-c31075fcb3f8'
              }
            },
            spec: {
              containers: [
                {
                  env: [
                    {
                      name: 'NODE_ENV',
                      value: 'kube'
                    },
                    {
                      name: 'ALGORITHM_TYPE',
                      value: 'eval-alg'
                    },
                    {
                      name: 'METRICS_PORT',
                      value: '3001'
                    },
                    {
                      name: 'INACTIVE_PAUSED_WORKER_TIMEOUT_MS',
                      value: '60000'
                    },
                    {
                      name: 'POD_ID',
                      valueFrom: {
                        fieldRef: {
                          apiVersion: 'v1',
                          fieldPath: 'metadata.uid'
                        }
                      }
                    },
                    {
                      name: 'POD_NAME',
                      valueFrom: {
                        fieldRef: {
                          apiVersion: 'v1',
                          fieldPath: 'metadata.name'
                        }
                      }
                    },
                    {
                      name: 'AWS_ACCESS_KEY_ID',
                      valueFrom: {
                        secretKeyRef: {
                          key: 'awsKey',
                          name: 's3-secret'
                        }
                      }
                    },
                    {
                      name: 'AWS_SECRET_ACCESS_KEY',
                      valueFrom: {
                        secretKeyRef: {
                          key: 'awsSecret',
                          name: 's3-secret'
                        }
                      }
                    },
                    {
                      name: 'S3_ENDPOINT_URL',
                      valueFrom: {
                        secretKeyRef: {
                          key: 'awsEndpointUrl',
                          name: 's3-secret'
                        }
                      }
                    },
                    {
                      name: 'DEFAULT_STORAGE',
                      value: 's3'
                    },
                    {
                      name: 'JAEGER_AGENT_SERVICE_HOST',
                      valueFrom: {
                        fieldRef: {
                          apiVersion: 'v1',
                          fieldPath: 'status.hostIP'
                        }
                      }
                    },
                    {
                      name: 'HKUBE_LOG_LEVEL',
                      value: '1'
                    }
                  ],
                  image: 'hkube/worker:v1.1.25',
                  imagePullPolicy: 'IfNotPresent',
                  name: 'worker',
                  resources: {},
                  securityContext: {
                    privileged: true
                  },
                  terminationMessagePath: '/dev/termination-log',
                  terminationMessagePolicy: 'File',
                  volumeMounts: [
                    {
                      mountPath: '/var/log',
                      name: 'varlog'
                    },
                    {
                      mountPath: '/var/lib/docker/containers',
                      name: 'varlibdockercontainers',
                      readOnly: true
                    }
                  ]
                },
                {
                  image: 'hkube/algorunner:v1.1.3',
                  imagePullPolicy: 'IfNotPresent',
                  name: 'algorunner',
                  resources: {},
                  terminationMessagePath: '/dev/termination-log',
                  terminationMessagePolicy: 'File'
                }
              ],
              dnsPolicy: 'ClusterFirst',
              nodeSelector: {
                worker: 'true'
              },
              restartPolicy: 'Never',
              schedulerName: 'default-scheduler',
              securityContext: {},
              serviceAccount: 'worker-serviceaccount',
              serviceAccountName: 'worker-serviceaccount',
              terminationGracePeriodSeconds: 30,
              volumes: [
                {
                  hostPath: {
                    path: '/var/log',
                    type: ''
                  },
                  name: 'varlog'
                },
                {
                  hostPath: {
                    path: '/var/lib/docker/containers',
                    type: ''
                  },
                  name: 'varlibdockercontainers'
                }
              ]
            }
          }
        },
        status: {
          active: 1,
          startTime: '2018-06-07T10:56:48Z'
        }
      }
    ],
    kind: 'List',
    metadata: {
      resourceVersion: '',
      selfLink: ''
    }
  },
  
};

module.exports = {
  twoCompleted
};
