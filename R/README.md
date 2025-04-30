# Installation

## Docker

This is already included in the deps image and other images that use it as a base image.

## Mac

1. Go to the Downloads directory

```sh
cd ~/Downloads
```

2. Download R .pkg file for same version of R that is used in Docker container

```sh
curl https://cran.r-project.org/bin/macosx/big-sur-arm64/base/R-4.4.3-arm64.pkg -O
```

3. Open the .pkg file and follow the installation instructions

4. Verify that correct version of R was installed by running:

```sh
R
```