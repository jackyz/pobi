var debug = require('./debug')('APP')
  , net = require('net')
  , fs = require('fs')
  , path = require('path');

// ----

function getLocalIP(callback) {
  var socket = net.createConnection(80, 'qq.com');
  socket.on('connect', function() {
    callback(undefined, socket.address().address);
    socket.end();
  });
  socket.on('error', function(e) {
    callback(e, 'error');
  });
}

function getConfig(localip, remote, callback) {
  try {
    var i = localip || '127.0.0.1';
    var r = remote || 'shadow://cool@'+i+':1027';
    var t = fs.readFileSync(path.dirname(__filename)+"/app.tmpl", 'utf8');
    var s = tmpl(t, {ip:i,remote:r});
    var j = JSON.parse(s);
    callback(undefined, j);
  } catch(x) {
    callback(x);
  }
}

// ---- begin inline underscore template function

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  var templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\t':     't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  var tmpl = function(text, data, settings) {
    settings = settings || templateSettings;

    // Combine delimiters into one regular expression via alternation.
    var matcher = new RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset)
        .replace(escaper, function(match) { return '\\' + escapes[match]; });

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      }
      if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      }
      if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }
      index = offset + match.length;
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + "return __p;\n";

    try {
      var render = new Function(settings.variable || 'obj', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    if (data) return render(data);
    var template = function(data) {
      return render.call(this, data);
    };

    // Provide the compiled function source as a convenience for precompilation.
    template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';

    return template;
  };

// ---- end inline underscore template function

// ---- exports

exports.tmpl = tmpl;

// ---- main entry

/*
// node http leaks socket, bug 3536
process.on('uncaughtException', function(e){
  debug('UNCAUGHTEXCEPTION', e);
});
*/

// command
// ** first run will build gfw chn-iptable
// ** if need rebuild, just drop gfw.rule file
// ** on local
// node app local shadow://pass@1.2.3.4:5678
// ** on remote (ip: 1.2.3.4)
// node app worker

if (!module.parent) {
  var app = process.argv[2];
  var remote = process.argv[3];
  getLocalIP(function (error, localip) {
    if (error) return console.log('Not Online? error:', error);
    getConfig(localip, remote, function(error, conf){
      if (error) return console.log('Config fail. error:', error);
      debug('starting %s on %s', app, localip);
      // the config parser
      function config(){
	// debug("%j",conf);
	var args = Array.prototype.slice.call(arguments);
	var val = conf;
	for (var i=0; i<args.length; i++) {
	  var key = args[i];
	  val = val[key];
	  if (!val) {
	    debug("!!!! config('"+args.slice(0,i+1).join()+"'):undefined");
	    break;
	  }
	}
	return val;
      }
      // start them one by one
      var cfg = config(app);
      for(var mod in cfg){
	var conf = cfg[mod];
	// debug("start %s:%s %j", app, mod, conf);
	require('./'+mod).start(conf);
      }
    });
  });
}
