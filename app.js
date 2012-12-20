var debug = require('debug')('APP');

// node http leaks socket, bug 3536
process.on('uncaughtException', function(e){
  debug('UNCAUGHTEXCEPTION', e.stack);
});

require('./dns').start({port:53});
require('./wpad').start({port:80});
require('./proxy').start({port:8080});

