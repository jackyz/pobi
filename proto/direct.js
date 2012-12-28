var debug = require('debug')('PROTO:DIRECT')
    , http = require('http')
    , net = require('net');

// Socket

function connect(){
  var h, p;
  if (typeof arguments[0] == 'object') { // call by (options) params
    var opt = arguments[0];
    p = opt.port;
    h = opt.host;
  } else { // call by (port, host) params
    p = arguments[0];
    h = arguments[1];
  }
  debug("==[]==> %s:%s", h, p);
  var socks = new net.Socket();
  return socks.connect(p, h);
};

exports.connect = connect;
// exports.connect = net.connect;
