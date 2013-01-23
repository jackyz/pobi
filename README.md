# Pobi Project

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

Install & Run & Config
----------------------

### Install node.js (http://nodejs.org/download/)

### Install pobi (Linux/MacOSX/Windows)

```
npm -g install https://github.com/jackyz/pobi/tarball/master
```

### Run (Linux/MacOSX)
```
## Local DNS is 192.168.1.1 using shadowsocks secure link
DEBUG=* sudo npm -g start pobi --lodns=udp://192.168.1.1:53 --worker=shadow://pass@1.2.3.4:9876
## Local DNS is 192.168.1.1 using socks5 secure link
DEBUG=* sudo npm -g start pobi --lodns=udp://192.168.1.1:53 --worker=socks5://127.0.0.1:1070
```

### Run (Windows)
```
## Local DNS is 192.168.1.1 using shadowsocks secure link
set DEBUG=* && npm -g start pobi --lodns=udp://192.168.1.1:53 --worker=shadow://pass@1.2.3.4:9876
## Local DNS is 192.168.1.1 using socks5 secure link
set DEBUG=* && npm -g start pobi --lodns=udp://192.168.1.1:53 --worker=socks5://127.0.0.1:1070
```

### Config

Point your DNS to ip address that running pobi project. You can set on your own NIC(works for you only) or on your router(works for your local network).

Enable browser's 'Auto Proxy Configure'(works for macosx/linux/ios), or set 'Auto Proxy Configure url' as http://wpad/wpad.dat (works for windows).

* In IE: `Tool` - `Internet Options` - `Connection` - `Lan` - `Use AutoConfig` - Address:`http://wpad/wpad.dat`
* In Safari: `Preference` - `Advanced` - `Proxies` - `Auto Proxy Discovery`
* In Firefox: `Preference` - `Advanced` - `Network` - `Settings` - `Auto-detect proxy setting for this network`

You have done, Enjoy.

Upgrade
-------

Of course we need upgrade, you can do it easy.
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
