####################
#
# this script writes files to ./deploys/deliver/proteinpaint/
#
####################



cp package.json deploys/deliver/proteinpaint/
cp utils/install.pp.js deploys/deliver/proteinpaint/utils/
cp utils/*.R deploys/deliver/proteinpaint/utils/
cp genome/* deploys/deliver/proteinpaint/genome/
cp dataset/clinvar* deploys/deliver/proteinpaint/dataset/
cp public/index.html deploys/deliver/proteinpaint/public/



rm -rf deploys/deliver/proteinpaint/public/bin/*

./node_modules/.bin/webpack --config=scripts/webpack.config.deliver.js --progress


cd deploys/deliver/proteinpaint

sed 's%http://localhost:3000/bin/%__PP_URL__%' public/bin/proteinpaint.js >public/bin/template.js

cd ..
tar zcvf ~/sourcecode.tgz proteinpaint/
