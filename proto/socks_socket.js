var net = require('net');
var stream = require('stream');
var sprintf = require('sprintf').sprintf;
var inherits = require('util').inherits;

exports.createConnection = function(options) {
  var socksSocket = new SocksClientSocket(options.socks_host, options.socks_port);
  return socksSocket.connect(options.port, options.host);
};

function SocksClientSocket(socks_host, socks_port) {
  stream.Stream.call(this);

  this.socket = new net.Socket();
  this.socks_host = socks_host;
  this.socks_port = socks_port;
}
//inherits(SocksClientSocket, net.Socket);
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
  self.socket.connect(self.socks_port, self.socks_host, function() {
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
  var portStr = sprintf("%04d", port);
  var byte1 = parseInt(portStr.substr(0,2));
  var byte2 = parseInt(portStr.substr(2,2));

  buffer.push(byte1);
  buffer.push(byte2);
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
