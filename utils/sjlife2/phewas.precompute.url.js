const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')
//const serverconfig = require('~/proteinpaint/serverconfig.json')
const serverconfig = require('../../serverconfig.json')

main()

async function main() {
	const res = await fetch('http://localhost:3001/termdb?genome=hg38&dslabel=SJLife&precompute=1&phewas=1')
	const data = await res.json()
	if (!data.filename) throw 'filename missing'
	fs.renameSync(path.join(serverconfig.cachedir, data.filename), 'category2vcfsample')
}
