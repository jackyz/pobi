Pobi Project
============

Purpose: A simple Fan-Qiang solution you can set it up for your old man.

_The name was Inspired by Liu Cixin's science fiction `The Three Body Trilogy` (aka. `SanTi`) part II._

Components
----------

* LOCAL runs on local host or local network.
    * DNS: a DNS server to antidote dns poison of the wall.
    * WPAD: a WPAD server to provide proxy rules auto discovery.
    * PROXY: a HTTP PROXY server for browsers, forward masked data to WORKERS.
* WORKERS runs on somewhere outside of the Wall.
    * unmask data and perform the jobs.
* HELPERS runs on somewhere outside of the Wall
    * helps to make connect between PROXY and WORKERS.

_For now, we just have a DO-NOTHING `LOCAL`, but it works (for early adapters, you can understand how it works). Due to the plugable `WORKERS` and protocls is not ready. We are still work on it._

Install & Run
-------------

#### LOCAL

`npm install -g pobi`

**Easy mode**

`sudo DEBUG=* node pobi`

This starts up a dns on port 53, a wpad on port 80 (that's why we need the root permission) as well as a http proxy runs on port 8080.

By setting this ip as your network's DNS in your router. You can use `Auto-detect proxy settings for this network` in your browser's network/proxy setting. And all computers in this network will be configured automatically, if you are lucky. It work for Mac OSX and iOS device, but windows (if you do not join any domain) and andriod (it doesn't have an config yet, damm it) just not work.

If you don't want to change the router (or you cann't). Just set `Automatic proxy configuration URL` to `http://127.0.0.1/wpad.dat` in your network/proxy setting interface.

Now you can browsing sites you will see how it's working (because we do nothing on worker yet, so you cannot access gfwed sites for now, we are working on it).

**Tips**

* testing dns try `dig twitter.com @127.0.0.1`
* testing wpad try `curl http://127.0.0.1/wpad.dat`
* testing http proxy try `curl -x 127.0.0.1:8080 http://qq.com`
* testing http tunnel try `curl -x 127.0.0.1:8080 https://github.com`

**Proxy only**

`DEBUG=* node pobi`

This starts up only a http proxy on 8080. you need not the root permission. But you need more config.

You need `Manually proxy configuration` set HTTP proxy to `127.0.0.1:8080`.

#### WORKERS
#### HELPERS

comming soon...

Q & A
-----

Why http proxy?

* It's the only proxy protocol works on every device/browser, even ie6.

Where is socks5?

* It's on the way.

Thanks
------

* GFW White List: https://github.com/n0wa11/gfw_whitelist

