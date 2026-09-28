#!/bin/bash

# call from the container dir
# ./check_base_user.sh <subdir>
# - subdir: 'server' | 'full', the subdirectory whose Dockerfile base image will be checked
#
# The server and full Dockerfiles build on top of a published ppserver/ppfull deps image
# and expect it to run as the unprivileged app user (UID 1000, see deps/Dockerfile).
# An older, root-based deps image would build fine but fail at runtime, since node is
# installed under /root which the app user cannot read. So fail early, before a build
# or release is started against such a base image.
#
# The image config is read from the registry manifest, the image is not pulled.

set -euo pipefail

function check_base_user {
	if (($# != 1)); then
		echo "Usage: $0 <subdir>"
		exit 1
	fi

	local dockerfile=./$1/Dockerfile
	if [[ ! -f "$dockerfile" ]]; then
		echo "Dockerfile not found at $dockerfile"
		exit 1
	fi

	local baseimg baseuser
	baseimg=$(getBaseImage "$dockerfile")
	baseuser=$(getImageUser "$baseimg")

	case "$baseuser" in
	"" | root | 0 | root:* | 0:*)
		echo "ERROR: the base image $baseimg runs as root (user='$baseuser'), but $dockerfile expects a non-root base image."
		echo "Run the CD-publish-deps-image workflow to publish a non-root deps image and update ARG VERSION, then retry."
		exit 1
		;;
	esac

	echo "the base image $baseimg runs as user='$baseuser'"
}

# resolves the FROM image of a Dockerfile, with the ARG VERSION value filled in
function getBaseImage {
	local version fromimg
	version=$(awk -F= '/^ARG VERSION=/{print $2; exit}' "$1")
	fromimg=$(awk '$1=="FROM"{print $2; exit}' "$1")
	fromimg=${fromimg//\$\{VERSION\}/$version}
	echo "${fromimg//\$VERSION/$version}"
}

# the image manifest may be for a single platform or a multi-platform index
function getImageUser {
	docker buildx imagetools inspect "$1" --format '{{json .Image}}' | node -e "
		let s = ''
		process.stdin.on('data', d => (s += d))
		process.stdin.on('end', () => {
			const img = JSON.parse(s)
			const cfg = img.config ? img.config : img['linux/amd64']?.config
			console.log(cfg?.User || '')
		})
	"
}

check_base_user "$@"
