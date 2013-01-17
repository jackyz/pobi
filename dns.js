var url = require('url')
  , ndns = require('native-dns')
  , d = require('domain').create()
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

function serve_query(req, res){
  var self = this;
  var q = req.question[0];
  var dn = q.name;
  var color = (q.type==1 && q.class==1) ? gfw.identifyDomain(dn) : 'white';
  _query.call(self, color, req, res);
}

function _query(color, req, res){
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
      debug("%s: Query [%s] %j OK", req.ip, color, dn);
      // console.dir(r);
      res.answer = result;
      res.send();
    } else if (color == 'gray' && e.code == 'ETIMEOUT'){
      debug("%s: Query [%s] %j TIMEOUT RETRY", req.ip, color, dn);
      _query.call(self, 'black', req, res);
    } else {
      // res.header.rcode = ndns.consts.NAME_TO_RCODE.NOTFOUND;
      // empty response
      res.send();
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
  ureq.on('message', function(){
    // connect ok, confirm the color
    gfw.identifyDomain(dn, (color == 'black') ? 'black' : 'white');
  });
  ureq.on('message', function (e, r) {
    r.answer.forEach(function (a) { result.push(a); });
  });
  ureq.on('end', function () {
    qEnd();
  });
  ureq.send();
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
    var q = req.question[0];
    var dn = q.name;
    if(q.type == 1 && q.class == 1 && startsWith(dn,wpad_domain)) {
      serve_wpad.call(self, req, res);
    } else {
      serve_query.call(self, req, res);
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

  d.on('error', function(e){
    // debug('ERROR', e, e.stack);
    debug('!!!! ERROR %s', e.message);
  });
  d.run(function(){
    udpServer.serve(port, host);
    // tcpServer.serve(port, host);
  });
}
exports.start = start;

function stop(){
  udpServer.close();
  // tcpServer.close();
}
exports.stop = stop;