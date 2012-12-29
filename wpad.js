var debug = require('debug')('LOCAL:WPAD')
    , http = require('http')
    , fs = require('fs')
    , path = require('path')
    , _ = require('underscore')
    , config = require('../util/config');

var wpad_pac_tmpl = config('local','wpad','pac','template');
var wpad_pac_proxy = config('local','wpad','pac','proxy');
var wpad_pac_tmpl_str = fs.readFileSync(path.dirname(__filename)+'/../'+wpad_pac_tmpl, 'utf8');
var wpad_pac = _.template(wpad_pac_tmpl_str, wpad_pac_proxy,{ interpolate : /\{\{(.+?)\}\}/g });

var wpad_path = '/wpad.da';

function serveWpad(req, res, cb){
  if (req.method == 'GET' && wpad_path == req.url.substr(0, wpad_path.length)){
    res.writeHead(200, {
      'Content-Type': 'application/x-ns-proxy-autoconfig; charset=UTF-8',
      'Cache-Control': 'no-cache'
    });
    res.write(wpad_pac);
    res.end();
    debug('%s : %s %s ok', req.ip, req.method, req.url);
    cb();
  } else {
    res.writeHead(404);
    res.end();
    cb(404);
  }
}

function start(opt){
  var onListening = function(){
    debug("listening on %j", this.address());
  };
  var onRequest = function(req, res){
    req.ip = req.connection.remoteAddress;
    serveWpad(req, res, function(e){
      if (e) debug('%s : %s %s fail %j', req.ip, req.method, req.url, e);
    });
  };
  var onClose = function(){
    debug("closed %j", this.address());
  };
  var onError = function(err){
    debug("error %j", err);
  };
  var port = opt.port || 80; // wpad must on 80
  var server = http.createServer();
  server.on('listening', onListening);
  server.on('request', onRequest);
  server.on('close', onClose);
  server.on('error', onError);
  server.listen(port); 
}
exports.start = start;

if(!module.parent) {
  start({port:80});
}
