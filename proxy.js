var debug = require('debug')('PROXY')
    , http = require('http')
    , url = require('url')
    , net = require('net');

var timeout = 2000;

function tunnel(req, sock, head, cb){
  var o = req.url.split(':');
  var uhost = o[0];
  var uport = o[1];
  // var usock = local.connect(uhost,uport);
  var usock = new net.Socket();
  usock.on('connect',function(){
    usock.setTimeout(0);
    sock.write('HTTP/1.0 200 Connect ok\r\n\r\n\r\n');
    debug('%s : %s %s tunnel begin', req.ip, req.method, req.url);
    sock.pipe(usock);
    sock.on('end', function(){
      debug('%s : %s %s tunnel end', req.ip, req.method, req.url);
      usock.destroy();
      cb();
    });
    sock.on('error', function(e){
      usock.destroy();
      cb(e);
    });
    usock.pipe(sock);
    usock.on('end', function(e){
      // debug('%s : %s %s tunnel end', req.ip, req.method, req.url);
      // cb(); // need not will auto close when usock closed
    });
    usock.on('error', function(e){
      sock.destroy();
      cb(e);
    });
  });
  usock.setTimeout(timeout, function(){
    sock.write('HTTP/1.0 400 Connect timeout\r\n\r\n\r\n');
    sock.end();
    usock.destroy();
    cb('ETIMEOUT');
  });
  usock.on('error', function(e){
    sock.write('HTTP/1.0 400 Connect fail\r\n\r\n\r\n');
    sock.end();
    usock.destroy();
    cb(e);
  });
  usock.connect(uport, uhost);
}

function proxy(req, res, cb){
  // expose ip
  var headers = req.headers;
  headers['X-Forwarded-Proto'] = "http";
  if (headers['X-Forwarded-For']){
    headers['X-Forwarded-For'] += ', '+req.ip;
  } else {
    headers['X-Forwarded-For'] = req.ip;
  }
  var o = url.parse(req.url);
  // var ureq = local.request();
  var ureq = http.request({
    host: o.hostname,
    port: o.port,
    path: o.path,
    method: req.method,
    headers: req.headers,
    agent: false
  });
  ureq.on('response',function(ures){
    ureq.setTimeout(0);
    ures.on('end', function(){
      debug('%s : %s %s ok', req.ip, req.method, req.url);
      cb();
    });
    ures.on('error', function(e){
      res.statusCode = 500;
      res.end();
      cb(e);
    });
    res.statusCode = ures.statusCode;
    for(var k in ures.headers){ res.setHeader(k,ures.headers[k]); }
    ures.pipe(res);
  });
  ureq.setTimeout(timeout, function(){
    res.statusCode = 500;
    res.end();
    ureq.abort();
    cb('ETIMEOUT');
  });
  ureq.on('error', function(e){
    res.statusCode = 500;
    res.end();
    ureq.abort();
    cb(e);
  });
  req.pipe(ureq);
}

function start(opt){
  var onListening = function(){
    debug("listening on %j", this.address());
  };
  var onRequest = function(req, res){
    req.ip = req.connection.remoteAddress;
    proxy(req, res, function(e){
      if (e) debug("%s : %s %s fail %j", req.ip, req.method, req.url, e);
    });
  };
  var onConnect = function(req, sock, head){
    req.ip = req.connection.remoteAddress;
    tunnel(req, sock, head, function(e){
      if (e) debug("%s : %s %s fail %j", req.ip, req.method, req.url, e);
    });
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
  start({port:8080});
}
