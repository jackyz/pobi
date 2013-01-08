#A 'Kill You 3000' tool for G.F.W.

What
----
Running such a node, without *any configure* or install *any other software*, **enables all devices in your local network Fan-Qiang automatically**.

* You still need enable browser's built-in `auto-detect proxy` feature, at least once.
* Andriod device still need install extra app manually. Because it doesn't built-in any proxy setting at all. (surprise?) Apps like ProxyDroid / Shadowsocks / SSH Tunnel would helps. To push andriod team to kill this 4 years old bug. Please **star** and **broadcast**: http://code.google.com/p/android/issues/detail?id=1273

Best Practice
-------------
* Setup a virtual machine (in bridge network mode, use static DHCP in router).
* Install and run it (auto-start is a good idea).
* Point DNS to this ip in router.
* You are done. Enjoy.

_Can someone helps to write a tutourial or make a vm-image?_

How
---
It starts a set of servers locally. Those servers take overs all the complexity of Fan-Qiang. The `hosts`, the `pac`, the `front proxy` etc. So, the only thing you need is an usable remote worker.
* A DNS server to deal with DNS poison.
* A WPAD server to dispatch auto-config proxy rules.
* DNS and WPAD uses a same modified version of GFWList2PAC, only proxy when nessary.
* A HTTP PROXY server for browsers (IE/Opera) and forward requests to SOCKS5 PROXY server.
* A SOCKS5 PROXY server for other tools (curl/skype/...) and encode data then forward request to remote WORKER.
* Obviously, each part could replaceable and upgradable.

Diagram
-------
```
                 +---------------LOCAL----------------+         +--WORKER--+
                 |                                    |         |          |
+-------+        | +---+  +----+  +-----+    +------+ |  +---+  | +------+ |
|Browser| --DNS--> |DNS|  |WPAD|  |HTTP |    |SOCKS5| |  |GFW|  | |SERVER| |
|       | <------- |   |  |    |  |PROXY|    |PROXY | |  |   |  | |      | |
|chrome |        | +---+  |    |  |     |    |      | |  |   |  | |      | |
|safari | --WPAD PAC----> |    |  |     |    |      | |  |   |  | |      | |
|firefox| <-------------- |    |  |     |    |      | |  |   |  | |      | |
|opera  |        |        +----+  |     |    |      | |  |   |  | |      | |
|ie     | --HTTP PROXY----------> |     | -> |      | --ENCODED-> |      | |
|...    | <---------------------- |     | <- |      | <-ENCODED-- |      | |
+-------+        |                +-----+    |      | |  |   |  | |      | |
                 |                           |      | |  |   |  | |      | |
+-------+        |                           |      | |  |   |  | |      | |
|Tools  | --SOCKS5 PROXY-------------------> |      | --ENCODED-> |      | |
|curl   | <--------------------------------> |      | <-ENCODED-- |      | |
+-------+        |                           +------+ |  +---+  | +------+ |
                 +------------------------------------+         +----------+
```

What Not
--------
* Not a sevice, just a tool. You still need your own outside server.
* Nothing magic, just a set of standard protocol services.

Install - Test - Run
--------------------

###Install node

Go http://nodejs.org/download/ download and install the latest version.

###Install pobi

```
npm -g install https://github.com/jackyz/pobi/tarball/master
```

_I'm not sure if it's the right place, any suggestion?_

###Run for test

We will run the LOCAL and WORKER with DEBUG flag for testing. All runs on your local machine. So you cannot cross the wall by this configure.

  * linux/macosx

```bash
# start the LOCAL in a console.
# LOCAL needs port 80 and 53, so need sudo
sudo DEBUG=* npm -g start pobi
# start the WORKER in a new console.
DEBUG=* npm -g start pobi --app=worker
```

  * windows

```bash
# start the LOCAL in a console.
set DEBUG=* && npm -g start pobi
# start the WORKER in a new console.
set DEBUG=* && npm -g start pobi --app=worker
```

###Test

```bash
# assuming your ip is 192.168.1.100
# test if DNS is working (linux/macosx)
dig wpad @192.168.1.100
# test if DNS is working (windows)
nslookup wpad 192.168.1.100
# test if DNS clean is working
dig twitter.com @192.168.1.100
# set DNS to 192.168.1.100 in your router, or network setting
# test if WPAD is working
curl http://wpad/wpad.dat
# test if HTTP PROXY is working
curl -x http://192.168.1.100:8080 http://qq.com
# test if HTTP PROXY tunnel is working
curl -x http://192.168.1.100:8080 https://github.com
# test if SOCKS5 PROXY is working
curl -x socks5://192.168.1.100:7070 http://qq.com
```

###Run for real

We will remove the DEBUG flag in production mode, and obviously, you need a server runs outside. Assuming this server's ip is 1.1.1.1 and running on port 1234, change it to fit your own setting.

  * on your remote server

```bash
# start the WORKER on your remote server.
npm -g start pobi --app=worker --shadow=shadow://pass@1.1.1.1:1234
```

  * on your local machine (linux/macosx)

```bash
# start the LOCAL on your local machine, and point to the WORKER
# LOCAL needs port 80 and 53, so need sudos
sudo npm -g start pobi --worker=shadow://pass@1.1.1.1:1234
```

  * on your local machine (windows)

```bash
# start the LOCAL on your local machine, and point to the WORKER
npm -g start pobi --worker=shadow://pass@1.1.1.1:1234
```

### Enable `Auto-detect proxy`

* In IE: `Tool` - `Internet Options` - `Connection` - `Lan` - `Use AutoConfig` - Address:`http://wpad/wpad.dat`
* In Safari: `Preference` - `Advanced` - `Proxies` - `Auto Proxy Discovery`
* In Firefox: `Preference` - `Advanced` - `Network` - `Settings` - `Auto-detect proxy setting for this network`

_I need volunteer to complete this list._

###Upgrade

Because this package was not added to the npm repo(I don't want to make npm was block too). So `npm update` just doesn't work. But you can upgrade easily by remove and install again.

```
npm -g remove pobi
npm -g install https://github.com/jackyz/pobi/tarball/master
```

Q & A
-----

Why old http proxy protocol?

* It's the only proxy protocol works on every browser, even for old ie5.5 and opera. And the http proxy is delegate to socks5 proxy, the overhead is small. You could test by your own.

```
# direct
time for i in `seq 1 10`; do curl http://qq.com > /dev/null; done
# via http proxy
time for i in `seq 1 10`; do curl -x http://192.168.1.100:8080 http://qq.com > /dev/null; done
# via socks5 proxy
time for i in `seq 1 10`; do curl -x socks5://192.168.1.100:7070 http://qq.com > /dev/null; done
```

Can I use my ssh-D link instead?

* Of course. You can switch between upstreams, just start LOCAL like this.

```
# assume your ssh -D link is `ssh -D1080 YOUR-SERVER`
sudo npm -g start pobi --worker=socks5://191.168.1.100:1080
```

What if I found a bug?

* Submit an issues here.

Thanks
------

* Of course, __The Party__, __The Country__ and __The G.F.W.__ must be first ;)
* XiXiang project: http://code.google.com/p/scholarzhang
* AutoProxyGFWList: http://code.google.com/p/autoproxy-gfwlist
* AutoProxy2Pac: http://autoproxy2pac.appspot.com
* Inspired By Clowwindy's ShadowSocks: https://github.com/clowwindy/shadowsocks-nodejs
* Name was Inspired by Liu Cixin's science fiction `The Three Body Trilogy` (aka. `SanTi`) part II
