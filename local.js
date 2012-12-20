var debug = require('debug')('LOCAL')
    , axon = require('axon');

/*
var req = axon.socket('req');
req.format('json');
req.connect(3030);

exports.echo = function(param,cb){
  req.send('echo',param,function(d){
    cb(d);
  });
};
*/

var id = 0;
var callbacks = {};

var push = axon.socket('push');
push.connect(3031);

function call(fun, param, cb){
  var x = id++;
  callbacks[x] = cb;
  push.send(JSON.stringify([x, fun, param]));
}

var pull = axon.socket('pull');
pull.connect(3032);

pull.on('message', function(str){
  var obj = JSON.parse(str);
  var id = obj[0], r = obj[1], v = obj[2];
  var cb = callbacks[id];
  if (r == 0) { // ok
    cb(null, v); // success callback
  } else {
    cb(v); // error callback
  }
  delete callbacks[id];
});


exports.echo = function(param,cb){
  call('echo',param,cb);
};

exports.connect = function(opts){
};
