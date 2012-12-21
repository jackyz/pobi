var debug = require('debug')('DIRECT')
    , http = require('http')
    , net = require('net');

// Socket

exports.connect = net.connect;

// Agent

exports.agent = http.globalAgent;

debug('selected');
