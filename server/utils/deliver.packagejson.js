const fs = require('fs')
const j = JSON.parse(fs.readFileSync('package.json'))
delete j.scripts
delete j.devDependencies
delete j.prettier
delete j.browserify
delete j.license
console.log(JSON.stringify(j, null, 2))
