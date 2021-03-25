####################
#
# this script writes files to ./deploys/deliver/proteinpaint/
#
####################



node utils/deliver.packagejson.js > deploys/deliver/proteinpaint/package.json
cp utils/*.R utils/install.pp.js deploys/deliver/proteinpaint/utils/
cp genome/* deploys/deliver/proteinpaint/genome/
cp dataset/clinvar* deploys/deliver/proteinpaint/dataset/
cp dataset/gdc.hg38.2.js deploys/deliver/proteinpaint/dataset/
cp public/index.html deploys/deliver/proteinpaint/public/



rm -rf deploys/deliver/proteinpaint/public/bin/*

./node_modules/.bin/webpack --config=build/webpack.config.deliver.js --progress


cd deploys/deliver/proteinpaint

sed 's%http://localhost:3000/bin/%__PP_URL__%' public/bin/proteinpaint.js >public/bin/template.js

cd ..
tar zcvf ~/sourcecode.tgz proteinpaint/
