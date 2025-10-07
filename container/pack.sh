#!/bin/bash

set -euxo pipefail

# this script:
# - will pack workspaces 
# - replace each workspace package.json's dependency versions
#   with the tarball location as copied into the Docker build
#
# call from the proteinpaint/container dir

# defaults
PKGPATH=/home/root/pp/tmppack
TMPDIR=/home/root/pp/tmppack
RUST_BINARIES_DIR=../rust-binaries

if (( $# == 1 )); then
  PKGPATH="$1"
fi

if (( $# == 2 )); then
  PKGPATH="$1"
  TMPDIR="$2"
fi

if (( $# >= 3 )); then
  PKGPATH="$1"
  TMPDIR="$2"
  RUST_BINARIES_DIR="$3"
fi

rm -rf tmppack
mkdir tmppack

FRONTDEPNAME="@sjcrh/proteinpaint-front"
SERVERDEPNAME="@sjcrh/proteinpaint-server"

# no -w argument to bump.cjs, just get the changed workspace since the last publish
cd ..
CHANGEDWS=$(./build/bump.cjs prerelease)
cd container
echo "$CHANGEDWS"

for shareddir in types utils
do
	if [[ "$shareddir" == "utils" ]]; then
		sharedws="shared"
	else
		sharedws=$shareddir
	fi

	if [[ "$CHANGEDWS" == *"shared/$shareddir"* ]]; then
		cd ../shared/$shareddir
		echo "packing shared/$sharedws ..."
		npm pack
		SHAREDPKGVER=$(node -p "require('./package.json').version")
		SHAREDTGZ=sjcrh-proteinpaint-$sharedws-$SHAREDPKGVER.tgz
		mv $SHAREDTGZ ../../container/tmppack/
		SHAREDDEPNAME="@sjcrh/proteinpaint-$sharedws"
		cd ../../client
		# may reset the dep new version temporarily, for package testing
		npm pkg set "devDependencies.$SHAREDDEPNAME"=$PKGPATH/$SHAREDTGZ
		cd ../server
		# may reset the dep new version temporarily, for package testing
		npm pkg set "dependencies.$SHAREDDEPNAME"=$PKGPATH/$SHAREDTGZ
		cd ../container
	fi
done

if [[ "$CHANGEDWS" == *"client"* ]]; then
	cd ../client
	echo "packing client ..."
	npm pack
	CLIENTPKGVER=$(node -p "require('./package.json').version")
	CLIENTTGZ=sjcrh-proteinpaint-client-$CLIENTPKGVER.tgz
	mv $CLIENTTGZ ../container/tmppack/
	git restore package.json
	cd ../front
	CLIENTDEPNAME="@sjcrh/proteinpaint-client"
	# may reset the dep new version temporarily, for package testing
	npm pkg set "devDependencies.$CLIENTDEPNAME"=$PKGPATH/$CLIENTTGZ
	cd ../container
fi

if [[ "$CHANGEDWS" == *"front"* ]]; then
	cd ../front
	echo "packing front ..."
	npm pack
	FRONTPKGVER=$(node -p "require('./package.json').version")
	FRONTTGZ=sjcrh-proteinpaint-front-$FRONTPKGVER.tgz
	mv $FRONTTGZ ../container/tmppack/
	git restore package.json

	cd ../container/full
	echo "update the dependency in container/full/package.json to point to the front tarball inside of tmppack dir ..."
	npm pkg set "dependencies.$FRONTDEPNAME"=$PKGPATH/$FRONTTGZ
	cd ..
fi

if [[ "$CHANGEDWS" == *"augen"* ]]; then
	cd ../augen
	echo "packing augen ..."
	npm pack
	AUGENPKGVER=$(node -p "require('./package.json').version")
	AUGENTGZ=sjcrh-augen-$AUGENPKGVER.tgz
	mv $AUGENTGZ ../container/tmppack/

	cd ../server
	AUGENDEPNAME="@sjcrh/augen"
	# may reset the dep new version temporarily, for package testing
	npm pkg set "dependencies.$AUGENDEPNAME"=$PKGPATH/$AUGENTGZ
	cd ../container
fi

if [[ "$CHANGEDWS" == *"rust"* ]]; then
  cd ../rust

  # Only copy binaries if RUST_BINARIES_DIR exists
  if [[ -d "$RUST_BINARIES_DIR" ]]; then
    echo "RUST_BINARIES_DIR found at $RUST_BINARIES_DIR"
    echo "Cleaning previous rust build..."
    rm -rf target/release
    mkdir -p target/release

    echo "Copying compiled rust binaries to target/release ..."
    cp "$RUST_BINARIES_DIR"/* target/release/

    echo "Making all files in target/release executable..."
    chmod +x target/release/*

    echo "Ensuring target/* is included in package.json files array..."

      node -e '
        const fs = require("fs");
        const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
        if (!pkg.files.includes("target/*")) {
          pkg.files.push("target/*");
          fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
          console.log("\"target/*\" added to package.json files array.");
        } else {
          console.log("\"target/*\" already present in package.json files array.");
        }
      '
  else
    echo "RUST_BINARIES_DIR not found at $RUST_BINARIES_DIR — skipping binary copy."
  fi

  echo "Packing rust module with npm ..."
  RUSTTGZ=$(npm pack)
  RUSTPKGVER=$(node -p "require('./package.json').version")

  mv "$RUSTTGZ" ../container/tmppack/

  cd ../server
  RUSTDEPNAME="@sjcrh/proteinpaint-rust"
  npm pkg set "dependencies.$RUSTDEPNAME"="file:$PKGPATH/$RUSTTGZ"

  cd ../container
fi

if [[ "$CHANGEDWS" == *"python"* ]]; then
	cd ../python
	echo "packing python ..."
	npm pack
	PYPKGVER=$(node -p "require('./package.json').version")
	PYTGZ=sjcrh-proteinpaint-python-$PYPKGVER.tgz
	mv $PYTGZ ../container/tmppack/

	cd ../server
	PYDEPNAME="@sjcrh/proteinpaint-python"
	# may reset the dep new version temporarily, for package testing
	npm pkg set "dependencies.$PYDEPNAME"=$PKGPATH/$PYTGZ
	cd ../container
fi

if [[ "$CHANGEDWS" == *"R"* ]]; then
	cd ../R
	echo "packing R ..."
	npm pack
	RPKGVER=$(node -p "require('./package.json').version")
	RTGZ=sjcrh-proteinpaint-r-$RPKGVER.tgz
	mv $RTGZ ../container/tmppack/

	cd ../server
	RDEPNAME="@sjcrh/proteinpaint-r"
	# may reset the dep new version temporarily, for package testing
	npm pkg set "dependencies.$RDEPNAME"=$PKGPATH/$RTGZ
	cd ../container
fi

if [[ "$CHANGEDWS" == *"server"* ]]; then
	cd ../server
	echo "packing server ..."
	npm pack
	SERVERTPKGVER=$(node -p "require('./package.json').version")
	SERVERTGZ=sjcrh-proteinpaint-server-$SERVERTPKGVER.tgz
	mv $SERVERTGZ ../container/tmppack/
	git restore package.json

	cd ../container/full
	echo "update the dependency in container/full/package.json to point to the front tarball inside of tmppack dir ..."
	npm pkg set "dependencies.$SERVERDEPNAME"=$PKGPATH/$SERVERTGZ

	cd ../server
	echo "update dependencies in container/server/package.json to point to server tarball inside of tmppack dir ..."
	npm pkg set "dependencies.$SERVERDEPNAME"=$PKGPATH/$SERVERTGZ

	cd ..
fi