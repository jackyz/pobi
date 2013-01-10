var net = require('net')
  , url = require('url')
  , http = require('http')
  , d = require('domain').create()
  , gfw = require('./gfw')
  , proto = require('./proto')
  , debug = require('./debug')('HTTP');

// ---- timeout

var connectTimeout = 2000; // 2 second
var transferTimeout = 30000; // 30 second

var app = process.env.npm_config_app || 'local';

// ----

function tunnel(req, sock, head){
  function fail(e){
    debug('%s : tunnel %s FAIL %j', req.ip, req.url, e);
    sock.end('HTTP/1.0 500 Connect fail\r\n\r\n\r\n');
  }
  var host = url.parse('http://'+req.url).hostname;
  var color = (app != 'local') ? 'white' : gfw.identifyDomain(host);
  if (color == 'white') {
    _tunnel(server.direct, req, sock, head, fail);
  } else if (color == 'black') {
    _tunnel(server.upstream, req, sock, head, fail);
  } else { // it's gray
    _tunnel(server.direct, req, sock, head, function(e){
      if (e.code == 'ETIMEOUT') {
	debug('%s : tunnel %s RETRY', req.ip, req.url);
	_tunnel(server.upstream, req, sock, head, fail);
	// there is no ECONNRESET
	// TimeOut means ip is a blackhole or normal ip temp down
	// nothing can do for now but check domain for next time
	gfw.checkDomain(host);
      } else {
	fail(e);
      }
    });
  }
}

function _tunnel(upstream, req, sock, head, fail){
  debug('%s : tunnel %s ... :%s', req.ip, req.url, server.connections);
  var o = url.parse('http://'+req.url);
  var uerr = null;
  var usock = upstream.createConnection(o.port, o.hostname);

  function conTimeout(){
    // debug('%s : tunnel %s CONN TIMEOUT', req.ip, req.url);
    try { usock.destroy(); } catch(x) { }
    uerr = new Error('connect timeout');
    uerr.code = 'ETIMEOUT';
    fail(uerr);
  }
  function conError(e){
    // debug('%s : tunnel %s CONN ERROR %j', req.ip, req.url, e);
    try { usock.destroy(); } catch(x) { }
    fail(uerr ? uerr : e);
  }

  usock.setTimeout(connectTimeout, conTimeout);
  usock.on('error', conError);

  function close(){
    // debug('%s : tunnel %s EST END', req.ip, req.url);
    // debug('%s : tunnel %s DONE :%s', req.ip, req.url, server.connections);
    try { sock.destroy(); } catch(x){ }
    try { usock.destroy(); } catch(x){ }
  }
  function timeout(){
    // debug('%s : tunnel %s EST TIMEOUT', req.ip, req.url);
    close();
  }
  function error(e){
    // debug('%s : tunnel %s EST ERROR %j', req.ip, req.url, e);
    close();
  }

  usock.on('connect', function(){
    // debug('%s : tunnel %s EST BEGIN', req.ip, req.url);
    usock.removeListener('error', conError); usock.on('error', error);
    usock.setTimeout(transferTimeout, timeout);
    usock.on('end', close);
    usock.setNoDelay(true);
    usock.write(head);
    sock.pipe(usock);
    sock.setTimeout(transferTimeout, timeout);
    sock.setNoDelay(true);
    sock.on('error', error);
    sock.on('end', close);
    sock.write('HTTP/1.0 200 Connect ok\r\n\r\n\r\n');
    usock.pipe(sock);
  });
}

// ----

function proxy(req, res){
  function fail(e){
    debug('%s : proxy %s %s FAIL %j', req.ip, req.method, req.url, e);
    res.statusCode = 500;
    res.end(e.code);
  }
  var color = (app != 'local') ? 'white' : gfw.identifyUrl(req.url);
  if (color == 'white') {
    _proxy(server.direct, req, res, fail);
  } else if (color == 'black') {
    _proxy(server.upstream, req, res, fail);
  } else { // it's gray
    _proxy(server.direct, req, res, function(e){
      if (e.code == 'ECONNRESET') {
	debug('%s : proxy %s %s RETRY', req.ip, req.method, req.url);
	_proxy(server.upstream, req, res, fail);
	// ECONNRESET means reset by gfw, mark as black
	gfw.identifyUrl(req.url, 'black');
      } else {
	fail(e);
	// TimeOut means ip is a blackhole or normal ip temp down
	// nothing can do for now, but should check domain for next time
	if (e.code == 'ETIMEOUT') gfw.checkDomain(url.parse(req.url).hostname);
      }
    });
  }
}

function _proxy(upstream, req, res, fail){
  debug('%s : proxy %s %s ... :%s', req.ip, req.method, req.url, server.connections);
  var o = url.parse(req.url);
  // expose ip
  var headers = req.headers;
  headers['X-Forwarded-Proto'] = "http";
  if (headers['X-Forwarded-For']){
    headers['X-Forwarded-For'] += ', '+req.ip;
  } else {
    headers['X-Forwarded-For'] = req.ip;
  }
  var ropts = {
    host: o.hostname,
    port: o.port,
    path: o.path,
    method: req.method,
    headers: headers, // req.headers,
    agent: upstream.agent // using the upstream
    // agent: false, // using the original http
  };
  var uerr = null;
  var ureq = http.request(ropts);

  function conTimeout(){
    // debug('%s : proxy %s %s CONN TIMEOUT', req.ip, req.method, req.url);
    uerr = new Error('connect timeout');
    uerr.code = 'ETIMEOUT'; // will trigger conError with a 'ECONNRESET'
  }
  function conError(e){
    // debug('%s : proxy %s %s CONN ERROR %j', req.ip, req.method, req.url, e);
    fail(uerr ? uerr : e);
  }

  ureq.on('error', conError);
  ureq.setTimeout(connectTimeout, conTimeout);
  ureq.end(); // manually call end // req.on('end', ureq.end);

  function timeout(){
    // debug('%s : proxy %s %s EST TIMEOUT', req.ip, req.method, req.url);
    res.statusCode = 500;
    close();
  }
  function error(e){
    // debug('%s : proxy %s %s EST ERROR %j', req.ip, req.method, req.url, e);
    res.statusCode = 500;
    close();
  }
  function close(){
    // debug('%s : proxy %s %s EST END', req.ip, req.method, req.url);
    // debug('%s : proxy %s %s DONE :%s', req.ip, req.method, req.url, server.connections);
    try { res.end(); } catch(x){ }
    try { ureq.abort(); } catch(x){ }
  }

  ureq.on('response', function(ures){
    // debug('%s : proxy %s %s EST BEGIN', req.ip, req.method, req.url);
    req.on('error', error); // in case of client ends first
    req.pipe(ureq);
    ureq.removeListener('error', conError); ureq.on('error', error);
    ureq.setTimeout(transferTimeout, timeout);
    ureq.on('end', close);
    ures.on('error', error);
    ures.on('end', close);
    res.statusCode = ures.statusCode;
    for(var k in ures.headers){ res.setHeader(k,ures.headers[k]); }
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
    req.ip = req.connection.remoteAddress;
    proxy(req, res);
  };
  var onConnect = function(req, sock, head){
    req.ip = req.connection.remoteAddress;
    tunnel(req, sock, head);
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