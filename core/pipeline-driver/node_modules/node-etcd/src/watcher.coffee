{EventEmitter} = require 'events'

# A eventemitter for watching changes on a given key for etcd.
# Emits:
#   'change' - on value change
#   'reconnect' - on errors/timeouts
#   '<etcd action>' - the etcd action that triggered the watcher (set, delete, etc)
#
#   Automatically reconnects and backs off on errors.
#
class Watcher extends EventEmitter

  constructor: (@etcd, @key, @index = null, @options = {}) ->
    @stopped = false
    @retryAttempts = 0
    @_watch()


  stop: () =>
    @stopped = true
    @request.abort()
    @emit 'stop', "Watcher for '#{@key}' aborted."


  _watch: () =>
    if @index is null
      @request = @etcd.watch @key, @options, @_respHandler
    else
      @request = @etcd.watchIndex @key, @index, @options, @_respHandler


  _error: (err) =>
    # Something went wrong, most likely on the network,
    # maybe disconnected, or similar.
    error = new Error 'Connection error, reconnecting.'
    error.error = err
    error.reconnectCount = @retryAttempts
    @emit 'reconnect', error
    @_retry()


  _missingValue: (headers) =>
    # Etcd sent us an empty response, it seems to do this when
    # it times out a watching client.
    error = new Error 'Etcd timed out watcher, reconnecting.'
    error.headers = headers
    @retryAttempts = 0
    @emit 'reconnect', error
    @_watch()


  _valueChanged: (val, headers) =>
    # Valid data received, value was changed.
    @retryAttempts = 0
    @index = val.node.modifiedIndex + 1
    @emit 'change', val, headers
    @emit val.action, val, headers if val.action?
    @_watch()


  _unexpectedData: (val, headers) =>
    # Unexpected data received
    error = new Error 'Received unexpected response'
    error.response = val;
    @emit 'error', error
    @_retry()


  _resync: (err) =>
    @index = err.error.index
    @retryAttempts = 0
    @emit 'resync', err
    @_watch()


  _respHandler: (err, val, headers) =>
    return if @stopped

    if err?.errorCode is 401 and err.error?.index?
      @_resync err
    else if err
      @_error err
    else if headers?['x-etcd-index']? and not val?
      @_missingValue headers
    else if val?.node?.modifiedIndex?
      @_valueChanged val, headers
    else
      @_unexpectedData val, headers


  _retry: () =>
    timeout = (Math.pow(2,@retryAttempts)*300) + (Math.round(Math.random() * 1000))
    setTimeout @_watch, timeout
    @retryAttempts++


exports = module.exports = Watcher
