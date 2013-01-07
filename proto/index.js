var debug = require('../debug')('PROTO')
  , url = require('url')
  , util = require('util')
  , http = require('http');

// ---- upstream socket

var upstreams = {};

module.exports = function(config){
  var protocol = config.split(':')[0] || 'direct';
  var u = upstreams[config];
  if (u === undefined) {
    // debug('init upstream %j', config);
    // ---- createConnection
    function createConnection(){
      // debug("init");
      var sock = require('./'+protocol).init(config);
      // debug("init");
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
	if (typeof (arguments[0] - 0) === 'number') {
	  options.port = (arguments[0] - 0);
	}
	if (typeof arguments[1] === 'string') {
	  options.host = arguments[1];
	}
      }
      // debug("CONNECT %j %s:%s", arguments, options.host, options.port);
      return sock.connect(options.port, options.host);
    }
    // ---- agent
    function Agent(options) {
      http.Agent.call(this, options);
      this.createConnection = createConnection;
    }
    util.inherits(Agent, http.Agent);
    // Agent.prototype.maxSockets = 32;
    var agent = new Agent({maxSockets:32});
    // ---- exports
    u = {
      config: config,
      createConnection: createConnection,
      agent: agent
    };
    upstreams[config] = u;
  }
  return u;
}
