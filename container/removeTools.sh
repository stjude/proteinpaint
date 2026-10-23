#!/bin/sh

# Run as root near the end of the server and full Dockerfiles:
#   RUN --mount=type=bind,source=removeTools.sh,target=/tmp/removeTools.sh sh /tmp/removeTools.sh
#
# Removes the listed files, which the app does not use, clears the setuid and setgid bits, and checks that the
# app's dependencies still run.

set -eu

rm -f \
	/usr/bin/curl /usr/bin/wget \
	/usr/bin/GET /usr/bin/HEAD /usr/bin/POST /usr/bin/lwp-* \
	/usr/bin/openssl /usr/bin/c_rehash \
	/usr/bin/git /usr/bin/git-* \
	/usr/bin/ssh /usr/bin/ssh-* /usr/bin/scp /usr/bin/sftp /usr/bin/slogin \
	/usr/bin/apt /usr/bin/apt-* /usr/bin/dpkg /usr/bin/dpkg-* /usr/bin/cpan /usr/bin/cpan5* /usr/bin/sqv \
	/usr/bin/pip /usr/bin/pip3* /opt/venv/bin/pip /opt/venv/bin/pip3* \
	/usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
	/usr/bin/gcc /usr/bin/gcc-* /usr/bin/g++ /usr/bin/g++-* /usr/bin/cc /usr/bin/c++ /usr/bin/c89* /usr/bin/c99* \
	/usr/bin/cpp /usr/bin/cpp-* /usr/bin/gfortran /usr/bin/gfortran-* /usr/bin/*-linux-gnu-* \
	/usr/bin/as /usr/bin/ld /usr/bin/ld.bfd /usr/bin/ld.gold \
	/usr/bin/make /usr/bin/make-first-existing-target /usr/bin/cmake /usr/bin/ctest /usr/bin/cpack \
	/usr/bin/pkg-config /usr/bin/pkgconf \
	/usr/bin/su /usr/bin/chsh /usr/bin/chfn /usr/bin/passwd /usr/bin/gpasswd /usr/bin/newgrp \
	/usr/bin/mount /usr/bin/umount \
	/usr/lib/dbus-1.0/dbus-daemon-launch-helper

rm -rf \
	/usr/lib/git-core /usr/lib/openssh /usr/lib/apt /usr/libexec/gcc \
	/usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
	/opt/venv/lib/python3*/site-packages/pip /opt/venv/lib/python3*/site-packages/pip-*.dist-info \
	/usr/lib/python3/dist-packages/pip /usr/lib/python3/dist-packages/pip-*.dist-info

find / -xdev -perm /6000 -type f -exec chmod ug-s {} +

# fail the build if a listed command is still on PATH
failed=0
for c in curl wget GET POST lwp-download openssl git ssh scp sftp apt apt-get dpkg sqv cpan pip pip3 npm npx corepack \
	gcc g++ cc c++ cpp gfortran as ld make cmake pkg-config su chsh chfn passwd gpasswd newgrp mount umount; do
	if command -v "$c"; then
		echo "ERROR: $c is still on PATH"
		failed=1
	fi
done
if python3 -m pip --version 2>/dev/null; then
	echo "ERROR: python3 -m pip still runs"
	failed=1
fi
if find / -xdev -perm /6000 -type f | grep .; then
	echo "ERROR: the files above still have the setuid or setgid bit"
	failed=1
fi
if [ "$failed" -ne 0 ]; then exit 1; fi

# the app's dependencies still run
mkdir -p /tmp/removeTools && tar -C /tmp/removeTools -cf - . | tar -tf - >/dev/null && rm -rf /tmp/removeTools
bash -c true
node -v
python3 -c 'import ssl, numpy'
Rscript -e 'stopifnot(capabilities("libcurl"))'
bcftools --version | head -1
h5dump --version
perl -e 1
