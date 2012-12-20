var debug = require('debug')('REMOTE')
    , axon = require('axon');

/*
var rep = axon.socket('rep');
rep.format('json');
rep.bind(3030);

rep.on('message', function(fun,param,reply){
  var f = exports[fun];
  if (typeof f === 'function') {
    f(param, function(d){
      debug("%s(%j)%j", fun, param, d);
      reply(d);
    });
  } else {
    var r = 'ENOENT';
    debug("%s(%j)%j", fun, param, r);
    reply(r);
  }
});
*/

var pull = axon.socket('pull');
pull.bind(3031);

var push = axon.socket('push');
push.bind(3032);

pull.on('message', function(str){
  var obj = JSON.parse(str);
  var id = obj[0], fun = obj[1], param = obj[2];
  var f = exports[fun];
  if (typeof f === 'function') {
    f(param, function(e,r){
      debug("%s(%j) %j %j", fun, param, e, r);
      if(e) {
	push.send(JSON.stringify([id,1,e]));
      } else {
	push.send(JSON.stringify([id,0,r]));
      }
    });
  } else {
    debug("%s %j", fun, 'ENOENT');
    push.send(JSON.stringify([id,1,'ENOENT']));
  }
});

exports.echo = function(param, cb){
  cb(null, param);
};
