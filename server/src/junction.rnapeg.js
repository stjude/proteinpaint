const app = require('./app')
const fs = require('fs')
const readline = require('readline')
const serverconfig = require('./serverconfig')
exports.features = Object.freeze(serverconfig.features || {})

module.exports = async (req, res) => {
	app.log(req)
	try {
		if(!exports.features.junctionrnapeg) throw 'junction rnapeg not supported on this server'
		const [e, file, isurl] = app.fileurl(req)
		if (e) throw e
		if (!req.query.rglst) throw 'rglst[] missing'
		req.query.rglst = JSON.parse(req.query.rglst)
		if (!Array.isArray(req.query.rglst)) throw 'rglst[] not an array'

		if (req.query.rglst.reduce((i, j) => j.stop - j.start + i, 0) > 1000000)
			throw 'Zoom in below 1 Mb to show junctions'

	// 	const dir = isurl ? await utils.cache_index(file, req.query.indexURL) : null

		const items = []
		for (const r of req.query.rglst) {
			// await get_lines_rnapeg({file, chr: r.chr, start: r.start, stop: r.stop})
			// 	.then(lines =>{
			// 		console.log(lines)
			// 	})
			await get_lines_rnapeg({file, chr: r.chr, start: r.start, stop: r.stop}, lines => {
				for (let i = 0; i < lines.length; i++) {
					const l = lines[i].split('\t')
					const pos = l[0].split(',')
					const start = Number.parseInt(pos[0].split(':')[1]),
						stop = Number.parseInt(pos[1].split(':')[1])
					// only use those with either start/stop in region
					const j = {
						chr: r.chr,
						start,
						stop,
						type: l[2],
						rawdata: []
					}
					j.rawdata.push(Number.parseInt(l[1]))
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

function get_lines_rnapeg(args, callback){
	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({input: fs.createReadStream(args.file, {encoding:'utf8'})})
		const lines = []
		rl.on('line',line=>{
			const l = line.split('\t')
			const pos = l[0].split(',')
			const _start = pos[0].split(':')
			const chr = _start[0],
				start = _start[1],
				stop = pos[1] ? pos[1].split(':')[1] : undefined
			if(chr == args.chr && ((start >= args.start && start <= args.stop) || (stop >= args.start && stop <= args.stop))){
				if(Number.isNaN(start) || Number.isNaN(stop) || start<0 || stop<0 || start>stop) {
					reject('error reading file: '+ line)
				}
				lines.push(line)
			}else if(chr == args.chr && stop > args.stop){
				rl.close()
			}
		})
		rl.on('close',()=>{
			callback(lines)
			resolve()
		})
	})
} 
