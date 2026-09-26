#!/bin/bash

#
# Builds the ppbase, ppserver, and ppfull images from container/deps/Dockerfile,
# may be called from any dir:
# ./build.sh [-m MODE] [-b BUILDARGS] [-c CROSSENV]
#
# The build context is staged in a temporary dir that is always removed on exit, so that
# a successful, failed, or interrupted build does not add or change any file in the repo.
#
# To install the server package from the local code instead of the published version,
# first run container/pack.sh to create the tarballs in container/tmppack or deps/tmppack.
#

set -euo pipefail

USAGE="Usage:
	./build.sh [-m MODE] [-b BUILDARGS] [-c CROSSENV]

	-m MODE: string to loosely indicate the build environment.
			 - defaults to an empty string
			 - 'pkg' is reserved to indicate a package build, outside of the repo or dev environment
			 - will be used as a prefix for the image name
	-b BUILDARGS: build variables to pass to the Dockerfile that are not persisted to the built image
	-c CROSSENV: cross-env options that are used prior to npm install
"

DEPSDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINERDIR="$(dirname "$DEPSDIR")"
REPODIR="$(dirname "$CONTAINERDIR")"

function build {
	parseArgs "$@"
	if [[ "$MODE" == "pkg" && -d "$CONTAINERDIR/client" ]]; then
		echo "post-install pkg build skipped within repo"
		exit 0
	fi
	detectPlatform
	detectVersions
	stageContext
	buildImages
	tagImages
}

function parseArgs {
	BUILDARGS=""
	CROSSENV=""
	MODE=""
	while getopts "m:b:c:h" opt; do
		case "${opt}" in
		m) MODE=${OPTARG} ;;
		b) BUILDARGS=${OPTARG} ;;
		c) CROSSENV=${OPTARG} ;;
		h)
			echo "$USAGE"
			exit 0
			;;
		*)
			echo "Unrecognized parameter. Use -h to display usage."
			exit 1
			;;
		esac
	done
}

# the Dockerfile only supports x86_64, which is emulated on an arm64 machine such as an M-series Mac
function detectPlatform {
	PLATFORM=""
	ARCH=$(uname -m)
	if [[ ${ARCH} == "arm64" || ${ARCH} == "aarch64" ]]; then
		ARCH="x86_64"
		PLATFORM="--platform=linux/amd64"
	fi
}

# The versions that deps/version.sh sets in deps/package.json, as in CI. When version.sh has not been
# run, such as in a local build, use the same versions that it would set, without changing package.json.
function detectVersions {
	read -r IMGVER SERVERPKGVER FRONTPKGVER < <(
		node -e '
			const [deps, root, server, front] = process.argv.slice(1).map(f => require(f))
			const versions = deps.containerDeps
				? [deps.version, deps.containerDeps.server, deps.containerDeps.front]
				: [root.version, server.version, front.version]
			console.log(versions.join(" "))
		' "$DEPSDIR/package.json" "$REPODIR/package.json" "$REPODIR/server/package.json" "$REPODIR/front/package.json"
	)
	# assumes that the branch head is currently checked out
	IMGREV="head"
	HASH=$(git -C "$DEPSDIR" rev-parse --short HEAD 2>/dev/null || true)
	if [[ "$HASH" != "" ]]; then
		IMGREV="$HASH"
	fi
	echo "IMGVER=$IMGVER SERVERPKGVER=$SERVERPKGVER FRONTPKGVER=$FRONTPKGVER IMGREV=$IMGREV ARCH=$ARCH"
}

# copies the files that the Dockerfile COPYs into a temporary build context dir
function stageContext {
	CTX="$(mktemp -d "${TMPDIR:-/tmp}/ppdeps-build.XXXXXX")"
	trap 'rm -rf "$CTX"' EXIT
	# exit through the EXIT trap when interrupted, such as with Ctrl-C
	trap 'exit 130' INT TERM

	mkdir -p "$CTX/R" "$CTX/python" "$CTX/tmppack"
	cp -R "$REPODIR/R/utils" "$CTX/R/"
	cp "$REPODIR/python/requirements.txt" "$CTX/python/"
	cp "$CONTAINERDIR/full/app-full.mjs" "$CONTAINERDIR/server/app-server.mjs" "$CTX/"
	stagePublicDir
	stageTarballs
}

# only the tracked public files, not local leftovers such as a dangling bin symlink or generated cards
function stagePublicDir {
	if git -C "$CONTAINERDIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
		(cd "$CONTAINERDIR" && git ls-files -z -- public | tar --null -T - -cf -) | tar -C "$CTX" -xf -
	else
		cp -R "$CONTAINERDIR/public" "$CTX/"
	fi
}

# The deps/tmppack dir, as copied in CI, or else the container/tmppack dir that pack.sh creates.
# Without a tarball for the server version, the Dockerfile installs the published package.
function stageTarballs {
	local dir
	for dir in "$DEPSDIR/tmppack" "$CONTAINERDIR/tmppack"; do
		if compgen -G "$dir/*.tgz" >/dev/null; then
			echo "using the tarballs in $dir"
			cp "$dir"/*.tgz "$CTX/tmppack/"
			break
		fi
	done
	if [[ ! -f "$CTX/tmppack/sjcrh-proteinpaint-server-$SERVERPKGVER.tgz" ]]; then
		echo "NOTE: no sjcrh-proteinpaint-server-$SERVERPKGVER.tgz tarball, the published server package will be installed"
	fi
}

# NOTE: important to supply the same ARCH, IMGVER, and IMGREV arguments for all 3 build jobs
# to ensure that the ppbase stage of the build is cached for the ppserver and ppfull stages
function buildImages {
	local common=(--file "$DEPSDIR/Dockerfile" --build-arg ARCH="$ARCH" --build-arg IMGVER="$IMGVER" --build-arg IMGREV="$IMGREV")
	set -x
	docker buildx build "$CTX" "${common[@]}" --target ppbase --tag "${MODE}ppbase:latest" $PLATFORM $BUILDARGS --output type=docker

	docker buildx build "$CTX" "${common[@]}" --target ppserver --tag "${MODE}ppserver:latest" $PLATFORM \
		--build-arg SERVERPKGVER="$SERVERPKGVER" --build-arg CROSSENV="$CROSSENV" $BUILDARGS --output type=docker

	docker buildx build "$CTX" "${common[@]}" --target ppfull --tag "${MODE}ppfull:latest" $PLATFORM \
		--build-arg SERVERPKGVER="$SERVERPKGVER" --build-arg FRONTPKGVER="$FRONTPKGVER" --build-arg CROSSENV="$CROSSENV" \
		$BUILDARGS --output type=docker
	set +x
}

# in non-dev/repo environment, may automatically add extra tags
function tagImages {
	if [[ "$MODE" == "" ]]; then
		return
	fi
	local target
	for target in server full; do
		docker tag "${MODE}pp${target}:latest" "${MODE}pp${target}:$IMGVER"
	done
	if [[ "$HASH" != "" ]]; then
		for target in base server full; do
			docker tag "${MODE}pp${target}:latest" "${MODE}pp${target}:$IMGVER-$HASH"
		done
	fi
}

build "$@"
