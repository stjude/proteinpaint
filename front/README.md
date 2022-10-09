# Proteinpaint Front

The web bundle for window.runproteinpaint(). The intent is for this package to contain
most of the "porcelain" or "portal-like" features of proteinpaint, such as headers
and other elements that are not likely to be shown by an embedder portal. 

The *essential visualization and tracks* code will remain in the proteinpaint-client package,
as these features can be embedded with less bloat by a heavily frameworked embedder portal.
Less dependency bloat in the proteinpaint-client code will also mean more security for
an embedder.

## Usage

You should have a [serverconfig.json](https://docs.google.com/document/d/12s4n1QSOWlxso9zK6L5aZAMuYYdX1Uz4Tu1ECW8tMsk/edit#)
in you project root, with at least a URL property.

Run the following to set a valid public path for the dynamically loaded Proteinpaint bundles.
```bash
npm run proteinpaint-front [URL_PUBLIC_PATH]
```

If you omit the URL_PUBLIC_PATH argument above, then it will default to `'.'`, which assumes that the bundle is served by 
the same PP server. But note that in this case, the web bundle or server host may NOT be embedded or used as host from 
other domains, even if CORS is allowed, since script bundles will not be sourced properly and loaded dynamically.  

## Develop

```bash
# must run the module bundling of proteinpaint-client
cd ../client
npm run rollw

# in another terminal
cd ../front
npm run dev

# NOTE: the public/index.html will use https://proteinpaint.stjude.org as runproteinpaint({host}),
# you can edit it to use localhost or another remote host
```

## Build and Publish

```bash
../deploy.sh
```
