var net = require('net')
  , url = require('url')
  , http = require('http')
  , d = require('domain').create()
  , gfw = require('./gfw')
  , proto = require('./proto')
  , debug = require('./debug')('HTTP');

// ---- timeout

var CONTIMEOUT = 3000; // 3 second
var ESTTIMEOUT = 5000; // 5 second

var app = process.env.npm_config_app || 'local';

// ----

// tunnel /// https going this way
function tunnel(req, sock, head){
  var self = this;
  var host = url.parse('http://'+req.url).hostname;
  var color = (app != 'local') ? 'white' : gfw.identifyDomain(host);
  _tunnel.call(this, color, req, sock, head);
}

function _tunnel(color, req, sock, head){

  debug('%s : tunnel [%s] %s ING %s', req.ip, color, req.url, server.connections);
  var self = this;
  var o = url.parse('http://'+req.url);
  var upstream = (color == 'black') ? self.upstream : self.direct;
  var uerr = null;
  var usock = upstream.createConnection(o.port, o.hostname);

  function conEnd(e){
    if (uerr) return; else uerr = e; // do not process error again
    try { usock.destroy(); } catch(x) { }
    if (color == 'gray' && e.code == 'ETIMEOUT') {
      debug('%s : tunnel [%s] %s CON TIMEOUT RETRY', req.ip, color, req.url);
      _tunnel.call(self, 'black', req, sock, head);
    } else {
      debug('%s : tunnel [%s] %s CON FAIL %j', req.ip, color, req.url, e);
      sock.end('HTTP/1.0 500 Connect fail\r\n\r\n\r\n');
    }
  }
  function conTimeout(){
    // debug('%s : tunnel [%s] %s CON TIMEOUT', req.ip, color, req.url);
    var e = new Error('connect timeout');
    e.code = 'ETIMEOUT';
    conEnd(e);
  }
  function conError(e){
    // debug('%s : tunnel [%s] %s CON ERROR %j', req.ip, color, req.url, e);
    conEnd(e);
  }

  usock.setTimeout(CONTIMEOUT, conTimeout);
  usock.on('error', conError);
  usock.on('connect', function(){

    // connect ok, confirm the color
    gfw.identifyDomain(o.hostname, (color == 'black') ? 'black' : 'white');

    function estEnd(e){
      // debug('%s : tunnel [%s] %s DONE :%s', req.ip, color, req.url, server.connections);
      if (uerr) return; else uerr = e; // do not process error again
      try { sock.destroy(); } catch(x){ }
      try { usock.destroy(); } catch(x){ }
      if (!e) {
	debug('%s : tunnel [%s] %s EST END OK', req.ip, color, req.url);
      } else {
	debug('%s : tunnel [%s] %s EST END FAIL %j', req.ip, color, req.url, e);
      }
    }
    function estTimeout(){
      // debug('%s : tunnel [%s] %s EST TIMEOUT', req.ip, color, req.url);
      var e = new Error('timeout');
      e.code = 'ETIMEOUT';
      estEnd(e);
    }
    function estError(e){
      // debug('%s : tunnel [%s] %s EST ERROR %j', req.ip, color, req.url, e);
      estEnd(e);
    }

    debug('%s : tunnel [%s] %s EST BEGIN', req.ip, color, req.url);
    usock.removeListener('error', conError); usock.on('error', estError);
    usock.removeListener('timeout', conTimeout); usock.on('timeout', estTimeout);
    usock.setTimeout(ESTTIMEOUT);
    usock.on('end', estEnd);
    usock.setNoDelay(true);
    usock.write(head);
    sock.pipe(usock);
    sock.setTimeout(ESTTIMEOUT, estTimeout);
    sock.setNoDelay(true);
    sock.on('error', estError);
    sock.on('end', estEnd);
    sock.write('HTTP/1.1 200 Connection Established\r\n'+
      'Proxy-agent: Pobi-Http-Proxy\r\n'+
      '\r\n');
    sock.write(head);
    usock.pipe(sock);
  });
}

// ----

function proxy(req, res){
  var self = this;
  req.pause(); // pause data to prevent lost, after connect resume
  var color = (app != 'local') ? 'white' : gfw.identifyUrl(req.url);
  _proxy.call(self, color, req, res);
}

function _proxy(color, req, res){

  debug('%s : proxy [%s] %s %s ING %s', req.ip, color, req.method, req.url, server.connections);
  var self = this;
  var o = url.parse(req.url);
  // if (o.hostname == 'ocsp.digicert.com') console.dir(req.headers); // buggy
  var upstream = (color == 'black') ? self.upstream : self.direct;
  // expose ip
  // var headers = req.headers;
  // headers['X-Forwarded-Proto'] = "http";
  // if (headers['X-Forwarded-For']){
  //    headers['X-Forwarded-For'] += ', '+req.ip;
  // } else {
  //    headers['X-Forwarded-For'] = req.ip;
  // }
  var uerr = null;
  var ureq = http.request( {
    host: o.hostname,
    port: o.port,
    path: o.path,
    method: req.method,
    headers: req.headers, // headers
    agent: upstream.agent // using the upstream
    // agent: false, // using the original http
  });

  function conEnd(e){
    if (uerr) return; else uerr = e; // do not process error again
    try { ureq.abort(); } catch(x){ }
    if (color == 'gray' && e.code == 'ECONNRESET') {
      // it's a reset url
      debug('%s : proxy [%s] %s %s CON RESET RETRY', req.ip, color, req.method, req.url);
      _proxy.call(self, 'black', req, res);
    } else if (color == 'gray' && e.code == 'ETIMEOUT') {
      // it's a blackholed domain
      debug('%s : proxy [%s] %s %s CON TIMEOUT RETRY', req.ip, color, req.method, req.url);
      // gfw.identifyDomain(o.hostname, 'black');
      _proxy.call(self, 'black', req, res);
    } else {
      debug('%s : proxy [%s] %s %s CON FAIL %j', req.ip, color, req.method, req.url, e);
      res.statusCode = 500;
      res.end(e.code);
    }
  }
  function conTimeout(){
    // debug('%s : proxy [%s] %s %s CON TIMEOUT', req.ip, color, req.method, req.url);
    var e = new Error('connect timeout');
    e.code = 'ETIMEOUT'; // will trigger conError with a 'ECONNRESET'
    conEnd(e);
  }
  function conError(e){
    // debug('%s : proxy [%s] %s %s CON ERROR %j', req.ip, color, req.method, req.url, e);
    conEnd(e);
  }

  ureq.on('error', conError);
  // ureq.setTimeout(CONTIMEOUT, conTimeout); // doesn't work
  ureq.on('socket', function(socket){
    socket.once('error', conError);
    socket.setTimeout(CONTIMEOUT, conTimeout);
  });

  ureq.on('response', function(ures){

    // connect ok, confirm the color
    gfw.identifyUrl(req.url, (color == 'black') ? 'black' : 'white');
    if (req.method == 'GET') {
      ureq.end();
    } else {
      req.pipe(ureq);
      req.resume(); // when connect, resume to pipe to ureq
    }

    function estEnd(e){
      // debug('%s : proxy [%s] %s %s DONE :%s', req.ip, color, req.method, req.url, server.connections);
      if (uerr) return; else uerr = e; // do not process error again
      try { ureq.abort(); } catch(x){ }
      try { res.end(); } catch(x){ }
      if (!e) {
	debug('%s : proxy [%s] %s %s EST END OK', req.ip, color, req.method, req.url);
      } else {
	debug('%s : proxy [%s] %s %s EST END FAIL %j', req.ip, color, req.method, req.url, e);
      }
    }
    function estTimeout(){
      // debug('%s : proxy [%s] %s %s EST TIMEOUT', req.ip, color, req.method, req.url);
      var e = new Error('timeout');
      e.code = 'ETIMEOUT';
      estEnd(e);
    }
    function estError(e){
      // debug('%s : proxy [%s] %s %s EST ERROR %j', req.ip, color, req.method, req.url, e);
      estEnd(e);
    }

    // debug('%s : proxy [%s] %s %s EST BEGIN', req.ip, color, req.method, req.url);
    req.on('error', estError); // in case of client ends first
    req.pipe(ureq);
    ureq.removeListener('error', conError); ureq.on('error', estError);
    ureq.removeListener('timeout', conTimeout); ureq.on('timeout', estTimeout);
    ureq.setTimeout(ESTTIMEOUT);
    ureq.on('end', estEnd);
    ures.on('error', estError);
    ures.on('end', estEnd);
    res.statusCode = ures.statusCode;
    try {
      for(var k in ures.headers){ res.setHeader(k,ures.headers[k]); }
    } catch(x) { }
    ures.pipe(res);
  });
}

// ----

var server = null;

function start(config){
  var onListening = function(){
    debug("listening on %j via %j", this.address(), this.upstream.config);
  };
  var onRequest = function(req, res){
    var self = this;
    req.ip = req.connection.remoteAddress;
    proxy.call(this, req, res);
  };
  var onConnect = function(req, sock, head){
    var self = this;
    req.ip = req.connection.remoteAddress;
    tunnel.call(this, req, sock, head);
  };
  var onClose = function(){
    debug("closed %j", this.address());
  };
  var onError = function(err){
    debug("error %j", err);
  };

  // init
  server = http.createServer();
  server.on('listening', onListening);
  server.on('request', onRequest);
  server.on('connect', onConnect);
  server.on('close', onClose);
  server.on('error', onError);

  server.direct = proto('direct://');
  server.upstream = proto(config.upstream);

  var o = url.parse(config.listen);
  var host = o.hostname || '0.0.0.0';
  var port = o.port || 8080;

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