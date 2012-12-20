var debug = require('debug')('PROXY')
    , http = require('http')
    , url = require('url')
    , net = require('net');

var connectTimeout = 2000; // 2'
var transferTimeout = 30000; // 30'

function tunnel(req, sock, head){
  var o = url.parse('http://'+req.url);
  var usock = net.connect(o.port, o.hostname);
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
  usock.on('timeout', timeout);
  usock.on('error', error);
  usock.on('end', close);
  usock.on('connect', function(){
    debug('%s : tunnel %s %s BEGIN', req.ip, req.method, req.url);
    sock.write('HTTP/1.0 200 Connect ok\r\n\r\n\r\n');
    usock.setTimeout(transferTimeout);
    usock.write(head);
    usock.pipe(sock);
  });
  usock.setTimeout(connectTimeout);
  sock.pipe(usock);
}

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
  var ureq = http.request({
    host: o.hostname,
    port: o.port,
    path: o.path,
    method: req.method,
    headers: headers, // req.headers,
    agent: false
  });
  function close(){
    debug('%s : proxy %s %s END', req.ip, req.method, req.url);
    try { ureq.abort(); } catch(x){ }
    try { res.end(); } catch(x){ }
  }
  function timeout(){
    debug('%s : proxy %s %s TIMEOUT', req.ip, req.method, req.url);
    close();
  }
  function error(e){
    debug('%s : proxy %s %s ERROR %j', req.ip, req.method, req.url, e);
    close();
  }
  req.on('error', error);
  // req.on('end', close);
  ureq.on('timeout', timeout);
  ureq.on('response', function(ures){
    debug('%s : proxy %s %s BEGIN', req.ip, req.method, req.url);
    ureq.setTimeout(transferTimeout);
    ures.on('error', error);
    ures.on('end', close);
    res.statusCode = ures.statusCode;
    for(var k in ures.headers){ res.setHeader(k,ures.headers[k]); }
    ures.pipe(res);
  });
  ureq.setTimeout(connectTimeout);
  req.pipe(ureq);
}

function start(opt){
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
  var port = opt.port || 8080;
  var server = http.createServer();
  server.on('listening', onListening);
  server.on('request', onRequest);
  server.on('connect', onConnect);
  server.on('close', onClose);
  server.on('error', onError);
  server.listen(port);
}
exports.start = start;

if(!module.parent) {
  // node http leaks socket, bug 3536
  process.on('uncaughtException', function(e){
    debug('UNCAUGHTEXCEPTION', e.stack);
  });
  start({port:8080});
}
