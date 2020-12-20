const fs = require('fs')
const serverconfig = require('./serverconfig.json')

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
