var debug = require('debug')('PROTO:SHADOWSOCKS')
    , net = require('net')
    , stream = require('stream')
    , crypto = require('crypto')
    // , events = require('events')
    // , sprintf = require('sprintf').sprintf;
    , inherits = require('util').inherits
    , config = require('../util/config');

var _ip = config('proto', 'shadowsocks', 'ip') || '127.0.0.1';
var _port = config('proto', 'shadowsocks', 'port') || 7070;
var _pass = config('proto', 'shadowsocks', 'pass') || "cool";

var tables = genTable(_pass);

var _en_table = tables[0];
var _de_table = tables[1];

// ---- shadowsocks encode/decode

function merge_sort(array, comp){
  
  function merge(left, right) {
    var result = new Array();
    while ((left.length > 0) && (right.length > 0)) {
      if (comp(left[0], right[0]) <= 0)
        result.push(left.shift());
      else
        result.push(right.shift());
    }
    while (left.length > 0) result.push(left.shift());
    while (right.length > 0) result.push(right.shift());
    return result;
  }
  
  if (array.length < 2) return array;
  var middle = Math.ceil(array.length / 2);
  return merge(
    merge_sort(array.slice(0, middle), comp),
    merge_sort(array.slice(middle), comp)
  ); 
}

var Max = Math.pow(2,32);

function genTable(key){
  var md5 = crypto.createHash('md5');
  md5.update(key);
  var hash = new Buffer(md5.digest(), 'binary');
  var al = hash.readUInt32LE(0);
  var ah = hash.readUInt32LE(4);
  var en_table = new Array(256);
  var de_table = new Array(256);
  for(var i=0; i<256; i++){
    en_table[i] = i;
  }
  for(var i=1; i<1024; i++){
    en_table = merge_sort(en_table, function(x,y){
      return ((ah % (x + i)) * Max + al) % (x + i) - ((ah % (y + i)) * Max + al) % (y + i);
    });
  }
  for(var i=0; i<256; i++){
    de_table[en_table[i]] = i;
  }
  return [en_table, de_table];
}

function trans(table, buf){
  var buf2 = new Buffer(buf.length);
  for(var i=0; i<buf.length; i++){
    buf2[i] = table[buf[i]];
  }
  return buf2;
}

function encode(buf){
  return trans(_en_table, buf);
};
function decode(buf){
  return trans(_de_table, buf);
};

exports.encode = encode;
exports.decode = decode;

/*
var buff1 = new Buffer("abcdefg");
debug("buff1", buff1);
var buff2 = encode(buff1);
debug("buff2", buff2);
var buff3 = decode(buff2);
debug("buff3", buff3);
*/

// ---- shadowsocks client interface

function connect(port, host){
  debug("!!!! connect(%j) via %s:%s#%s", arguments, _ip, _port, _pass);
  var socks = new ShadowSocks(_ip, _port);
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

// ---- shadowsocks client implement

function ShadowSocks(host, port, pass) {
  stream.Stream.call(this);

  this.socket = new net.Socket();
  this._host = host;
  this._port = port;
  this._pass = pass;
}
//inherits(ShadowSocks, net.Socket);
//inherits(ShadowSocks, events.EventEmitter);
inherits(ShadowSocks, stream.Stream);

ShadowSocks.prototype.setTimeout = function(msecs, callback) {
  this.socket.setTimeout(msecs, callback);
};

ShadowSocks.prototype.setNoDelay = function() {
  this.socket.setNoDelay();
};

ShadowSocks.prototype.setKeepAlive = function(setting, msecs) {
  this.socket.setKeepAlive(setting, msecs);
};

ShadowSocks.prototype.address = function() {
  return this.socket.address();
};

ShadowSocks.prototype.pause = function() {
  this.socket.pause();
};

ShadowSocks.prototype.resume = function() {
  this.socket.resume();
};

ShadowSocks.prototype.end = function(data, encoding) {
  return this.socket.end(data, encoding);
};

ShadowSocks.prototype.destroy = function(exception) {
  this.socket.destroy(exception);
};

ShadowSocks.prototype.destroySoon = function() {
  this.socket.destroySoon();
  this.writable = false; // node's http library asserts writable to be false after destroySoon
};

ShadowSocks.prototype.setEncoding = function(encoding) {
  this.socket.setEncoding(encoding);
};

ShadowSocks.prototype.write = function(data, arg1, arg2) {
  return this.socket.write(data, arg1, arg2);
};

ShadowSocks.prototype.connect = function(port, host) {
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
  self.socket.connect(self._port, self._host, function() {
    self.socket.removeAllListeners(); // added
    self.establish_socks_connection(host, port);
  });
  return self;
};

ShadowSocks.prototype.establish_socks_connection = function(host, port) {
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

ShadowSocks.prototype.authenticate = function(cb) {
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

ShadowSocks.prototype.connect_socks_to_host = function(host, port, cb) {
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

    if(cb) cb();
  };

  var buffer = [];
  buffer.push(0x05);  // SOCKS version 
  buffer.push(0x01);  // command code: establish a TCP/IP stream connection
  buffer.push(0x00);  // reserved - myst be 0x00

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

  var request = new Buffer(buffer);
  this.socket.write(request);
}


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
