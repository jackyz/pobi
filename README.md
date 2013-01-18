# 翻墙工具链

目标
----

“不折腾”翻墙。用 pobi 接入你的安全链接，最简配置，即可达到“全网翻墙”效果。尚不完美：

* 需接管 DNS 解析(可在路由器上一次配置)
* 需开启浏览器内置的“自动配置代理”选项
* Android 设备尚不支持任何形式的代理，需安装软件
* pobi 是安全链接的接入工具，无法替代安全链接本身

示意图
------
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

原理
----

本地的 DNS 代理接管域名解析，对未屏蔽域名用本地 DNS ，对被屏蔽域名用外部 DNS (走 TCP 防干扰)

本地的 WPAD 提供浏览器所需的 PAC 规则文件

本地的 HTTP PROXY 会对未屏蔽地址直接连接，对屏蔽地址使用安全连接，对未知地址则会先尝试直连，失败再用安全连接自动重连

本地的 SOCKS PROXY 负责接入安全连接穿墙，会在多个链接之间轮换，以弱化“主机行为特征”(尚未实现，有待升级)

安装 & 运行 & 配置
------------------

安装适用于本机平台的 node.js (http://nodejs.org/download/)

安装 pobi (Linux/MacOSX/Windows)

```
npm -g install https://github.com/jackyz/pobi/tarball/master
```

运行 (Linux/MacOSX)
```
## 指明本地 dns 为 192.168.1.1 接入 shadowsocks 协议的安全链接
DEBUG=* sudo npm -g start pobi --lodns=udp://192.168.1.1:53 --worker=shadow://pass@1.2.3.4:9876
## 指明本地 dns 为 192.168.1.1 接入 socks5 协议的安全链接
DEBUG=* sudo npm -g start pobi --lodns=udp://192.168.1.1:53 --worker=socks5://127.0.0.1:1070
```

运行 (Windows)
```
## 指明本地 dns 为 192.168.1.1 接入 shadowsocks 协议的安全链接
set DEBUG=* && npm -g start pobi --lodns=udp://192.168.1.1:53 --worker=shadow://pass@1.2.3.4:9876
## 指明本地 dns 为 192.168.1.1 接入 socks5 协议的安全链接
set DEBUG=* && npm -g start pobi --lodns=udp://192.168.1.1:53 --worker=socks5://127.0.0.1:1070
```

将 DNS 指向运行 pobi 节点的 ip 地址 (在“本机网络”或“路由器”上设置均可，前者只对本机生效，后者对接入路由器的所有设备生效)

在浏览器的代理设置里打开“自动配置代理”(macosx/linux/ios 平台)，或将“代理自动配置地址”设为 http://wpad/wpad.dat (windows 平台)

配置完成，可正常浏览

升级
---

pobi 不定期升级，升级步骤如下(卸载重装)

```
npm -g remove pobi
npm -g install https://github.com/jackyz/pobi/tarball/master
```



What
----
Running such a node, without *any configure* or install *any other software*, **enables all devices in your local network Fan-Qiang automatically**.

* You still need enable browser's built-in `auto-detect proxy` feature, at least once.
* Andriod device still need install extra app manually. Because it doesn't built-in any proxy setting at all. (surprise?) Apps like ProxyDroid / Shadowsocks / SSH Tunnel would helps. To push andriod team to kill this 4 years old bug. Please **star** and **broadcast**: http://code.google.com/p/android/issues/detail?id=1273


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
npm -g start pobi --lodns=udp://192.168.1.1:53 --worker=shadow://pass@1.2.3.4:9876
npm -g start pobi --lodns=udp://192.168.1.1:53 --worker=socks5://127.0.0.1:1070
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
