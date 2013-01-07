var debug = require('./debug')('SHADOW')
    , url = require('url')
    , net = require('net')
    , util = require('util')
    , d = require('domain').create()
    , proto = require('./proto')
    , shadow = require('./proto/shadow');

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
  function command(d){
    // debug('%s COMMAND', sock.remoteAddress);
    sock.removeListener('data', command);
    sock.on('data', await);
    connect(d);
  }
  function await(en){
    // debug('%s AWAIT', sock.remoteAddress);
    var d = shadow.decode(self.pass, en);
    buff.push(d);
  }
  function connect(en){
    // debug('%s CONNECT', sock.remoteAddress);
    var d = shadow.decode(self.pass, en);
    var address = shadow.decodeAddress(d,0);
    // debug('address:%j', address);
    if(address.length < d.length) buff.push(d.slice(address.length));
    // debug("connect %s:%s", address.host, address.port)
    usock = self.upstream.createConnection(address.port, address.host);
    usock.setTimeout(connectTimeout, timeout);
    usock.on('error', error);
    usock.on('end', close);
    usock.on('connect', function(){
      // debug('%s CONNECTED', sock.remoteAddress);
      // debug("%s -> %s:%s", sock.remoteAddress, address.host, address.port)
      usock.setTimeout(transferTimeout, timeout);
      usock.setNoDelay(true);
      while(buff.length) { usock.write(buff.shift()); }
      sock.removeListener('data', await);
      // sock.pipe(usock);
      sock.on('data', function(en){
        var d = shadow.decode(self.pass, en);
        // debug('->', d.toString('utf8'));
        if(!usock.write(d)) sock.pause();
      });
      sock.on('end', function(){ usock.end(); });
      sock.on('drain', function(){ usock.resume(); });
      // sock.setTimeout(transferTimeout, timeout);
      sock.setNoDelay(true);
      // usock.pipe(sock);
      usock.on('data', function(d){
        // debug('<-', d.toString('utf8'));
        var en = shadow.encode(self.pass, d);
        if(!sock.write(en)) usock.pause();
      });
      usock.on('end', function(){ sock.end(); });
      usock.on('drain', function(){ sock.resume(); });
    });
  }
  sock.setTimeout(transferTimeout, timeout);
  // sock.setNoDelay(true);
  sock.on('error', error);
  sock.on('data', command);
  sock.on('end', close);
}

// ----

function start(config){
  // init
  var port = config.port || 1070;
  var host = config.host || '0.0.0.0';
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
    server.upstream = proto(config.upstream);
    server.pass = config.pass || 'cool';
    server.on('listening', onListening);
    server.on('connection', onConnection);
    server.on('close', onClose);
    server.on('error', onError);
    server.listen(port, host);
  });
}
exports.start = start;

// ----
/*
if(!module.parent) {
  start({port:7070});
}
*/