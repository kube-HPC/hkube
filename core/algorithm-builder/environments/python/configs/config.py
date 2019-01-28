import os


class Config:

    adapter = os.environ.get('WORKER_ALGORITHM_PROTOCOL', "socket")
    socket = {
        "port": os.environ.get('WORKER_SOCKET_PORT', "9876"),
        "host": os.environ.get('WORKER_SOCKET_HOST', "127.0.0.1"),
        "protocol": os.environ.get('WORKER_SOCKET_PROTOCOL', "ws"),
        "url": os.environ.get('WORKER_SOCKET_URL', None),
    }
    algorithm = {
        "path": "algorithm",
        "entryPoint": os.environ.get('ALGORITHM_ENTRY_POINT', "")
    }