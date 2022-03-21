npm run reset

cd server
echo -e "\nCreating the server bundle\n"
npx webpack --config=webpack.config.js

cd ../client
echo -e "\nBundling the client browser bin ...\n"
rm -rf ../public/bin
npx webpack --config=webpack.config.js --env.url="__PP_URL__"
echo -e "\nPacking the client module main ...\n"
rm -rf dist
npx rollup -c ./rollup.config.js

cd ..

mv package.json package.json.bak
./build/full/editpkgjson.js > package.json
npm pack 
rm package.json
mv package.json.bak package.json
