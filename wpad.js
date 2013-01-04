var debug = require('debug')('WPAD')
    , http = require('http')
    , fs = require('fs')
    , path = require('path');

// underscore template

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

var wpad_path = '/wpad.da';

function serveWpad(req, res, cb){
  var self = this;
  if (req.method == 'GET' && wpad_path == req.url.substr(0, wpad_path.length)){
    res.writeHead(200, {
      'Content-Type': 'application/x-ns-proxy-autoconfig; charset=UTF-8',
      'Cache-Control': 'no-cache'
    });
    res.write(self.pac);
    res.end();
    debug('%s : %s %s ok', req.ip, req.method, req.url);
    cb();
  } else {
    res.writeHead(404);
    res.end();
    cb(404);
  }
}

function start(config){
  // init
  var port = config.port || 80; // wpad must on 80
  var host = config.host || '0.0.0.0';
  var pac = tmpl(fs.readFileSync(path.dirname(__filename)+'/'+config.pac.template, 'utf8'), config.pac.proxy || {type:'PROXY',host:'127.0.0.1',port:8080});
  //
  var onListening = function(){
    debug("listening on %j", this.address());
  };
  var onRequest = function(req, res){
    req.ip = req.connection.remoteAddress;
    serveWpad.call(this, req, res, function(e){
      if (e) debug('%s : %s %s fail %j', req.ip, req.method, req.url, e);
    });
  };
  var onClose = function(){
    debug("closed %j", this.address());
  };
  var onError = function(err){
    debug("error %j", err);
  };
  var server = http.createServer();
  server.pac = pac;
  server.on('listening', onListening);
  server.on('request', onRequest);
  server.on('close', onClose);
  server.on('error', onError);
  server.listen(port, host);
}

exports.start = start;

// ----
/*
if(!module.parent) {
  start({port:80});
}
*/
