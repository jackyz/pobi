var debug = require('debug')('LOCAL')
    , config = require('./config');

/*
// node http leaks socket, bug 3536
process.on('uncaughtException', function(e){
  debug('UNCAUGHTEXCEPTION', e);
});
*/

var c = config('local');
for(var n in c){
  require('./'+n).start(c[n]);
}
