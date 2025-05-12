# Installation

## Docker

This is already included in the deps image and other images that use it as a base image.

## Mac

Go to the Downloads directory

```sh
cd ~/Downloads
```

Download the R .pkg file, where `VERSION` is the same version of R specified in Dockerfile (see `proteinpaint/container/deps/Dockerfile`)

arm64-based (Apple silicon):
```sh
curl -O https://cran.r-project.org/bin/macosx/big-sur-arm64/base/R-{VERSION}-arm64.pkg
```

Intel-based:
```sh
curl -O https://cran.r-project.org/bin/macosx/big-sur-x86_64/base/R-{VERSION}-x86_64.pkg
```

Open the .pkg file and follow the installation instructions.

Verify that the correct version of R was installed
```sh
R --version
```

Install R packages
```sh
Rscript ~/dev/sjpp/proteinpaint/R/utils/install.pkgs.R
```

# New R dependencies

To add an R package as a new dependency:
- For a CRAN package, add it to "utils/cran.pkgs.txt"
- For a Bioconductor package, add it to "utils/bioconductor.pkgs.txt"

Then re-build the deps image, as described here: https://github.com/stjude/proteinpaint/wiki/Buiding-a-deps-image
