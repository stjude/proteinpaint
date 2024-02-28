import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import * as utils from './utils.js'
import { createCanvas } from 'canvas'
import { bplen } from '#shared/common.js'

/*
********************** EXPORTED
load_tk
overlay
********************** INTERNAL
*/

export async function load_tk(_tk, q, genome, ds, result) {
	/*
_tk:{}
	.name
	also has customization parameters
result:{}
	.__mposset
*/
	const tk = ds.track.ld.tracks.find(i => i.name == _tk.name)
	if (!tk) throw 'ld track not found by name: ' + _tk.name

	if (!q.rglst) throw 'rglst missing'

	result.ld[tk.name] = { rglst: [] }

	const connheight = q.trigger_ld.connheight || 50

	for (const r of q.rglst) {
		const r2 = {
			chr: r.chr,
			start: r.start,
			stop: r.stop,
			width: r.width,
			reverse: r.reverse,
			xoff: r.xoff
		}
		result.ld[tk.name].rglst.push(r2)

		if (r.stop - r.start >= tk.viewrangelimit) {
			r2.rangetoobig = 'Zoom in under ' + bplen(tk.viewrangelimit) + ' to view LD data'
			continue
		}

		const pairs = []
		const coordset = new Set()

		// query for this variant
		const coord = (tk.nochr ? r.chr.replace('chr', '') : r.chr) + ':' + r.start + '-' + r.stop
		await utils.get_lines_bigfile({
			args: [tk.file, coord],
			dir: tk.dir,
			callback: line => {
				const l = line.split('\t')
				const start = Number.parseInt(l[1])
				if (start < r.start) return
				const stop = Number.parseInt(l[2])
				if (stop > r.stop) return
				if (result.__mposset) {
					if (!result.__mposset.has(start)) return
					if (!result.__mposset.has(stop)) return
				}
				const r2 = Number.parseFloat(l[5])
				pairs.push({ start, stop, r2 })
				coordset.add(start)
				coordset.add(stop)
			}
		})

		r2.img = plot_img(r, pairs, coordset, connheight)
	}
}

function plot_img(r, pairs, coordset, connheight) {
	/*
x1 ------------
	mapping of actual coord positions
x2 ------------
	shifted position for regularized bins
*/

	const [binsize, coord2x2] = get_coord2x2(r, coordset)

	const coord2x1 = new Map()
	{
		const sf = (r.stop - r.start) / r.width
		for (const c of coordset) {
			if (r.reverse) {
				coord2x1.set(c, (r.stop - c) / sf)
			} else {
				coord2x1.set(c, (c - r.start) / sf)
			}
		}
	}

	let maxpairheight = 0
	for (const pair of pairs) {
		maxpairheight = Math.max(maxpairheight, (coord2x2.get(pair.stop) - coord2x2.get(pair.start)) / 2)
	}
	const canvasheight = connheight + maxpairheight + binsize / 2

	const canvas = createCanvas(r.width, canvasheight)
	const ctx = canvas.getContext('2d')
	ctx.strokeStyle = 'black'
	for (const c of coordset) {
		ctx.beginPath()
		ctx.moveTo(coord2x1.get(c), 0)
		ctx.lineTo(coord2x2.get(c), connheight)
		ctx.closePath()
		ctx.stroke()
	}

	for (const pair of pairs) {
		const xstart = coord2x2.get(pair.start)
		const xstop = coord2x2.get(pair.stop)
		const xmid = (xstart + xstop) / 2
		const y = connheight + Math.abs(xstop - xstart) / 2

		const v = Math.floor(255 * (1 - pair.r2))
		ctx.fillStyle = 'rgb(255,' + v + ',' + v + ')'
		ctx.beginPath()
		ctx.moveTo(xmid, y - binsize / 2)
		ctx.lineTo(xmid - binsize / 2, y)
		ctx.lineTo(xmid, y + binsize / 2)
		ctx.lineTo(xmid + binsize / 2, y)
		ctx.lineTo(xmid, y - binsize / 2)
		ctx.closePath()
		ctx.fill()
	}

	return {
		height: canvasheight,
		src: canvas.toDataURL()
	}
}

function get_coord2x2(r, coordset) {
	/*
x2 is shifted x position of regular bins
limit bin size so as not to show a huge blood diamond filling screen when there's just one pair of snps
*/
	let binsize = r.width / coordset.size
	let x_offset = 0
	if (binsize > 40) {
		binsize = 40
		x_offset = (r.width - binsize * coordset.size) / 2
	}
	const coord2x2 = new Map()
	const lst = r.reverse ? [...coordset].sort((a, b) => b - a) : [...coordset].sort((a, b) => a - b)
	let x = x_offset
	for (const a of lst) {
		coord2x2.set(a, x + binsize / 2)
		x += binsize
	}
	return [binsize, coord2x2]
}

export async function overlay(q, ds, res) {
	if (!q.ldtkname) throw '.ldtkname missing'
	const tk = ds.track.ld.tracks.find(i => i.name == q.ldtkname)
	if (!tk) throw 'ld tk not found by name: ' + q.ldtkname

	const thisalleles = q.m.ref + '.' + q.m.alt
	const coord = (tk.nochr ? q.m.chr.replace('chr', '') : q.m.chr) + ':' + q.m.pos + '-' + (q.m.pos + 1)
	const lst = []
	await utils.get_lines_bigfile({
		args: [tk.file, coord],
		dir: tk.dir,
		callback: line => {
			const l = line.split('\t')
			const start = Number.parseInt(l[1])
			const stop = Number.parseInt(l[2])
			const alleles1 = l[3]
			const alleles2 = l[4]
			const r2 = Number.parseFloat(l[5])
			if (start == q.m.pos && alleles1 == thisalleles) {
				lst.push({
					pos: stop,
					alleles: alleles2,
					r2
				})
			} else if (stop == q.m.pos && alleles2 == thisalleles) {
				lst.push({
					pos: start,
					alleles: alleles1,
					r2
				})
			}
		}
	})

	res.send({ lst })
}
