const fs = require('fs')
const spawnSync = require('child_process').spawnSync

/*if (!fs.existsSync('./serverconfig.json')) {
	throw `missing serverconfig.json`
}*/

const serverconfig = require('./serverconfig.json')
if (!serverconfig.genomes) {
	serverconfig.genomes = [
		{
			name: 'hg19',
			species: 'human',
			file: './genome/hg19.js',
			datasets: [
				{
					name: 'ClinVar',
					jsfile: './dataset/clinvar.hg19.js'
				}
			]
		},
		{
			name: 'hg38',
			species: 'human',
			file: './genome/hg38.js',
			datasets: [
				{
					name: 'ClinVar',
					jsfile: './dataset/clinvar.hg38.js'
				}
			]
		}
	]
}

serverconfig.backend_only = false
fs.writeFileSync('./serverconfig.json', JSON.stringify(serverconfig, null, '   '), { charset: 'utf8' })

if (serverconfig.releaseTag) {
	if (serverconfig.releaseTag.server) {
		console.log('Updating proteinpaint server package ...')
		spawnSync('npm', ['update', `@stjude/proteinpaint-server@${serverconfig.releaseTag.server}`], { encoding: 'utf-8' })
	}
	if (serverconfig.releaseTag.front) {
		console.log('Updating proteinpaint front package ...')
		spawnSync('npm', ['update', `@stjude/proteinpaint-front@${serverconfig.releaseTag.front}`], { encoding: 'utf-8' })
	}
}

if (!serverconfig.URL) serverconfig.URL = serverconfig.url || '.'
console.log(`generating public/bin for ${serverconfig.URL}`)
spawnSync('npx', ['proteinpaint-front', serverconfig.URL], { encoding: 'utf-8' })

require('@stjude/proteinpaint-server')
