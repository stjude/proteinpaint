import { Menu } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { initLegend, updateLegend } from './legend'
import { loadTk } from './tk'
import { renderTk } from './render'
import {
	mclass,
	dtsnvindel,
	dtsv,
	dtfusionrna,
	dtcnv,
	dtitd,
	mclassfusionrna,
	mclasssv,
	CNVClasses,
	getColors
} from '#shared/common.js'
import { getFilterName } from '../mds3/filterName'
import { fillTermWrapper } from '#termsetting'
import { rehydrateFilter } from '../filter/rehydrateFilter.js'

/*
 */

export async function makeTk(tk, block) {
	// run just once to initiate a track by adding in essential attributes to tk object
	tk.yscaleUseLog = true

	// make color gradients
	{
		const pale = '#FFFEAB'
		const dark = '#F7F69E'
		const id1 = Math.random().toString()
		const id2 = Math.random().toString()
		const id3 = Math.random().toString()
		const defs = tk.gleft.append('defs')
		const left = defs.append('linearGradient').attr('id', id1)
		left.append('stop').attr('offset', 0).attr('stop-color', dark)
		left.append('stop').attr('offset', 1).attr('stop-color', 'white')
		const mid = defs.append('linearGradient').attr('id', id2)
		mid.append('stop').attr('offset', 0).attr('stop-color', pale)
		mid.append('stop').attr('offset', 0.5).attr('stop-color', 'white')
		mid.append('stop').attr('offset', 1).attr('stop-color', pale)
		const right = defs.append('linearGradient').attr('id', id3)
		right.append('stop').attr('offset', 0).attr('stop-color', 'white')
		right.append('stop').attr('offset', 1).attr('stop-color', dark)

		tk.gradient4spanBackground = {
			left: { id: id1, gradient: left },
			mid: { id: id2, gradient: mid },
			right: { id: id3, gradient: right }
		}
	}

	tk.leftlabels = {
		g: tk.gleft.append('g'), // all labels are rendered here, except track label
		doms: {},
		// keys: label name, value: label dom
		// to avoid having to delete all labels upon tk rendering
		laby: 0, // cumulative height, 0 for no labels
		xoff: 0,
		maxwidth: 0 // set default 0 in case track runs into err, can still render tk
	}

	{
		const g = tk.glider.append('g')
		tk.sections = {
			// sections from top to bottom.
			jug: {
				height: 0, // total height of the jug section
				g: g.append('g'),
				axis: g.append('g')
			}
		}
	}
	setH(tk, 'axisheight', 200)
	setH(tk, 'legheight', 50)
	setH(tk, 'neckheight', 50)

	tk._finish = loadTk_finish_closure(tk, block)

	tk.itemtip = new Menu() // show contents on clicking an item
	tk.hovertip = new Menu() // show contents here on hovering an item and avoid reusing itemtip
	tk.menutip = new Menu({ padding: '' }) // to show menu options without margin

	tk.load = _load(tk, block) // shorthand

	await initTermdb(tk, block)

	if (tk.filter) await Promise.all(rehydrateFilter(tk.filter, tk.vocabApi))

	tk.tklabel.text(tk.dslabel || tk.name)

	tk.clear = () => {
		// called in loadTk, when uninitialized is true
		tk.sections.jug.g.selectAll('*').remove()
	}

	// config
	tk.config_handle = block.maketkconfighandle(tk).on('click', () => {
		configPanel(tk, block)
	})

	initLegend(tk, block)
}

function setH(tk, prop, v) {
	// custom value is defined at tk.prop. it's moved to tk.sections.jug.prop
	const customv = tk[prop]
	if (customv != undefined) {
		if (!Number.isFinite(customv) || customv <= 0) throw new Error('invalid tk.' + prop)
		tk.sections.jug[prop] = customv
		delete tk[prop]
		return
	}
	tk.sections.jug[prop] = v // no custom value. use default
}

function loadTk_finish_closure(tk, block) {
	// call this when tk finish rendering
	return data => {
		// update legend name in case filter has changed
		// tk.legend{} is missing if tk is not initiated (wrong ds name)
		tk.legend?.headTd.text(tk.name + (tk.filter ? ' - ' + getFilterName(tk.filter) : ''))

		if (data) {
			// centralized place on indicating if tk has error or simply no data
			// only do this when server return data is present. data may not be supplied e.g when switching skewer mode

			if (data.error) {
				// has error e.g. server snafu. set skewer height to show error msg later
				tk.sections.jug.height = 40
			} else {
				// no error. detect if has data or not
				if (data.junctions?.length == 0) {
					tk.sections.jug.g
						.append('text')
						.text('No splice junctions')
						.attr('y', 25)
						.attr('x', block.width / 2)
						.attr('text-anchor', 'middle')
						.attr('dominant-baseline', 'center')
					tk.sections.jug.height = 40
				}
				if (data.alert) {
					console.log('TODO print this alert in tk', data.alert)
				}
			}
		}

		// derive tk height
		tk.height_main = tk.sections.jug.height + tk.toppad + tk.bottompad

		if (data) {
			updateLegend(data, tk, block)
		}

		;(tk.leftLabelMaxwidth = tk.leftlabels.maxwidth + tk.leftlabels.xoff),
			block.tkcloakoff(tk, { error: data ? data.error : null })
		block.block_setheight()
		block.setllabel()

		tk.callbackOnRender?.(tk, block) // run if present
	}
}

async function initTermdb(tk, block) {
	if (!tk.dslabel) {
		// later support custom vocab
		throw new Error('tk.dslabel missing')
	}
	if (!tk.vocabApi) {
		const arg = {
			vocab: {
				genome: block.genome.name,
				dslabel: tk.dslabel
			}
		}
		const _ = await import('#termdb/vocabulary')
		tk.vocabApi = _.vocabInit(arg)

		if (!tk.vocabApi.app) {
			// see notes in mds3/makeTk
			tk.vocabApi.app = { opts: { genome: block.genome } }
		}
	}
	if (!tk.termdbConfig) {
		tk.termdbConfig = await tk.vocabApi.getTermdbConfig()
	}
	if (!tk.termdbConfig.queries?.junction) throw new Error('queries.junction missing')
}

function _load(tk, block) {
	return async () => {
		return await loadTk(tk, block)
	}
}

function configPanel(tk, block) {
	tk.tkconfigtip.clear().showunder(tk.config_handle.node())
	const holder = tk.tkconfigtip.d

	// read count cutoff
	{
		const row = holder.append('div').style('margin-bottom', '15px')
		row.append('span').html('Read count cutoff&nbsp;')
		row
			.append('input')
			.property('value', tk.readcountCutoff || 0)
			.attr('type', 'number')
			.style('width', '50px')
			.on('keyup', event => {
				if (event.code != 'Enter' && event.code != 'NumpadEnter') return
				let v = event.target.value
				if (!v || v < 0) {
					// set to zero to cancel
					v = 0
				}
				if (v == 0) {
					if (tk.readcountCutoff) {
						// cutoff has been set, cancel and refetch data
						tk.readcountCutoff = 0
						loadTk(tk, block, true)
					} else {
						// cutoff has not been set, do nothing
					}
					return
				}
				// set cutoff
				if (tk.readcountCutoff) {
					// cutoff has been set
					if (tk.readcountCutoff == v) {
						// same as current cutoff, do nothing
					} else {
						// set new cutoff
						tk.readcountCutoff = v
						loadTk(tk, block, true)
					}
				} else {
					// cutoff has not been set
					tk.readcountCutoff = v
					loadTk(tk, block, true)
				}
			})
		row
			.append('div')
			.style('font-size', '.7em')
			.style('color', '#858585')
			.text('For a junction, samples with read count lower than cutoff will not be shown.')
	}

	// height
	{
		const row = holder.append('div').style('margin-bottom', '15px')
		row.append('span').text('Track height')
		row
			.append('button')
			.html('&nbsp;&nbsp;+&nbsp;&nbsp;')
			.style('margin-left', '10px')
			.on('click', () => {
				tk.axisheight += 30
				tk.legheight = tk.axisheight / 4
				renderTk(null, tk, block)
				block.block_setheight()
			})
		row
			.append('button')
			.html('&nbsp;&nbsp;-&nbsp;&nbsp;')
			.style('margin-left', '5px')
			.on('click', () => {
				if (tk.axisheight <= 90) return
				tk.axisheight -= 30
				tk.legheight = tk.axisheight / 4
				renderTk(null, tk, block)
				block.block_setheight()
			})
	}

	// log scale
	{
		const row = holder.append('div').style('margin-bottom', '1px')
		const id = Math.random()
		const input = row
			.append('input')
			.attr('type', 'checkbox')
			.style('margin-right', '10px')
			.attr('id', id)
			.on('change', () => {
				tk.yscaleUseLog = !tk.yscaleUseLog
				renderTk(null, tk, block)
			})
		if (tk.yscaleUseLog) {
			input.property('checked', 1)
		}
		row.append('label').text('Use log10 for Y scale read count').attr('for', id)
	}
}
