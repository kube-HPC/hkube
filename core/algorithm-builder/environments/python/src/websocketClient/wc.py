import websocket
import json
from events import Events
try:
    import thread
except ImportError:
    import _thread as thread
import time

# TODO:
# 1) handle bytes instead of json


class WebsocketClient:
    def __init__(self):
        self.events = Events()
        self._ws = None
        self._reconnectInterval = 5
        self._active = True
        self._switcher = {
            "initialize": self.init,
            "start": self.start,
            "stop": self.stop,
            "exit": self.exit
        }

    def init(self, data):
        self.events.on_init(data)

    def start(self, data):
        self.events.on_start(data)

    def stop(self, data):
        self.events.on_stop(data)

    def exit(self, data):
        self.events.on_exit(data)

    def on_message(self, message):
        decoded = json.loads(message)
        command = decoded["command"]
        print(f'got message from worker: {command}')
        func = self._switcher.get(command)
        data = None if 'data' not in decoded else decoded["data"]
        func(data)

    def on_error(self, error):
        print(error)

    def on_close(self):
        self.events.on_disconnect()

    def on_open(self):
        self.events.on_connection()

    def send(self, message):
        print(f'sending message to worker {message["command"]}')
        self._ws.send(json.dumps(message))

    def startWS(self, url):
        websocket.enableTrace(True)
        self._ws = websocket.WebSocketApp(
            url,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close)
        self._ws.on_open = self.on_open
        while self._active:
            try:
                self._ws.run_forever()
                time.sleep(self._reconnectInterval)
            except:
                pass

    def stopWS(self):
        self._active = False
