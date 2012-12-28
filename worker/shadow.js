var debug = require('debug')('WORKER:SHADOW')
    , url = require('url')
    , net = require('net')
    , util = require('util')
    , d = require('domain').create()
    , socks5 = require('../proto/socks5')
    , shadow = require('../proto/shadow')
    , config = require('../util/config');

// ---- timeout

var connectTimeout = 2000; // 2 second
var transferTimeout = 30000; // 30 second

// ---- upstream socket

var protocol = 'direct'; // no proxy chain, just direct

var upstream = require('../proto/'+protocol);

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
  function request(en){
    sock.removeListener('data', request);
    sock.on('data', await);
    // delete sock.ondata;
    // todo check v5
    var d = shadow.decode(en);
    // debug("req", d.toString('hex'));
    var address = socks5.decodeAddress(d,0);
    var host = address.host;
    var port = address.port;
    var leng = address.length;
    // debug("req", d.slice(leng).toString('utf8'));
    if(leng < d.length) buff.push(d.slice(leng));
    // debug("REQUEST %s:%s", host, port);
    usock = upstream.connect(port, host);
    usock.on('end', close);
    usock.on('error', error);
    usock.on('connect', function(){
      // debug('%s -> %s', sock.remoteAddress, host);
      // debug('%s BEGIN', sock.remoteAddress);
      usock.setNoDelay(true);
      // usock.setTimeout(0);
      // usock.setTimeout(transferTimeout, timeout);
      // usock.pipe(sock);
      usock.on('data', function(d){
        // debug('<-', d);
        var en = shadow.encode(d);
        if(!sock.write(en)) usock.pause();
      });
      usock.on('end', function(){ sock.end(); });
      usock.on('drain', function(){ sock.resume(); });
      sock.setNoDelay(true);
      while(buff.length) usock.write(buff.shift());
      sock.removeListener('data', await);
      // sock.setTimeout(0);
      // sock.setTimeout(transferTimeout, timeout);
      // sock.pipe(usock);
      sock.on('data', function(en){
        var d = shadow.decode(en);
        // debug('->', d);
        if(!usock.write(d)) sock.pause();
      });
      sock.on('end', function(){ usock.end(); });
      sock.on('drain', function(){ usock.resume(); });
    });
    // usock.setTimeout(connectTimeout, timeout);
  }
  function await(en){
    var d = shadow.decode(en);
    buff.push(d);
  }
  sock.on('data', request);
  // sock.ondata = handshake;
  sock.on('end', close);
  sock.on('error', error);
  // sock.setTimeout(transferTimeout, timeout);
}

// ----

function start(opt){
  var port = opt.port || 7070;
  var onListening = function(){
    debug("listening on %j", this.address());
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
    server.on('listening', onListening);
    server.on('connection', onConnection);
    server.on('close', onClose);
    server.on('error', onError);
    server.listen(port);
  });
}
exports.start = start;

// ---- 

if(!module.parent) {
  start({port:7070});
}
