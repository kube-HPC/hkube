const { gpuVendors } = require('../../lib/consts');

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
                                    memory: '256Mi',
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

const nodeWithLabels = {
    metadata: {
        name: 'node4',
        labels: {
            type: 'gpu-extreme',
            max: 'bound'
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

module.exports = {
    pods,
    nodes,
    nodeWithLabels
};
