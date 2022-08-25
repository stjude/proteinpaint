set -e

# docker build --file ./build/Dockerfile --target pprust --tag pprust:flat --build-arg ARCH="$ARCH" .
docker build --file ./build/dev/Dockerfile --target ppdev --tag ppdev:latest .

set +e
docker stop ppdev && docker rm ppdev
set -e

TPDIR=$(node ./build/getConfigProp.js tpmasterdir)
echo "serverconfig.tpmasterdir='$TPDIR'"
PPDIR=$(pwd)
CONTAPP=/home/root/pp/app/

# mounting specific subdirs and files avoids mounting the node_modules
# at the root or any workspace
# the client dir is mounted for purposes of generating /spec route results,
# and not related to bundling
docker run -d \
	--name ppdev \
	--mount type=bind,source=$TPDIR,target=/home/root/pp/tp,readonly \
	--mount type=bind,source=$PPDIR/public,target=$CONTAPP/public,readonly \
	--mount type=bind,source=$PPDIR/client,target=$CONTAPP/client,readonly \
	--mount type=bind,source=$PPDIR/client/test/internals.js,target=$CONTAPP/client/test/internals.js \
	--mount type=bind,source=$PPDIR/rust/src,target=$CONTAPP/rust/src,readonly \
	--mount type=bind,source=$PPDIR/rust/test,target=$CONTAPP/rust/test,readonly \
	--mount type=bind,source=$PPDIR/server/src,target=$CONTAPP/server/src,readonly \
	--mount type=bind,source=$PPDIR/server/dataset,target=$CONTAPP/server/dataset,readonly \
	--mount type=bind,source=$PPDIR/server/genome,target=$CONTAPP/server/genome,readonly \
	--mount type=bind,source=$PPDIR/server/shared,target=$CONTAPP/server/shared,readonly \
	--mount type=bind,source=$PPDIR/server/test,target=$CONTAPP/server/test,readonly \
	--mount type=bind,source=$PPDIR/server/cards,target=$CONTAPP/server/cards,readonly \
	--mount type=bind,source=$PPDIR/server/utils,target=$CONTAPP/server/utils,readonly \
	--mount type=bind,source=$PPDIR/server/bin.js,target=$CONTAPP/server/bin.js,readonly \
	--mount type=bind,source=$PPDIR/server/webpack.config.js,target=$CONTAPP/server/webpack.config.js \
	--mount type=bind,source=$PPDIR/server/.babelrc,target=$CONTAPP/server/.babelrc \
	--mount type=bind,source=$PPDIR/serverconfig.json,target=$CONTAPP/serverconfig.json \
	--publish 3000:3000 \
	-e PP_MODE=container-prod \
	ppdev:latest

cd client
# the client-side webpack bundling is outputted to public/bin/,
# and public is mounted to be served by the PP server
npm run dev
cd ..
