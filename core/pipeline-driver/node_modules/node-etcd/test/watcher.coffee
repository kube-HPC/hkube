should = require 'should'
nock = require 'nock'

Etcd = require '../src/index'
Watcher = require '../src/watcher.coffee'

class FakeEtcd
  constructor: ->
    @stopped = false
    @cb = ->

  abort: -> {abort: => @stopped = true}

  watch: (key, options, cb) ->
    key.should.equal 'key'
    @cb = cb
    return @abort()

  watchIndex: (key, index, options, cb) ->
    key.should.equal 'key'
    @cb = cb
    return @abort()

  change: (err, val, header = {}) ->
    @cb err, val, header


describe 'Watcher', ->
  it 'should emit change on watch change', (done) ->
    etcd = new FakeEtcd
    w = new Watcher etcd, 'key'

    w.on 'change', (val) ->
      val.should.containEql { node: { modifiedIndex: 0 } }
      done()

    etcd.change null, { node: { modifiedIndex: 0 } }

  it 'should emit reconnect event on error', (done) ->
    etcd = new FakeEtcd
    w = new Watcher etcd, 'key'

    w.on 'reconnect', (err) ->
      err.should.containEql { error: "error" }
      done()

    etcd.change "error", null

  it 'should emit error if received content is invalid', (done) ->
    etcd = new FakeEtcd
    w = new Watcher etcd, 'key'
    w.on 'error', -> done()

    etcd.change null, 'invalid content', {}

  it 'should emit error object on error', (done) ->
    etcd = new FakeEtcd
    w = new Watcher etcd, 'key'
    w.on 'error', (err) ->
      err.should.be.an.instanceOf Error
      done()

    etcd.change null, 'invalid content', {}

  it 'should use provided options', (done) ->
    etcd = new FakeEtcd

    etcd.watch = (key, opt, cb) ->
      opt.should.containEql { recursive: true }
      done()

    w = new Watcher etcd, 'key', null, { recursive: true }

  it 'should emit action on event', (done) ->
    etcd = new FakeEtcd
    w = new Watcher etcd, 'key'
    w.on 'set', (res) -> done()

    etcd.change null, { action: 'set', node: { key: '/key', value: 'value', modifiedIndex: 1, createdIndex: 1 } }

  it 'should reconnect (call watch again) on error', (done) ->
    etcd = new FakeEtcd
    w = new Watcher etcd, 'key'

    etcd.watch = (key, cb) ->
      w.retryAttempts.should.equal 1
      done()

    etcd.change "error", null

  it 'should reconnect (watch again) on empty body (etcd timeout)', (done) ->
    etcd = new FakeEtcd
    w = new Watcher etcd, 'key'

    w.on 'reconnect', () ->
      done()

    etcd.change null, null, {'x-etcd-index': 123}

  it 'should call watch on next index after getting change', (done) ->
    etcd = new FakeEtcd
    w = new Watcher etcd, 'key'

    i = 5

    etcd.watchIndex = (key, index, cb) ->
      index.should.equal i + 1
      done()

    etcd.change null, { node: { modifiedIndex: i } }

  it 'should abort request when stop is called', ->
    etcd = new FakeEtcd
    w = new Watcher etcd, 'key'

    w.stop()
    etcd.stopped.should.be.true

  it 'should emit stop when stopped', (done) ->
    etcd = new FakeEtcd
    w = new Watcher etcd, 'key'

    w.on 'stop', -> done()
    w.stop()


describe 'Watcher resync', ->

  getNock = ->
    nock 'http://127.0.0.1:2379'

  it 'should resync if index is outdated and cleared', (done) ->
    getNock()
      .get('/v2/keys/key?waitIndex=0&wait=true')
      .reply(401, {
        errorCode: 401
        message: "The event in requested index is outdated and cleared"
        cause: "the requested history has been cleared [1007/4]"
        index: 2006
        })
      .get('/v2/keys/key?waitIndex=2006&wait=true')
      .reply(200, {
          action:"set"
          node:
            key: "/key"
            value: "banan"
            modifiedIndex: 2013
            createdIndex: 2013
          prevNode:
            key: "/key"
            value: "2"
            modifiedIndex: 5
            createdIndex: 5
          })
      .get('/v2/keys/key?waitIndex=2014&wait=true').reply(200,{})

    w = new Watcher (new Etcd), 'key', 0
    w.on 'change', (res) ->
      res.node.value.should.equal 'banan'
      w.stop()
      done()
