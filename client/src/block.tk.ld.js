import { dofetch3 } from '#common/dofetch'
import { legend_newrow } from '#src/block.legend'
import { showLDlegend } from '../plots/regression.results'
import { interpolateRgb } from 'd3-interpolate'

export async function loadTk(tk, block) {
	/*
returns sum of heights of LD panels
*/

	if (tk.uninitiated) {
		makeTk(tk, block)
	}

	block.tkcloakon(tk)

	try {
		const arg = {
			genome: block.genome.name,
			file: tk.file,
			rglst: block.tkarg_rglst(tk),
			width: block.width,
			devicePixelRatio: window.devicePixelRatio > 1 ? window.devicePixelRatio : 1
		}

		const data = await dofetch3('tkld', { method: 'POST', body: arg })
		if (data.error) throw data.error

		tk.rglstG.selectAll('*').remove()
		let tkheight = 0

		for (const r of data.rglst) {
			const g = tk.rglstG.append('g') //.attr('transform', 'translate(' + r.xoff + ',0)')

			if (r.rangetoobig) {
				r.text_rangetoobig = g
					.append('text')
					.text(r.rangetoobig)
					.attr('text-anchor', 'middle')
					.attr('dominant-baseline', 'central')
					.attr('x', r.width / 2)
				// set y after row height is decided
				tkheight = Math.max(tkheight, 50)
				continue
			}

			if (r.img) {
				g.append('image').attr('width', r.width).attr('height', r.img.height).attr('xlink:href', r.img.src)
				tkheight = Math.max(tkheight, r.img.height)
				continue
			}
		}

		// row height set
		tk.height_main = tk.toppad + tkheight + tk.bottompad
		block.tkcloakoff(tk, {})
	} catch (e) {
		tk.height_main = 50
		block.tkcloakoff(tk, { error: e.message || e })
	}
	block.block_setheight(tk)

	/*
		for (const r of lddata.rglst) {
			if (r.rangetoobig) {
				r.text_rangetoobig.attr('y', rowheight / 2)
			}
		}
		*/
}

function makeTk(tk, block) {
	delete tk.uninitiated
	tk.rglstG = tk.glider.append('g')

	const [tr, td] = legend_newrow(block, tk.name)
	tk.tr_legend = tr // required by block.js
	tk.legend = {
		div: td.append('div')
	}

	tk.legend.div.html('LD r<sup>2</sup>')
	const scale = interpolateRgb('white', 'red')
	showLDlegend(tk.legend.div, scale)
}
