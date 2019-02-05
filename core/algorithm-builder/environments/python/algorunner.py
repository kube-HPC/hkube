import os
import importlib
from src.websocketClient import wc
from src.consts import messages, methods
from events import Events
import threading


class Algorunner:
    def __init__(self, options):
        self._url = None
        self._algorithm = dict()
        self._events = Events()
        self._loadAlgorithmError = None
        self._bootstrap(options)

    def _bootstrap(self, options):
        self._loadAlgorithm(options)
        self._connectToWorker(options)

    def _loadAlgorithm(self, options):
        try:
            cwd = os.getcwd()
            alg = options.algorithm
            folderName = alg["path"]
            fileName = os.path.splitext(alg["entryPoint"])[0]
            os.chdir(f'{cwd}/{folderName}')
            mod = importlib.import_module(f'.{fileName}', package=folderName)
            print('algorithm code loaded')

            for m in dir(methods):
                if not m.startswith("__"):
                    method = getattr(methods, m)
                    try:
                        self._algorithm[method] = getattr(mod, method)
                    except Exception as e:
                        print(e)

        except Exception as e:
            self._loadAlgorithmError = e
            print(e)

    def _connectToWorker(self, options):
        socket = options.socket
        if (socket["url"] is not None):
            self._url = socket["url"]
        else:
            self._url = f'{socket["protocol"]}://{socket["host"]}:{socket["port"]}'

        self._wsc = wc.WebsocketClient()
        self._registerToWorkerEvents()

        t = threading.Thread(target=self._wsc.startWS, args=(self._url, ))
        t.start()

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
            if (self._loadAlgorithmError):
                self._sendError(self._loadAlgorithmError)
            else:
                method = self._algorithm.get(methods.init)
                if (method is None):
                    raise Exception(f'unable to find method {methods.init}')
                else:
                    method(options)
                    self._wsc.send({
                        "command": messages.outgoing["initialized"]
                    })

        except Exception as e:
            self._sendError(e)

    def _start(self, options):
        try:
            self._wsc.send({"command": messages.outgoing["started"]})
            method = self._algorithm.get(methods.start)
            if (method is None):
                raise Exception(f'unable to find method {methods.start}')
            else:
                output = method(options)
                self._wsc.send({
                    "command": messages.outgoing["done"],
                    "data": output
                })

        except Exception as e:
            self._sendError(e)

    def _stop(self, options):
        try:
            method = self._algorithm.get(methods.stop)
            if (method is None):
                raise Exception(f'unable to find method {methods.stop}')
            else:
                method(options)
                self._wsc.send({"command": messages.outgoing["stopped"]})

        except Exception as e:
            self._sendError(e)

    def _exit(self, options):
        try:
            self._wsc.stopWS()
            method = self._algorithm.get(methods.exit)
            if (method is None):
                raise Exception(f'unable to find method {methods.exit}')
            else:
                method(options)

        except Exception as e:
            self._sendError(e)

    def _sendError(self, error):
        print(error)
        self._wsc.send({
            "command": messages.outgoing["error"],
            "error": {
                "code": "Failed",
                "message": str(error)
            }
        })