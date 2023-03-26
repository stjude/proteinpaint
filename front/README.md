# Proteinpaint Front

The web bundle for window.runproteinpaint(). The intent is for this package to contain
most of the "porcelain" or "portal-like" features of proteinpaint, such as headers
and other elements that are not likely to be shown by an embedder portal. 

The *essential visualization and tracks* code will remain in the proteinpaint-client package,
as these features can be embedded with less bloat by a heavily frameworked embedder portal.
Less dependency bloat in the proteinpaint-client code will also mean more security for
an embedder.

## Usage

The recommended usage is to include a postinstall script in your project as follows.
```json
	"scripts": {
		"postinstall": "proteinpaint-front https://my.host.tld"
	}
```

You can manually test your project's postinstall lifecyle script by running the following
to extract the Proteinpaint bundles, with the correct public path for the dynamically 
loaded Proteinpaint bundles.
```bash
npx proteinpaint-front [URL_PUBLIC_PATH]
```

If you omit the URL_PUBLIC_PATH argument above, then it will default to `'.'`, which assumes that the bundle is served by 
the same PP server. But note that in this case, the web bundle or server host may NOT be embedded or used as host from 
other domains, even if CORS is allowed, since script bundles will not be sourced properly and loaded dynamically.

Note that you can serve the web bundle using the Proteinpaint server or any web server,
see the example in the Develop section.

## Develop

```bash
# must run the module bundling of proteinpaint-client
cd ../client
npm run rollw

# in another terminal
cd ../front
npm run dev

# NOTE: the public/index.html will use https://proteinpaint.stjude.org as runproteinpaint({host}),
# you can edit the host to use localhost or another remote host. You can use any web server to 
# serve the web bundle separately from the PP API host, for example
cd public # the subdirectory under proteinpaint/front/
python3 -m http.server
```

## Build

```bash
npm pack
```

## Release

Use Github Actions to coordinate the release of related package updates.
The package versioning, build, and deployment uses the standard npm tooling under the hood
(`version`, `pack`, and `publish`, respectively).
