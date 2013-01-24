var fs = require('fs')
  , path = require('path')
  , url = require('url')
  , http = require('http')
  , gfw = require('./gfw')
  , server = require('./server')
  , debug = require('./debug')('WPAD');

// ----

var pacTmpl = '/tmpl/pac.tmpl'; // all-by-proxy pac template

var wpad_path = '/wpad.da';

// ----

function serveWpad(req, res, cb){
  var self = this;
  if (req.method == 'GET' && wpad_path == req.url.substr(0, wpad_path.length)){
    res.writeHead(200, {
      'Content-Type': 'application/x-ns-proxy-autoconfig; charset=UTF-8',
      'Cache-Control': 'no-cache'
    });
    res.write(self.pac);
    res.end();
    debug('%s : %s %s ok', req.ip, req.method, req.url);
    cb();
  } else if (req.method == 'GET' && req.url.substr(0,4) == '/gfw'){
    var o = url.parse(req.url.substr(4), true);
    var code = 200;
    var data = '';
    switch (o.pathname) {
      case '/identifyDomain' :
	var d = o.query.domain || undefined;
	var v = o.query.val || undefined;
	data = gfw.identifyDomain(d,v);
	break;
      case '/identifyIp' :
	var d = o.query.domain || undefined;
	var i = o.query.ip || undefined;
	var v = o.query.val || undefined;
	data = gfw.identifyIp(d,i,v);
	break;
      case '/identifyUrl' :
	var d = o.query.domain || undefined;
	var u = o.query.url || undefined;
	var v = o.query.val || undefined;
	data = gfw.identifyUrl(d,u,v);
	break;
      default :
	code = 404;
    }
    res.writeHead(code);
    res.end(data);
    cb();
  } else {
    res.writeHead(404);
    res.end();
    cb(404);
  }
}

// ----

var wpad = null;

function start(config){
  var onListening = function(){
    debug("listening on %s:%s",
      this.address().address, this.address().port);
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
  var proxy = config.proxy || "DIRECT";
  var pac = server.tmpl(fs.readFileSync(path.dirname(__filename)+pacTmpl, 'utf8'), {proxy:proxy});

  wpad = http.createServer();
  wpad.on('listening', onListening);
  wpad.on('request', onRequest);
  wpad.on('close', onClose);
  wpad.on('error', onError);

  wpad.pac = pac;

  var o = url.parse(config.listen);
  var host = o.hostname || '0.0.0.0';
  var port = o.port || 80; // wpad must on 80
  //
  wpad.listen(port, host);
}
exports.start = start;

function stop(){
  wpad.close();
}
exports.stop = stop;
