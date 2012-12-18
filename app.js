
require('./dns').start({port:53});
require('./wpad').start({port:80});
require('./proxy').start({port:8080});

/*

var utoken = process.args[1];
var server = process.args[2] || 'default.com';
usync(server, utoken, function(e, config){
  config.gfw_domains = [  // domain / wpad global
    "twitter.com", "facebook.com"
  ];
  config.session = [  // remote / user only
    {url: 'http://1.2.3.4:8088/path1', ttoken:'v1-everyserver'},
    {url: 'http://1.2.3.4:8088/path2', ttoken:'v2-everyserver'},
    {url: 'http://1.2.3.4:8088/path3', ttoken:'v3-everyserver'}
    ttoken : "everylogin" // each login has a diffrent ttoken
  ];
  config.account = {
    expire : '20120106',
    today : {
      max : 100M,
      used : 20M
    },
  };
});
ssync(server, url, stoken, function(e, config){
  config.account = {
      total : { max : 100G, used: 80G}
  },
  ttoken : "v1-everysync"
});
server: sid stoken url email
server-accont: sid day_max day_used status
server-session: sid cstoken lasttime

server-data: cstoken lasttime
server-data: ip cutoken
server-data: ip used

server -> ssync([ip,used]) -> cstoken 
user -> usync -> cutoken

user: uid utoken email
user-account: uid expire day_max day_used status
user-bills: uid date amount day_max expire note
user-session: uid ip cutoken lasttime sid cstoken sid cstoken

var local_ip = getParam('local') || getLocalIp() || "127.0.0.1";
var config_ip = dns.resolveGfw(config_domain);
var config = fetch_config(ip);

var gfw_domains = config.gfw_domains;
dns.start({gfw:gfw_domains,port:53});
wpad.start({gfw:gfw_domains,proxy:localhost_ip,port:80});
proxy.start({gfw:gfw_domains,port:8080});

app.on('error', reloadConfig);

*/
