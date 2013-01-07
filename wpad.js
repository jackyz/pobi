var debug = require('./debug')('WPAD')
  , getPac = require('./gfw').getPac
  , http = require('http');

var wpad_path = '/wpad.da';

function serveWpad(req, res, cb){
  var self = this;
  if (req.method == 'GET' && wpad_path == req.url.substr(0, wpad_path.length)){
    res.writeHead(200, {
      'Content-Type': 'application/x-ns-proxy-autoconfig; charset=UTF-8',
      'Cache-Control': 'no-cache'
    });
    res.write(getPac());
    res.end();
    debug('%s : %s %s ok', req.ip, req.method, req.url);
    cb();
  } else {
    res.writeHead(404);
    res.end();
    cb(404);
  }
}

function start(config){
  // init
  var host = config.host || '0.0.0.0';
  var port = config.port || 80; // wpad must on 80
  //
  var onListening = function(){
    debug("listening on %j", this.address());
  };
  var onRequest = function(req, res){
    req.ip = req.connection.remoteAddress;
    serveWpad.call(this, req, res, function(e){
      if (e) debug('%s : %s %s fail %j', req.ip, req.method, req.url, e);
    });
  };
  var onClose = function(){
    debug("closed %j", this.address());
  };
  var onError = function(err){
    debug("error %j", err);
  };
  var server = http.createServer();
  server.on('listening', onListening);
  server.on('request', onRequest);
  server.on('close', onClose);
  server.on('error', onError);
  server.listen(port, host);
}

exports.start = start;

// ----
/*
if(!module.parent) {
  start({port:80});
}
*/
