const app = require('./app')
const utils = require('./utils')

module.exports = async (req, res) => {
	app.log(req)
	try {
		const [e, file, isurl] = app.fileurl(req)
		if (e) throw e
		if (!req.query.rglst) throw 'rglst[] missing'
		req.query.rglst = JSON.parse(req.query.rglst)
		if (!Array.isArray(req.query.rglst)) throw 'rglst[] not an array'

		if (req.query.rglst.reduce((i, j) => j.stop - j.start + i, 0) > 1000000)
			throw 'Zoom in below 1 Mb to show junctions'

		const dir = isurl ? await utils.cache_index(file, req.query.indexURL) : null

		const items = []
		for (const r of req.query.rglst) {
			await utils.get_lines_tabix([file, r.chr + ':' + r.start + '-' + r.stop], dir, line => {
				const l = line.split('\t')
				const start = Number.parseInt(l[1]),
					stop = Number.parseInt(l[2])
				if ((start >= r.start && start <= r.stop) || (stop >= r.start && stop <= r.stop)) {
					// only use those with either start/stop in region
					const j = {
						chr: r.chr,
						start,
						stop,
						type: l[4],
						rawdata: []
					}
					for (let i = 5; i < l.length; i++) {
						j.rawdata.push(Number.parseInt(l[i]))
					}
					items.push(j)
				}
			})
		}
		res.send({ lst: items })
	} catch (e) {
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
}
