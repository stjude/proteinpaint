import * as utils from './utils'
import serverconfig from './serverconfig'
import { spawn } from 'child_process'
import { createCanvas } from 'canvas'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { rgb } from 'd3-color'

/*

NOTE:
if file/url ends with .gz, it is bedgraph

- all bedgraph data from view range will be kept in mem, risk of running out of mem
- not to be used in production!!!
- bedgraph should render bars while reading data, with predefined y axis; no storing data
*/

export async function handle_tkbigwig(req, res) {
	try {
		const pa = {
			// plot arg
			fixminv: null,
			fixmaxv: null,
			percentile: null,
			autoscale: false,
			isbedgraph: false,
			bedgraphdir: null
		}

		const [e, file, isurl] = utils.fileurl(req)
		if (e) throw e

		if (file.endsWith('.gz')) {
			// is bedgraph, will cache index if is url
			pa.isbedgraph = true
			if (isurl) {
				pa.bedgraphdir = await utils.cache_index(file, req.query.indexURL)
			}
		}

		if (req.query.autoscale) {
			pa.autoscale = true
		} else if (req.query.percentile) {
			pa.percentile = req.query.percentile
			if (!Number.isFinite(pa.percentile)) throw 'invalid percentile'
		} else {
			pa.fixminv = req.query.minv
			pa.fixmaxv = req.query.maxv
			if (!Number.isFinite(pa.fixminv)) throw 'invalid minv'
			if (!Number.isFinite(pa.fixmaxv)) throw 'invalid maxv'
		}
		if (!Number.isFinite(req.query.barheight)) throw 'invalid barheight'
		if (!Number.isFinite(req.query.regionspace)) throw 'invalid regionspace'
		if (!Number.isFinite(req.query.width)) throw 'invalid width'
		if (!utils.hasValidRglst(req.query, res)) return
		if (req.query.dotplotfactor) {
			if (!Number.isInteger(req.query.dotplotfactor)) throw 'dotplotfactor value should be positive integer'
		}

		if (pa.isbedgraph) {
			return await getBedgraph(req, res, file, pa)
		}

		for (const r of req.query.rglst) {
			let out

			if (serverconfig.features.bigwig_rust) {
				// When bigwig_rust is defined in serverconfig.json, bigwig rust binary will be used to query the bigwig file (currently experimental!!)
				const input_data =
					file + ',' + r.chr + ',' + r.start + ',' + r.stop + ',' + Math.ceil(r.width * (req.query.dotplotfactor || 1))

				out = await run_rust('bigwig', input_data)
			} else {
				// When this flag is not defined, the ucsc bigwigsummary will be used to query the bigwig file
				out = await run_bigwigsummary(req, r, file)
			}

			if (out) {
				r.values = out.trim().split('\t').map(Number.parseFloat)
				if (req.query.dividefactor) {
					r.values = r.values.map(i => i / req.query.dividefactor)
				}
			}
		}

		res.send(plotWiggle(req.query, pa))
	} catch (err) {
		if (err.stack) console.log(err.stack)
		res.send({ error: err.message || err })
	}
}

/*
q={ // contains parameters from request
	rglst[
		{
			start
			stop
			width
			values[]
		}
	]
	regionspace
	width
	devicePixelRatio
	barheight
	name
	dotplotfactor
	pcolor
	pcolor2
	ncolor
	ncolor2
}
pa={ // contains parameters derived from q
	fixminv
	fixmaxv
	percentile
	autoscale
}

returns 
{
	src
	nodata
}
*/
export function plotWiggle(q, pa) {
	let nodata = true
	for (const r of q.rglst) {
		if (r.values) nodata = false
	}
	const canvas = createCanvas(q.width * q.devicePixelRatio, q.barheight * q.devicePixelRatio)
	const ctx = canvas.getContext('2d')
	if (q.devicePixelRatio > 1) {
		ctx.scale(q.devicePixelRatio, q.devicePixelRatio)
	}
	if (nodata) {
		// bigwig hard-coded stuff
		ctx.font = '14px Arial'
		ctx.fillStyle = '#858585'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'
		ctx.fillText(q.name + ': no data in view range', q.width / 2, q.barheight / 2)
		return { src: canvas.toDataURL(), nodata: true }
	}

	const pointwidth = 1 // line/dot plot width
	const pointshift = q.dotplotfactor ? 1 / q.dotplotfactor : 1 // shift distance

	let maxv = 0,
		minv = 0

	const values = []
	const result = {}

	if (pa.autoscale || pa.percentile) {
		const positive = []
		const negative = []
		for (const r of q.rglst) {
			if (r.values) {
				for (const v of r.values) {
					if (Number.isNaN(v)) continue
					if (v >= 0) positive.push(v)
					if (v <= 0) negative.push(v)
				}
			}
		}
		if (positive.length) {
			positive.sort((a, b) => a - b)
			if (pa.autoscale) {
				maxv = positive[positive.length - 1]
			} else {
				maxv = positive[Math.floor((positive.length * pa.percentile) / 100)]
			}
		}
		if (negative.length) {
			negative.sort((a, b) => b - a)
			if (pa.autoscale) {
				minv = negative[negative.length - 1]
			} else {
				minv = negative[Math.floor((negative.length * pa.percentile) / 100)]
			}
		}
		result.minv = minv
		result.maxv = maxv
	} else {
		minv = pa.fixminv
		maxv = pa.fixmaxv
	}
	if (q.barheight < 10) {
		/*
			heatmap
			*/
		let r = rgb(q.pcolor)
		const rgbp = r.r + ',' + r.g + ',' + r.b
		r = rgb(q.ncolor)
		const rgbn = r.r + ',' + r.g + ',' + r.b
		let x = 0
		for (const r of q.rglst) {
			if (r.values) {
				for (let i = 0; i < r.values.length; i++) {
					const v = r.values[i]
					if (Number.isNaN(v)) continue
					ctx.fillStyle =
						v >= maxv
							? q.pcolor2
							: v >= 0
							? 'rgba(' + rgbp + ',' + v / maxv + ')'
							: v <= minv
							? q.ncolor2
							: 'rgba(' + rgbn + ',' + v / minv + ')'
					const x2 = Math.ceil(x + (r.reverse ? r.width - pointshift * i : pointshift * i))
					ctx.fillRect(x2, 0, pointwidth, q.barheight)
				}
			}
			x += r.width + q.regionspace
		}
	} else {
		/*
			barplot
			*/
		const hscale = makeyscale().height(q.barheight).min(minv).max(maxv)
		let x = 0
		for (const r of q.rglst) {
			if (r.values) {
				for (let i = 0; i < r.values.length; i++) {
					const v = r.values[i]
					if (Number.isNaN(v)) continue
					ctx.fillStyle = v > 0 ? q.pcolor : q.ncolor
					const x2 = Math.ceil(x + (r.reverse ? r.width - pointshift * i : pointshift * i))
					const tmp = hscale(v)

					if (v > 0) {
						ctx.fillRect(x2, tmp.y, pointwidth, q.dotplotfactor ? Math.min(2, tmp.h) : tmp.h)
					} else {
						// negative value
						if (q.dotplotfactor) {
							const _h = Math.min(2, tmp.h)
							ctx.fillRect(x2, tmp.y + tmp.h - _h, pointwidth, _h)
						} else {
							ctx.fillRect(x2, tmp.y, pointwidth, tmp.h)
						}
					}

					if (v > maxv) {
						ctx.fillStyle = q.pcolor2
						ctx.fillRect(x2, 0, pointwidth, 2)
					} else if (v < minv) {
						ctx.fillStyle = q.ncolor2
						ctx.fillRect(x2, q.barheight - 2, pointwidth, 2)
					}
				}
			}
			x += r.width + q.regionspace
		}
	}
	result.src = canvas.toDataURL()
	return result
}

async function getBedgraph(req, res, file, pa) {
	/* read and plot all bedgraph lines from a locus, without summary
	pa={minv,maxv,bedgraphdir}
	 */
	if (pa.minv == undefined || pa.maxv == undefined) throw 'Y axis scale must be defined for bedgraph track'
	const canvas = createCanvas(
		req.query.width * req.query.devicePixelRatio,
		req.query.barheight * req.query.devicePixelRatio
	)
	const ctx = canvas.getContext('2d')
	if (req.query.devicePixelRatio > 1) ctx.scale(req.query.devicePixelRatio, req.query.devicePixelRatio)
	let xoff = 0
	for (let r of req.query.rglst) {
		await bedgraphRegion(req, r, xoff, file, ctx, pa)
		xoff += r.width + req.query.regionspace
	}
	res.send({ src: canvas.toDataURL() })
}

async function bedgraphRegion(req, r, xoff, file, ctx, pa) {
	const hscale = makeyscale().height(req.query.barheight).min(pa.minv).max(pa.maxv)
	const sf = r.width / (r.stop - r.start)

	await utils.get_lines_bigfile({
		args: [file, r.chr + ':' + r.start + '-' + r.stop],
		dir: pa.bedgraphdir,
		callback: line => {
			const l = line.split('\t')
			const start = Number.parseInt(l[1])
			if (Number.isNaN(start)) return
			const stop = Number.parseInt(l[2])
			if (Number.isNaN(stop)) return
			const v = Number.parseFloat(l[3])
			if (Number.isNaN(v)) return
			ctx.fillStyle = v > 0 ? req.query.pcolor : req.query.ncolor
			const tmp = hscale(v)
			const x1 = xoff + (Math.max(start, r.start) - r.start) * sf
			const x2 = xoff + (Math.min(stop, r.stop) - r.start) * sf
			const w = Math.max(1, x2 - x1)

			ctx.fillRect(x1, tmp.y, w, tmp.h)

			if (v > pa.maxv) {
				ctx.fillStyle = req.query.pcolor2
				ctx.fillRect(x1, 0, w, 2)
			} else if (v < pa.minv) {
				ctx.fillStyle = req.query.ncolor2
				ctx.fillRect(x1, req.query.barheight - 2, w, 2)
			}
		}
	})
}

function makeyscale() {
	var barheight = 50,
		minv = 0,
		maxv = 100

	function yscale(v) {
		var usebaseline = false
		var baseliney = 0
		if (minv == 0 && maxv == 0) {
			// nothing
		} else if (minv <= 0 && maxv >= 0) {
			usebaseline = true
			baseliney = (barheight * maxv) / (maxv - minv)
		}
		if (usebaseline) {
			if (v >= maxv) return { y: 0, h: baseliney }
			if (v >= 0) {
				var h = (baseliney * v) / maxv
				return { y: baseliney - h, h: h }
			}
			if (v <= minv) return { y: baseliney, h: barheight - baseliney }
			var h = ((barheight - baseliney) * v) / minv
			return { y: baseliney, h: h }
			return
		}
		if (v <= minv) return { y: barheight, h: 0 }
		var h = (barheight * (v - minv)) / (maxv - minv)
		return { y: barheight - h, h: h }
	}
	yscale.height = function (h) {
		barheight = h
		return yscale
	}
	yscale.min = function (v) {
		minv = v
		return yscale
	}
	yscale.max = function (v) {
		maxv = v
		return yscale
	}
	return yscale
}

function run_bigwigsummary(req, r, file) {
	return new Promise((resolve, reject) => {
		const ps = spawn(serverconfig.bigwigsummary, [
			'-udcDir=' + serverconfig.cachedir,
			file,
			r.chr,
			r.start,
			r.stop,
			Math.ceil(r.width * (req.query.dotplotfactor || 1))
		])
		const out = []
		const out2 = []
		ps.stdout.on('data', i => out.push(i))
		ps.stderr.on('data', i => out2.push(i))
		ps.on('close', code => {
			const err = out2.join('')
			if (err.length) {
				if (err.startsWith('no data')) {
					resolve()
				} else {
					// in case of invalid file the message is "Couldn't open /path/to/tp/..."
					// must not give away the tp path!!
					reject('Cannot read bigWig file')
				}
			} else {
				resolve(out.join(''))
			}
		})
	})
}
