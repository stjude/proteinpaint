import * as utils from './utils.js'
import { createCanvas } from 'canvas'
import { rgb } from 'd3-color'
import { run_python } from '@sjcrh/proteinpaint-python'
import { mayLog } from './helpers.ts'
/*

NOTE:
if file/url ends with .gz, it is bedgraph

- all bedgraph data from view range will be kept in mem, risk of running out of mem
- not to be used in production!!!
- bedgraph should render bars while reading data, with predefined y axis; no storing data
*/

export default function (genomes) {
	return async (req, res) => {
		try {
			await handle_tkbigwig(req, res, genomes)
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

// upper limits of the size of the image, which is allocated in memory
const maxWidth = 20000
const maxBarHeight = 2000
const maxPixelRatio = 5

export function validateCanvasSize(q) {
	if (!Number.isFinite(q.barheight)) throw 'invalid barheight'
	if (q.barheight < 0 || q.barheight > maxBarHeight) throw 'barheight out of bound'
	if (!Number.isFinite(q.width)) throw 'invalid width'
	if (q.width < 0 || q.width > maxWidth) throw 'width out of bound'
	// may be missing
	if (q.devicePixelRatio !== undefined) {
		if (!Number.isFinite(q.devicePixelRatio)) throw 'invalid devicePixelRatio'
		if (q.devicePixelRatio <= 0 || q.devicePixelRatio > maxPixelRatio) throw 'devicePixelRatio out of bound'
	}
}

async function handle_tkbigwig(req, res, genomes) {
	const gn = genomes[req.query.genome]
	if (!gn) throw 'invalid genome'

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
	validateCanvasSize(req.query)
	if (!Number.isFinite(req.query.regionspace)) throw 'invalid regionspace'
	if (req.query.dotplotfactor) {
		const f = req.query.dotplotfactor
		if (!Number.isInteger(f) || f < 1 || f > 100) throw 'dotplotfactor value should be an integer from 1 to 100'
	}

	if (pa.isbedgraph) {
		return await getBedgraph(req, res, file, pa)
	}

	// check the total before reading any region
	let totalBins = 0
	for (const r of req.query.rglst) totalBins += getNBins(req, r)
	if (totalBins > maxBins) throw 'too many bins requested'

	const t = new Date()
	for (const r of req.query.rglst) {
		const bins = await run_bigwigsummary(req, r, file)

		if (bins) {
			r.values = bins
			if (req.query.dividefactor) {
				r.values = r.values.map(i => i / req.query.dividefactor)
			}
		}
	}
	mayLog('bw python', Date.now() - t)

	res.send(plotWiggle(req.query, pa))
	mayLog('bw python+rendering', Date.now() - t)
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
					if (Number.isNaN(Number(v))) continue
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
				const [pointwidth, pointshift] = getP(r, q)
				for (let i = 0; i < r.values.length; i++) {
					const v = r.values[i]
					if (Number.isNaN(Number(v))) continue
					ctx.fillStyle =
						v >= maxv
							? q.pcolor2
							: v >= 0
							? 'rgba(' + rgbp + ',' + v / maxv + ')'
							: v <= minv
							? q.ncolor2
							: 'rgba(' + rgbn + ',' + v / minv + ')'
					const x2 = Math.ceil(x + (r.reverse ? r.width - pointshift * (i + 1) : pointshift * i))
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
				const [pointwidth, pointshift] = getP(r, q)
				for (let i = 0; i < r.values.length; i++) {
					const v = r.values[i]
					if (Number.isNaN(Number(v))) continue
					// for reverse region, i+1 is needed to correctly compute plot start position
					const x2 = Math.ceil(x + (r.reverse ? r.width - pointshift * (i + 1) : pointshift * i))

					if (q.bgcolor) {
						// track defines bg color. draw it for all loci with valid value
						ctx.fillStyle = q.bgcolor
						ctx.fillRect(x2, 0, pointwidth, q.barheight)
					}

					ctx.fillStyle = v > 0 ? q.pcolor : q.ncolor
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

function getP(r, q) {
	// returns [pointwidth, pointshift]
	let w
	if (r.stop - r.start >= r.width) {
		w = 1
	} else {
		w = r.width / (r.stop - r.start)
	}
	return [w, q.dotplotfactor ? w / q.dotplotfactor : w]
}

async function getBedgraph(req, res, file, pa) {
	/* read and plot all bedgraph lines from a locus, without summary
	pa={minv,maxv,bedgraphdir}
	 */
	if (pa.fixminv == undefined || pa.fixmaxv == undefined) throw 'Y axis scale must be defined for bedgraph track'
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
	const hscale = makeyscale().height(req.query.barheight).min(pa.fixminv).max(pa.fixmaxv)
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

			if (v > pa.fixmaxv) {
				ctx.fillStyle = req.query.pcolor2
				ctx.fillRect(x1, 0, w, 2)
			} else if (v < pa.fixminv) {
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

// upper limit of the number of bins requested for all regions of a request
const maxBins = 200000

function getNBins(req, r) {
	return Math.ceil(Math.min(r.stop - r.start, r.width) * (req.query.dotplotfactor || 1))
}

async function run_bigwigsummary(req, r, file) {
	const n_bins = getNBins(req, r)
	const input_json = {
		bw_file: file,
		chromosome: r.chr,
		start: r.start,
		end: r.stop,
		n_bins
	}
	const python_output = await run_python('bigWigSummary.py', JSON.stringify(input_json))
	const bins = typeof python_output === 'string' ? JSON.parse(python_output) : []
	if (bins.length == 0) throw `Couldn't find data for provided file`
	return bins
}
