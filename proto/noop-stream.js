var debug = require('debug')('NOOP')
    , http = require('http')
    , net = require('net');

// Socket

exports.connect = net.connect;

// Agent

exports.agent = http.globalAgent;

debug('protocol selected');