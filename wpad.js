var url = require('url')
  , http = require('http')
  , d = require('domain').create()
  , debug = require('./debug')('WPAD')
  , getPac = require('./gfw').getPac;

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

// ----

var server = null;

function start(config){
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

  // init
  server = http.createServer();
  server.on('listening', onListening);
  server.on('request', onRequest);
  server.on('close', onClose);
  server.on('error', onError);

  var o = url.parse(config.url);
  var host = o.hostname || '0.0.0.0';
  var port = o.port || 80; // wpad must on 80

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
