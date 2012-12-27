var debug = require('debug')('PROTO:SOCKS5')
    , net = require('net')
    , util = require('util')
    , stream = require('stream')
    // , events = require('events')
    // , sprintf = require('sprintf').sprintf;
    , inherits = require('util').inherits
    , config = require('../util/config');

var _ip = config('proto', 'socks5', 'ip') || '127.0.0.1';
var _port = config('proto', 'socks5', 'port') || 7070;

// debug('%s:%s selected', _ip, _port);

// ---- socks5 client interface

function connect(port, host){
  debug("!!!! connect(%j) via %s:%s", arguments, _ip, _port);
  var socks = new SocksClientSocket(_ip, _port);
  if (typeof arguments[0] == 'object') { // call by (options) params
    var opt = arguments[0];
    return socks.connect(opt.port, opt.host);
  } else { // call by (port, host) params
    var port = arguments[0];
    var host = arguments[1];
    return socks.connect(port, host);
  }
};

exports.connect = connect;

// ---- socks5 client implement

// original
// https://github.com/vially/node-socksified/blob/master/lib/socks_socket.js
// with bug fix

function SocksClientSocket(socks_host, socks_port) {
  stream.Stream.call(this);

  this.socket = new net.Socket();
  this.socks_host = socks_host;
  this.socks_port = socks_port;
}
//inherits(SocksClientSocket, net.Socket);
//inherits(SocksClientSocket, events.EventEmitter);
inherits(SocksClientSocket, stream.Stream);

SocksClientSocket.prototype.setTimeout = function(msecs, callback) {
  this.socket.setTimeout(msecs, callback);
};

SocksClientSocket.prototype.setNoDelay = function() {
  this.socket.setNoDelay();
};

SocksClientSocket.prototype.setKeepAlive = function(setting, msecs) {
  this.socket.setKeepAlive(setting, msecs);
};

SocksClientSocket.prototype.address = function() {
  return this.socket.address();
};

SocksClientSocket.prototype.pause = function() {
  this.socket.pause();
};

SocksClientSocket.prototype.resume = function() {
  this.socket.resume();
};

SocksClientSocket.prototype.end = function(data, encoding) {
  return this.socket.end(data, encoding);
};

SocksClientSocket.prototype.destroy = function(exception) {
  this.socket.destroy(exception);
};

SocksClientSocket.prototype.destroySoon = function() {
  this.socket.destroySoon();
  this.writable = false; // node's http library asserts writable to be false after destroySoon
};

SocksClientSocket.prototype.setEncoding = function(encoding) {
  this.socket.setEncoding(encoding);
};

SocksClientSocket.prototype.write = function(data, arg1, arg2) {
  return this.socket.write(data, arg1, arg2);
};

SocksClientSocket.prototype.connect = function(port, host) {
  var self = this;
  // ----
  self.socket.on('timeout', function(){
    // debug("TIMEOUT");
    self.emit('timeout');
  });
  self.socket.on('error', function(e){
    // debug("ERROR", e);
    // debug('onerror',self._events.error);
    self.emit('error',e);
  });
  // ----
  self.socket.connect(self.socks_port, self.socks_host, function() {
    self.socket.removeAllListeners(); // added
    self.establish_socks_connection(host, port);
  });
  return self;
};

SocksClientSocket.prototype.establish_socks_connection = function(host, port) {
  var self = this;

  self.authenticate(function() {
    self.connect_socks_to_host(host, port, function() {
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
    });
  });
};

SocksClientSocket.prototype.authenticate = function(cb) {
  var self = this;
  self.socket.ondata = function(d, start, end) {
    if(end - start != 2) {
      throw new Error('SOCKS authentication failed. Unexpected number of bytes received');
    }

    if(d[start] != 0x05) {
      throw new Error('SOCKS authentication failed. Unexpected SOCKS version number: ' + d[start]);
    }

    if(d[start + 1] != 0x00) {
      throw new Error('SOCKS authentication failed. Unexpected SOCKS authentication method: ' + d[start+1]);
    }

    if (cb) cb();
  };

  var request = new Buffer(3);
  request[0] = 0x05;  // SOCKS version
  request[1] = 0x01;  // number of authentication methods
  request[2] = 0x00;  // no authentication
  self.socket.write(request);
};

SocksClientSocket.prototype.connect_socks_to_host = function(host, port, cb) {
  this.socket.ondata = function(d, start, end) {
    if(d[start] != 0x05) {
      throw new Error('SOCKS connection failed. Unexpected SOCKS version number: ' + d[start]);
    }

    if(d[start+1] != 0x00) {
      var msg = get_error_message(d[start+1]);
      throw new Error('SOCKS connection failed. ' + msg);
    }

    if(d[start+2] != 0x00) {
      throw new Error('SOCKS connection failed. The reserved byte must be 0x00');
    }

    var addr = decodeAddress(d, 3);
    // debug("connected :: addr", addr);
    /*
    var address = '';
    var address_length = 0;

    switch(d[start+3]) {
      case 1:
        address = d[start+4] + '.' + d[start+5] + '.' + d[start+6] + '.' + d[start+7];
        address_length = 4;
        break;
      case 3:
        address_length = d[start+4] + 1;
        for(var i = start + 5; i < start + address_length; i++) {
          address += String.fromCharCode(d[i]);
        }
        break;
      case 4:
        address_length = 16;
        break;
      default:
        throw new Error('SOCKS connection failed. Unknown addres type: ' + d[start+3]);
    }

    var portIndex = start + 4 + address_length;
    var port = d[portIndex] * 256 + d[portIndex+1];

    var boundAddress = {
      'address':  address,
      'port':     port
    };
    */

    if(cb) cb();
  };

  var buffer = [];
  buffer.push(0x05);  // SOCKS version 
  buffer.push(0x01);  // command code: establish a TCP/IP stream connection
  buffer.push(0x00);  // reserved - myst be 0x00

  buffer = buffer.concat(encodeAddress({host:host, port:port}));
  // debug("concat", buffer);

  /*
  switch(net.isIP(host)) {
    case 0:
      buffer.push(0x03);
      parseDomainName(host, buffer);
      break;
    case 4:
      buffer.push(0x01);
      parseIPv4(host, buffer);
      break;
    case 6:
      buffer.push(0x04);
      parseIPv6(host, buffer);
      break;
  }
  parsePort(port, buffer);
  */

  var request = new Buffer(buffer);

  // debug("request", request.toString('hex'));

  this.socket.write(request);
}

// ----

// options : {host:ip, port:int}
// return : Arrray of bytes, not Buffer, need concat or toBuffer
function encodeAddress(options){

  function parseIPv4(host, buffer) {
    var groups = host.split('.');
    for(var i=0; i < groups.length; i++) {
      var ip = parseInt(groups[i]);
      buffer.push(ip);
    }
  }

  function parseIPv6(host, buffer) {
    var address = new ipv6.Address(host).canonical_form();
    var groups = address.split(':');
    for(var i=0; i < groups.length; i++) {
      var part1 = groups[i].substr(0,2);
      var part2 = groups[i].substr(2,2);

      var b1 = parseInt(part1, 16);
      var b2 = parseInt(part2, 16);

      buffer.push(b1);
      buffer.push(b2);
    }
  }

  function parseDomainName(host, buffer) {
    buffer.push(host.length);
    for(var i=0; i < host.length; i++) {
      var c = host.charCodeAt(i);
      buffer.push(c);
    }
  }

  function parsePort(port, buffer) {
    /*
    var portStr = sprintf("%04d", port);
    var byte1 = parseInt(portStr.substr(0,2));
    var byte2 = parseInt(portStr.substr(2,2));
    buffer.push(byte1);
    buffer.push(byte2);
    */
    var p = parseInt(port);
    buffer.push( (p & 0xff00) >> 8 );
    buffer.push( p & 0xff );
  }

  var host = options.host;
  var port = options.port;
  var buffer = [];
  switch(net.isIP(host)) {
    case 0:
      buffer.push(0x03);
      parseDomainName(host, buffer);
      break;
    case 4:
      buffer.push(0x01);
      parseIPv4(host, buffer);
      break;
    case 6:
      buffer.push(0x04);
      parseIPv6(host, buffer);
      break;
  }
  parsePort(port, buffer);
  // debug("encodeAddress(%j):%j", options, new Buffer(buffer).toString('hex'));
  return buffer;
}

exports.encodeAddress = encodeAddress;

// buffer : the Buffer or Array
// offset : the offset of address data. 3 for socks5
// return : {host:ip, port:int}
function decodeAddress(buffer, offset){ 
  var host = "";
  var host_len = 0;
  if (buffer[offset] == 0x01) { // ip v4
    host = util.format('%s.%s.%s.%s', buffer[offset+1], buffer[offset+2], buffer[offset+3], buffer[offset+4]);
    host_len = 4;
  } else if (buffer[offset] == 0x03) { // dns
    host = buffer.toString('utf8', offset+2, offset+2+buffer[offset+1]);
    host_len = buffer[offset+1]+1;
  } else if (buffer[offset] == 0x04) { // ip v6
    host = buffer.slice(buffer[offset+1], buffer[offset+1+16]);
    host_len = 16;
  }
  var portIndex = offset + 1 + host_len;
  var port = (buffer[portIndex] << 8) + buffer[portIndex+1];
  var result = {host:host, port:port};
  // debug("decodeAddress(%s,%s):%j", buffer.toString('hex'), offset, result);
  return result;
}

exports.decodeAddress = decodeAddress;

function get_error_message(code) {
  switch(code) {
    case 1:
      return 'General SOCKS server failure';
    case 2:
      return 'Connection not allowed by ruleset';
    case 3:
      return 'Network unreachable';
    case 4:
      return 'Host unreachable';
    case 5:
      return 'Connection refused';
    case 6:
      return 'TTL expired';
    case 7:
      return 'Command not supported';
    case 8:
      return 'Address type not supported';
    default:
      return 'Unknown status code ' + code;
  }
}

