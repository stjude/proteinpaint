# GDC Proteinpaint

These instructions are for SJ developers who are preparing to push a new release to the GDC-NCI repository.

## Setup

Read the Develop section in proteinpaint/README.md, especially
the *Installation* and *Project Root* sections.

## Pre-release Build

The following will test and build a Docker image of the Proteinpaint server,
before pushing to the GDC repo. You will need to regenerate cached test data per the [packaging section for GDC](https://docs.google.com/document/d/13gUdU9UrHFkdspcQgc6ToRZJsrdFM4LCwCg7g1SQc4Q/edit#heading=h.u8e2rtguf36g).

### Support Files

Note that you'd need to a serverconfig.json at the proteinpaint/ project root
folder, and the expected data files in there including
[gencode.v22](https://pecan.stjude.cloud/static/hg38/gdc/gencode.v22.hg38.gz).

You may use a helper script to install these support files:

```bash
# run the following command to show help messages from the script.
node utils/install.pp.js 

# Do the following command to list all available files for download, 
# as well as the file sizes. This can verify that your server is able 
# to access these files over the Internet.
node utils/install.pp.js -v
```
Follow the instructions to prepare a config file. Example file may look like below.
Note that the two columns should be separated by a single tab.
```text
URL        https://pp.mycompany.com
TP         /home/user/data/tp/
CACHE      /home/user/data/cache/
BINPATH    /home/user/data/tools/
PYTHON3    python
GENOMES    hg19
```
Run the script with the config file and perform the installation:
```bash
node utils/install.pp.js -c <configFile>
```

### Build script

The following script will:
- check out git-tracked files into a tar file
- extract selected artifacts from the tar file into an empty tmppack/ directory
- build a docker image for testing and run the test (todo: create small test data files to not have to create and run this image with a full data mount)
- if the test passes, use the same Dockefile to build the ppserver target

```bash
./build/gdc/prepush/build.sh -r HEAD -t my/tp/master/dir

# loof for the latest matching ppgdc:$HASH image tag 
# that was created with the HEAD commit hash
$ docker image ls 

# if the test passes and the ppserver target builds, you may run it as
./build/gdc/dockrun.sh your/tpmasterdir 3456 ppgdc:$HASH
```
