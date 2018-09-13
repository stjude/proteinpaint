node utils/uglify.js src/bulk.cnv.js    deploys/deliver/proteinpaint/src/
node utils/uglify.js src/bulk.del.js    deploys/deliver/proteinpaint/src/
node utils/uglify.js src/bulk.itd.js    deploys/deliver/proteinpaint/src/
node utils/uglify.js src/bulk.js        deploys/deliver/proteinpaint/src/
node utils/uglify.js src/bulk.project.js deploys/deliver/proteinpaint/src/
node utils/uglify.js src/bulk.snv.js    deploys/deliver/proteinpaint/src/
node utils/uglify.js src/bulk.sv.js     deploys/deliver/proteinpaint/src/
node utils/uglify.js src/bulk.svjson.js deploys/deliver/proteinpaint/src/
node utils/uglify.js src/bulk.trunc.js  deploys/deliver/proteinpaint/src/
node utils/uglify.js src/bulk.ui.js     deploys/deliver/proteinpaint/src/
node utils/uglify.js src/tree.js        deploys/deliver/proteinpaint/src/
node utils/uglify.js src/common.js      deploys/deliver/proteinpaint/src/
node utils/uglify.js src/vcf.js         deploys/deliver/proteinpaint/src/




rm -rf deploys/deliver/proteinpaint/public/bin/*

./node_modules/.bin/webpack --config=scripts/webpack.config.deliver.js

#./node_modules/babel-cli/bin/babel.js server.js | ./node_modules/uglify-js/bin/uglifyjs --compress --mangle > deploys/deliver/proteinpaint/server.js
cp server.js deploys/deliver/proteinpaint/server.js

cd deploys/deliver/proteinpaint

sed 's%https://pecan.stjude.org/pp/bin/%__PP_URL__%' public/bin/proteinpaint.js >public/bin/template.js
sed 's%__PP_URL__%http://localhost:3000/bin/%' public/bin/template.js >public/bin/proteinpaint.js
