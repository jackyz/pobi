var url = require('url')
  , ndns = require('native-dns')
  , gfw = require('./gfw')
  , debug = require('./debug')('DNS');

// ----

var wpad_domain = 'wpad';

var TIMEOUT = 2000; // 2 second

// ----

function serve_wpad(req, res){
  var self = this;
  var dn = req.question[0].name;
  res.answer.push(ndns.A({
    name:wpad_domain, address:self.wpad, ttl:600
  }));
  res.send();
  debug("%s: Query [WPAD] %j -> %j", req.ip, dn, [self.wpad]);
}

// if not name resolve, use lodns direct
function proxy_query(req, res){
  var self = this;
  var q = req.question[0];
  var dn = q.name;
  var color = 'white';
  _query.call(self, color, req, function(e,r){
    if (e){
      debug("%s: Query [%s] %j FAIL %s", req.ip, color, dn, e.code);
    } else {
      res.answer = r;
    }
    res.send();
  });
}

function serve_query(req, res){
  var self = this;
  var q = req.question[0];
  var dn = q.name;
  var color = (q.type==1 && q.class==1) ? gfw.identifyDomain(dn) : 'white';
  _serve_query.call(self, color, req, res);
}

function _serve_query(color, req, res){
  var self = this;
  var q = req.question[0];
  var dn = q.name;
  _query.call(self, color, req, function(e,r){
    if (e) {
      if ((color == 'gray' || color == 'white')  && e.code == 'ETIMEOUT') {
	debug("%s: Query [%s] %j TIMEOUT RETRY", req.ip, color, dn);
	req.retry++;
	_serve_query.call(self, 'black', req, res);
      } else {
	gfw.identifyDomain(dn, 'fail');
	debug("%s: Query [%s] %j FAIL %s", req.ip, color, dn, e.code);
	res.send();
      }
    } else {
      var r2 = filterFails(r);
      if (r2.length){
	debug("%s: Query [%s] %j OK", req.ip, color, dn);
	// retry connect ok, confirm the color
	gfw.identifyDomain(dn, (color != 'black') ? 'white' : 'black');
	res.answer = r;
	res.send();
      } else if ((color == 'gray' || color == 'white')) {
	// try black
	debug("%s: Query [%s] %j GFWED RETRY", req.ip, color, dn);
	req.retry++;
	_serve_query.call(self, 'black', req, res);
      } else {
	gfw.identifyDomain(dn, 'fail');
	debug("%s: Query [%s] %j GFWED FAIL", req.ip, color, dn);
	res.send();
      }
    }
  });
}

function _query(color, req, callback){
  if (color == 'fail') return callback(null, []);
  var self = this;
  var q = req.question[0];
  var dn = q.name;
  var uerr = null;
  var result = [];
  var ureq = ndns.Request({
    question: q,
    server: (color == 'black') ? self.upstream : self.direct,
    timeout: TIMEOUT,
    cache: false
  });
  function qEnd(e){
    if (uerr) return; else uerr = e; // do not process error again
    if(!e) {
      callback(null, result);
    } else {
      callback(e, result);
    }
  }
  ureq.on('timeout', function(){
    var e = new Error('timeout');
    e.code = 'ETIMEOUT';
    qEnd(e);
  });
  ureq.on('error', function(e){
    qEnd(e);
  });
  ureq.on('message', function (e, r) {
    r.answer.forEach(function (a) { result.push(a); });
  });
  ureq.on('end', function () {
    qEnd();
  });
  ureq.send();
}

function filterFails(answers){
  var r2 = [];
  for (var i=0; i<answers.length; i++){
    var answer = answers[i];
    answer.color = gfw.identifyIp(answer.address);
  }
  // white is best
  for (var i=0; i<answers.length; i++){
    var answer = answers[i];
    if (answer.color == 'white') {
      r2.push(answer);
    }
  }
  if (r2.length) return r2;
  // gray will be ok
  for (var i=0; i<answers.length; i++){
    var answer = answers[i];
    if (answer.color == 'gray') {
      r2.push(answer);
    }
  }
  if (r2.length) return r2;
  // black is fallback
  for (var i=0; i<answers.length; i++){
    var answer = answers[i];
    if (answer.color == 'black') {
      r2.push(answer);
    }
  }
  if (r2.length) return r2;
  // fail should be filter out
  return r2;
}

function startsWith(str, prefix){
  return prefix == str.substr(0,prefix.length);
}

// ----

var udpServer = null;
// var tcpServer = null;

function start(config){

  var onListening = function(){
    debug("listening on %s:%s",
      this.address().address, this.address().port);
    debug("  --lodns=%s://%s:%s",
      this.direct.type, this.direct.address, this.direct.port);
    debug("  --upstream=%s://%s:%s",
      this.upstream.type, this.upstream.address, this.upstream.port);
    debug("  --wpad=%s",
      this.wpad);
  };
  var onRequest = function(req, res){
    var self = this;
    req.ip = req._socket._remote.address;
    req.retry = 0;
    var q = req.question[0];
    var dn = q.name;
    if(q.type == 1 && q.class == 1){
      if(startsWith(dn,wpad_domain)) {
	// if wpad name resolve
	serve_wpad.call(self, req, res);
      } else {
	// other name resolve
	serve_query.call(self, req, res);
      }
    } else {
      // not name resolve
      proxy_query.call(self, req, res);
    }
  };
  var onClose = function(){
    debug("closed %j", this.address());
  };
  var onError = function(err, buff, req, res){
    debug("error", err, buff, req, res);
  }

  // init
  udpServer = ndns.createServer();
  udpServer.on('listening', onListening);
  udpServer.on('request', onRequest);
  udpServer.on('close', onClose);
  udpServer.on('error', onError);

  // tcpServer = ndns.createTCPServer();
  // tcpServer.on('listening', onListening);
  // tcpServer.on('request', onRequest);
  // tcpServer.on('close', onClose);
  // tcpServer.on('error', onError);

  var o = url.parse(config.upstream);
  var upstream = {
    type: (o.protocol == "tcp:") ? 'tcp' : 'udp',
    address: o.hostname || '8.8.8.8',
    port: o.port || 53
  };
  // debug("upstream %j",upstream);
  var o = url.parse(config.direct);
  var direct = {
    type: (o.protocol == "tcp:") ? 'tcp' : 'udp',
    address: o.hostname || '8.8.8.8',
    port: o.port || 53
  };
  // debug("direct %j",direct);
  var wpad = config.wpad || '127.0.0.1';

  udpServer.upstream = upstream;
  udpServer.direct = direct;
  udpServer.wpad = wpad;

  // tcpServer.upstream = upstream;
  // tcpServer.direct = direct;
  // tcpServer.wpad = wpad;

  var o = url.parse(config.listen);
  var host = o.hostname || '0.0.0.0';
  var port = o.port || 53; // dns must on 53

  udpServer.serve(port, host);
  // tcpServer.serve(port, host);
  
}
exports.start = start;

function stop(){
  udpServer.close();
  // tcpServer.close();
}
exports.stop = stop;