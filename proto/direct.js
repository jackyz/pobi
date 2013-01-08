var net = require('net')
  , debug = require('../debug')('PROTO:DIRECT');

// ---- exports

exports.init = function(options){
  var socks = new net.Socket();
  return socks;
}
