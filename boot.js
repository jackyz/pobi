var http = require('http');
var url = require('url');

var timeout = 2000; // 2'

function encode(str){
  // todo return "AB + AB XOR BASE64(PATH)"
  return str;
}

function load(surl, cb){
  var options = url.parse(surl);
  var req = http.request({
    hostname: options.hostname,
    port: 80,
    method:'GET',
    path: '/',
    agent: false,
    headers: {
      'Content-Type':'image/jpeg',
      'Cookie': encode(url.path)
    }
  }, function(res){
    if (res.statusCode != 200) return cb(res.statusCode);
    var buf = [], len = 0;
    res.on('data', function(d){
      buf.push(d);
      len += d.length;
    });
    res.on('end', function(){
      var c = Buffer.concat(buf, len).toString();
      cb(null, c);
    });
  });
  req.on('error', function(e){
    cb(e);
  });
  // req.setTimeout(timeout);
  req.setTimeout(timeout, function(){
    req.abort();
    // cb('ETIMEOUT');
  });
  req.end();
}

function try_upstreams(upstreams, system, token, cb){
  if (upstreams.length == 0) {
    cb("all_upstreams_failed");
  } else {
    var upstream = upstreams[0];
    var url = 'http://'+upstream+'/'+system+'?token='+token;
    console.log('try upstream %s ...', upstream);
    load(url, function(e,c){
      if (e) {
        console.log('upstream %s failed.', upstream);
	upstreams.shift();
        try_upstreams(upstreams, system, token, cb);
      } else {
        console.log('upstream %s hit.', upstream);
        cb(null, c);
      }
    });
  }
}

function get_local(){
  // todo get ip address of local machine
  return '0.0.0.0';
}

var app = null;

function start(){
  // align params
  var args = process.argv.slice(0); // clone level 1
  args.shift(); args.shift();
  var system = args.shift();
  var s = args.shift().split('@');
  var token = s[0];
  var host = s[1] || get_local();
  var upstreams = args;
  // try upstream
  try_upstreams(upstreams, system, token, function(e,c){
    if(e) {
      console.error('all upstreams fails. reactive please.');
      process.exit(1);
    }
    console.log("start...\n%s", c);
    // app = eval('((function(){'+c+'})())');
    // app.start(host, function(){
    //   console.log('started');
    // });
  });
  // restart automatically to prevent too long connection
  var hour = 3600000; // 1 hour
  setInterval(restart, (system == 'worker') ? hour * 24 : hour);
}

function restart(){
  console.log("shutdown...");
  app.stop(function(){
    start();
  });
}

if(!module.parent){
  start();
}

// node boot system token@host up1 up2 up3

// * starts local(dns/wpad/http/socks5) on 192.168.1.3 for share
// node boot local 12345@192.168.1.3 1.2.3.4 5.6.7.8

// * starts worker on 202.106.107.108 for locals
// node boot worker 12345@202.106.107.108 1.2.3.4 5.6.7.8

// * starts helper on 202.106.107.108 for workers
// node boot helper 12345@202.106.107.108 1.2.3.4 5.6.7.8
