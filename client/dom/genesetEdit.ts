import { addGeneSearchbox } from '#dom/genesearch'
import { Menu } from '#dom/menu'
import { select } from 'd3-selection'
import { mclass, dt2color, dt2label } from '#shared/common'

type API = {
	dom: {
		tdbBtns: { [key: string]: any }
		holder: any
		loadBtn: any
		clearBtn: any
		submitBtn: any
		restoreBtn: any
		geneHoldingDiv: any | null // gene holding area, shows bunch of gene buttons pending submission
		statLegendDiv: any // legend area, to show available stats legend on genes
	}
	params: any[]
	statColor2label: any // while rendering each gene button, if gene stat is available, it records color and labels for each color, to be shown in statLegendDiv
	destroy: (_obj) => void
}

type Gene = { gene: string }

type CallbackArg = {
	geneList: Gene[]
}

type showGenesetEditArg = {
	holder: any
	genome: any
	mode?: 'expression' // if provided, allow to load top variably expressed genes; later can be union of multiple mode strings
	minNumGenes?: number
	callback: (arg: CallbackArg) => void
	vocabApi: any
	geneList?: {
		gene: string
		mutationStat?: { class: string; count: number }[]
	}[]
	titleText?: string
}

export function showGenesetEdit(arg: showGenesetEditArg) {
	const { holder, genome, mode, callback, vocabApi, titleText, minNumGenes } = arg
	let geneList = structuredClone(arg.geneList || [])
	const tip2 = new Menu({ padding: '0px', parent_menu: holder.node(), test: 'test' })
	holder.selectAll('*').remove()
	// must not hardcode div width to 850px, gives broken ui
	// FIXME should set min and max width for div to maintain proper look
	const div = holder.append('div').style('padding', '5px')

	const origLst = structuredClone(geneList)
	const origNames = JSON.stringify(geneList.map(t => t.gene).sort())

	if (titleText) {
		div.append('div').style('margin-bottom', '10px').html(titleText)
	}

	const api: API = {
		dom: {
			tdbBtns: {},
			holder: div,
			loadBtn: null,
			clearBtn: null,
			restoreBtn: null,
			geneHoldingDiv: null,
			statLegendDiv: null,
			submitBtn: null
		},
		params: [],
		statColor2label: null,
		destroy() {
			arg.holder.remove()
		}
	}

	const headerDiv = div.append('div')
	//.style('white-space','nowrap')
	const label = headerDiv.append('label')
	label.append('span').html('Search')
	const row = label.append('span')
	const geneSearch = addGeneSearchbox({
		tip: tip2,
		genome,
		row,
		geneOnly: true,
		callback: addGene,
		hideHelp: true,
		focusOff: true
	})

	// a holder to render optional buttons
	const rightDiv = headerDiv
		.append('div')
		.style('display', 'inline-flex')
		.style('align-items', 'center')
		.style('float', 'right')
		.style('gap', '5px')

	/*

	logic on optional buttons

	- there are two buttons, click one to load: 1) top mutated genes, 2) top variably expressed genes
	- first detect if "top variably expressed" button should be rendered
	- current assumption is that only one button should be rendered, not both
	  this is primarily based on how matrix gene groups operate; a group is either for mutation data, or exp data, but not both
	  when this ui is used elsewhere outside of matrix, this assumption can subject to change
	*/

	api.dom.geneHoldingDiv = div
		.append('div')
		.append('div')
		.style('display', 'flex')
		.style('flex-wrap', 'wrap')
		.style('gap', '5px')
		.style('min-height', '20px')
		.style('border', 'solid 1px #aaa')
		.style('margin', '10px 0px')
		.style('padding', '6px 2px')
		.style('min-height', '30px')

	api.dom.statLegendDiv = div.append('div')

	const footerDiv = div.append('div').style('margin-top', '10px')
	const submitBtn = footerDiv
		.append('button')
		.property('disabled', !geneList?.length)
		.text(`Submit`)
		.on('click', () => {
			callback({ geneList })
		})

	api.dom.submitBtn = submitBtn

	function renderRightDiv() {
		rightDiv.selectAll('*').remove()

		if (mode == 'expression' && vocabApi.termdbConfig?.queries?.topVariablyExpressedGenes) {
			if (vocabApi.termdbConfig.queries.topVariablyExpressedGenes.arguments) {
				for (const param of vocabApi.termdbConfig.queries.topVariablyExpressedGenes.arguments) addParameter(param)
			}
			rightDiv
				.append('button')
				.style('white-space', 'nowrap')
				.text('Load top variably expressed genes')
				.on('click', async event => {
					event.target.disabled = true
					const args: any = {
						genome: vocabApi.state.vocab.genome,
						dslabel: vocabApi.state.vocab.dslabel,
						maxGenes: 50
					}
					// supply filters from app state
					if (vocabApi.state.termfilter) {
						if (vocabApi.state.termfilter.filter) args.filter = vocabApi.state.termfilter.filter // pp filter
						if (vocabApi.state.termfilter.filter0) args.filter0 = vocabApi.state.termfilter.filter0 // gdc filter
					}
					const result = await vocabApi.getTopVariablyExpressedGenes(args)

					geneList = []
					if (result.genes) {
						for (const gene of result.genes) geneList.push({ gene })
					}
					renderGenes()
					event.target.disabled = false
				})
		} else if (vocabApi.termdbConfig?.queries?.topMutatedGenes) {
			// only render this button when the first is not rendered
			if (vocabApi.termdbConfig.queries.topMutatedGenes.arguments) {
				for (const param of vocabApi.termdbConfig.queries.topMutatedGenes.arguments) addParameter(param)
			}
			api.dom.loadBtn = rightDiv
				.append('button')
				.style('white-space', 'nowrap')
				.html(`Load top mutated genes`)
				.on('click', async () => {
					api.dom.loadBtn.property('disabled', true)
					const args = {
						filter0: vocabApi.state.termfilter.filter0
					}
					// TODO rename api.params[] as api.topMutatedParams[]
					// as topMutatedGenes and topVariablyExpressedGenes can both come with arguments.
					// renaming to api.topMutatedGeneParams[] and api.topVariablyExpressedGeneParams[] will help this
					for (const { param, input } of api.params) {
						const id = input.attr('id')
						args[id] = getInputValue({ param, input })
					}
					const result = await vocabApi.getTopMutatedGenes(args)

					geneList = []
					geneList.push(...result.genes)
					renderGenes()
					api.dom.loadBtn.property('disabled', false)
				})
		}
		if (genome?.termdbs?.msigdb) {
			for (const key in genome.termdbs) {
				const tdb = genome.termdbs[key]
				api.dom.tdbBtns[key] = rightDiv
					.append('button')
					.attr('name', 'msigdbBt')
					.style('white-space', 'nowrap')
					.html(`Load ${tdb.label} gene set &#9660;`)
					.on('click', async event => {
						tip2.clear().showunder(event.target)
						const termdb = await import('../termdb/app.js')
						termdb.appInit({
							holder: tip2.d,
							state: {
								dslabel: key,
								genome: genome.name,
								nav: {
									header_mode: 'search_only'
								}
							},
							tree: {
								click_term: term => {
									geneList = []
									const geneset = term._geneset
									if (geneset) {
										for (const gene of geneset) geneList.push({ gene: gene.symbol })
										renderGenes()
									}
									tip2.hide()
									submitBtn.node().focus()
								}
							}
						})
					})
			}
		}

		api.dom.clearBtn = rightDiv
			.append('button')
			.property('disabled', !geneList?.length)
			.text('Clear')
			.on('click', () => {
				geneList = []
				renderGenes()
			})

		if (arg.geneList?.length) {
			api.dom.restoreBtn = rightDiv
				.append('button')
				.property('disabled', true)
				.text('Restore')
				.on('click', () => {
					geneList = origLst
					renderGenes()
				})
		}
	}

	function renderGenes() {
		const hasStat = geneList.some(g => g.mutationStat)
		if (!hasStat)
			geneList.sort((a, b) => {
				if (a.gene < b.gene) return -1
				if (a.gene > b.gene) return 1
				return 0
			})
		api.dom.geneHoldingDiv.selectAll('*').remove()

		api.statColor2label = new Map()

		api.dom.geneHoldingDiv
			.selectAll('div')
			.data(geneList || [])
			.enter()
			.append('div')
			.attr('title', 'click to delete')
			.attr('class', 'sja_menuoption')
			.attr('tabindex', 0)
			.style('position', 'relative')
			.style('display', 'inline-block')
			.style('padding', '5px 16px 5px 9px')
			.style('margin-left', '5px')
			.each(renderGene)
			.on('click', deleteGene)
			.on('mouseover', function (event) {
				const div = select(event.target)
				div
					.append('div')
					.style('margin-left', '4px')
					.classed('sjpp_deletebt', true)
					.style('display', 'inline-block')
					.style('position', 'absolute')
					.style('right', '0px')
					.style('top', '0px')

					.style('transform', 'scale(0.6)')
					.style('pointer-events', 'none')
					.html(
						`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#000" class="bi bi-x-lg" viewBox="0 0 16 16">
				<path stroke='#f00' d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
				</svg>`
					)
			})
			.on('mouseout', function (event) {
				select(event.target).select('.sjpp_deletebt').remove()
			})
			.on('focus', event => {
				event.target.dispatchEvent(new PointerEvent('mouseover'))
			})
			.on('blur', event => {
				event.target.dispatchEvent(new PointerEvent('mouseout'))
			})
			.on('keyup', event => {
				if (event.key == 'Enter') event.target.click()
			})

		renderStatLegend() // api.statColor2label has been accumulated if available

		api.dom.clearBtn.property('disabled', !geneList?.length)
		const hasChanged = origNames !== JSON.stringify(geneList.map(t => t.gene).sort())
		api.dom.restoreBtn?.property('disabled', !hasChanged)
		// disable submit button when gene list not changed or is empty in expression mode
		const minNum = minNumGenes || 0
		api.dom.submitBtn.property('disabled', !hasChanged || geneList?.length < minNum)
		if (hasChanged) submitBtn.node().focus()
	}

	function renderGene(this: any, gene) {
		const div = select(this).style('border-radius', '5px')

		if (gene.mutationStat) {
			div.html(`${gene.gene}&nbsp;&nbsp;`)
			for (const m of gene.mutationStat) {
				// m is {class,count} or {dt,count}; if class is given, bgcolor is determined by class; otherwise by dt and logicis  a bit shaky now (may
				let bgcolor, textcolor // bg and text color of gene button
				if ('class' in m) {
					if (!mclass[m.class]) throw 'invalid stat class'
					bgcolor = mclass[m.class].color
					api.statColor2label.set(bgcolor, mclass[m.class].label)
				} else if ('dt' in m) {
					if (!dt2color[m.dt]) throw 'invalid stat dt'
					bgcolor = dt2color[m.dt]
					textcolor = 'white' // hardcode it for now
					api.statColor2label.set(bgcolor, dt2label[m.dt])
				} else {
					throw 'stat missing dt/class'
				}
				div
					.insert('span')
					.style('font-size', '.7em')
					.style('background-color', bgcolor)
					.style('padding', '1px 2px')
					.style('color', textcolor || 'black')
					.text(m.count)
			}
			/* enable different types of gene stats this way
		} else if(gene.expStat) {
		*/
		} else {
			div.insert('div').style('display', 'inline-block').html(gene.gene)
		}
	}

	function renderStatLegend() {
		if (!api.statColor2label || api.statColor2label.size == 0) {
			// no legend to display
			api.dom.statLegendDiv.style('display', 'none')
			return
		}
		api.dom.statLegendDiv.style('display', 'block').selectAll('*').remove()
		for (const [c, n] of api.statColor2label) {
			api.dom.statLegendDiv
				.append('div')
				.style('display', 'inline-block')
				.style('width', '12px')
				.style('height', '12px')
				.style('background-color', c)
			api.dom.statLegendDiv.append('span').html(` ${n} &nbsp;&nbsp;`)
		}
	}

	function addGene() {
		const gene = geneSearch.geneSymbol
		for (const item of geneList) {
			if (item.gene == gene) {
				window.alert(`The gene ${gene} has already been added`)
				return
			}
		}
		geneList.push({ gene })
		renderGenes()
	}

	function deleteGene(event, d) {
		const i = geneList.findIndex(g => g.gene === d.gene)
		if (i != -1) {
			geneList.splice(i, 1)
			renderGenes()
		}
	}

	function addParameter(param) {
		let input
		if (param.type == 'boolean') {
			input = rightDiv.append('input').attr('type', 'checkbox').attr('id', param.id)
			if (param.value) input.property('checked', param.value)
			rightDiv.append('label').html(param.label).attr('for', param.id)
		}
		//The parameter value will be used as the input value if the option is checked
		else if (param.type == 'string' && param.value) {
			input = rightDiv.append('input').attr('type', 'checkbox').attr('id', param.id)
			input.property('checked', true)
			rightDiv.append('label').html(param.label).attr('for', param.id)
		} else if (param.type == 'number') {
			input = rightDiv.append('input').attr('type', 'number').style('width', '40px').attr('id', param.id)
			if (param.value) input.attr('value', param.value)
			rightDiv.append('span').html(param.label)
		}
		api.params.push({ param, input })
	}

	function getInputValue({ param, input }) {
		const value = input.node().value
		if (input.attr('type') == 'number') return Number(value)
		if (input.attr('type') == 'checkbox') {
			if (param.type == 'string') return input.node().checked ? param.value : ''
			if (param.type == 'boolean') return input.node().checked ? 1 : 0
		}
	}

	renderRightDiv()
	renderGenes()
	return api
}
