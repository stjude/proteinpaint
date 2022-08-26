set -e

# generate minimal package.json's so that only relevant changes
# will trigger `npm install`, otherwise safe to reuse that 
# that build step's cache for irrelevant changes like to scripts, etc
./build/minpkgjson.js package.json > min-package.json
./build/minpkgjson.js server/package.json > server/min-package.json
./build/minpkgjson.js client/package.json > client/min-package.json

docker build --file ./build/dev/Dockerfile --target ppdev --tag ppdev:latest .
rm min-package.json server/min-package.json client/min-package.json

set +e
docker stop ppdev && docker rm ppdev
set -e

TPDIR=$(node ./build/getConfigProp.js tpmasterdir)
echo "serverconfig.tpmasterdir='$TPDIR'"
PPDIR=$(pwd)
CONTAPP=/home/root/pp/app/



docker run -d \
	--name ppdev \
	`# mounting specific subdirs and files avoids mounting the node_modules at the root or any workspace` \
	--mount type=bind,source=$TPDIR,target=/home/root/pp/tp,readonly \
	--mount type=bind,source=$PPDIR/public,target=$CONTAPP/public,readonly \
	`# the client dir is mounted for purposes of generating /spec route results, not related to bundling` \
	--mount type=bind,source=$PPDIR/client,target=$CONTAPP/client,readonly \
	--mount type=bind,source=$PPDIR/client/test/internals.js,target=$CONTAPP/client/test/internals.js \
	`# rust code is compiled as part of server deps installation` \
	--mount type=bind,source=$PPDIR/rust/src,target=$CONTAPP/rust/src,readonly \
	--mount type=bind,source=$PPDIR/rust/test,target=$CONTAPP/rust/test,readonly \
	`# copy source and build code` \
	--mount type=bind,source=$PPDIR/server/src,target=$CONTAPP/server/src,readonly \
	--mount type=bind,source=$PPDIR/server/dataset,target=$CONTAPP/server/dataset,readonly \
	--mount type=bind,source=$PPDIR/server/genome,target=$CONTAPP/server/genome,readonly \
	--mount type=bind,source=$PPDIR/server/shared,target=$CONTAPP/server/shared,readonly \
	--mount type=bind,source=$PPDIR/server/test,target=$CONTAPP/server/test,readonly \
	--mount type=bind,source=$PPDIR/server/cards,target=$CONTAPP/server/cards,readonly \
	--mount type=bind,source=$PPDIR/server/utils,target=$CONTAPP/server/utils,readonly \
	--mount type=bind,source=$PPDIR/server/bin.js,target=$CONTAPP/server/bin.js,readonly \
	--mount type=bind,source=$PPDIR/server/webpack.config.js,target=$CONTAPP/server/webpack.config.js,readonly \
	--mount type=bind,source=$PPDIR/server/.babelrc,target=$CONTAPP/server/.babelrc,readonly \
	--mount type=bind,source=$PPDIR/serverconfig.json,target=$CONTAPP/serverconfig.json,readonly \
	`# swap out the minimal for the full package.json's before starting the container` \
	--mount type=bind,source=$PPDIR/package.json,target=$CONTAPP/package.json,readonly \
	--mount type=bind,source=$PPDIR/server/package.json,target=$CONTAPP/server/package.json,readonly \
	--mount type=bind,source=$PPDIR/client/package.json,target=$CONTAPP/client/package.json,readonly \
	--publish 3000:3000 \
	-e PP_MODE=container-prod \
	ppdev:latest

cd client
# the client-side webpack bundling is outputted to public/bin/,
# and public is mounted to be served by the PP server
npm run dev
cd ..
