var url = require('url')
  , net = require('net')
  , d = require('domain').create()
  , debug = require('./debug')('SHADOW')
  , proto = require('./proto')
  , shadow = require('./proto/shadow');

// ---- timeout

var CONTIMEOUT = 2000; // 2 second
var ESTTIMEOUT = 4000; // 4 second

// ----

function serve(sock){

  // debug("connections:%s", self.connections);

  var self = this;
  var uhost = null; // up host
  var uport = null; // up port
  var usock = null; // up sock
  var uest = false;
  var uend = null;  // end
  var ubuff = [];   // buff
  var stage = 0;    // stage

  function endup(e){
    if (uend) return; else uend = e || true; // do not process error again
    try { usock.destroy(); } catch(x){ }
    // TODO retry other link
    if (uest) { try { sock.destroy(); } catch(x){ } }
    var us = uest ? 'EST' : 'CON';
    if (!e) {
      // debug("%s -> %s:%s %s END OK", sock.remoteAddress, uhost, uport, us);
    } else {
      debug("%s -> %s:%s %s END FAIL %j", sock.remoteAddress, uhost, uport, us, e.code);
    }
  }
  function timeout(){
    var e = new Error('timeout');
    e.code = 'ETIMEOUT';
    endup(e);
  }

  function onData(d){
    if (stage == 0){
      connect(d);
    } else if (stage == 1) {
      wait(d);
    } else if (stage == 2) {
      // connected , noop
    } else {
      var e = new Error('unknow stat');
      e.code = 'UNKNOWN_USTAT';
      debug(e);
    }
  }

  function connect(en){
    stage = 1; // next stage is wait

    var d = shadow.decode(self.pass, en);
    // debug("READ %s", d.toString('hex'));
    var address = shadow.decodeAddress(d,0);
    uhost = address.host;
    uport = address.port;
    if(address.length < d.length) ubuff.push(d.slice(address.length));

    // debug("%s -> %s:%s CON ING", sock.remoteAddress, uhost, uport);

    // sock.pause(); // hold data first, due not connected

    usock = self.upstream.createConnection(uport, uhost);
    usock.on('error', endup);
    usock.on('end', endup);
    usock.on('timeout', timeout);
    usock.setTimeout(CONTIMEOUT);

    usock.on('connect', function(){
      uest = true; // est

      // debug("%s -> %s:%s EST BEGIN", sock.remoteAddress, uhost, uport);

      usock.setTimeout(ESTTIMEOUT);
      usock.setNoDelay(true);

      // flush the buff if any
      while(ubuff.length){
	var d = ubuff.shift();
	var r = usock.write(d);
        // debug('-> %s %s', d.toString('utf8'), r);
      }

      stage = 2; // next stage is noop
      // sock.resume();
      // ** sock.pipe(usock);
      sock.on('data', function(en){
        var d = shadow.decode(self.pass, en);
	var r = usock.write(d);
        if (!r) usock.pause();
        // debug('-> %s %s', d.toString('utf8'), r);
      });
      sock.on('end', function(){ usock.end(); });
      sock.on('drain', function(){ usock.resume(); });

      // ** usock.pipe(sock);
      usock.on('data', function(d){
        var en = shadow.encode(self.pass, d);
	var r = sock.write(en);
        if(!r) usock.pause();
	// debug('<- %s %s', d.toString('utf8'), r);
      });
      usock.on('end', function(){ sock.end(); });
      usock.on('drain', function(){ sock.resume(); });
      /*
      usock.on('drain', function(){
	sock.resume();
	var d = ubuff.shift();
	if (!d) {
	  sock.resume();
	} else {
	  debug('-> %s', d.toString('utf8'));
	  if (!usock.write(d)) sock.pause();
	}
      });
      usock.emit('drain');
       */
    });
  }

  function wait(en){
    // debug('%s WAIT CON', sock.remoteAddress);
    var d = shadow.decode(self.pass, en);
    // debug("READ %s", d.toString('hex'));
    ubuff.push(d);
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
    debug("listening on %j [%s] via %j", this.address(), this.pass, this.upstream.config);
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
  server.pass = o.auth || 'cool';
  var host = o.hostname || '0.0.0.0';
  var port = o.port || 1070;
  //

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
