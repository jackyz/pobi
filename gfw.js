var fs = require('fs')
  , path = require('path')
  , vm = require('vm')
  , url = require('url')
  , server = require('./server')
  , debug = require('./debug')('GFW');

// ----

var pacTmpl = '/pac.tmpl'; // all-by-proxy pac template

var whiteList = '/pac.whitelist';
var blackList = '/pac.blacklist';

// ---- implements

var init = false;
var pac = null;
var black = null;
var white = null;
var uCache = {};
var dCache = {};

function start(config){
  var proxy = config.proxy || "DIRECT";
  pac = server.tmpl(fs.readFileSync(path.dirname(__filename)+pacTmpl, 'utf8'), {proxy:proxy});
  black = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.dirname(__filename)+blackList, 'utf8'), black, 'blacklist');
  white = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.dirname(__filename)+blackList, 'utf8'), white, 'whitelist');
  init = true;
  debug("started");
}
exports.start = start;

function stop(){
  init = false;
  pac = null;
  uCache = {};
  dCache = {};
  black = null;
  white = null;
  debug("stoped");
}
exports.stop = stop;

function getPac(){
  if (!init) throw new Error("NOT_INIT_YET");
  return pac;
}
exports.getPac = getPac;

function identifyDomain(d,v){
  // check domain against whitelist and blacklist
  if (!init) throw new Error("NOT_INIT_YET");
  // set
  if (v) {
    debug('identifyDomain(%s,%s)', d, v);
    return dCache[d] = v;
  }
  // get :: use cache to speed up
  var r = dCache[d];
  if (!r) {
    if (true) {
      var v1 = white.FindProxyForURL('http://'+d, d);
      r = (v1 == 'DIRECT') ? 'white' : 'gray';
    }
    if (r == 'gray') {
      var v2 = black.FindProxyForURL('http://'+d, d);
      r = (v2 == 'DIRECT') ? 'gray' : 'black';
    }
    dCache[d] = r;
  }
  debug('identifyDomain(%s):%s', d, r);
  return r;
}
exports.identifyDomain = identifyDomain;

function checkDomain(d){
  // TODO make sure if the domain is blackhole
  // mark as black for now
  identifyDomain(d,'black');
}
exports.checkDomain = checkDomain;

function identifyUrl(u,v){
  // check url against whitelist and blacklist
  if (!init) throw new Error("NOT_INIT_YET");
  // set
  if (v) {
    debug('identifyUrl(%s,%s)', u, v);
    return uCache[u] = v;
  }
  // get :: use cache to speed up
  var r = uCache[u];
  if (!r) {
    var d = url.parse(u).hostname;
    if (true) {
      var v1 = white.FindProxyForURL(u, d);
      r = (v1 == 'DIRECT') ? 'white' : 'gray';
    }
    if (r == 'gray') {
      var v2 = black.FindProxyForURL(u, d);
      r = (v2 == 'DIRECT') ? 'gray' : 'black';
    }
    uCache[u] = r;
  }
  debug('identifyUrl(%s):%s', u, r);
  return r;
}
exports.identifyUrl = identifyUrl;
