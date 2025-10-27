import fs from 'fs'
import path from 'path'
import * as utils from './utils.js'
import serverconfig from './serverconfig.js'
import { createCanvas } from 'canvas'

/*
 ********************** EXPORTED
 ********************** INTERNAL
 */

export default function (genomes) {
	return async (req, res) => {
		try {
			const q = req.query
			const gn = genomes[q.genome]
			if (!gn) throw 'unknown genome'

			let dir = null
			if (q.file) {
				q.file = path.join(serverconfig.tpmasterdir, q.file)
			} else if (q.url) {
				dir = await utils.cache_index(q.url, q.indexURL)
			} else {
				throw 'file or url missing'
			}

			const nochr = await utils.tabix_is_nochr(q.file || q.url, dir, gn)

			const result = await run_request(q, dir, nochr, gn)

			res.send(result)
		} catch (e) {
			if (e.stack) console.log(e.stack)
			res.send({ error: e.message || e })
		}
	}
}

async function run_request(q, dir, nochr, gn) {
	const result = { rglst: [] }
	utils.validateRglst(q, gn)

	let minv = 0,
		maxv = 0

	if (q.autoscale) {
		// figure out the hard way
		for (const r of q.rglst) {
			const coord = (nochr ? r.chr.replace('chr', '') : r.chr) + ':' + r.start + '-' + r.stop
			await utils.get_lines_bigfile({
				args: [q.file, coord],
				dir,
				callback: line => {
					const [chr, s1, s2, s3] = line.split('\t')
					for (const s of s3.split(',')) {
						const v = Number(s)
						minv = Math.min(minv, v)
						maxv = Math.max(maxv, v)
					}
				}
			})
		}
		result.minv = minv
		result.maxv = maxv
	} else {
		minv = q.minv
		maxv = q.maxv
	}

	const hscale = app.makeyscale().height(q.barheight).min(minv).max(maxv)

	for (const r of q.rglst) {
		const r2 = {
			chr: r.chr,
			start: r.start,
			stop: r.stop,
			width: r.width,
			reverse: r.reverse,
			xoff: r.xoff
		}

		const canvas = createCanvas(r.width, q.barheight)
		const ctx = canvas.getContext('2d')

		// query for this variant
		const coord = (nochr ? r.chr.replace('chr', '') : r.chr) + ':' + r.start + '-' + r.stop
		await utils.get_lines_bigfile({
			args: [q.file, coord],
			dir,
			callback: line => {
				const [chr, s1, s2, s3] = line.split('\t')

				const start = Math.max(Number.parseInt(s1), r.start)
				const stop = Math.min(Number.parseInt(s2), r.stop)

				const x1 = ((r.reverse ? r.stop - stop : start - r.start) * r.width) / (r.stop - r.start)
				const x2 = ((r.reverse ? r.stop - start : stop - r.start) * r.width) / (r.stop - r.start)

				for (const str of s3.split(',')) {
					const v = Number(str)

					ctx.fillStyle = v > 0 ? q.pcolor : q.ncolor
					const tmp = hscale(v)

					const w = Math.max(1, x2 - x1)
					ctx.fillRect(x1, tmp.y, w, 2)

					if (v > maxv) {
						ctx.fillStyle = req.query.pcolor2
						ctx.fillRect(x1, 0, w, 2)
					} else if (v < minv) {
						ctx.fillStyle = req.query.ncolor2
						ctx.fillRect(x1, q.barheight - 2, w, 2)
					}
				}
			}
		})

		r2.img = canvas.toDataURL()
		result.rglst.push(r2)
	}

	return result
}
