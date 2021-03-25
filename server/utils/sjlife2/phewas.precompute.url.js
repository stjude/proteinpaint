const got = require('got')
const fs = require('fs')
const path = require('path')
const serverconfig = require('../../serverconfig.json')

main()

async function main() {
	const res = await got('http://localhost:3001/termdb?genome=hg38&dslabel=SJLife&precompute=1&phewas=1')
	const data = JSON.parse(res.body)
	if (data.error) throw data.error
	if (!data.filename) throw 'filename missing'
	fs.renameSync(path.join(serverconfig.cachedir, data.filename), 'category2vcfsample')
	console.log('new file "category2vcfsample" has been created under current dir')
}
