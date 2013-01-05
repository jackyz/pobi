var debug = require('./debug')('CONFIG')
    , fs = require('fs')
    , path = require('path');

// module.exports = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

var conf = JSON.parse(fs.readFileSync(path.dirname(__filename)+"/config.json", "utf-8"));

module.exports = function(){
  var args = Array.prototype.slice.call(arguments);
  var val = conf;
  for (var i = 0; i < args.length; i++) {
    var key = args[i];
    val = val[key];
    if (!val) {
      //console.dir(args);
      //console.log(i);
      debug("!!!! config("+args.slice(0,i+1).join()+"):undefined");
      break;
    }
  }
  return val;
};
