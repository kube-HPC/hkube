import imp
import sys
import os
from .websocketClient import wc
from .consts import messages, methods
from events import Events


class Algorunner:
    def __init__(self, options):
        self._url = None
        self._algorithm = dict()
        self._events = Events()
        self._bootstrap(options)

    def _bootstrap(self, options):
        self._loadAlgorithm(options)
        self._connectToWorker(options)

    def _loadAlgorithm(self, options):
        cwd = os.getcwd()
        alg = options.algorithm
        entryPoint = f'{cwd}/src/{alg["path"]}/{alg["entryPoint"]}'
        try:
            mod = imp.load_source('algorithm', entryPoint)
            for method in dir(methods):
                if not method.startswith("__"):
                    self._algorithm[method] = getattr(mod, method)

        except Exception as e:
            self._sendError(e)

    def _connectToWorker(self, options):
        socket = options.socket
        if (socket["url"] is not None):
            self._url = socket["url"]
        else:
            self._url = f'{socket["protocol"]}://{socket["host"]}:{socket["port"]}'

        self._wsc = wc.WebsocketClient()
        self._registerToWorkerEvents()
        self._wsc.startWS(self._url)

    def _registerToWorkerEvents(self):
        self._wsc.events.on_connection += self._connection
        self._wsc.events.on_disconnect += self._disconnect
        self._wsc.events.on_init += self._init
        self._wsc.events.on_start += self._start
        self._wsc.events.on_stop += self._stop
        self._wsc.events.on_exit += self._exit

    def _connection(self):
        print(f'connected to {self._url}')

    def _disconnect(self):
        print(f'disconnected from {self._url}')

    def _init(self, options):
        try:
            self._algorithm[methods.init](options)
            self._wsc.send({"command": messages.outgoing["initialized"]})

        except Exception as e:
            self._sendError(e)

    def _start(self, options):
        try:
            self._wsc.send({"command": messages.outgoing["started"]})
            output = self._algorithm[methods.start]()
            self._wsc.send({
                "command": messages.outgoing["done"],
                "data": output
            })

        except Exception as e:
            self._sendError(e)

    def _stop(self, options):
        try:
            self._algorithm[methods.stop]()
            self._wsc.send({"command": messages.outgoing["stopped"]})

        except Exception as e:
            self._sendError(e)

    def _exit(self, options):
        try:
            self._algorithm[methods.stop]()
            self._wsc.send({"command": messages.outgoing["stopped"]})

        except Exception as e:
            self._sendError(e)

    def _sendError(self, error):
        print(error)
        self._wsc.send({
            "command": messages.outgoing["error"],
            "error": {
                "code": "Failed",
                "message": error
            }
        })