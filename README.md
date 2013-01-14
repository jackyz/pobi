#A 'Kill You 3000' tool for G.F.W.

What
----
Running such a node, without *any configure* or install *any other software*, **enables all devices in your local network Fan-Qiang automatically**.

* You still need enable browser's built-in `auto-detect proxy` feature, at least once.
* Andriod device still need install extra app manually. Because it doesn't built-in any proxy setting at all. (surprise?) Apps like ProxyDroid / Shadowsocks / SSH Tunnel would helps. To push andriod team to kill this 4 years old bug. Please **star** and **broadcast**: http://code.google.com/p/android/issues/detail?id=1273

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
* Not a FQ protocol, just use it.
* Not a FQ sevice, You still need your own FQ protocol.
* Nothing magic, just put HOSTS/PAC/WhatEver pices together.

Install & Run
-------------

###Install & Run

install node.js first. (http://nodejs.org/download/)

```
npm -g install https://github.com/jackyz/pobi/tarball/master
npm -g start pobi --ldns=udp://192.168.1.1:53 --worker=shadow://pass@127.0.0.1:1027
```

Assuming your local DNS is `192.168.1.1:53` and your shadowsocks runs on `127.0.0.1:1027` with password `pass`.

### Enable `Auto-detect proxy` in your browser

* In IE: `Tool` - `Internet Options` - `Connection` - `Lan` - `Use AutoConfig` - Address:`http://wpad/wpad.dat`
* In Safari: `Preference` - `Advanced` - `Proxies` - `Auto Proxy Discovery`
* In Firefox: `Preference` - `Advanced` - `Network` - `Settings` - `Auto-detect proxy setting for this network`

You are done, ENJOY.

_I need volunteer to complete this list._

###Upgrade

```
npm -g remove pobi
npm -g install https://github.com/jackyz/pobi/tarball/master
```

Thanks
------

* Of course, __The Party__, __The Country__ and __The G.F.W.__ must be first ;)
* XiXiang project: http://code.google.com/p/scholarzhang
* AutoProxyGFWList: http://code.google.com/p/autoproxy-gfwlist
* AutoProxy2Pac: http://autoproxy2pac.appspot.com
* GFWWhiteList: https://github.com/n0wa11/gfw_whitelist
* Inspired By Clowwindy's ShadowSocks: https://github.com/clowwindy/shadowsocks-nodejs
* Name was Inspired by Liu Cixin's science fiction `The Three Body Trilogy` (aka. `SanTi`) part II
