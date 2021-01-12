const fs = require('fs')
const path = require('path')

module.exports = function setRoutes(app, basepath) {
	app.get(basepath + '/genes/bin/:bundle', async (req, res) => {
		const file = path.join(process.cwd(), `./public/bin/${req.params.bundle}`)
		res.header('Content-Type', 'application/js')
		res.send(await fs.readFileSync(file))
	})
	app.get(basepath + '/genes/:gene', async (req, res) => {
		const file = path.join(process.cwd(), './public/example.gdc.react.html')
		res.header('Content-Type', 'text/html')
		res.send(await fs.readFileSync(file))
	})
	app.get(basepath + '/wrappers/test/:filename', async (req, res) => {
		const file = path.join(process.cwd(), `./src/wrappers/test/${req.params.filename}`)
		res.header('Content-Type', 'application/javascript')
		const content = await fs.readFileSync(file, { encoding: 'utf8' })
		const lines = content.split('\n')
		let str = ''
		// remove import lines
		for (const line of lines) {
			let l = line.trim()
			if (!l.startsWith('import')) {
				if (l.includes('getPpReact')) {
					l = l.replace('getPpReact', 'runproteinpaint.wrappers.getPpReact')
				}
				if (l.includes('getLolliplotTrack')) {
					l = l.replace('getLolliplotTrack', 'runproteinpaint.wrappers.getLolliplotTrack')
				}

				if (l.startsWith('export')) {
					str += l.substr(l.search(' ')) + '\n'
				} else {
					str += l + '\n'
				}
			}
		}
		res.send(str)
	})
}
