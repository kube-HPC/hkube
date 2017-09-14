# node-etcd

A nodejs library for [etcd](http://github.com/coreos/etcd), written in coffee-script.

[![NPM](https://nodei.co/npm/node-etcd.png?downloads=true&stars=true)](https://nodei.co/npm/node-etcd/)

Travis-CI: [![Build Status](https://travis-ci.org/stianeikeland/node-etcd.png?branch=master)](https://travis-ci.org/stianeikeland/node-etcd)

## Install

For nodejs >= 0.10 and iojs:

```
$ npm install node-etcd
```

For nodejs == 0.8:

```
$ npm install node-etcd@3.0.2
```

## Changes

- 5.1.0
  - Upgrade deasync dep (caused build problems on newer node) #67 / @jefflembeck
  - Upgrade request dep (security vulnerability) #71 / @esatterwhite
  - Sync functions no longer mutate input opts.
- 5.0.3
  - Fix bug #56 (exception when calling mkdir with no options or callback)
- 5.0.2
  - Update deasync dependency, possible fix for #47.
- 5.0.1
  - Was forced to publish 5.0.0 as 5.0.1 because of previous beta tag.
- 5.0.0
  - Supports basic auth, timeout, etc. See options.
  - **Breaking**: Constructor changes (see below)
  - **Breaking**: Must provide https url to use https
  - **Breaking**: Uses new default port 2379.
- 4.2.1
  - Newer deasync fixes issues with iojs 3.3.0 and nodejs 4.0.0.
- 4.1.0
  - Bumps [request](https://github.com/request/request) library version to
  v2.60.0, this solves an issue with HTTP proxies. `HTTP_PROXY` and `NO_PROXY`
  env variables should now work as expected for all requests. See issue #40
- 4.0.2
  - 307 redirects from etcd 0.4.x clusters when using SSL didn't work properly
  because of a change in the underlying request library. See issue #39
- 4.0.1
  - Minor fixes for syncronous operations, better handling of server failure.
- 4.0.0
  - Adds support for synchronous operations (@brockwood) - See
    [Synchronous Operations](#synchronous-operations).
  - Adds support for iojs.
  - Drops support for nodejs 0.8 (use v3.x.x).
  - Upgrade dependencies.
- 3.0.2 - Handle cluster leader election periods better (etcd will disconnect us
  and reject new connections until a new leader is chosen). The client will now
  retry 3 times with exp backoff if it believes a cluster election is in
  progress. Retry count is controllable via the `{ maxRetries: x }` option for a
  request. (npm failed on me and I had to publish as 3.0.2)
- 3.0.0 - Added cluster support, library now accepts a list of servers to
  connect to, see constructor changes below. All requests now return a
  cancellation token, meaning you can cancel requests by calling .cancel() or
  .abort(). This release might break something if you've previously depended on
  the leaky abstraction to the request library (request object from request
  library was returned on all api calls - this has been replaced by the
  cancellation token - the current request is still available under .req on the
  token if you really need it.).
- 2.1.5 - Watcher: try to resync if etcd reports cleared index
- 2.1.4 - Don't wait before reconnecting if Etcd server times out our watcher.
- 2.1.3 - Etcd sends an empty response on timeout in recent versions. Parsing
  the empty message caused watcher to emit error. Now it reconnects instead.
- 2.1.2 - Exponential backoff (retry), fix spinning reconnect on error. (@ptte)
- 2.1.1 - Increase request pool.maxSockets to 100
- 2.1.0 - Use proper error objects instead of strings for errors.
- 2.0.10 - Fix error in documentation
- 2.0.9 - Added .post() alias of .create(). Added .compareAndDelete() (for etcd v0.3.0)
- 2.0.8 - Watchers can be canceled. In-order keys using #create(). Raw requests using #raw().
- 2.0.7 - Avoid calling callback if callback not given.
- 2.0.6 - Refactoring, fix responsehandler error.
- 2.0.5 - Undo use of 'x-etcd-index', this refers to global state.
- 2.0.4 - Use 'x-etcd-index' for index when watching a key.
- 2.0.3 - Watcher supports options. Watcher emits etcd action type.
- 2.0.2 - Mkdir and rmdir. Fix watcher for v2 api.
- 2.0.1 - Watch, delete and stats now use new v2 api. Added testAndSet convenience method.
- 2.0.0 - Basic support for etcd protocol v2. set, get, del now supports options.
- 0.6.1 - Fixes issue #10, missing response caused error when server connection failed / server responded incorrectly.
- 0.6.0 - Watcher now emits 'error' on invalid responses.

## Basic usage

```javascript
var Etcd = require('node-etcd');
var etcd = new Etcd();
etcd.set("key", "value");
etcd.get("key", console.log);
```

Callbacks follows the default (error, result) nodejs convention:

```javascript
function callback(err, res) {
    console.log("Error: ", err);
    console.log("Return: ", res);
}
etcd.get("key", callback);
// Error: null
// Return: { action: 'get', node: { key: '/key', value: 'value', modifiedIndex: 4, createdIndex: 4 } }
```

## Methods

### Etcd(hosts = ['127.0.0.1:2379'], [options])

Create a new etcd client for a single host etcd setup

```javascript
etcd = new Etcd();
etcd = new Etcd("127.0.0.1:2379");
etcd = new Etcd("http://127.0.0.1:2379");
etcd = new Etcd("https://127.0.0.1:2379");
etcd = new Etcd(["http://127.0.0.1:2379"]);
```

### Etcd(hosts, [options])

Create a new etcd client for a clustered etcd setup. Client will connect to
servers in random order. On failure it will try the next server. When all
servers have failed it will callback with error. If it suspects the cluster is
in leader election mode it will retry up to 3 times with exp backoff. Number of
retries can be controlled by adding `{ maxRetries: x }` as an option to requests.

```javascript
etcd = new Etcd(['127.0.0.1:2379','192.168.1.1:2379']);
etcd = new Etcd(['http://127.0.0.1:2379','http://192.168.1.1:2379']);
```

### .set(key, value = null, [options], [callback])

Set key to value, or create key/directory.

```javascript
etcd.set("key");
etcd.set("key", "value");
etcd.set("key", "value", console.log);
etcd.set("key", "value", { ttl: 60 }, console.log);
etcd.set("key", "value", { maxRetries: 3 }, console.log);
```

Available options include:

- `ttl` (time to live in seconds)
- `prevValue` (previous value, for compare and swap)
- `prevExist` (existance test, for compare and swap)
- `prevIndex` (previous index, for compare and swap)

Will create a directory when used without value (value=null): `etcd.set("directory/");`

### .compareAndSwap(key, value, oldvalue, [options], [callback])

Convenience method for test and set (set with {prevValue: oldvalue})

```javascript
etcd.compareAndSwap("key", "newvalue", "oldvalue");
etcd.compareAndSwap("key", "newValue", "oldValue", options, console.log);
```

Alias: `.testAndSet()`

### .get(key, [options], [callback])

Get a key or path.

```javascript
etcd.get("key", console.log);
etcd.get("key", { recursive: true }, console.log);
```

Available options include:

- `recursive` (bool, list all values in directory recursively)
- `wait` (bool, wait for changes to key)
- `waitIndex` (wait for changes after given index)

### .del(key, [options], [callback])

Delete a key or path

```javascript
etcd.del("key");
etcd.del("key", console.log);
etcd.del("key/", { recursive: true }, console.log);
```

Available options include:

- `recursive` (bool, delete recursively)

Alias: `.delete()`

### .compareAndDelete(key, oldvalue, [options], [callback])

Convenience method for test and delete (delete with {prevValue: oldvalue})

```javascript
etcd.compareAndDelete("key", "oldvalue");
etcd.compareAndDelete("key", "oldValue", options, console.log);
```

Alias: `.testAndDelete()`

### .mkdir(dir, [options], [callback])

Create a directory

```javascript
etcd.mkdir("dir");
etcd.mkdir("dir", console.log);
etcd.mkdir("dir/", options, console.log);
```

### .rmdir(dir, [options], [callback])

Remove a directory

```javascript
etcd.rmdir("dir");
etcd.rmdir("dir", console.log);
etcd.rmdir("dir/", { recursive: true }, console.log);
```

Available options include:

- `recursive` (bool, delete recursively)

### .create(path, value, [options], [callback])

Atomically create in-order keys.

```javascript
etcd.create("queue", "first")
etcd.create("queue", "next", console.log)
```

Alias: `.post()`

### .watch(key, [options], [callback])

This is a convenience method for get with `{wait: true}`.

```javascript
etcd.watch("key");
etcd.watch("key", console.log);
```

The watch command is pretty low level, it does not handle reconnects or
timeouts (Etcd will disconnect you after 5 minutes). Use the `.watcher()` below
if you do not wish to handle this yourself.

### .watchIndex(key, index, [options], callback)

This is a convenience method for get with `{wait: true, waitIndex: index}`.

```javascript
etcd.watchIndex("key", 7, console.log);
```

See `.watch()` above.

### .watcher(key, [index], [options])

Returns an eventemitter for watching for changes on a key

```javascript
watcher = etcd.watcher("key");
watcher.on("change", console.log); // Triggers on all changes
watcher.on("set", console.log);    // Triggers on specific changes (set ops)
watcher.on("delete", console.log); // Triggers on delete.
watcher2 = etcd.watcher("key", null, {recursive: true});
watcher2.on("error", console.log);
```

You can cancel a watcher by calling `.stop()`.

Signals:
- `change` - emitted on value change
- `reconnect` - emitted on reconnect
- `error` - emitted on invalid content
- `<etcd action>` - the etcd action that triggered the watcher (ex: set, delete).
- `stop` - watcher was canceled.
- `resync` - watcher lost sync (server cleared and outdated the index).

It will handle reconnects and timeouts for you, it will also resync (best
effort) if it loses sync with Etcd (Etcd only keeps 1000 items in its event
history - for high frequency setups it's possible to fall behind).

Use the `.watch()` command in you need more direct control.

### .raw(method, key, value, options, callback)

Bypass the API and do raw queries.
Method must be one of: PUT, GET, POST, PATCH, DELETE

```javascript
etcd.raw("GET", "v2/stats/leader", null, {}, callback)
etcd.raw("PUT", "v2/keys/key", "value", {}, callback)
```

Remember to provide the full path, without any leading '/'

### .machines(callback)

Returns information about etcd nodes in the cluster

```javascript
etcd.machines(console.log);
```

### .leader(callback)

Return the leader in the cluster

```javascript
etcd.leader(console.log);
```

### .leaderStats(callback)

Return statistics about cluster leader

```javascript
etcd.leaderStats(console.log);
```

### .selfStats(callback)

Return statistics about connected etcd node

```javascript
etcd.selfStats(console.log);
```

## Synchronous operations

The library supports a set of basic synchronous/blocking operations that can be useful during
program startup (used like [fs.readFileSync](http://nodejs.org/api/fs.html#fs_fs_readfilesync_filename_options)).

Synchronous functions perform the etcd request immediately (blocking) and return the following:

```javascript
{
  err // Error message or null if request completed successfully
  body // Body of the message or null if error
  headers // Headers from the response
}
```

### .setSync(key, value = null, [options])

Synchronously set key to value, or create key/directory.

```javascript
etcd.setSync("key");
etcd.setSync("key", "value");
etcd.setSync("key", "value", { ttl: 60 });
etcd.setSync("key", "value", { maxRetries: 3 });
```

Same options and function as .set().

### .getSync(key, [options])

Get a key or path.

```javascript
etcd.getSync("key");
etcd.getSync("key", { recursive: true });
```

### .delSync(key, [options])

Synchronously delete a key or path

```javascript
etcd.delSync("key");
etcd.delSync("key/", { recursive: true });
```

The available options are the same as .del() above.

### .mkdirSync(dir, [options])

Synchronously create a directory

```javascript
etcd.mkdirSync("dir");
etcd.mkdirSync("dir/", options);
```

### .rmdirSync(dir, [options])

Synchronously remove a directory

```javascript
etcd.rmdirSync("dir");
etcd.rmdirSync("dir/", { recursive: true });
```

The available options are the same as .rmdir() above.

## Aborting a request

All async requests will return a cancellation token, to abort a request, do
the following:

```javascript
var token = etcd.get("key", console.log);
token.abort() // also aliased as token.cancel()

console.log("Request is cancelled: ", token.isAborted());
```

Note that there are no guarantees that aborted write operations won't have
affected server state before they were aborted. They only guarantee here is that
you won't get any callbacks from the request after calling `.abort()`.

## SSL support

Provide `ca`, `cert`, `key` as options. Remember to use `https`-url.

```javascript
var fs = require('fs');

var options = {
    ca:   fs.readFileSync('ca.pem'),
    cert: fs.readFileSync('cert.pem'),
    key:  fs.readFileSync('key.pem')
};

var etcdssl = new Etcd("https://localhost:2379", options);
```

## Basic auth

Pass a hash containing username and password as auth option to use basic auth.

```javascript
var auth = {
    user: "username",
    pass: "password"
};

var etcd = new Etcd("localhost:2379", { auth: auth });
```

## Constructor options

Pass in a hash after server in the constructor to set options. Some useful constructor options include:

- `timeout` - Integer request timeout in milliseconds to wait for server response.
- `ca` - Ca certificate
- `cert` - Client certificate
- `key` - Client key
- `passphrase` - Client key passphrase
- `auth` - A hash containing `{user: "username", pass: "password"}` for basic auth.

```javascript
var etcd = new Etcd("127.0.0.1:2379", { timeout: 1000, ... });'
```

## Debugging

Nodejs `console.log`/`console.dir` truncates output to a couple of levels -
often hiding nested errors. Use `util.inspect` to show inner errors.

```javascript
etcd.get('key', function(err, val) {
    console.log(require('util').inspect(err, true, 10));
});

//{ [Error: All servers returned error]
//  [stack]: [Getter/Setter],
//  [message]: 'All servers returned error',
//  errors:
//   [ { server: 'https://localhost:2379',
//       httperror:
//        { [Error: Hostname/IP doesn't match certificate's altnames: "Host: localhost. is not cert's CN: undefined"]
//          [stack]: [Getter/Setter],
//          [message]: 'Hostname/IP doesn\'t match certificate\'s altnames: "Host: localhost. is not cert\'s CN: undefined"',
//          reason: 'Host: localhost. is not cert\'s CN: undefined',
//          host: 'localhost.',
//          cert:
//           { subject: { C: 'USA', O: 'etcd-ca', OU: 'CA' },
//             issuer: { C: 'USA', O: 'etcd-ca', OU: 'CA' } } },
//       httpstatus: undefined,
//       httpbody: undefined,
//       response: undefined,
//       timestamp: Sun Dec 27 2015 23:05:15 GMT+0100 (CET) },
//     [length]: 1 ],
//  retries: 0 }
```

## FAQ:

- Are there any order of execution guarantees when doing multiple requests without using callbacks?
    - No, order of execution is up to NodeJS and the network. Requests run from a connection pool, meaning that if one request is delayed for some reason they'll arrive at the server out of order. Use callbacks (and maybe even a nice [async](https://github.com/caolan/async) callback handling library for convenient syntax) if ordering is important to prevent race conditions.
