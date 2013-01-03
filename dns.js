var debug = require('debug')('DNS')
    , _ = require('underscore')
    , ndns = require('native-dns');

var wpad_domain = 'wpad';
var timeout = 2000;

function forwardQuery(q, cb){
  var self = this;
  var result = [];
  var ureq = ndns.Request({
    question: q,
    server: self.upstream,
    timeout: timeout
    // cache: false
  });
  ureq.on('timeout', function(){
    debug('forward timeout');
    cb('ETIMEOUT');
  });
  ureq.on('message', function (e, r) {
    r.answer.forEach(function (a) { result.push(a); });
  });
  ureq.on('end', function () {
    cb(null, result);
  });
  ureq.send();
}

function resolveGfw(domain, cb){
  var self = this;
  var result = [];
  var ureq = ndns.Request({
    question: { name:domain, type:1, class:1 },
    server: self.upstream,
    timeout: timeout,
    obstruct: true // to drop obstruct packet from gfw
    // cache: false
  });
  ureq.on('timeout', function(){
    debug('forward timeout');
    cb('ETIMEOUT');
  });
  ureq.on('message', function (e, r) {
    r.answer.forEach(function (a) { result.push(a.address); });
  });
  ureq.on('end', function () {
    cb(null, result);
  });
  ureq.send();
}

function startsWith(str, prefix){
  return prefix == str.substr(0,prefix.length);
}

function endsWith(str, postfix){
  if (str.length < postfix.length) return false;
  return postfix == str.substr(str.length - postfix.length, postfix.length);
}

function isGfwed(domain){
  var self = this;
  return _(self.gfw).any(function(s){ return endsWith(domain,s); });
}

function start(config){
  // init
  var port = config.port || 53; // dns must on 53
  var host = config.host || '127.0.0.1';
  var upstream = {
    address: config.upstream.host || '8.8.8.8',
    port: config.upstream.port || 53,
    type: config.upstream.protocol || 'udp'
  };
  var self = this;
  self.upstream = upstream;
  self.gfw = config.gfw || ['twitter.com','facebook.com'];
  self.wpad = config.wpad || '127.0.0.1';
  //
  var onListening = function(){
    debug("listening on %j", this.address());
  };
  var onRequest = function(req, res){
    req.ip = req._socket._remote.address;
    var q = req.question[0];
    var d = q.name;
    var wpad_ip = self.wpad || '127.0.0.1';
    if(q['type'] == 1 && q['class'] == 1 && startsWith(d,wpad_domain)) {
      // resolve WPAD name
      res.answer.push(ndns.A({
        name: wpad_domain,
        address: wpad_ip,
        ttl: 600
      }));
      res.send();
      debug("WPAD %s : %j -> %j", req.ip, d, [wpad_ip]);
    } else if(q['type'] == 1 && q['class'] == 1 && isGfwed(d)) {
      /*
      resolveRemote(d, function(e,r){
        if(e) {
          debug("%s : resolveGFW %j : %j", req.ip, d, e);
	  res.header.rcode = ndns.const.NAME_TO_RCODE.NOTFOUND;
        } else {
          _(r).forEach(function(ip){
            res.answer.push(ndns.A({
              name: d,
              address: ip,
              ttl: 300
            }));
          });
        }
        res.send();
        debug("%s : resolveGFW %j -> %j", req.ip, d, r);
      }
      */
      // local.resolve(d, function(e,r){
      resolveGfw(d, function(e,r){
        if(e) {
          debug("GFW %s : %j : %j", req.ip, d, e);
	  res.header.rcode = ndns.consts.NAME_TO_RCODE.NOTFOUND;
        } else {
          r.forEach(function(ip){
            res.answer.push(ndns.A({
              name: d,
              address: ip,
              ttl: 300
            }));
          });
        }
        res.send();
        debug("GFW %s : %j -> %j", req.ip, d, r);
      });
    } else {
      forwardQuery(q, function(e,r){
        if(e) {
          debug("%s : forward %j : %j", req.ip, q, e);
	  res.header.rcode = ndns.consts.NAME_TO_RCODE.NOTFOUND;
        } else {
          res.answer = r;
        }
        res.send();
        debug("forward %s : %j -> %j", req.ip, q, r);
      });
    }
  };
  var onClose = function(){
    debug("closed %j", this.address());
  };
  var onError = function(err, buff, req, res){
    debug("error", err, buff, req, res);
  }
  var udpServer = ndns.createServer();
  udpServer.on('listening', onListening);
  udpServer.on('request', onRequest);
  udpServer.on('close', onClose);
  udpServer.on('error', onError);
  udpServer.serve(port, host);
  var tcpServer = ndns.createTCPServer();
  tcpServer.on('listening', onListening);
  tcpServer.on('request', onRequest);
  tcpServer.on('close', onClose);
  tcpServer.on('error', onError);
  tcpServer.serve(port, host);
}

exports.start = start;

// ----
/*
if(!module.parent) {
  start({port:53});
}
*/
