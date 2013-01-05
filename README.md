Pobi Project
============

Purpose: A simple Fan-Qiang solution you can set it up for your old man.

_The name was Inspired by Liu Cixin's science fiction `The Three Body Trilogy` (aka. `SanTi`) part II._

Diagram
-------

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

Install & Run
-------------

Download and install for your platform http://nodejs.org/download/
Install by `npm install -g pobi`
Run by `sudo npm start pobi`

**Test running**

* testing dns try `dig wpad @127.0.0.1` or `nslookup wpad 127.0.0.1`
* testing wpad try `curl http://wpad/wpad.dat`
* testing http proxy try `curl -x http://127.0.0.1:8080 http://qq.com`
* testing http tunnel try `curl -x http://127.0.0.1:8080 https://github.com`
* testing socks5 proxy try `curl -x socks5://127.0.0.1:7070 http://qq.com`

**Setting up**

Pointing dns to 127.0.0.1 (or you can set it in your router)
Setting proxy `automaticlly config by network`. for ie/xp or other system don't support autoconfig, point pac to http://wpad/wpad.dat

Q & A
-----

Why http proxy?

* It's the only proxy protocol works on every device/browser, even ie6.

Thanks
------

* GFW White List: https://github.com/n0wa11/gfw_whitelist
