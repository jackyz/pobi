var net = require('net');
var http = require('http');
var inherits = require('util').inherits;
var socks = require('./socks_socket');

function SocksAgent(options) {
  http.Agent.call(this, options);

  if (options.socks_host) {
    this.socks_host = options.socks_host;
    this.socks_port = options.socks_port || 1080;
    this.createConnection = socks.createConnection;
  }
}

inherits(SocksAgent, http.Agent);
module.exports = SocksAgent;
