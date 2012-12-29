var debug = require('debug')('PROTO:DIRECT')
    , http = require('http')
    , net = require('net');

// Socket

function createConnection(){ // port,host,options
  var options = {};

  if (typeof arguments[0] === 'object') {
    options = arguments[0];
  } else if (typeof arguments[1] === 'object') {
    options = arguments[1];
    options.port = arguments[0];
  } else if (typeof arguments[2] === 'object') {
    options = arguments[2];
    options.port = arguments[0];
    options.host = arguments[1];
  } else {
    if (typeof arguments[0] === 'number') {
      options.port = arguments[0];
    }
    if (typeof arguments[1] === 'string') {
      options.host = arguments[1];
    }
  }
  var socks = new net.Socket();
  return socks.connect(options.port, options.host);
};

exports.createConnection = createConnection;
