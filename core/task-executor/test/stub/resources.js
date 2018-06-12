const pods = {
    body: {
        items: [
            {
                metadata: {
                    name: 'one container with resources'
                },
                spec: {
                    containers: [
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
                    nodeName: 'node1',
                },
                status: {
                    phase: 'Running'
                }
            },
            {
                metadata: {
                    name: 'one container with resources not running'
                },
                spec: {
                    containers: [
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
                    nodeName: 'node1',
                },
                status: {
                    phase: 'Terminated'
                }
            },
            {
                metadata: {
                    name: 'two container with resources'
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
                    nodeName: 'node2',
                },
                status: {
                    phase: 'Running'
                }
            },
            {
                metadata: {
                    name: 'two container no node name'
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
                    name: 'one container no resources'
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
                    name: 'node1',
                    
                },
                status: {
                    capacity: {
                        cpu: '8',
                        memory: '32919088Ki',
                        pods: '110'
                    },
                    allocatable: {
                        cpu: '7800m',
                        memory: '32316688Ki',
                        pods: '110'
                    },
                }
            },
            {
                metadata: {
                    name: 'node2',
                    
                },
                status: {
                    capacity: {
                        cpu: '8',
                        memory: '32919088Ki',
                        pods: '110'
                    },
                    allocatable: {
                        cpu: '7800m',
                        memory: '32316688Ki',
                        pods: '110'
                    },
                }
            },
            {
                metadata: {
                    name: 'node3',
                    
                },
                status: {
                    capacity: {
                        cpu: '8',
                        memory: '32919088Ki',
                        pods: '110'
                    },
                    allocatable: {
                        cpu: '7800m',
                        memory: '32316688Ki',
                        pods: '110'
                    },
                }
            },
        ]
    }
};

module.exports = {
    pods,
    nodes
};
