var debug = require('../debug')('PROTO:DIRECT')
    , net = require('net');

// ---- exports

exports.init = function(options){
  var socks = new net.Socket();
  return socks;
}
