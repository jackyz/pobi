var url = require('url')
  , net = require('net')
  , d = require('domain').create()
  , debug = require('./debug')('SOCKS5')
  , proto = require('./proto')
  , socks5 = require('./proto/socks5');

// ---- timeout

var CONTIMEOUT = 2000; // 2 second
var ESTTIMEOUT = 4000; // 4 second

// ----

function serve(sock){

  // debug("connections:%s", self.connections);

  var self = this;
  var uhost = null;
  var uport = null;
  var usock = null;
  var uest = false;
  var uend = null;
  var stage = 0;
  var ubuff = [];

  function endup(e){
    if (uend) return; else uend = e || true; // do not process error again
    try { usock.destroy(); } catch(x){ }
    // TODO retry other link
    if (uest) { try { sock.destroy(); } catch(x){ } }
    var us = uest ? 'EST' : 'CON';
    if (!e) {
      // debug("%s -> %s:%s %s END OK",sock.remoteAddress, uhost, uport, us);
    } else {
      debug("%s -> %s:%s %s END FAIL %j", sock.remoteAddress, uhost, uport, us, e.code);
    }
  }
  function timeout(){
    var e = new Error();
    e.code = 'ETIMEOUT';
    endup(e);
  }

  function onData(d){
    if (stage == 0){
      handshake(d);
    } else if (stage == 1) {
      command(d);
    } else if (stage == 2) {
      await(d);
    } else if (stage == 3) {
      // connected , noop
    } else {
      var e = new Error('unknow stat');
      e.code = 'UNKNOWN_USTAT';
      debug(e);
    }
  }

  function handshake(d){
    // debug('%s HANDSHAKE', sock.remoteAddress);
    stage = 1; // next stage is command
    // todo check v5
    // todo auth
    sock.write(new Buffer([0x05, 0x00])); // socks5 noauth
  }

  function command(d){
    // debug('%s COMMAND', sock.remoteAddress);
    // todo check v5
    var cmd = d[1];
    if (cmd == 0x01) { // connect
      connect(d);
    //} else if (cmd == 0x02) { // bind
    //} else if (cmd == 0x03) { // udp associate
    } else { // unsupport
      sock.end(new Buffer([0x05,0x07,0x00,0x01]));
      var e = new Error('UNSUPPORT_CMD');
      e.code = 'EUNKNOWN_CMD';
      endup(e);
    }
  }

  function await(d){
    // debug('%s AWAIT', sock.remoteAddress);
    ubuff.push(d);
  }

  function connect(d){
    stage = 2; // next stage is await

    var address = socks5.decodeAddress(d,3);
    uhost = address.host;
    uport = address.port;
    if(address.length < d.length) ubuff.push(d.slice(address.length));

    // debug("%s -> %s:%s CON ING", sock.remoteAddress, uhost, uport)

    usock = self.upstream.createConnection(uport, uhost);
    usock.on('error', endup);
    usock.on('end', endup);
    usock.setTimeout(CONTIMEOUT, timeout);

    usock.on('connect', function(){
      uest = true; // est

      // debug("%s -> %s:%s EST BEGIN", sock.remoteAddress, uhost, uport);

      usock.setTimeout(ESTTIMEOUT, timeout);
      usock.setNoDelay(true);

      // flush the buff if any
      while(ubuff.length){
	var da = ubuff.shift();
	var r = usock.write(da);
        // debug('-> %s %s', da.toString('utf8'), r);
      }

      stage = 3; // next stage is noop
      sock.pipe(usock);
      var resp = new Buffer(d.length);
      d.copy(resp);
      resp[0] = 0x05;
      resp[1] = 0x00;
      resp[2] = 0x00;
      sock.write(resp);
      usock.pipe(sock);
    });
  }

  sock.on('data', onData);
  sock.on('error', endup);
  sock.on('end', endup);
  sock.setTimeout(ESTTIMEOUT, timeout);
  sock.setNoDelay(true);
}

// ----

var server = null;

function start(config){
  var onListening = function(){
    debug("listening on %s:%s",
      this.address().address, this.address().port);
    debug("  --upstream=%s", this.upstream.config);
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

  // init
  server = net.createServer();
  server.on('listening', onListening);
  server.on('connection', onConnection);
  server.on('close', onClose);
  server.on('error', onError);

  server.upstream = proto(config.upstream);

  var o = url.parse(config.listen);
  var host = o.hostname || '0.0.0.0';
  var port = o.port || 7070;

  d.on('error', function(e){
    // debug('ERROR', e, e.stack);
    debug('!!!! ERROR %s', e.message);
  });
  d.run(function(){
    server.listen(port, host);
  });
}
exports.start = start;

function stop(){
  server.close();
}
exports.stop = stop;
