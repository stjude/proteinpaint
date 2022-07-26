# GDC Proteinpaint

## Setup

Read the Develop section in proteinpaint/README.md, especially
the *Installation* and *Project Root* sections.

## Build

The following will test and build a Docker image of the Proteinpaint server.

### Support Files

Note that you'd need the expected data files in there including proteinpaint project root
folder [gencode.v36](https://pecan.stjude.cloud/static/hg38/gdc/gencode.hg38.gz). 
NOTE: Other gencode versions may work for limited testing purposes, but not production release.

See the [GDC Proteinpaint instructions](https://docs.google.com/document/d/1wMw2GKvEZSnYjqETJ2HfH3-g5-QfSIP1wlo8Q0p4CJ0/edit#)
to download the required data files:

### Build script

The following script will:
- check out git-tracked files into a tar file
- extract selected artifacts from the tar file into an empty tmppack/ directory
- build a docker image for testing and run the test (todo: create small test data files to not have to create and run this image with a full data mount)
- if the test passes, use the same Dockefile to build the ppserver target

```bash
# create a full image with test spec files and devDependencies
./build/full/build.sh

# extract a subset of build artifacts from the full image
./build/gdc/build.sh -r HEAD -t my/tp/master/dir

# loof for the latest matching ppgdc:$HASH image tag 
# that was created with the HEAD commit hash
$ docker image ls 

# if the test passes and the ppserver target builds, you may run it as
./build/gdc/dockrun.sh your/tpmasterdir 3456 ppgdc:$HASH
```
