var fs = require('fs')
  , path = require('path')
  , vm = require('vm')
  , url = require('url')
  , debug = require('./debug')('GFW');

// ----

var hosts = '/list/hosts.whitelist';
var whiteList = '/list/pac.whitelist';
var blackList = '/list/pac.blacklist';

// ---- implements

var init = false;
var black = null;
var white = null;
var cache = {};

/*

domain : the domain name
color : white | gray | black | fail :: the color
ip : string | null :: ip address
url : string | null :: the url string
error : ECONNRESET | ETIMEOUT | null
established : true | false | null

DNS:  gfw.isDomainBlocked(domain) : true | false
HTTP: gfw.isDomainBlocked(domain) : true | false
HTTP: gfw.reportDomainBlock(domain) : void
HTTP: gfw.isUrlBlocked(url) : true | false
HTTP: gfw.reportUrlBlock(url) : void


DNS:  gfw.identifyDomain(domain, function next(color,ip){ });
DNS:  gfw.feedbackDomain(domain,color,ips,ttl, function next(){ });
HTTP: gfw.identifyUrl(url, function next(color,ip){ });
HTTP: gfw.feedbackUrl(color,ip,url,error,established, function next(){ });

IP Domain1,Domain2

+-------- DNS -------+---- HTTP ----+
| Domain | IPS | TTL | D | U | URLS |
+-----------------------------------+

+---- Blocked Ip ----+
| IP           | TTL |
+--------------------+

*/

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
