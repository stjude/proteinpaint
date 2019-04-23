cp serverconfig.json test/copies/modules/
cp modules/partjson.js test/copies/modules/
sed 's%__non_webpack_require__%require%' < modules/termdb2.js > test/copies/modules/termdb2.js
sed 's%__non_webpack_require__%require%' < modules/utils.js > test/copies/modules/utils.js

rm test/copies/src
ln -s ../../src test/copies/src
