# Installation

## Docker

This is already included in the deps image and other images that use it as a base image.

## Mac

1. Go to the Downloads directory

```sh
cd ~/Downloads
```

2. Download the R .pkg file, where `VERSION` is the same version of R specified in Dockerfile (see `proteinpaint/container/deps/Dockerfile`)

```sh
curl https://cran.r-project.org/bin/macosx/big-sur-arm64/base/R-{VERSION}-arm64.pkg -O
```

3. Open the .pkg file and follow the installation instructions

4. Verify that the correct version of R was installed

```sh
R --version
```

5. Install R libraries

```sh
# open R
R
```
```R
# install R libraries specified in Dockerfile
# see "proteinpaint/container/deps/Dockerfile"
install.packages(...)
BiocManager::install(...)
```