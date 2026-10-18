#!/bin/sh

# Fails when an ELF file under the given dirs, or a given ELF file, cannot resolve a shared library, so that an
# unloadable binary or module fails the image build instead of a request. Run in the image that the files run in:
#   RUN --mount=type=bind,source=checkSharedLibs.sh,target=/tmp/checkSharedLibs.sh sh /tmp/checkSharedLibs.sh <path>...
#
# Not reported:
# - numba's optional TBB threading layer, which numba skips when libtbb is not installed
# - the libraries that a python wheel bundles in site-packages/<name>.libs/, which resolve each other only when they
#   are loaded through the wheel's extension modules, whose own dependencies are checked; import the package to check
#   them, as the ppruntime stage does

set -eu

SKIP='/numba/np/ufunc/tbbpool\.|/site-packages/[^/]+\.libs/'
failed=0
count=0
for f in $(find "$@" -type f \( -name '*.so' -o -name '*.so.*' -o -name '*.node' -o -perm -u+x \) 2>/dev/null); do
	if ! head -c 4 "$f" 2>/dev/null | grep -q 'ELF'; then
		continue
	fi
	count=$((count + 1))
	missing=$(ldd "$f" 2>/dev/null | grep 'not found' || true)
	if [ -z "$missing" ] || echo "$f" | grep -qE "$SKIP"; then
		continue
	fi
	echo "ERROR: $f cannot resolve:"
	echo "$missing"
	failed=1
done
if [ "$failed" -ne 0 ]; then
	echo "the files above need a shared library that this image does not have"
	exit 1
fi
echo "the $count ELF files resolve their shared libraries"
