import * as utils from './utils.js'
import { createCanvas } from 'canvas'
import { basecolor } from '#shared/common.js'

export default async function (req, res) {
	try {
		const [e, tkfile, isurl] = utils.fileurl(req)
		if (e) throw e
		let usegrade = req.query.usegrade
		const allheight = Number(req.query.allheight),
			fineheight = Number(req.query.fineheight),
			fineymax = Number(req.query.fineymax),
			midpad = Number(req.query.midpad),
			regionspace = Number(req.query.regionspace),
			width = Number(req.query.width)
		if (!Number.isInteger(allheight)) throw 'allheight is not integer'
		if (!Number.isInteger(fineheight)) throw 'fineheight is not integer'
		if (!Number.isInteger(fineymax)) throw 'fineymax is not integer'
		if (!Number.isInteger(midpad)) throw 'midpad is not integer'
		if (!Number.isInteger(regionspace)) throw 'regionspace is not integer'
		// width could be float!!
		if (!Number.isFinite(width)) throw 'width is not a number'
		utils.validateRglst(req.query)
		for (const r of req.query.rglst) {
			if (r.reverse) {
				r.scale = p => Math.ceil((r.width * (r.stop - p)) / (r.stop - r.start))
			} else {
				r.scale = p => Math.ceil((r.width * (p - r.start)) / (r.stop - r.start))
			}
		}

		let dir
		if (isurl) {
			dir = await utils.cache_index(tkfile, req.query.indexURL)
		}

		for (const r of req.query.rglst) {
			r.items = []
			let errlinecount = 0
			await utils.get_lines_bigfile({
				args: [tkfile, r.chr + ':' + r.start + '-' + r.stop],
				dir,
				callback: line => {
					const l = line.split('\t')
					let j
					try {
						j = JSON.parse(l[2])
					} catch (e) {
						errlinecount++
						return
					}
					const pos = Number.parseInt(l[1])
					r.items.push({ pos: pos, data: j })
				}
			})
		}

		const height = allheight + midpad + fineheight
		const canvas = createCanvas(width, height)
		const itemcount = req.query.rglst.reduce((i, j) => i + j.items.length, 0)
		const ctx = canvas.getContext('2d')
		if (itemcount == 0) {
			// no data
			ctx.font = '15px Arial'
			ctx.fillStyle = '#aaa'
			ctx.textAlign = 'center'
			ctx.textBaseline = 'middle'
			ctx.fillText('No data in view range', width / 2, height / 2)
			res.send({ src: canvas.toDataURL() })
			return
		}
		let allgrades = null
		if (!usegrade) {
			// get all grades
			const gradeset = new Set()
			for (const r of req.query.rglst) {
				for (const i of r.items) {
					for (const k in i.data) {
						gradeset.add(k)
					}
				}
			}
			allgrades = [...gradeset]
			if (allgrades.length > 0) {
				usegrade = allgrades[0]
			}
			if (!usegrade) {
				res.send({ src: canvas.toDataURL() })
				return
			}
		}
		let allmax = 0
		for (const r of req.query.rglst) {
			for (const i of r.items) {
				if (i.data[usegrade]) {
					let sum = 0
					for (const nt in i.data[usegrade]) {
						sum += i.data[usegrade][nt]
					}
					allmax = Math.max(allmax, sum)
				}
			}
		}
		const gray = '#ededed'
		let x = 0
		const allhsf = allheight / allmax
		const allhsf2 = fineheight / fineymax
		for (const r of req.query.rglst) {
			const bpwidth = r.width / (r.stop - r.start)
			for (const item of r.items) {
				const ntd = item.data[usegrade]
				if (!ntd) continue
				const xx = r.scale(item.pos)
				let sum = 0
				const ntlst = []
				for (const nt in ntd) {
					ntlst.push({ nt: nt, v: ntd[nt] })
					sum += ntd[nt]
				}
				///////// allheight graph
				// gray bar atcg sum
				ctx.fillStyle = gray
				const thisbary = allhsf * (allmax - sum)
				ctx.fillRect(x + xx, thisbary, bpwidth, allhsf * sum)
				// other nt bases
				if (ntlst.length > 1) {
					ntlst.sort((a, b) => b.v - a.v)
					for (let i = 1; i < ntlst.length; i++) {
						let cum = 0
						for (let j = 0; j < i; j++) {
							cum += ntlst[j].v
						}
						ctx.fillStyle = basecolor[ntlst[i].nt]
						ctx.fillRect(x + xx, thisbary + allhsf * cum, bpwidth, allhsf * ntlst[i].v)
					}
				}
				/////// fineheight graph
				// gray bar atcg sum
				ctx.fillStyle = gray
				const thisbary2 = allheight + midpad + allhsf2 * (fineymax - Math.min(sum, fineymax))
				ctx.fillRect(x + xx, thisbary2, bpwidth, allhsf2 * Math.min(sum, fineymax))
				if (ntlst.length > 1) {
					for (let i = 1; i < ntlst.length; i++) {
						let cum = 0
						for (let j = 0; j < i; j++) {
							cum += ntlst[j].v
						}
						ctx.fillStyle = basecolor[ntlst[i].nt]
						ctx.fillRect(
							x + xx,
							thisbary2 + allhsf2 * (fineymax - Math.min(fineymax, sum - cum)),
							bpwidth,
							allhsf2 * Math.min(fineymax, ntlst[i].v)
						)
					}
				}
			}
			x += r.width + regionspace
		}
		res.send({
			src: canvas.toDataURL(),
			allgrades: allgrades,
			usegrade: usegrade,
			allmax: allmax
		})
	} catch (e) {
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
}
