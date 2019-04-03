const { ALGORITHM_BUILDER } = require('../../lib/consts/containers');

const jobTemplate = {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
        name: ALGORITHM_BUILDER,
        labels: {
            type: ALGORITHM_BUILDER,
            group: 'hkube',
            core: 'true'
        }
    },
    spec: {
        template: {
            metadata: {
                labels: {
                    type: ALGORITHM_BUILDER,
                    group: 'hkube'
                }
            },
            spec: {
                nodeSelector: {
                    builder: 'true'
                },
                containers: [
                    {
                        name: ALGORITHM_BUILDER,
                        image: `hkube/${ALGORITHM_BUILDER}`,
                        env: [
                            {
                                name: 'NODE_ENV',
                                value: 'production'
                            },
                            {
                                name: 'POD_ID',
                                valueFrom: {
                                    fieldRef: {
                                        fieldPath: 'metadata.uid'
                                    }
                                }
                            },
                            {
                                name: 'POD_NAME',
                                valueFrom: {
                                    fieldRef: {
                                        fieldPath: 'metadata.name'
                                    }
                                }
                            },
                            {
                                name: 'DEFAULT_STORAGE',
                                valueFrom: {
                                    configMapKeyRef: {
                                        name: 'algorithm-operator-configmap',
                                        key: 'DEFAULT_STORAGE'
                                    }
                                }
                            },
                            {
                                name: 'DOCKER_REGISTRY_USER',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 'docker-credentials-secret',
                                        key: 'username'
                                    }
                                }
                            },
                            {
                                name: 'DOCKER_REGISTRY_PASS',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 'docker-credentials-secret',
                                        key: 'password'
                                    }
                                }
                            }
                        ],
                        volumeMounts: [
                            {
                                name: 'dockersock',
                                mountPath: '/var/run/docker.sock'
                            }
                        ],
                        securityContext: {
                            privileged: true
                        }
                    }
                ],
                volumes: [
                    {
                        name: 'dockersock',
                        hostPath: {
                            path: '/var/run/docker.sock'
                        }
                    }
                ],
                restartPolicy: 'Never'
            }
        },
        backoffLimit: 4
    }
};

module.exports = jobTemplate;
