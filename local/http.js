var debug = require('debug')('LOCAL:HTTP')
    , http = require('http')
    , url = require('url')
    , net = require('net')
    , inherits = require('util').inherits
    , d = require('domain').create()
    , config = require('../util/config');

// ---- timeout

var connectTimeout = 2000; // 2 second
var transferTimeout = 30000; // 30 second

// ---- upstream socket

var protocol = config('proto','select') || 'direct';

var upstream = require('../proto/'+protocol);

// ---- upstream agent

function Agent(options) {
  http.Agent.call(this, options);
  this.createConnection = upstream.connect;
}
inherits(Agent, http.Agent);

var agent = new Agent({maxSockets:64});

// ---- 

function tunnel(req, sock, head){
  var o = url.parse('http://'+req.url);
  // var usock = net.connect(o.port, o.hostname);
  var usock = upstream.connect(o.port, o.hostname);
  // debug("usock", usock);
  function close(){
    debug('%s : tunnel %s %s END', req.ip, req.method, req.url);
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
  // sock.on('timeout', timeout);
  sock.on('error', error);
  sock.on('end', close);
  usock.on('error', error);
  usock.on('end', close);
  usock.on('connect', function(){
    debug('%s : tunnel %s %s BEGIN', req.ip, req.method, req.url);
    sock.write('HTTP/1.0 200 Connect ok\r\n\r\n\r\n');
    usock.setTimeout(transferTimeout, timeout);
    usock.write(head);
    sock.pipe(usock);
    usock.pipe(sock);
  });
  usock.setTimeout(connectTimeout, timeout);
}

// ----

function proxy(req, res){
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
    agent: agent // using the upstream connections
    // agent: false, // using the original http
  };
  var ureq = http.request(ropts);
  function close(){
    debug('%s : proxy %s %s END', req.ip, req.method, req.url);
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
  ureq.on('response', function(ures){
    debug('%s : proxy %s %s BEGIN', req.ip, req.method, req.url);
    // ureq.setTimeout(transferTimeout, timeout);
    res.statusCode = ures.statusCode;
    for(var k in ures.headers){ res.setHeader(k,ures.headers[k]); }
    ures.pipe(res);
  });
  // ureq.setTimeout(connectTimeout, timeout);
  req.pipe(ureq);
  // req.on('end', function(){ ureq.end(); });
}

// ----

function start(opt){
  var port = opt.port || 8080;
  var onListening = function(){
    debug("listening on %j", this.address());
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

  d.on('error', function(e){
    // debug('ERROR', e, e.stack);
    debug('!!!! ERROR %s', e.message);
  });
  d.run(function(){
    var server = http.createServer();
    server.on('listening', onListening);
    server.on('request', onRequest);
    server.on('connect', onConnect);
    server.on('close', onClose);
    server.on('error', onError);
    server.listen(port);
  });
}
exports.start = start;

// ----

if(!module.parent) {
  start({port:8080});
}
