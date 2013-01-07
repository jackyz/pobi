var debug = require('./debug')('GFW')
  , app = require('./app')
  , vm = require('vm')
  , fs = require('fs')
  , path = require('path');

// ---- exports

exports.start = start;
exports.stop = stop;

exports.isGfw = isGfw;
exports.getPac = getPac;

// ---- implements

var pac = null;
var ctx = null;

var keys = [];
var cache = {};

function start(config){
  var proxy = config.pac.proxy || "DIRECT";
  pac = app.tmpl(fs.readFileSync(path.dirname(__filename)+'/'+config.pac.template, 'utf8'), {proxy:proxy});
  ctx = vm.createContext({});
  vm.runInContext(pac, ctx, 'wpad.dat');
  debug("started");
}

function stop(){
  pac = null;
  ctx = null;
  keys = [];
  cache = {};
  debug("stoped");
}

function isGfw(d){
  if (pac == null) throw "NOT_INIT_YET";
  // use cache to speed up
  var r = cache[d];
  if (r !== undefined) return r;
  r = (ctx.FindProxyForURL('http://'+d, d) != 'DIRECT');
  cache[d] = r;
  return r;
}

function getPac(){
  if (pac == null) throw "NOT_INIT_YET";
  return pac;
}

function endsWith(str, postfix){
  if (str.length < postfix.length) return false;
  return postfix == str.substr(str.length - postfix.length, postfix.length);
}
