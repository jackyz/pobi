Pobi -- A `Kill You 3000` tool for G.F.W.
=========================================

**What**
Contains a set of servers runs in standard protocol. When running such a node, without install any extra software or configure *anything* (still need enable `auto-detect proxy setting` in some browser), *all* device in your local network will Fan-Qiang automatically.

**BestPractice**
* Setup a virtual machine (in bridge network mode, use static DHCP in router).
* Install and run it (make it auto-start is a good idea).
* Point DNS to this ip in your router.
* You are done. Enjoy it.
__Someone can write a tutourial or make a vm-image, please help.__

**Note**
* In some browser, you still need enable `auto-detect proxy setting`.
* Andriod device still needs install extra app manually. Because it doesn't support any proxy setting at all. (surprise?) ProxyDroid/Shadowsocks/SSH Tunnel would helps.
* To push andriod team kill this 4 years old bug. Please **star** and **broadcast** it: http://code.google.com/p/android/issues/detail?id=1273

**TechDetail**
Protocol: http, socks5, shadow (for now).
Browser: *any browser* ie, safari, chrome, firefox, iOS, kindle.
Platform: macosx windows linux (just the toolchain itself, because it is running standard protocol, so you can use it in any properly platform)

The Diagram
-----------

```
                 +---------------LOCAL----------------+         +--WORKER--+
                 |                                    |         |          |
+-------+        | +---+  +----+  +-----+    +------+ |  +---+  | +------+ |
|Browser| --DNS--> |DNS|  |WPAD|  |HTTP |    |SOCKS5| |  |GFW|  | |SERVER| |
|       | <------- |   |  |    |  |PROXY|    |PROXY | |  |   |  | |      | |
|CHROME |        | +---+  |    |  |     |    |      | |  |   |  | |      | |
|SAFARI | --WPAD PAC----> |    |  |     |    |      | |  |   |  | |      | |
|FIREFOX| <-------------- |    |  |     |    |      | |  |   |  | |      | |
|OPERAE |        |        +----+  |     |    |      | |  |   |  | |      | |
|IE     | --HTTP PROXY----------> |     | -> |      | --ENCODED-> |      | |
|...    | <---------------------- |     | <- |      | <-ENCODED-- |      | |
+-------+        |                +-----+    |      | |  |   |  | |      | |
                 |                           |      | |  |   |  | |      | |
+-------+        |                           |      | |  |   |  | |      | |
|Tools  | --SOCKS5 PROXY-------------------> |      | --ENCODED-> |      | |
|CURL   | <--------------------------------> |      | <-ENCODED-- |      | |
+-------+        |                           +------+ |  +---+  | +------+ |
                 +------------------------------------+         +----------+
```

Install - Test - Run
--------------------

1. Download and install node first. http://nodejs.org/download/
1. Install the tool
```
npm install -g https://github.com/jackyz/pobi/tarball/master
```
1. Run for test.
  - We will run the LOCAL and WORKER with DEBUG flag for testing. All runs on your local machine. So you cannot cross the wall by this configure.
  1. linux/macosx
```bash
# start the LOCAL in a console.
sudo DEBUG=* npm -g start pobi
# start the WORKER in a new console.
sudo DEBUG=* npm -g start pobi --app worker
```
  1. windows
```bash
# start the LOCAL in a console.
set DEBUG=* && npm -g start pobi
# start the WORKER in a new console.
set DEBUG=* && npm -g start pobi --app worker
```
1. Test
```bash
# assuming your ip is 192.168.1.100
# test if DNS is working
dig wpad @192.168.1.100
# set DNS to 192.168.1.100 in your router, or in your network setting
# test if WPAD is working
curl http://wpad/wpad.dat
# test if HTTP PROXY is working
curl -x http://192.168.1.100:8080 http://qq.com
# test if HTTP PROXY TUNNEL is working
curl -x http://192.168.1.100:8080 https://github.com
# test if SOCKS5 PROXY is working
curl -x socks5://192.168.1.100:7070 http://qq.com
```
1. Run for real.
  - We will remove the DEBUG flag in production mode, and obviously, you need a server runs outside. Assuming this server's ip is 1.1.1.1 and running on port 1234, change it to fit your own setting.
  1. on your remote server
```bash
# start the WORKER on your remote server.
npm -g start pobi --app worker --shadow shadow://pass@1.1.1.1:1234
```
  1. on your local machine
    1. linux/macosx
```bash
# start the LOCAL on your local machine, and point to the WORKER
sudo npm -g start pobi --remote shadow://pass@1.1.1.1:1234
```
    1. windows
```bash
# start the LOCAL on your local machine, and point to the WORKER
npm -g start pobi --remote shadow://pass@1.1.1.1:1234`
```
1. Enable `Auto-detect proxy setting`
* In IE: `Tool` - `Internet Options` - `Connection` - `Lan` - `Use AutoConfig` - Address:`http://wpad/wpad.dat`
* In Safari: `Preference` - `Advanced` - `Proxies` - `Auto Proxy Discovery`
* In Firefox: `Preference` - `Advanced` - `Network` - `Settings` - `Auto-detect proxy setting for this network`
__I need volunteer to complete this list.__

Q & A
-----

Why http proxy?

* It's the only proxy protocol works on every device/browser, even for ie6 and opera. and the http proxy is delegate to socks5 proxy, the overhead is very small.

Where is the socks5 proxy?

* It's runs on 7070 port.

How can I disable the logs?

* As above, It's can enable or disable by `DEBUG=*` envirment var.

Thanks
------

* Of course, __The Party__, __The Country__ and __The G.F.W. itself__ first ;)
* XiXiang project: http://code.google.com/p/scholarzhang
* AutoProxyGFWList: http://code.google.com/p/autoproxy-gfwlist
* AutoProxy2Pac: http://autoproxy2pac.appspot.com
* Inspired By Clowwindy's ShadowSocks: https://github.com/clowwindy/shadowsocks-nodejs
* Name was Inspired by Liu Cixin's science fiction `The Three Body Trilogy` (aka. `SanTi`) part II
