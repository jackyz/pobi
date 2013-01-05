var debug = require('../debug')('PROTO:HTTP')
    , net = require('net')
    , http = require('http')
    , util = require('util')
    , stream = require('stream')
    , config = require('../util/config');

var _host = config('proto', 'http', 'host') || '127.0.0.1';
var _port = config('proto', 'http', 'port') || 7070;

// ---- http client interface

function createConnection(){ // port,host,options
  var options = {};

  if (typeof arguments[0] === 'object') {
    options = arguments[0];
  } else if (typeof arguments[1] === 'object') {
    options = arguments[1];
    options.port = arguments[0];
  } else if (typeof arguments[2] === 'object') {
    options = arguments[2];
    options.port = arguments[0];
    options.host = arguments[1];
  } else {
    if (typeof arguments[0] === 'number') {
      options.port = arguments[0];
    }
    if (typeof arguments[1] === 'string') {
      options.host = arguments[1];
    }
  }
  var socks = new HttpClientSocket(_host, _port);
  return socks.connect(options.port, options.host);
};

exports.createConnection = createConnection;

// ---- http client implement

function HttpClientSocket(socks_host, socks_port) {
  stream.Stream.call(this);

  this.socket = null; // not init yet
  this.socks_host = socks_host;
  this.socks_port = socks_port;
}
util.inherits(HttpClientSocket, stream.Stream);

HttpClientSocket.prototype.setTimeout = function(msecs, callback) {
  this.socket.setTimeout(msecs, callback);
};

HttpClientSocket.prototype.setNoDelay = function() {
  this.socket.setNoDelay();
};

HttpClientSocket.prototype.setKeepAlive = function(setting, msecs) {
  this.socket.setKeepAlive(setting, msecs);
};

HttpClientSocket.prototype.address = function() {
  return this.socket.address();
};

HttpClientSocket.prototype.pause = function() {
  this.socket.pause();
};

HttpClientSocket.prototype.resume = function() {
  this.socket.resume();
};

HttpClientSocket.prototype.end = function(data, encoding) {
  return this.socket.end(data, encoding);
};

HttpClientSocket.prototype.destroy = function(exception) {
  this.socket.destroy(exception);
};

HttpClientSocket.prototype.destroySoon = function() {
  this.socket.destroySoon();
  this.writable = false; // node's http library asserts writable to be false after destroySoon
};

HttpClientSocket.prototype.setEncoding = function(encoding) {
  this.socket.setEncoding(encoding);
};

HttpClientSocket.prototype.write = function(data, arg1, arg2) {
  return this.socket.write(data, arg1, arg2);
};

HttpClientSocket.prototype.connect = function(port, host) {
  var self = this;
  var req = http.request({
    port: self._port,
    hostname: self._host,
    method: 'CONNECT',
    path: host+':'+port
  });
  req.end();
  req.on('connect', function(res, socket, head){
    self.socket = socket;
    self.establish_connection();
  });
  req.on('timeout', function(){
    self.emit('timeout');
  });
  req.on('error', function(e){
    self.emit('error',e);
  });
  return self;
};

HttpClientSocket.prototype.establish_connection = function() {
  var self = this;

  self.socket.on('data', function(data) {
    self.emit('data', data);
  });
  self.socket.on('close', function(had_error) {
    self.emit('close', had_error);
  });
  self.socket.on('end', function() {
    self.emit('end');
  });
  self.socket.on('error', function(error) {
    self.emit('error', error);
  });

  self.socket._httpMessage = self._httpMessage;
  self.socket.parser = self.parser;
  self.socket.ondata = self.ondata;
  self.writable = true;
  self.emit('connect');
};
