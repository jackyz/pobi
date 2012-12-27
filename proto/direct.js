var debug = require('debug')('PROTO:DIRECT')
    , http = require('http')
    , net = require('net');

// Socket

function connect(port, host){
  debug("!!!! connect(%j)", arguments);
  var socks = new net.Socket();
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
// exports.connect = net.connect;
