/*
 *
 * (C) 2013 Jaakko Suutarla
 * MIT LICENCE
 *
 */

var net = require('net'),
    util = require('util'),
    os = require('os'),
    tls = require('tls'),
    fs = require('fs'),
    winston = require('winston'),
    common = require('winston/lib/winston/common');

var ECONNREFUSED_REGEXP = /ECONNREFUSED/;

var Logstash = exports.Logstash = function (options) {
  winston.Transport.call(this, options);
  options = options || {};

  this.name                = 'logstash';
  this.localhost           = options.localhost || os.hostname();
  this.host                = options.host || '127.0.0.1';
  this.port                = options.port || 28777;
  this.node_name           = options.node_name || process.title;
  this.pid                 = options.pid || process.pid;
  this.max_connect_retries = ('number' === typeof options.max_connect_retries) ? options.max_connect_retries : 4;
  this.timeout_connect_retries = ('number' === typeof options.timeout_connect_retries) ? options.timeout_connect_retries : 100;
  this.retries             = -1;

  // Support for winston build in logstash format
  // https://github.com/flatiron/winston/blob/master/lib/winston/common.js#L149
  this.logstash            = options.logstash || false;

  // SSL Settings
  this.ssl_enable          = options.ssl_enable || false;
  this.ssl_key             = options.ssl_key || '';
  this.ssl_cert            = options.ssl_cert || '';
  this.ca                  = options.ca || '';
  this.ssl_passphrase      = options.ssl_passphrase || '';
  this.rejectUnauthorized  = options.rejectUnauthorized === true;

  // Connection state
  this.log_queue           = [];
  this.connected           = false;
  this.socket              = null;

  // Miscellaneous options
  this.strip_colors        = options.strip_colors || false;
  this.label               = options.label || this.node_name;
  this.meta_defaults       = options.meta || {};

  // We want to avoid copy-by-reference for meta defaults, so make sure it's a flat object.
  for (var property in this.meta_defaults) {
    if (typeof this.meta_defaults[property] === 'object') {
      delete this.meta_defaults[property];
    }
  }

  this.connect();
};

//
// Inherit from `winston.Transport`.
//
util.inherits(Logstash, winston.Transport);

//
// Define a getter so that `winston.transports.Syslog`
// is available and thus backwards compatible.
//
winston.transports.Logstash = Logstash;

Logstash.prototype.name = 'logstash';

Logstash.prototype.log = function (level, msg, meta, callback) {
  var self = this,
      meta = winston.clone(meta || {}),
      log_entry;

  for (var property in this.meta_defaults) {
    meta[property] = this.meta_defaults[property];
  }

  if (self.silent) {
    return callback(null, true);
  }

  if (self.strip_colors) {
    msg = msg.stripColors;

    // Let's get rid of colors on our meta properties too.
    if (typeof meta === 'object') {
      for (var property in meta) {
        meta[property] = meta[property].stripColors;
      }
    }
  }

  log_entry = common.log({
    level: level,
    message: msg,
    node_name: this.node_name,
    meta: meta,
    timestamp: self.timestamp,
    json: true,
    label: this.label
  });

  if (!self.connected) {
    self.log_queue.push({
      message: log_entry,
      callback: function () {
        self.emit('logged');
        callback(null, true);
      }
    });
  } else {
    self.sendLog(log_entry, function () {
      self.emit('logged');
      callback(null, true);
    });
  }
};

Logstash.prototype.connect = function () {
  var tryReconnect = true;
  var options = {};
  var self = this;
  this.retries++;
  this.connecting = true;
  this.terminating = false;
  if (this.ssl_enable) {
    options = {
      key: this.ssl_key ? fs.readFileSync(this.ssl_key) : null,
      cert: this.ssl_cert ? fs.readFileSync(this.ssl_cert) : null,
      passphrase: this.ssl_passphrase ? this.ssl_passphrase : null,
      rejectUnauthorized: this.rejectUnauthorized === true,
      ca: this.ca ? (function (caList) {
        var caFilesList = [];

        caList.forEach(function (filePath) {
          caFilesList.push(fs.readFileSync(filePath));
        });

        return caFilesList;
      }(this.ca)) : null
    };
    this.socket = new tls.connect(this.port, this.host, options, function() {
      self.socket.setEncoding('UTF-8');
      self.announce();
      self.connecting = false;
    });
  } else {
    this.socket = new net.Socket();
  }

  this.socket.on('error', function (err) {
    self.connecting = false;
    self.connected = false;

    if (typeof(self.socket) !== 'undefined' && self.socket != null) {
      self.socket.destroy();
    }

    self.socket = null;

    if (!ECONNREFUSED_REGEXP.test(err.message)) {
      tryReconnect = false;
      self.emit('error', err);
    }
  });

  this.socket.on('timeout', function() {
    if (self.socket.readyState !== 'open') {
      self.socket.destroy();
    }
  });

  this.socket.on('connect', function () {
    self.retries = 0;
  });

  this.socket.on('close', function (had_error) {
    self.connected = false;

    if (self.max_connect_retries < 0 || self.retries < self.max_connect_retries) {
      if (!self.connecting) {
        setTimeout(function () {
          self.connect();
        }, self.timeout_connect_retries);
      }
    } else {
      self.log_queue = [];
      self.silent = true;
      self.emit('error', new Error('Max retries reached, transport in silent mode, OFFLINE'));
    }
  });

  if (!this.ssl_enable) {
    this.socket.connect(self.port, self.host, function () {
      self.announce();
      self.connecting = false;
    });
  }

};

Logstash.prototype.close = function () {
  var self = this;
  self.terminating = true;
  if (self.connected && self.socket) {
    self.connected = false;
    self.socket.end();
    self.socket.destroy();
    self.socket = null;
  }
};

Logstash.prototype.announce = function () {
  var self = this;
  self.connected = true;
  self.flush();
  if (self.terminating) {
    self.close();
  }
};

Logstash.prototype.flush = function () {
  var self = this;

  for (var i = 0; i < self.log_queue.length; i++) {
    self.sendLog(self.log_queue[i].message, self.log_queue[i].callback);
    self.emit('logged');
  }
  self.log_queue.length = 0;
};

Logstash.prototype.sendLog = function (message, callback) {
  var self = this;
  callback = callback || function () {};

  self.socket.write(message + '\n');
  callback();
};
