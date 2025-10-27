import fs from 'fs'
import path from 'path'
import * as utils from './utils.js'
import serverconfig from './serverconfig.js'
import { createCanvas } from 'canvas'

export default function (genomes) {
	return async (req, res) => {
		try {
			res.send(await do_query(req, genomes))
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

async function do_query(req, genomes) {
	/*
	no caching markers, draw them as along as they are retrieved
	do not try to estimate marker size, determined by client
	*/
	const gn = genomes[req.query.genome]
	if (!gn) throw 'invalid genome'
	utils.validateRglst(req.query, gn)

	const [e, file, isurl] = utils.fileurl(req)
	if (e) throw e
	const coveragemax = Number(req.query.coveragemax) || 100
	if (!Number.isInteger(coveragemax)) throw 'invalid coveragemax'
	const vafheight = Number(req.query.vafheight)
	if (!Number.isInteger(vafheight)) throw 'invalid vafheight'
	const coverageheight = Number(req.query.coverageheight)
	if (!Number.isInteger(coverageheight)) throw 'invalid coverageheight'
	const rowspace = Number(req.query.rowspace)
	if (!Number.isInteger(rowspace)) throw 'invalid rowspace'
	const dotsize = Number(req.query.dotsize) || 1
	if (!Number.isInteger(dotsize)) throw 'invalid dotsize'

	const gtotalcutoff = req.query.gtotalcutoff
	const gmafrestrict = req.query.gmafrestrict

	const canvas = createCanvas(
		req.query.width * req.query.devicePixelRatio,
		(vafheight * 3 + rowspace * 4 + coverageheight * 2) * req.query.devicePixelRatio
	)
	const ctx = canvas.getContext('2d')
	if (req.query.devicePixelRatio > 1) {
		ctx.scale(req.query.devicePixelRatio, req.query.devicePixelRatio)
	}

	// vaf track background
	ctx.fillStyle = '#f1f1f1'
	ctx.fillRect(0, 0, req.query.width, vafheight / 2) // tumor
	ctx.fillRect(0, rowspace * 2 + vafheight + coverageheight, req.query.width, vafheight / 2) // normal
	ctx.fillStyle = '#FAFAD9'
	ctx.fillRect(0, vafheight / 2, req.query.width, vafheight / 2) // tumor
	ctx.fillRect(0, rowspace * 2 + vafheight * 1.5 + coverageheight, req.query.width, vafheight / 2) // normal

	let dir // when using url
	if (isurl) {
		dir = await utils.cache_index(file, req.query.indexURL)
	}

	let x = 0
	for (const r of req.query.rglst) {
		r.x = x
		x += req.query.regionspace + r.width
	}

	const samplecolor = '#786312'
	const aicolor = '#122778'
	const barcolor = '#858585'
	const coverageabovemaxcolor = 'red'

	for (const r of req.query.rglst) {
		const xsf = r.width / (r.stop - r.start) // pixel per bp
		await utils.get_lines_bigfile({
			args: [file, r.chr + ':' + r.start + '-' + r.stop],
			dir,
			callback: line => {
				const l = line.split('\t')
				const pos = Number.parseInt(l[1])
				const mintumor = Number.parseInt(l[2])
				const tintumor = Number.parseInt(l[3])
				const minnormal = Number.parseInt(l[4])
				const tinnormal = Number.parseInt(l[5])
				if (Number.isNaN(mintumor) || Number.isNaN(tintumor) || Number.isNaN(minnormal) || Number.isNaN(tinnormal))
					return

				if (gtotalcutoff && tinnormal < gtotalcutoff) return

				const x = Math.ceil(r.x + xsf * (r.reverse ? r.stop - pos : pos - r.start) - dotsize / 2)

				// marker maf
				ctx.fillStyle = samplecolor
				const vaftumor = mintumor / tintumor
				ctx.fillRect(x, vafheight * (1 - vaftumor), dotsize, 2)
				const vafnormal = minnormal / tinnormal

				if (gmafrestrict && (vafnormal < gmafrestrict || vafnormal > 1 - gmafrestrict)) return

				ctx.fillRect(x, vafheight + rowspace + coverageheight + rowspace + vafheight * (1 - vafnormal), dotsize, 2)
				ctx.fillStyle = aicolor
				// ai
				const ai = Math.abs(vaftumor - vafnormal)
				ctx.fillRect(x, vafheight * 2 + rowspace * 4 + coverageheight * 2 + vafheight * (1 - ai), dotsize, 2)

				// coverage bars
				//ctx.fillStyle = tintumor>=coveragemax ? coverageabovemaxcolor : barcolor
				ctx.fillStyle = barcolor
				let barh = ((tintumor >= coveragemax ? coveragemax : tintumor) * coverageheight) / coveragemax
				let y = coverageheight - barh
				ctx.fillRect(x, y + vafheight + rowspace, dotsize, barh)

				//ctx.fillStyle = tinnormal >=coveragemax ? coverageabovemaxcolor : barcolor
				ctx.fillStyle = barcolor
				barh = ((tinnormal >= coveragemax ? coveragemax : tinnormal) * coverageheight) / coveragemax
				y = coverageheight - barh
				ctx.fillRect(x, y + 3 * rowspace + 2 * vafheight + coverageheight, dotsize, barh)

				// coverage above max
				if (tintumor >= coveragemax) {
					ctx.fillStyle = coverageabovemaxcolor
					ctx.fillRect(x, vafheight + rowspace, dotsize, 2)
				}
				if (tinnormal >= coveragemax) {
					ctx.fillStyle = coverageabovemaxcolor
					ctx.fillRect(x, 3 * rowspace + 2 * vafheight + coverageheight, dotsize, 2)
				}
			}
		})
	}
	return {
		src: canvas.toDataURL(),
		coveragemax: coveragemax
	}
}
