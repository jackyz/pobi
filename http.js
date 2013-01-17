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

  // debug('%s : tunnel [%s] %s CON ING %s', req.ip, color, req.url, server.connections);
  var self = this;
  var o = url.parse('http://'+req.url);
  var upstream = (color == 'black') ? self.upstream : self.direct;
  var usock = upstream.createConnection(o.port, o.hostname);
  var uend = null;
  var uest = false;

  function endup(e){
    if (uend) return; else uend = e || true; // do not process error again
    try { usock.destroy(); } catch(x) { }
    if (uest) {
      try { sock.destroy(); } catch(x){ }
    }
    var us = uest ? 'EST' : 'CON';
    if (!e) {
      // debug('%s : tunnel [%s] %s %s END OK', req.ip, color, req.url, us);
    } else if (!uest && color == 'gray' && e.code == 'ETIMEOUT') {
      debug('%s : tunnel [%s] %s %s TIMEOUT RETRY', req.ip, color, req.url, us);
      _tunnel.call(self, 'black', req, sock, head);
    } else {
      debug('%s : tunnel [%s] %s %s FAIL %s', req.ip, color, req.url, us, e.code);
      sock.end('HTTP/1.0 500 Connect fail\r\n\r\n\r\n');
    }
  }
  function timeout(){
    var e = new Error('connect timeout');
    e.code = 'ETIMEOUT';
    endup(e);
  }

  usock.setTimeout(CONTIMEOUT, timeout);
  usock.on('error', endup);

  usock.on('connect', function(){

    uest = true; // now connected
    // debug('%s : tunnel [%s] %s EST BEGIN', req.ip, color, req.url);

    // connect ok, confirm the color
    gfw.identifyDomain(o.hostname, (color == 'black') ? 'black' : 'white');

    usock.setTimeout(ESTTIMEOUT);
    usock.setNoDelay(true);
    usock.write(head);
    sock.pipe(usock);

    sock.setTimeout(ESTTIMEOUT, timeout);
    sock.setNoDelay(true);
    sock.on('error', endup);
    sock.on('end', endup);
    sock.write('HTTP/1.1 200 Connection Established\r\n'+
      'Proxy-agent: Pobi-Http-Proxy\r\n'+
      '\r\n');
    usock.write(head);
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
  // debug('%s : proxy [%s] %s %s CON ING %s', req.ip, color, req.method, req.url, server.connections);

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

  var uend = null;
  var uest = false;
  var ureq = http.request( {
    host: o.hostname,
    port: o.port,
    path: o.path,
    method: req.method,
    headers: req.headers, // headers
    agent: upstream.agent // using the upstream
    // agent: false, // using the original http
  });

  function endup(e){
    if (uend) return; else uend = e || true; // do not process error again
    try { ureq.abort(); } catch(x){ }
    if (uest){ try { res.end(); } catch(x){ } }
    var us = uest ? 'EST' : 'CON';
    if (!e) {
      // debug('%s : proxy [%s] %s %s %s END OK', req.ip, color, req.method, req.url, us);
    } else if (!uest && color == 'gray' && e.code == 'ECONNRESET') {
      // it's a reset url
      debug('%s : proxy [%s] %s %s %s RESET RETRY', req.ip, color, req.method, req.url, us);
      gfw.identifyDomain(o.hostname, 'black'); // prevent
      _proxy.call(self, 'black', req, res);
    } else if (!uest && color == 'gray' && e.code == 'ETIMEOUT') {
      // it's a blackholed domain
      debug('%s : proxy [%s] %s %s %s TIMEOUT RETRY', req.ip, color, req.method, req.url, us);
      _proxy.call(self, 'black', req, res);
    } else {
      debug('%s : proxy [%s] %s %s %s FAIL %s',	req.ip, color, req.method, req.url, us, e.code);
      res.statusCode = 500;
      res.end(e.code);
    }
  }
  function timeout(){
    var e = new Error('connect timeout');
    e.code = 'ETIMEOUT';
    endup(e);
  }

  // ureq.setTimeout(CONTIMEOUT, timeout); // doesn't work
  ureq.on('socket', function(socket){
    socket.setTimeout(CONTIMEOUT, timeout);
    socket.on('error', endup);
    socket.on('connect', function(){
      req.resume(); // when connect, resume to pipe to ureq
    });
  });

  ureq.on('response', function(ures){
    uest = true; // now connected
    // debug('%s : proxy [%s] %s %s EST BEGIN', req.ip, color, req.method, req.url);
    // connect ok, confirm the color
    gfw.identifyUrl(req.url, (color == 'black') ? 'black' : 'white');
    ureq.setTimeout(ESTTIMEOUT);
    req.pipe(ureq);
    try {
      res.statusCode = ures.statusCode;
      for(var k in ures.headers){ res.setHeader(k,ures.headers[k]); }
    } catch(x) { }
    ures.pipe(res);
    ures.on('error', endup);
    ures.on('end', endup);
  });

  req.on('error', endup); // in case of client ends first
  ureq.on('error', endup);
  ureq.on('end', endup);

  if (req.method == 'GET') {
    ureq.end();
  } else {
    req.pipe(ureq);
  }
}

// ----

var server = null;

function start(config){
  var onListening = function(){
    debug("listening on %s:%s",
      this.address().address, this.address().port);
    debug("  --upstream=%j", this.upstream.config);
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