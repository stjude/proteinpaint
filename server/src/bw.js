const app = require('./app')
const createCanvas = require('canvas').createCanvas
const utils = require('./utils')
const run_rust = require('@sjcrh/proteinpaint-rust').run_rust
const serverconfig = require('./serverconfig')
const spawn = require('child_process').spawn
const { rgb } = require('d3-color')

/*

NOTE:
if file/url ends with .gz, it is bedgraph

- all bedgraph data from view range will be kept in mem, risk of running out of mem
- not to be used in production!!!
- bedgraph should render bars while reading data, with predefined y axis; no storing data
*/

export async function handle_tkbigwig(req, res) {
	try {
		let fixminv,
			fixmaxv,
			percentile,
			autoscale = false,
			isbedgraph = false,
			bedgraphdir

		const [e, file, isurl] = app.fileurl(req)
		if (e) throw e

		if (file.endsWith('.gz')) {
			// is bedgraph, will cache index if is url
			isbedgraph = true
			if (isurl) {
				bedgraphdir = await utils.cache_index(file, req.query.indexURL)
			}
		}

		if (req.query.autoscale) {
			autoscale = true
		} else if (req.query.percentile) {
			percentile = req.query.percentile
			if (!Number.isFinite(percentile)) throw 'invalid percentile'
		} else {
			fixminv = req.query.minv
			fixmaxv = req.query.maxv
			if (!Number.isFinite(fixminv)) throw 'invalid minv'
			if (!Number.isFinite(fixmaxv)) throw 'invalid maxv'
		}
		if (!Number.isFinite(req.query.barheight)) throw 'invalid barheight'
		if (!Number.isFinite(req.query.regionspace)) throw 'invalid regionspace'
		if (!Number.isFinite(req.query.width)) throw 'invalid width'
		if (!req.query.rglst) throw 'region list missing'
		if (req.query.dotplotfactor) {
			if (!Number.isInteger(req.query.dotplotfactor)) throw 'dotplotfactor value should be positive integer'
		}

		if (isbedgraph) {
			return await getBedgraph(req, res, fixminv, fixmaxv, file, bedgraphdir)
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
				r.values = out
					.trim()
					.split('\t')
					.map(Number.parseFloat)
				if (req.query.dividefactor) {
					r.values = r.values.map(i => i / req.query.dividefactor)
				}
			}
		}

		let nodata = true
		for (const r of req.query.rglst) {
			if (r.values) nodata = false
		}
		const canvas = createCanvas(
			req.query.width * req.query.devicePixelRatio,
			req.query.barheight * req.query.devicePixelRatio
		)
		const ctx = canvas.getContext('2d')
		if (req.query.devicePixelRatio > 1) {
			ctx.scale(req.query.devicePixelRatio, req.query.devicePixelRatio)
		}
		if (nodata) {
			// bigwig hard-coded stuff
			ctx.font = '14px Arial'
			ctx.fillStyle = '#858585'
			ctx.textAlign = 'center'
			ctx.textBaseline = 'middle'
			ctx.fillText(req.query.name + ': no data in view range', req.query.width / 2, req.query.barheight / 2)
			res.send({ src: canvas.toDataURL(), nodata: true })
			return
		}

		const pointwidth = 1 // line/dot plot width
		const pointshift = req.query.dotplotfactor ? 1 / req.query.dotplotfactor : 1 // shift distance

		let maxv = 0,
			minv = 0

		const values = []
		const result = {}

		if (autoscale || percentile) {
			const positive = []
			const negative = []
			for (const r of req.query.rglst) {
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
				if (autoscale) {
					maxv = positive[positive.length - 1]
				} else {
					maxv = positive[Math.floor((positive.length * percentile) / 100)]
				}
			}
			if (negative.length) {
				negative.sort((a, b) => b - a)
				if (autoscale) {
					minv = negative[negative.length - 1]
				} else {
					minv = negative[Math.floor((negative.length * percentile) / 100)]
				}
			}
			result.minv = minv
			result.maxv = maxv
		} else {
			minv = fixminv
			maxv = fixmaxv
		}
		if (req.query.barheight < 10) {
			/*
			heatmap
			*/
			let r = rgb(req.query.pcolor)
			const rgbp = r.r + ',' + r.g + ',' + r.b
			r = rgb(req.query.ncolor)
			const rgbn = r.r + ',' + r.g + ',' + r.b
			let x = 0
			for (const r of req.query.rglst) {
				if (r.values) {
					for (let i = 0; i < r.values.length; i++) {
						const v = r.values[i]
						if (Number.isNaN(v)) continue
						ctx.fillStyle =
							v >= maxv
								? req.query.pcolor2
								: v >= 0
								? 'rgba(' + rgbp + ',' + v / maxv + ')'
								: v <= minv
								? req.query.ncolor2
								: 'rgba(' + rgbn + ',' + v / minv + ')'
						const x2 = Math.ceil(x + (r.reverse ? r.width - pointshift * i : pointshift * i))
						ctx.fillRect(x2, 0, pointwidth, req.query.barheight)
					}
				}
				x += r.width + req.query.regionspace
			}
		} else {
			/*
			barplot
			*/
			const hscale = makeyscale()
				.height(req.query.barheight)
				.min(minv)
				.max(maxv)
			let x = 0
			for (const r of req.query.rglst) {
				if (r.values) {
					for (let i = 0; i < r.values.length; i++) {
						const v = r.values[i]
						if (Number.isNaN(v)) continue
						ctx.fillStyle = v > 0 ? req.query.pcolor : req.query.ncolor
						const x2 = Math.ceil(x + (r.reverse ? r.width - pointshift * i : pointshift * i))
						const tmp = hscale(v)

						if (v > 0) {
							ctx.fillRect(x2, tmp.y, pointwidth, req.query.dotplotfactor ? Math.min(2, tmp.h) : tmp.h)
						} else {
							// negative value
							if (req.query.dotplotfactor) {
								const _h = Math.min(2, tmp.h)
								ctx.fillRect(x2, tmp.y + tmp.h - _h, pointwidth, _h)
							} else {
								ctx.fillRect(x2, tmp.y, pointwidth, tmp.h)
							}
						}

						if (v > maxv) {
							ctx.fillStyle = req.query.pcolor2
							ctx.fillRect(x2, 0, pointwidth, 2)
						} else if (v < minv) {
							ctx.fillStyle = req.query.ncolor2
							ctx.fillRect(x2, req.query.barheight - 2, pointwidth, 2)
						}
					}
				}
				x += r.width + req.query.regionspace
			}
		}
		result.src = canvas.toDataURL()
		res.send(result)
	} catch (err) {
		if (err.stack) console.log(err.stack)
		res.send({ error: err.message || err })
	}
}

async function getBedgraph(req, res, minv, maxv, file, bedgraphdir) {
	/*
	 */
	if (minv == undefined || maxv == undefined) throw 'Y axis scale must be defined for bedgraph track'
	const canvas = createCanvas(req.query.width, req.query.barheight)
	const ctx = canvas.getContext('2d')
	let xoff = 0
	for (let r of req.query.rglst) {
		await bedgraphRegion(req, r, xoff, minv, maxv, file, bedgraphdir, ctx)
		xoff += r.width + req.query.regionspace
	}
	res.send({ src: canvas.toDataURL() })
}

async function bedgraphRegion(req, r, xoff, minv, maxv, file, bedgraphdir, ctx) {
	const hscale = makeyscale()
		.height(req.query.barheight)
		.min(minv)
		.max(maxv)
	const sf = r.width / (r.stop - r.start)

	await utils.get_lines_bigfile({
		args: [file, r.chr + ':' + r.start + '-' + r.stop],
		dir: bedgraphdir,
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

			if (v > maxv) {
				ctx.fillStyle = req.query.pcolor2
				ctx.fillRect(x1, 0, w, 2)
			} else if (v < minv) {
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
	yscale.height = function(h) {
		barheight = h
		return yscale
	}
	yscale.min = function(v) {
		minv = v
		return yscale
	}
	yscale.max = function(v) {
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
