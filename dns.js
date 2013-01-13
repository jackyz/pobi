var url = require('url')
  , ndns = require('native-dns')
  , d = require('domain').create()
  , gfw = require('./gfw')
  , debug = require('./debug')('DNS')

var wpad_domain = 'wpad';
var timeout = 2000;

function query(up, q, cb){
  var self = this;
  var err = null;
  var result = [];
  var ureq = ndns.Request({
    question: q,
    server: up,
    timeout: timeout,
    cache: false
  });
  ureq.on('timeout', function(){
    err = 'ETIMEOUT';
  });
  ureq.on('message', function (e, r) {
    r.answer.forEach(function (a) { result.push(a); });
  });
  ureq.on('end', function () {
    cb(err, result);
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
    debug("listening on %j", this.address());
  };
  var onRequest = function(req, res){
    var self = this;
    req.ip = req._socket._remote.address;
    var q = req.question[0];
    var d = q.name;
    if(q['type'] == 1 && q['class'] == 1 && startsWith(d,wpad_domain)) {
      // resolve WPAD name
      res.answer.push(ndns.A({
	name:wpad_domain, address:self.wpad, ttl:600
      }));
      res.send();
      debug("%s: Query [WPAD] %j -> %j", req.ip, d, [self.wpad]);
    } else {
      var up = self.direct;
      var color = 'white';
      if (q.type == 1 && q.class == 1) {
	color = gfw.identifyDomain(d);
	up = (color == 'black') ? self.upstream : self.direct;
      }
      query(up, q, function(e,r){
	if(e) {
	  debug("%s: Query [%s] %j FAIL %j", req.ip, color, d, e);
	  // res.header.rcode = ndns.consts.NAME_TO_RCODE.NOTFOUND;
	  res.send(); // empty response
        } else {
	  // console.dir(r);
	  res.answer = r;
	  debug("%s: Query [%s] %j OK", req.ip, color, d);
          res.send();
        }
      });
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