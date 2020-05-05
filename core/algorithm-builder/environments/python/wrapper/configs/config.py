import os
socket = {
    "port": os.environ.get('WORKER_SOCKET_PORT', "3000"),
    "host": os.environ.get('WORKER_SOCKET_HOST', "127.0.0.1"),
    "protocol": os.environ.get('WORKER_SOCKET_PROTOCOL', "ws"),
    "url": os.environ.get('WORKER_SOCKET_URL', None),
    "encoding": os.environ.get('WORKER_ALGORITHM_ENCODING', 'bson')
}
discovery = {
    "host": os.environ.get('POD_NAME', 'localhost'),
    "port": os.environ.get('DISCOVERY_PORT', 9020),
    "encoding": os.environ.get('DISCOVERY_ENCODING', 'bson')
}
algorithm = {
    "path": os.environ.get('ALGORITHM_PATH', "algorithm_unique_folder"),
    "entryPoint": os.environ.get('ALGORITHM_ENTRY_POINT', "main.py")
}
storage = {
    "clusterName": os.environ.get('CLUSTER_NAME', 'local'),
    "type": os.environ.get('DEFAULT_STORAGE', 'fs'),
    "mode": 'v2',
    "encoding": os.environ.get('STORAGE_ENCODING', 'bson'),
    "fs": {
        "baseDirectory": os.environ.get('BASE_FS_ADAPTER_DIRECTORY', '/var/tmp/fs/storage')
    },
    "s3": {
        "accessKeyId": os.environ.get('AWS_ACCESS_KEY_ID', 'AKIAIOSFODNN7EXAMPLE'),
        "secretAccessKey": os.environ.get('AWS_SECRET_ACCESS_KEY', 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'),
        "endpoint": os.environ.get('AWS_ENDPOINT', 'http://127.0.0.1:9000')
    }
}
