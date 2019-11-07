import os

class Config:
    socket = {
        "port": os.environ.get('WORKER_SOCKET_PORT', "3000"),
        "host": os.environ.get('WORKER_SOCKET_HOST', "127.0.0.1"),
        "protocol": os.environ.get('WORKER_SOCKET_PROTOCOL', "ws"),
        "url": os.environ.get('WORKER_SOCKET_URL', None),
    }
    algorithm = {
        "path": os.environ.get('ALGORITHM_PATH', "algorithm_unique_folder"),
        "entryPoint": os.environ.get('ALGORITHM_ENTRY_POINT', "main.py")
    }