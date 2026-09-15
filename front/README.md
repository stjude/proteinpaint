# Proteinpaint Front

The web bundle for window.runproteinpaint(). The intent is for this package to contain
most of the "porcelain" or "portal-like" features of proteinpaint, such as headers
and other elements that are not likely to be shown by an embedder portal. 

The *essential visualization and tracks* code will remain in the proteinpaint-client package,
as these features can be embedded with less bloat by a heavily frameworked embedder portal.
Less dependency bloat in the proteinpaint-client code will also mean more security for
an embedder.

## Usage

This package is used inside a ppfull container (https://github.com/stjude/proteinpaint/pkgs/container/ppfull).
The container image ensures that a matching proteinpaint-server is used to serve the data as expected by 
proteinpaint-client code. Standalone usage outside of a ppfull container is not recommended. From within
the container, the command below is used:

```bash
npx proteinpaint-front
```

## Develop

The usual dev workflow typically focuses on the client workspace development. For troubleshooting builds
for production, the following may be performed:

```bash
# must run the module bundling of proteinpaint-client, either from sjpp dev process or below
cd ../client 
npm run dev

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
