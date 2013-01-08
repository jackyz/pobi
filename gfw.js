var fs = require('fs')
  , path = require('path')
  , vm = require('vm')
  , server = require('./server')
  , debug = require('./debug')('GFW');

// ---- implements

var pac = null;
var ctx = null;

var keys = [];
var cache = {};

// ----

var template = '/gfw.tmpl'; // gfw pac template

function start(config){
  var proxy = config.proxy || "DIRECT";
  var t = fs.readFileSync(path.dirname(__filename)+template, 'utf8');
  pac = server.tmpl(t, {proxy:proxy});
  ctx = vm.createContext({});
  vm.runInContext(pac, ctx, 'wpad.dat');
  debug("started");
}
exports.start = start;

function stop(){
  pac = null;
  ctx = null;
  keys = [];
  cache = {};
  debug("stoped");
}
exports.stop = stop;

function isGfw(d){
  if (pac == null) throw "NOT_INIT_YET";
  // use cache to speed up
  var r = cache[d];
  if (r !== undefined) return r;
  r = (ctx.FindProxyForURL('http://'+d, d) != 'DIRECT');
  cache[d] = r;
  return r;
}
exports.isGfw = isGfw;

function getPac(){
  if (pac == null) throw "NOT_INIT_YET";
  return pac;
}
exports.getPac = getPac;
