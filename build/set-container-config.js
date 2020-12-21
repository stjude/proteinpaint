const fs = require('fs')
const serverconfig = require('./serverconfig.json')
const execSync = require('child_process').execSync

// within the container, the Dockerfile uses
// a pre-determined port and directories
Object.assign(serverconfig, {
	port: 3456,
	tpmasterdir: '/home/root/pp/tp',
	cachedir: '/home/root/pp/cache',
	bigwigsummary: '/home/root/pp/tools/bigWigSummary',
	hicstat: 'python3 /home/root/pp/tools/read_hic_header.py',
	hicstraw: '/home/root/pp/tools/straw'
})

fs.writeFileSync('./serverconfig.json', JSON.stringify(serverconfig))

const publicPath = serverconfig.URL ? serverconfig.URL : ''
console.log(`Setting the dynamic bundle path to '${publicPath}'`)
execSync(`mv ./public/bin/proteinpaint.js ./public/bin/proteinpaint-bkup.js`)
execSync(
	`sed 's%__PP_URL__/bin/%${publicPath}/bin/%' < ./public/bin/proteinpaint-bkup.js > ./public/bin/proteinpaint.js`
)
