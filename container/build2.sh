#!/bin/bash

set -euo pipefail

###############
# ARGUMENTS
###############

USAGE="Usage:
	./build2.sh [-z] [-a] [-v] [-i] [-r] [-b] [-c] [subdir]
	
	subdir: 'server' | 'full', the subdirectory to build

	-z USETGZ: use local tarballs for the server and full packages; the tarballs in tmppack are reused, unless
			 server/package.json no longer points to them, such as after a git restore
	-a ARM64: build a linux/arm64 image for local testing, tagged only as <image name>:arm64, on the local
			 trixie-pp<subdir>:arm64 deps image unless -i is set; the published deps images are linux/amd64.
			 Implies -z, and always packs new tarballs, with the linux/arm64 rust binaries from the -v volume,
			 since the image build can neither download nor compile them. Afterwards, also when the build fails,
			 removes tmppack and restores server/package.json and full/package.json, which must have no other changes
	-v RUST_VOLUME: the docker volume with the linux/arm64 rust binaries in release/, for -a; defaults to
			 sjpp-dev_rust-target, which the sjpp dev container builds
	-i BASE_IMAGE: the deps image to build on, instead of the published ghcr.io/stjude/pp<subdir> image of
			 ARG VERSION in the Dockerfile
	-r PREFIX: prefix for the image name, defaults to an empty string ""
			 - 'pkg' is reserved to indicate a package build, outside of the repo or dev environment
	-b BUILDARGS: build variables to pass to the Dockerfile that are not persisted in the built image
	-c CROSSENV: cross-env options that are used prior to npm install
"

SUBDIR=server
BUILDARGS=""
CROSSENV=""
PREFIX=""
SERVERTGZFILE=""
SERVERTGZ=""
FRONTTGZ=""
PKGPATH=""
ARM64=""
BASE_IMAGE=""
RUST_VOLUME=sjpp-dev_rust-target

#################
# PROCESSED ARGS
#################

while getopts "zav:i:r:b:c:h" opt; do
	case "${opt}" in
	a)
		ARM64=1
		PKGPATH=/home/root/pp/tmppack
		;;
	v)
		RUST_VOLUME=${OPTARG}
		;;
	i)
		BASE_IMAGE=${OPTARG}
		;;
	z)
    # install proteinpaint-* builds from tarballs, not published packages
		PKGPATH=/home/root/pp/tmppack
		;;
	r)
		PREFIX=${OPTARG}
		;;
	b)
		BUILDARGS=${OPTARG}
		;;
	c)
		CROSSENV=${OPTARG}
		;;
	h)
		echo "$USAGE"
		exit 1
		;;
  *)
  	echo "Unrecognized parameter. Use -h to display usage."
  	exit 1
  	;;
	esac
done
IMGNAME="${PREFIX}pp$SUBDIR"

shift $(($OPTIND-1))

if (( $# == 1 )); then
	SUBDIR=$1
fi

################
# DETECTED ARGS
################

# print a trace of simple commands, after argument parsing above 
# which can be too noisy
set -x

if [[ "$ARM64" != "" && "$BASE_IMAGE" == "" ]]; then
	BASE_IMAGE="trixie-pp$SUBDIR:arm64"
fi

# fail early if the base deps image still runs as root
./check_base_user.sh $SUBDIR $BASE_IMAGE

IMGVER="$(node -p "require('./$SUBDIR/package.json').version")"
# assumes that the branch head is currently checked out
IMGREV="head"
set +e
HASH=$(git rev-parse --short HEAD 2>/dev/null)
set -e
if [[ "$HASH" != "" ]]; then
	IMGREV="$HASH"
fi

TAGHASH="$IMGVER-$HASH"
# TAGHASH="ghcr.io/stjude/ppserver:2.155.0-e3bcfdd00"   # uncomment for testing, already published
INSPECT_STATUS="$(docker manifest inspect $IMGNAME:$TAGHASH > /dev/null ; echo $?)"
if (( $INSPECT_STATUS == 0 )); then
	echo "the container registry already has image:tag $IMGNAME:$TAGHASH"
#	exit 1  # uncomment to stop build if image already exists
fi
# echo "--- build will continue, end of manifest test --- ($INSPECT_STATUS)" # uncomment for testing
# exit 1                                                                     # uncomment for testing

PLATFORM=""
ARCH=$( uname -m )
if [[ "$ARM64" != "" ]]; then
	PLATFORM="--platform=linux/arm64"
elif [[ ${ARCH} == "arm64" ]]; then 
	ARCH="x86-64";
  PLATFORM="--platform=linux/amd64"
# Enable this if you want to build for arm64
#	ARCH="aarch64";
#	PLATFORM="--platform=linux/arm64"
fi

#########################
# Handle -z option
#########################

if [[ ! -d ./tmppack ]]; then
	# always has to have a tmppack dir because the Dockerfile may require it to COPY
	mkdir tmppack
fi

if [[ "$ARM64" != "" ]]; then
	# pack.sh changes these files, which are restored below, so that no change other than a tarball path that an earlier
	# pack set may be lost
	if git diff -U0 -- server/package.json full/package.json | grep '^+[^+]' | grep -qv "$PKGPATH/"; then
		echo "ERROR: -a restores server/package.json and full/package.json after the build, commit or restore their changes first"
		exit 1
	fi
	RUSTBINDIR=$(mktemp -d)
	# also when the build fails; tmppack is removed, so that a later linux/amd64 build cannot reuse its arm64 rust tarball
	cleanupArm64() {
		git restore server/package.json full/package.json
		rm -rf "$RUSTBINDIR" ./tmppack
	}
	trap cleanupArm64 EXIT

	if ! docker volume inspect "$RUST_VOLUME" >/dev/null 2>&1; then
		echo "ERROR: no docker volume '$RUST_VOLUME' with the linux/arm64 rust binaries, set it with -v"
		exit 1
	fi
	echo "copying the rust binaries from the $RUST_VOLUME volume ..."
	docker run --rm --platform=linux/arm64 --user "$(id -u):$(id -g)" \
		-v "$RUST_VOLUME":/t:ro -v "$RUSTBINDIR":/out --entrypoint sh "$BASE_IMAGE" \
		-c 'find /t/release -maxdepth 1 -type f -perm -u+x ! -name "*.d" -exec cp {} /out/ \;'
	if [[ -z "$(ls "$RUSTBINDIR")" ]]; then
		echo "ERROR: no rust binaries in the release/ dir of the $RUST_VOLUME volume"
		exit 1
	fi

	rm -rf ./tmppack
	mkdir tmppack
	echo "packing tarballs, with the linux/arm64 rust binaries ..."
	./pack.sh $PKGPATH $PKGPATH "$RUSTBINDIR"

	# the e_machine bytes of the ELF header, b7 00 for aarch64; the build would otherwise fail after the npm install
	RUSTTGZ=$(find ./tmppack -name "sjcrh-proteinpaint-rust-*.tgz" | head -1)
	RUSTMACHINE=""
	if [[ "$RUSTTGZ" != "" ]]; then
		RUSTMACHINE=$(tar -xzOf "$RUSTTGZ" package/target/release/fisher 2>/dev/null | head -c 20 | tail -c 2 | od -An -tx1 | tr -d ' \n' || true)
	fi
	if [[ "$RUSTMACHINE" != "b700" ]]; then
		echo "ERROR: the rust binaries in the $RUST_VOLUME volume are not linux/arm64 binaries, or have no fisher binary"
		exit 1
	fi
elif [[ "$PKGPATH" != "" ]]; then
	if [[ "$(find ./tmppack -type f -iname "sjcrh*.tgz")" == "" ]]; then
		echo "packing tarballs ..."
		./pack.sh $PKGPATH
	elif ! grep -q "$PKGPATH" server/package.json; then
		# the reused tarballs would not be installed, since npm would look up the package versions in the registry
		echo "server/package.json does not point to the tarballs in tmppack, packing new tarballs ..."
		rm -rf ./tmppack
		mkdir tmppack
		./pack.sh $PKGPATH
	else
		# option to reuse tarballs in dev, if certain updated tarballs are not needed
		echo "reusing tmppack: to avoid reuse, run 'rm -rf tmppack'"
	fi
fi

###############
# Docker build
###############

IMGNAME="${PREFIX}pp$SUBDIR"

if [[ "$ARM64" != "" ]]; then
	# a local test image, which must not replace the latest or version tag of a linux/amd64 build
	TAGS=(--tag "$IMGNAME:arm64")
else
	TAGS=(--tag "$IMGNAME:$IMGVER-$HASH" --tag "$IMGNAME:latest")
fi
BASEARG=()
if [[ "$BASE_IMAGE" != "" ]]; then
	BASEARG=(--build-arg "BASE_IMAGE=$BASE_IMAGE")
fi

echo "building $IMGNAME image"

docker buildx build . \
	--file ./$SUBDIR/Dockerfile \
	"${TAGS[@]}" ${BASEARG[@]+"${BASEARG[@]}"} $PLATFORM \
	--build-arg IMGVER=$IMGVER \
	--build-arg IMGREV=$IMGREV \
	--build-arg CROSSENV="$CROSSENV" $BUILDARGS \
	--output type=docker

#############
# Clean up
#############

# git restore server/package.json
# git restore full/package.json
