rm -rf ss/*
cp src/bulk.* src/common.js src/vcf.js src/tree.js ss/
node utils/uglify.js ss/ ../proteinpaint/src/

rm -rf ../proteinpaint/public/bin/*

./node_modules/.bin/webpack --config=scripts/webpack.config.deliver.js

./node_modules/babel-cli/bin/babel.js server.js | ./node_modules/uglify-js/bin/uglifyjs --compress --mangle > ../proteinpaint/server.js

cd ../proteinpaint

sed 's%https://pecan.stjude.org/pp/bin/%__PP_URL__%' public/bin/proteinpaint.js >public/bin/template.js
sed 's%__PP_URL__%http://localhost:3000/bin/%' public/bin/template.js >public/bin/proteinpaint.js
