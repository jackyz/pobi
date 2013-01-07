var debug = require('./debug')('HTTP')
  , http = require('http')
  , url = require('url')
  , net = require('net')
  , util = require('util')
  , proto = require('./proto')
  , d = require('domain').create();

// ---- timeout

var connectTimeout = 2000; // 2 second
var transferTimeout = 30000; // 30 second

// ----

function tunnel(req, sock, head){
  var self = this;
  debug("connections:%s", self.connections);
  var o = url.parse('http://'+req.url);
  // var usock = proto.createConnection(o.port, o.hostname);
  var usock = self.upstream.createConnection(o.port, o.hostname);
  function close(){
    debug("connections:%s", self.connections);
    // debug('%s : tunnel %s %s END', req.ip, req.method, req.url);
    try { sock.destroy(); } catch(x){ }
    try { usock.destroy(); } catch(x){ }
  }
  function timeout(){
    debug('%s : tunnel %s %s TIMEOUT', req.ip, req.method, req.url);
    close();
  }
  function error(e){
    debug('%s : tunnel %s %s ERROR %j', req.ip, req.method, req.url, e);
    close();
  }
  usock.setTimeout(connectTimeout, timeout);
  usock.on('error', error);
  usock.on('end', close);
  usock.on('connect', function(){
    // debug('%s : tunnel %s %s BEGIN', req.ip, req.method, req.url);
    usock.setTimeout(transferTimeout, timeout);
    usock.setNoDelay(true);
    usock.write(head);
    sock.pipe(usock);
    // sock.setTimeout(transferTimeout, timeout);
    sock.setNoDelay(true);
    sock.write('HTTP/1.0 200 Connect ok\r\n\r\n\r\n');
    usock.pipe(sock);
  });
  sock.setTimeout(transferTimeout, timeout);
  // sock.setNoDelay(true);
  sock.on('error', error);
  sock.on('end', close);
}

// ----

function proxy(req, res){
  var self = this;
  debug("connections:%s", self.connections);
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
    agent: self.upstream.agent // using the upstream
    // agent: false, // using the original http
  };
  var ureq = http.request(ropts);
  function close(){
    debug("connections:%s", self.connections);
    // debug('%s : proxy %s %s END', req.ip, req.method, req.url);
    try { res.end(); } catch(x){ }
    try { ureq.abort(); } catch(x){ }
  }
  function timeout(){
    debug('%s : proxy %s %s TIMEOUT', req.ip, req.method, req.url);
    res.statusCode = 500;
    close();
  }
  function error(e){
    debug('%s : proxy %s %s ERROR %j', req.ip, req.method, req.url, e);
    res.statusCode = 500;
    close();
  }
  ureq.on('error', error);
  ureq.on('end', close);
  ureq.on('response', function(ures){
    // debug('%s : proxy %s %s BEGIN', req.ip, req.method, req.url);
    ures.on('error', error);
    ures.on('end', close);
    ureq.setTimeout(transferTimeout, timeout);
    res.statusCode = ures.statusCode;
    for(var k in ures.headers){ res.setHeader(k,ures.headers[k]); }
    ures.pipe(res);
  });
  ureq.setTimeout(connectTimeout, timeout);
  req.on('error', error);
  // req.on('end', ureq.end);
  req.pipe(ureq);
}

// ----

function start(config){
  // init
  var host = config.host || '0.0.0.0';
  var port = config.port || 8080;
  //
  var onListening = function(){
    debug("listening on %j via %j", this.address(), this.upstream.config);
  };
  var onRequest = function(req, res){
    req.ip = req.connection.remoteAddress;
    proxy.call(this, req, res);
  };
  var onConnect = function(req, sock, head){
    req.ip = req.connection.remoteAddress;
    tunnel.call(this, req, sock, head);
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
    var server = http.createServer();
    server.upstream = proto(config.upstream);
    server.on('listening', onListening);
    server.on('request', onRequest);
    server.on('connect', onConnect);
    server.on('close', onClose);
    server.on('error', onError);
    server.listen(port, host);
  });
}

exports.start = start;

// ----
/*
if(!module.parent) {
  start({port:8080});
}
*/
