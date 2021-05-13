const fs = require('fs')
const readline = require('readline')
const app = require('./app')

module.exports = async (req, res) => {
	app.log(req)
	try {
		// check if junctionrnapeg is enabled from serverconfig.features
		if (!app.features && !app.features.junctionrnapeg) throw 'junction rnapeg not supported on this server'
		const [e, file, isurl] = app.fileurl(req)
		if (e) throw e
		if (!req.query.rglst) throw 'rglst[] missing'
		req.query.rglst = JSON.parse(req.query.rglst)
		if (!Array.isArray(req.query.rglst)) throw 'rglst[] not an array'

		if (req.query.rglst.reduce((i, j) => j.stop - j.start + i, 0) > 1000000)
			throw 'Zoom in below 1 Mb to show junctions'

		const items = []
		for (const r of req.query.rglst) {
			const lines = await get_lines_rnapeg({ file, chr: r.chr, start: r.start, stop: r.stop })
			// lines are already filterd from get_lines_rnapeg
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i]
				const j = {
					chr: line.chr,
					start: line.start,
					stop: line.stop,
					type: line.type,
					rawdata: []
				}
				// rawdata is using value from count column of rnapeg file
				j.rawdata.push(line.count)
				items.push(j)
			}
		}
		res.send({ lst: items })
	} catch (e) {
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
}

function get_lines_rnapeg(args) {
	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({ input: fs.createReadStream(args.file, { encoding: 'utf8' }) })
		const lines = []
		rl.on('line', line => {
			const l = line.split('\t')
			const pos = l[0].split(',')
			const _start = pos[0].split(':')
			const chr = _start[0],
				start = Number.parseInt(_start[1]) - 1,
				stop = pos[1] ? Number.parseInt(pos[1].split(':')[1])-1 : undefined,
				count = Number.parseInt(l[1]),
				type = l[2]
			// assumes that file is sorted by start:stop and stops when stop > args.stops
			if (
				chr == args.chr &&
				((start >= args.start && start <= args.stop) || (stop >= args.start && stop <= args.stop))
			) {
				if (Number.isNaN(start) || Number.isNaN(stop) || start < 0 || stop < 0 || start > stop) {
					reject('error reading file: ' + line)
				}
				lines.push({chr, start, stop, count, type})
			} else if (chr == args.chr && stop > args.stop) {
				rl.close()
			}
		})
		rl.on('close', () => {
			resolve(lines)
		})
	})
}
