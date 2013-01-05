var debug = require('./debug')('APP')
    , config = require('./config');

/*
// node http leaks socket, bug 3536
process.on('uncaughtException', function(e){
  debug('UNCAUGHTEXCEPTION', e);
});
*/

var app = process.argv[2];
var cfg = config(app);
for(var mod in cfg){
  // debug("start %s:%s %j", app, mod, cfg[mod]);
  require('./'+mod).start(cfg[mod]);
}
