var fs = require('fs')
  , path = require('path')
  , vm = require('vm')
  , url = require('url')
  , debug = require('./debug')('GFW');

/*
color:
   white : direct works | i don't know
   black : direct fail, retry upstream works
   fail  : direct fail, retry upstream fail

identifyDomain(dn) : color
identifyDomain(dn, color) : void

identifyIp(ip) : color
identifyIp(ip, color) : void

identifyUrl(url) : color
identifyUrl(url, color) : void

*/

// ----

var hosts = '/list/hosts.whitelist';
var whiteList = '/list/pac.whitelist';
var blackList = '/list/pac.blacklist';

// ---- implements

var init = false;
var black = null;
var white = null;
var cache_d = {};
var cache_i = {};
var cache_u = {};

function start(config){
  black = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.dirname(__filename)+blackList, 'utf8'), black, 'blacklist');
  white = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.dirname(__filename)+blackList, 'utf8'), white, 'whitelist');
  cache_d = {};
  cache_i = {};
  cache_u = {};
  init = true;
  debug("started");
}
exports.start = start;

function stop(){
  init = false;
  cache_d = {};
  cache_i = {};
  cache_u = {};
  black = null;
  white = null;
  debug("stoped");
}
exports.stop = stop;

function identifyDomain(d, v){
  if (!init) throw new Error("NOT_INIT_YET");
  if (v) { // set
    var v0 = cache_d[d];
    cache_d[d] = v;
    if (v0 != v) debug('identifyDomain(%s,%s)', d, v);
    return;
  } else if (d) { // get
    var v = cache_d[d];
    if (!v) {
      v = checkDomain(d);
      cache_d[d] = v;
    }
    // debug('identifyDomain(%s):%s', d, v);
    return v;
  } else { // list
    return list(cache_d);
  }
}
exports.identifyDomain = identifyDomain;

function identifyIp(i, v){
  if (!init) throw new Error("NOT_INIT_YET");
  if (v) { // set
    var v0 = cache_i[i];
    cache_i[i] = v;
    if (v0 != v) debug('identifyIp(%s,%s)', i, v);
    return;
  } else if (i) { // get
    var v = cache_i[i];
    if (!v) {
      v = checkIp(i);
      cache_i[i] = v;
    }
    // debug('identifyIp(%s):%s', i, v);
    return v;
  } else { // list
    return list(cache_i);
  }
}
exports.identifyIp = identifyIp;

function identifyUrl(u, v){
  if (!init) throw new Error("NOT_INIT_YET");
  if (v) { // set
    var v0 = cache_u[u];
    cache_u[u] = v;
    if (v0 = v) debug('identifyUrl(%s,%s)', u, v);
    return;
  } else if (u) { // get
    var v = cache_u[u];
    if (!v) {
      v = checkUrl(u);
      cache_u[u] = v;
    }
    // debug('identifyUrl(%s):%s', u, v);
    return v;
  } else { // list
    return list(cache_u);
  }
}
exports.identifyUrl = identifyUrl;

function checkDomain(d){
/*
  var r = null;
  var u = 'http://'+d;
  var v1 = white.FindProxyForURL(u, d);
  r = (v1 == 'DIRECT') ? 'white' : null;
  if (r) return r;
  var v2 = black.FindProxyForURL(u, d);
  r = (v2 != 'DIRECT') ? 'black' : null;
  if (r) return r;
*/
  return 'gray';
}

function checkIp(i){
  return 'gray';
}

function checkUrl(u){
/*
  var r = null;
  var d = url.parse(u).hostname;
  var v2 = black.FindProxyForURL(u, d);
  r = (v2 != 'DIRECT') ? 'black' : null;
  if (r) return r;
*/
  return 'gray';
}

function list(list){
  var s = '';
  for (var i in list){
    s += list[i] + '\t' + i + '\n';
  }
  return s;
}