var debug = require('./debug')('SOCKS5')
    , url = require('url')
    , net = require('net')
    , util = require('util')
    , d = require('domain').create()
    , proto = require('./proto')
    , socks5 = require('./proto/socks5');

// ---- timeout

var connectTimeout = 2000; // 2 second
var transferTimeout = 30000; // 30 second

// ----

function serve(sock){
  var self = this;
  debug("connections:%s", self.connections);
  var usock = null;
  var buff = [];
  function close(){
    // debug('%s END', sock.remoteAddress);
    debug("connections:%s", self.connections);
    try { sock.destroy(); } catch(x){ }
    try { usock.destroy(); } catch(x){ }
  }
  function error(e){
    debug('%s ERROR %j', sock.remoteAddress, e);
    close();
  }
  function timeout(){
    debug('%s TIMEOUT', sock.remoteAddress);
    close();
  }
  function handshake(d){
    // debug('%s HANDSHAKE', sock.remoteAddress);
    sock.removeListener('data', handshake);
    sock.on('data', command);
    // todo check v5
    // todo auth
    sock.write(new Buffer([0x05, 0x00])); // socks5 noauth
  }
  function command(d){
    // debug('%s COMMAND', sock.remoteAddress);
    sock.removeListener('data', command);
    sock.on('data', await);
    // todo check v5
    var cmd = d[1];
    if (cmd == 0x01) { // connect
      connect(d);
    //} else if (cmd == 0x02) { // bind
    //} else if (cmd == 0x03) { // udp associate
    } else { // unsupport
      sock.end(new Buffer([0x05,0x07,0x00,0x01]));
      error('UNSUPPORT_CMD');
    }
  }
  function await(d){
    // debug('%s AWAIT', sock.remoteAddress);
    buff.push(d);
  }
  function connect(d){
    // debug('%s CONNECT', sock.remoteAddress);
    var address = socks5.decodeAddress(d,3);
    if(address.length < d.length) buff.push(d.slice(address.length));
    // debug("%s con %s:%s", sock.remoteAddress, address.host, address.port)
    usock = self.upstream.createConnection(address.port, address.host);
    usock.setTimeout(connectTimeout, timeout);
    usock.on('error', error);
    usock.on('end', close);
    usock.on('connect', function(){
      // debug('%s CONNECTED', sock.remoteAddress);
      // debug("%s -> %s:%s", sock.remoteAddress, address.host, address.port)
      usock.setTimeout(transferTimeout, timeout);
      usock.setNoDelay(true);
      while(buff.length) usock.write(buff.shift());
      sock.removeListener('data', await);
      sock.pipe(usock);
      // sock.setTimeout(transferTimeout, timeout);
      sock.setNoDelay(true);
      var resp = new Buffer(d.length);
      d.copy(resp);
      resp[0] = 0x05;
      resp[1] = 0x00;
      resp[2] = 0x00;
      sock.write(resp);
      usock.pipe(sock);
    });
  }
  sock.setTimeout(transferTimeout, timeout);
  // sock.setNoDelay(true);
  sock.on('error', error);
  sock.on('data', handshake);
  sock.on('end', close);
}

// ----

function start(config){
  // init
  var host = config.host || '0.0.0.0';
  var port = config.port || 7070;
  //
  var onListening = function(){
    debug("listening on %j via %j", this.address(), this.upstream.config);
  };
  var onConnection = function(sock){
    // debug("%s connect", sock.remoteAddress);
    serve.call(this, sock);
  };
  var onClose = function(){
    debug("closed %j", this.address());
  };
  var onError = function(err){
    debug("error %j", err);
  };

  d.on('error', function(e){
    // debug('ERROR', e, e.stack);
    debug('!!!! ERROR %s', e.message);
  });
  d.run(function(){
    var server = net.createServer();
    // var server = socks5.createServer();
    server.upstream = proto(config.upstream);
    server.on('listening', onListening);
    server.on('connection', onConnection);
    server.on('close', onClose);
    server.on('error', onError);
    server.listen(port);
  });
}
exports.start = start;

// ----
/*
if(!module.parent) {
  start({port:1080});
}
*/