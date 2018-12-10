const fsVolumes = {
    name: 'storage-volume',
    persistentVolumeClaim: {
        claimName: 'hkube-storage-pvc'
    }
};

const fsVolumeMounts = {
    name: 'storage-volume',
    mountPath: process.env.BASE_FS_ADAPTER_DIRECTORY || '/hkubedata'
};

const fsBaseDirectory = {
    BASE_FS_ADAPTER_DIRECTORY:
        {
            configMapKeyRef: {
                name: 'task-executor-configmap',
                key: 'BASE_FS_ADAPTER_DIRECTORY'
            }
        }
};

module.exports = {
    fsBaseDirectory,
    fsVolumeMounts,
    fsVolumes
};
