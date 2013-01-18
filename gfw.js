var fs = require('fs')
  , path = require('path')
  , vm = require('vm')
  , url = require('url')
  , server = require('./server')
  , debug = require('./debug')('GFW');

// ----

var pacTmpl = '/tmpl/pac.tmpl'; // all-by-proxy pac template

var whiteList = '/list/pac.whitelist';
var blackList = '/list/pac.blacklist';

// ---- implements

var init = false;
var pac = null;
var black = null;
var white = null;
var cache = {};

function start(config){
  var proxy = config.proxy || "DIRECT";
  pac = server.tmpl(fs.readFileSync(path.dirname(__filename)+pacTmpl, 'utf8'), {proxy:proxy});
  black = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.dirname(__filename)+blackList, 'utf8'), black, 'blacklist');
  white = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.dirname(__filename)+blackList, 'utf8'), white, 'whitelist');
  cache = {};
  init = true;
  debug("started");
}
exports.start = start;

function stop(){
  init = false;
  cache = {};
  black = null;
  white = null;
  pac = null;
  debug("stoped");
}
exports.stop = stop;

function getPac(){
  if (!init) throw new Error("NOT_INIT_YET");
  return pac;
}
exports.getPac = getPac;

function checkDomain(d){
  // TODO make sure if the domain is blackhole
  // mark as black for now
  identifyDomain(d,'black');
}
exports.checkDomain = checkDomain;

function identifyDomain(d, v){
  return identifyUrl('http://'+d, v);
}
exports.identifyDomain = identifyDomain;

function identifyUrl(u, v){
  // check url against white and black list
  if (!init) throw new Error("NOT_INIT_YET");
  // set
  if (v) {
    if (cache[u] != v) {
      debug('identifyUrl(%s,%s)', u, v);
      cache[u] = v;
      return;
    }
  }
  // get :: use cache to speed up
  var r = cache[u];
  if (!r) {
    var d = url.parse(u).hostname;
    if ('http://'+d == u) {
      // we are arctually checking domain
      // check domain againset domain white list
      var v1 = white.FindProxyForURL(u, d);
      r = (v1 == 'DIRECT') ? 'white' : 'gray';
    } else {
      // we are checking url
      r = identifyDomain(d); // check domain first
      if (r != 'black') {
	// if domain is black, then all url is black
	// if domain is white or gray, then check url againset gfwlist
	var v2 = black.FindProxyForURL(u, d);
	r = (v2 == 'DIRECT') ? 'gray' : 'black';
      }
    }
    /*
    r = 'gray'; // short cut for test
    */
    cache[u] = r;
  }
  // debug('identifyUrl(%s):%s', u, r);
  return r;
}
exports.identifyUrl = identifyUrl;
