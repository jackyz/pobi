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

identifyIp(dn, ip) : color
identifyIp(dn, ip, color) : void

identifyUrl(dn, url) : color
identifyUrl(dn, url, color) : void

*/

// ----

var hosts = '/list/hosts.whitelist';
var whiteList = '/list/pac.whitelist';
var blackList = '/list/pac.blacklist';

// ---- implements

var init = false;
var black = null;
var white = null;
var cache = {};

function start(config){
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
  debug("stoped");
}
exports.stop = stop;

function identifyDomain(d, v){
  if (!init) throw new Error("NOT_INIT_YET");
  if (v) { // set
    var v0 = (cache[d] || {}).dns;
    if (!cache[d]) cache[d] = {};
    cache[d].dns = v;
    if (v0 != v) debug('identifyDomain(%s,%s)', d, v);
    return;
  } else if (d) { // get domain
    var v = (cache[d] || {}).dns;
    if (!v) {
      v = checkDomain(d);
      if (!cache[d]) cache[d] = {};
      cache[d].dns = v;
    }
    // debug('identifyDomain(%s):%s', d, v);
    return v;
  } else { // list all
    return listAll(cache);
  }
}
exports.identifyDomain = identifyDomain;

function identifyIp(d, i, v){
  if (!init) throw new Error("NOT_INIT_YET");
  if (v) { // set
    var v0 = ((cache[d] || {}).ips || {})[i];
    if (!cache[d]) cache[d] = {};
    if (!cache[d].ips) cache[d].ips = {};
    cache[d].ips[i] = v;
    if (v0 != v) debug('identifyIp(%s,%s,%s)', d, i, v);
    return;
  } else if (d && i) { // get
    var v = ((cache[d] || {}).ips || {})[i];
    if (!v) {
      v = checkIp(i);
      if (!cache[d]) cache[d] = {};
      if (!cache[d].ips) cache[d].ips = {};
      cache[d].ips[i] = v;
    }
    // debug('identifyIp(%d,%s):%s', d, i, v);
    return v;
  } else if (d) { // list ips by domain
    return list(((cache[d] || {}).ips || {}));
  } else { // list all
    return listAll(cache);
  }
}
exports.identifyIp = identifyIp;

function identifyUrl(d, u, v){
  if (!init) throw new Error("NOT_INIT_YET");
  if (v) { // set
    var v0 = ((cache[d] || {}).url || {})[u];
    if (!cache[d]) cache[d] = {};
    if (!cache[d].url) cache[d].url = {};
    cache[d].url[u] = v;
    if (v0 = v) debug('identifyUrl(%s,%s,%s)', d, u, v);
    return;
  } else if (d && u) { // get
    var v = ((cache[d] || {}).url || {})[u];
    if (!v) {
      v = checkUrl(u);
      if (!cache[d]) cache[d] = {};
      if (!cache[d].url) cache[d].url = {};
      cache[d].url[u] = v;
    }
    // debug('identifyUrl(%s,%s):%s', d, u, v);
    return v;
  } else if (d) { // list url by domain
    return list(((cache[d] || {}).url || {}));
  } else { // list all
    return listAll(cache);
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

function listAll(cache){
  var s = '';
  for (var i in cache){
    s += '\n' + ((cache[i] || {}).dns || 'gray') + '\t' + i + '\n';  // dns
    // s += '# ip:\n';
    s += list(((cache[i] || {}).ips || {})); // ips color
    // s += '# url:\n'
    s += list(((cache[i] || {}).url || {})); // url color
  }
  return s;
}