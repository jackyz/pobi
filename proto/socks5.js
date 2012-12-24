var debug = require('debug')('SOCKS5')
    // , Agent = require('./socks_agent')
    , Socks = require('./socks_socket')
    , http = require('http')
    , config = require('../util/config');

var socks5_ip = config('socks5', 'ip') || '127.0.0.1';
var socks5_port = config('socks5', 'port') || 7070;

debug('%s:%s selected', socks5_ip, socks5_port);

// Socket

function connect(port, host){
  var socks = new Socks(socks5_ip, socks5_port);
  // debug("!!!! connect", arguments);
  if (typeof arguments[0] == 'object') { // call by (options) params
    var opt = arguments[0];
    return socks.connect(opt.port, opt.host);
  } else { // call by (port, host) params
    var port = arguments[0];
    var host = arguments[1];
    return socks.connect(port, host);
  }
};

exports.connect = connect;

/*
// test socket ok
var sock = connect(80, 'qq.com');
console.dir(sock);
sock.on('connect', function(){
  debug('CONNECT');
  sock.write('GET / HTTP/1.0\r\nHost: qq.com\r\n\r\n');
  sock.setEncoding('utf8');
});
sock.on('data', function(d){
  debug('DATA', d);
});
sock.on('error', function(e){
  debug('ERROR', e);
});
sock.on('end', function(){
  debug('END');
});
*/
/*
// test agent ok
var options = {
  agent: agent,
  host: 'qq.com',
  port: 80,
  path: '/'
};
http.get(options, function(res) {
  res.on('data', function(data) {
    console.log('Public IP Address: %s', data);
  });
}).on('error', function(e) {
  console.log("Got error: " + e.message);
});
*/