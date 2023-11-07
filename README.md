⚠️ This project is not actively maintained

# quassel-webserver
A web client for Quassel (requires a running quasselcore)

:exclamation: Your node version should be at least v16 (v20 recommended).
To install node last version, you can install [nvm](https://github.com/creationix/nvm).

### Screenshots

#### Default
![default theme](https://github.com/magne4000/magne4000.github.com/raw/master/images/quassel-default-1.png)

#### Solarized
![solarized theme](https://github.com/magne4000/magne4000.github.com/raw/master/images/quassel-solarized-1.png)

### Installation

**With git:**

```sh
git clone https://github.com/magne4000/quassel-webserver.git
cd quassel-webserver
npm install --production
```

**With snap:**  
in any of the [supported Linux distributions](http://snapcraft.io/docs/core/install#ubuntu):
(Note that this is not yet stable)

```sh
snap install quassel-webserver --candidate
```

**On NixOS:**  
There is a NixOS module available in NixOS 17.03 and above. Just add these lines to your /etc/nixos/configuration.nix

```nix
  services.quassel-webserver = {
    enable = true;
  };
```

For more configuration options in NixOS check out `man configuration.nix`.

### Development
Get the code and install the server with: 
```sh
git clone https://github.com/magne4000/quassel-webserver.git
cd quassel-webserver
npm install
```
#### Update
Update the server with: 
```sh
git pull && npm prune && npm update
```

and run the following command: `node app.js`

The server is now running.

#### Settings
It is recommended to copy settings.cjs file to a new settings-user.cjs file
```
cp settings.cjs settings-user.cjs
```
File `settings-user.cjs` can then be modified to specify default quasselcore `host` and `port`.  
All available settings are described in `settings.cjs` file.

#### Certificate
You must use your own certificate for https mode. The key file is located at ssl/key.pem, and the certificate ssl/cert.pem.

You can generate a new self signed certificate with the following command:
```
openssl req -x509 -newkey rsa:2048 -keyout ssl/key.pem -out ssl/cert.pem -nodes
```

#### Usage
```
  Usage: app [options]

  Options:

    -h, --help            output usage information
    -V, --version         output the version number
    -c, --config <value>  Path to configuration file
    -s, --socket <path>   listen on local socket. If this option is set, --listen, --port and --mode are ignored
    -l, --listen <value>  listening address [0.0.0.0]
    -p, --port <value>    http(s) port to use [64080|64443]
    -m, --mode <value>    http mode (http|https) [https]
```

#### Init script
Startup scripts are available in `scripts` directory.
```
# SysVinit
cp scripts/startup /etc/init.d/quasselweb
# systemd
cp scripts/quassel-webserver.service /lib/systemd/system/quassel-webserver.service
```
For the sysvinit script, be sure to change `BASEDIR`, `RUNASUSER` and `RUNASGROUP` vars.  
For the systemd script, you must customize `ExecStart`, `User` and `Group` to suit your needs.

### In the browser
Just go to https://your.tld:64443 and enter your quasselcore information and credentials.

### Reverse proxies
If you want to access quassel-webserver behind a reverse proxy, here are some tips.

#### Socket mode
You can launch quassel-webserver in local socket mode by adding `-s <path/to/qws.run>` to the command line. The specified path must point to a non-existent file, as it will be created by the application.

#### HTTP mode
You can launch quassel-webserver in http mode by adding `-m http` to the command line.
This tells the webserver to run in `http` mode, and to listen on port `64080`.  
This way you can let your `apache` or `nginx` server handle the SSL layer.

#### Reverse proxy on https://your.tld/quassel
If you run behind `/quassel` location on your webserver, do not forget to edit `settings-user.cjs` file
```json
...
prefixpath: '/quassel',
...
```
Also, be sure to launch quassel-webserver in http mode by adding `-m http` to the command line, optionally including `-l localhost` to block direct outside connections from bypassing the proxy server.
You can also start quassel-webserver in socket mode by instead specifying `-s <path/to/qws.run>`.
#### nginx
```nginx
upstream quassel {
    server http://127.0.0.1:64080
    # or for socket, uncomment following line, and comment previous line
    # server unix:/path/to/qws.run;
}

# rewrite ^[/]quassel$ /quassel/ permanent;
location /quassel {
    proxy_pass http://quassel/quassel;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_http_version 1.1;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
    proxy_redirect off;
}
```

#### Apache
You will need mod_proxy_wstunnel and mod_rewrite.

To proxy to a server over TCP:

```apache
<VirtualHost ...>
...
RewriteEngine on
RewriteCond %{HTTP:Connection} Upgrade [NC]
RewriteCond %{HTTP:Upgrade} websocket [NC]
RewriteRule /quassel/(.*) ws://127.0.0.1:64080/quassel/$1 [P,L]
ProxyPass /quassel http://127.0.0.1:64080/quassel
...
</VirtualHost>
```

or to proxy to a unix domain socket:

```apache
<VirtualHost ...>
  RewriteEngine On
  <Location /quassel>
    RewriteCond %{HTTP:UPGRADE} ^WebSocket$ [NC]
    RewriteCond %{HTTP:CONNECTION} Upgrade$ [NC]
    RewriteRule .* unix:///var/run/quasselweb.socket|ws://localhost/quassel/$1 [P,L,NE]

    ProxyPass unix:///var/run/quasselweb.socket|http://localhost/quassel
  </Location>
</VirtualHost>
```

(Note that you need the [NE] flag to prevent the "|" from being escaped)

### Troubleshooting
#### Slow buffer display after some time
This is a [known issue](https://github.com/magne4000/quassel-webserver/issues/83) but there is a workaround:
 * go to the `General Configuration` and check `Trim buffer when switching to another buffer`. This is also configurable in `settings-user.cjs` file (see `settings.cjs`)

#### In socket mode : Error: listen EADDRINUSE
It means that quassel-webserver has been killed prematurely. You just have to manually delete `<path/to/qws.run>` file.

## Support
`#quassel-webserver` on Freenode

## License
Copyright (c) 2019 Joël Charles  
Licensed under the MIT license.
