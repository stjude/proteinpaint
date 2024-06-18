import fs from 'fs'
import { spawnSync } from 'child_process'
import path from 'path'
import { launch } from '@sjcrh/proteinpaint-server'

const serverconfigFile = path.join(import.meta.dirname, './serverconfig.json')

if (!fs.existsSync(serverconfigFile)) {
	throw `missing serverconfig.json: did you forget to mount?`
}

const { default: serverconfig } = await import(serverconfigFile, { assert: { type: 'json' } })

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

serverconfig.backend_only = true
fs.writeFileSync('./serverconfig.json', JSON.stringify(serverconfig, null, '   '), { charset: 'utf8' })

if (serverconfig.releaseTag && serverconfig.releaseTag.server) {
	console.log('Updating proteinpaint server package ...')
	spawnSync('npm', ['install', `"@sjcrh/proteinpaint-server@${serverconfig.releaseTag.server}"`], { encoding: 'utf-8' })
}

console.log('starting the server ...')
launch()
