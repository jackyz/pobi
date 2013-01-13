var net = require('net')
  , url = require('url')
  , http = require('http')
  , d = require('domain').create()
  , gfw = require('./gfw')
  , proto = require('./proto')
  , debug = require('./debug')('HTTP');

// ---- timeout

var connectTimeout = 2000; // 2 second
var transferTimeout = 5000; // 5 second

var app = process.env.npm_config_app || 'local';

// ----

// tunnel /// https going this way
function tunnel(req, sock, head){
  var host = url.parse('http://'+req.url).hostname;
  var color = (app != 'local') ? 'white' : gfw.identifyDomain(host);
  debug('%s : tunnel [%s] %s ... %s', req.ip, color, req.url, server.connections);
  function endup(e){
    if (e){
      debug('%s : tunnel [%s] %s FAIL %j', req.ip, color, req.url, e);
      sock.end('HTTP/1.0 500 Connect fail\r\n\r\n\r\n');
    } else {
      debug('%s : tunnel [%s] %s OK', req.ip, color, req.url);
    }
  }
  if (color == 'black') {
    _tunnel(server.upstream, req, sock, head, endup);
  } else if (color == 'white') {
    _tunnel(server.direct, req, sock, head, endup);
  } else { // i don't know, call it gray
    _tunnel(server.direct, req, sock, head, function(e){
      if (!e) {
	// if direct success, mark as white to speed up
	gfw.identifyDomain(host, 'white');
	endup();
      } else if (e.code == 'ETIMEOUT') {
	// seems there is no ECONNRESET
	// TimeOut means ip is a blackhole or normal server down
	// retry via upstream if ok, mark as black
	debug('%s : tunnel [%s] %s TIMEOUT RETRY', req.ip, color, req.url);
	color = 'black';
	_tunnel(server.upstream, req, sock, head, function(e){
	  if (!e) {
	    // if ok now, it's a blackhole, tell dns to skip it
	    gfw.identifyDomain(host, 'black');
	    endup();
	  } else {
	    // if same error, could be normal server down
	    endup(e);
	  }
	});
      } else {
	endup(e);
      }
    });
  }
}

function _tunnel(upstream, req, sock, head, callback){
  // debug('%s : tunnel %s ... :%s', req.ip, req.url, server.connections);
  var o = url.parse('http://'+req.url);
  var uerr = null;
  var usock = upstream.createConnection(o.port, o.hostname);

  function conTimeout(){
    // debug('%s : tunnel %s CONN TIMEOUT', req.ip, req.url);
    try { usock.destroy(); } catch(x) { }
    uerr = new Error('connect timeout');
    uerr.code = 'ETIMEOUT';
    callback(uerr);
  }
  function conError(e){
    // debug('%s : tunnel %s CONN ERROR %j', req.ip, req.url, e);
    try { usock.destroy(); } catch(x) { }
    callback(uerr ? uerr : e);
  }

  usock.setTimeout(connectTimeout, conTimeout);
  usock.on('error', conError);

  usock.on('connect', function(){

    function close(){
      // debug('%s : tunnel %s EST END', req.ip, req.url);
      // debug('%s : tunnel %s DONE :%s', req.ip, req.url, server.connections);
      try { sock.destroy(); } catch(x){ }
      try { usock.destroy(); } catch(x){ }
      callback();
    }
    function timeout(){
      // debug('%s : tunnel %s EST TIMEOUT', req.ip, req.url);
      close();
    }
    function error(e){
      // debug('%s : tunnel %s EST ERROR %j', req.ip, req.url, e);
      close();
    }

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
  var color = (app != 'local') ? 'white' : gfw.identifyUrl(req.url);
  debug('%s : proxy [%s] %s %s ... %s', req.ip, color, req.method, req.url, server.connections);
  function endup(e){
    if(e){
      debug('%s : proxy [%s] %s %s FAIL %j', req.ip, color, req.method, req.url, e);
      res.statusCode = 500;
      res.end(e.code);
    } else {
      debug('%s : proxy [%s] %s %s OK', req.ip, color, req.method, req.url);
    }
  }
  if (color == 'black') {
    _proxy(server.upstream, req, res, endup);
  } else if (color == 'white') {
    _proxy(server.direct, req, res, endup);
  } else { // i don't know, call it gray
    _proxy(server.direct, req, res, function(e){
      if (!e) {
	// gfw.identifyUrl(req.url, 'white'); // do not mark to save memory
	endup();
      } else if (e.code == 'ECONNRESET') {
	// ECONNRESET means reset by gfw
	debug('%s : proxy [%s] %s %s RESET RETRY', req.ip, color, req.method, req.url);
	gfw.identifyUrl(req.url, 'black');
	color = 'black';
	_proxy(server.upstream, req, res, endup);
      } else if (e.code == 'ETIMEOUT') {
	// ETIMEOUT means ip was block or normal server down
	debug('%s : proxy [%s] %s %s TIMEOUT RETRY', req.ip, color, req.method, req.url);
	color = 'black';
	_proxy(server.upstream, req, res, function(e){
	  if (!e) {
	    var d = url.parse(req.url).hostname;
	    gfw.identifyDomain(d, 'black');
	    endup();
	  } else {
	    endup(e);
	  }
	});
      }
    });
  }
}

function _proxy(upstream, req, res, callback){
  // debug('%s : proxy %s %s ... :%s', req.ip, req.method, req.url, server.connections);
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
    ureq.abort();
    callback(uerr ? uerr : e);
  }

  ureq.on('error', conError);
  // ureq.setTimeout(connectTimeout, conTimeout);
  ureq.on('socket', function(socket){
    socket.setTimeout(connectTimeout, conTimeout);
  });
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
    callback();
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