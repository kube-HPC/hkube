const { gpuVendors, kaiValues } = require('../../lib/consts');

const pods = {
    body: {
        items: [
            {
                metadata: {
                    name: 'one container with resources',
                    labels: {

                    }
                },
                spec: {
                    containers: [
                        {
                            resources: {
                                limits: {
                                    cpu: '200m',
                                    memory: '256Mi',
                                    [gpuVendors.NVIDIA]: '1'
                                },
                                requests: {
                                    cpu: '200m',
                                    memory: '268435456',
                                    [gpuVendors.NVIDIA]: '1'
                                }
                            }
                        }
                    ],
                    nodeName: 'node1',
                },
                status: {
                    phase: 'Running'
                }
            },
            {
                metadata: {
                    name: 'one container with resources not running',
                    labels: {

                    }
                },
                spec: {
                    containers: [
                        {
                            resources: {
                                limits: {
                                    cpu: '200m',
                                    memory: '256Mi',
                                    [gpuVendors.NVIDIA]: '1'
                                },
                                requests: {
                                    cpu: '200m',
                                    memory: '256Mi',
                                    [gpuVendors.NVIDIA]: '1'
                                }
                            }
                        }
                    ],
                    nodeName: 'node1',
                },
                status: {
                    phase: 'Terminated'
                }
            },
            {
                metadata: {
                    name: 'two container with resources',
                    labels: {

                    }
                },
                spec: {
                    containers: [
                        {
                            resources: {
                                limits: {
                                    cpu: '100m',
                                    memory: '128Mi',
                                    [gpuVendors.NVIDIA]: '1'
                                },
                                requests: {
                                    cpu: '50m',
                                    memory: '128Mi',
                                    [gpuVendors.NVIDIA]: '1'
                                }
                            }
                        },
                        {
                            resources: {
                                limits: {
                                    cpu: '600m',
                                    memory: '256Mi',
                                    [gpuVendors.NVIDIA]: '1'
                                },
                                requests: {
                                    cpu: '200m',
                                    memory: '256Mi',
                                    [gpuVendors.NVIDIA]: '1'
                                }
                            }
                        }
                    ],
                    nodeName: 'node2',
                },
                status: {
                    phase: 'Running'
                }
            },
            {
                metadata: {
                    name: 'two container no node name',
                    labels: {

                    }
                },
                spec: {
                    containers: [
                        {
                            resources: {
                                limits: {
                                    cpu: '100m',
                                    memory: '128Mi'
                                },
                                requests: {
                                    cpu: '50m',
                                    memory: '128Mi'
                                }
                            }
                        },
                        {
                            resources: {
                                limits: {
                                    cpu: '200m',
                                    memory: '256Mi'
                                },
                                requests: {
                                    cpu: '200m',
                                    memory: '256Mi'
                                }
                            }
                        }
                    ],
                },
                status: {
                    phase: 'Running'
                }
            },
            {
                metadata: {
                    name: 'one container no resources',
                    labels: {

                    }
                },
                spec: {
                    containers: [
                        {
                            resources: {

                            }
                        }
                    ],
                    nodeName: 'node2',
                },
                status: {
                    phase: 'Running'
                }
            }
        ]
    }
};


const nodes = {
    statusCode: 200,
    body: {
        kind: 'NodeList',
        apiVersion: 'v1',
        metadata: {
            selfLink: '/api/v1/nodes',
            resourceVersion: '7110746'
        },
        items: [
            {
                metadata: {
                    name: 'node1'
                },
                status: {
                    capacity: {
                        cpu: '8',
                        memory: '32Gi',
                        [gpuVendors.NVIDIA]: '8',
                        pods: '110'
                    },
                    allocatable: {
                        cpu: '7800m',
                        memory: '32Gi',
                        [gpuVendors.NVIDIA]: '4',
                        pods: '110'
                    },
                }
            },
            {
                metadata: {
                    name: 'node2'
                },
                status: {
                    capacity: {
                        cpu: '8',
                        memory: '32Gi',
                        [gpuVendors.NVIDIA]: '4',
                        pods: '110'
                    },
                    allocatable: {
                        cpu: '7800m',
                        memory: '32Gi',
                        [gpuVendors.NVIDIA]: '4',
                        pods: '110'
                    }
                }
            },
            {
                metadata: {
                    name: 'node3'
                },
                status: {
                    capacity: {
                        cpu: '8',
                        memory: '32Gi',
                        pods: '110'
                    },
                    allocatable: {
                        cpu: '7800m',
                        memory: '32Gi',
                        pods: '110'
                    }
                }
            },
        ]
    }
};


const podsGpu = {
    body: {
        items: [
            {
                metadata: {
                    name: 'one container with resources',
                    labels: {
                        "kubernetes.io/hostname": "node1"
                    }
                },
                spec: {
                    containers: [
                        {
                            resources: {
                                limits: {
                                    cpu: '200m',
                                    memory: '256Mi',
                                    [gpuVendors.NVIDIA]: '1'
                                },
                                requests: {
                                    cpu: '200m',
                                    memory: '268435456',
                                    [gpuVendors.NVIDIA]: '1'
                                }
                            }
                        }
                    ],
                    nodeName: 'node1',
                },
                status: {
                    phase: 'Running'
                }
            }
        ]
    }
};

const nodesNoGpu = {
    statusCode: 200,
    body: {
        kind: 'NodeList',
        apiVersion: 'v1',
        metadata: {
            selfLink: '/api/v1/nodes',
            resourceVersion: '7110746'
        },
        items: [
            {
                metadata: {
                    name: 'node1'
                },
                status: {
                    capacity: {
                        cpu: '8',
                        memory: '32Gi',
                        pods: '110'
                    },
                    allocatable: {
                        cpu: '7800m',
                        memory: '32Gi',
                        pods: '110'
                    },
                }
            }
        ]
    }
};


const nodeWithLabels = {
    metadata: {
        name: 'node4',
        labels: {
            type: 'gpu-extreme',
            max: 'bound',
            "kubernetes.io/hostname": "node4"
        }
    },
    status: {
        capacity: {
            cpu: '10',
            memory: '48Gi',
            [gpuVendors.NVIDIA]: '8',
            pods: '110'
        },
        allocatable: {
            cpu: '9800m',
            memory: '48Gi',
            [gpuVendors.NVIDIA]: '8',
            pods: '110'
        }
    }
}

const persistentVolumeClaim = {
    items: [
        {
            metadata: {
                name: 'pvc-1',
                labels: {
                    'app': 'my-app'
                }
            },
            spec: {
                accessModes: ['ReadWriteOnce'],
                resources: {
                    requests: {
                        storage: '1Gi'
                    }
                },
                storageClassName: 'standard'
            },
            status: {
                phase: 'Bound'
            }
        },
        {
            metadata: {
                name: 'pvc-2',
                labels: {
                    'app': 'my-app'
                }
            },
            spec: {
                accessModes: ['ReadWriteMany'],
                resources: {
                    requests: {
                        storage: '2Gi'
                    }
                },
                storageClassName: 'fast'
            },
            status: {
                phase: 'Pending'
            }
        }
    ]
};

const configMap = {
    items: [
        {
            metadata: {
                name: 'config-map-1',
                labels: {
                    'app': 'my-app'
                }
            },
            data: {
                'config.json': '{"setting1": "value1", "setting2": "value2"}',
                'config.yaml': 'setting1: value1\nsetting2: value2'
            }
        },
        {
            metadata: {
                name: 'config-map-2',
                labels: {
                    'app': 'another-app'
                }
            },
            data: {
                'app-config.json': '{"feature1": "enabled", "feature2": "disabled"}',
                'app-config.yaml': 'feature1: enabled\nfeature2: disabled'
            }
        }
    ]
};

const secret = {
    items: [
        {
            metadata: {
                name: 'secret-1',
                labels: {
                    'app': 'my-app'
                }
            },
            data: {
                'username': Buffer.from('admin').toString('base64'),
                'password': Buffer.from('password123').toString('base64')
            }
        },
        {
            metadata: {
                name: 'secret-2',
                labels: {
                    'app': 'another-app'
                }
            },
            data: {
                'api-key': Buffer.from('my-api-key-1234').toString('base64'),
                'token': Buffer.from('my-secret-token').toString('base64')
            }
        }
    ]
};

const customResourceDefinition = { // for Kai (run-ai) Queues + extra dummy CRD
    items: [
        {
            metadata: {
                name: kaiValues.KUBERNETES.QUEUES_CRD_NAME
            },
            spec: {
                versions: [
                    { name: 'v2', served: true }
                ]
            }
        },
        {
            metadata: {
                name: 'widgets.example.com'
            },
            spec: {
                versions: [
                    { name: 'v1alpha1', served: true }
                ]
            }
        }
    ]
};


const queues = { // for Kai (run-ai)
    items: [
        { metadata: { name: 'default' } },
        { metadata: { name: 'test' } }
    ]
};


module.exports = {
    pods,
    nodes,
    nodeWithLabels,
    nodesNoGpu,
    podsGpu,
    persistentVolumeClaim,
    configMap,
    secret,
    customResourceDefinition,
    queues
};
