import { addGeneSearchbox } from '#dom/genesearch'
import { Menu } from '#dom/menu'
import { select } from 'd3-selection'

type API = {
	dom: {
		tdbBtns: { [key: string]: any }
		holder: any
		loadBtn: any
		clearBtn: any
		submitBtn: any
		genesDiv: any | null
	}
	params: any[]
	destroy: (_obj) => void
}

type Gene = { name: string }

type CallbackArg = {
	geneList: Gene[]
	groupIndex?: number
	groupName?: string
}

type showGenesetEditArg = {
	holder: any
	genome: any
	geneList?: Gene[]
	mode?: string
	callback: (CallbackArg) => void
	vocabApi: any
	groups?: { name: string; lst: Gene[]; type?: 'hierCluster' }[]
	showGroup: boolean
	backBtn: {
		callback: () => void
		target?: string
	}
}

export function showGenesetEdit(arg: showGenesetEditArg) {
	const { holder, genome, callback, groups, vocabApi } = arg
	let mode = arg.mode || (groups?.length && arg.getMode?.(groups.find(g => g.selected)))
	let geneList = arg.geneList || groups?.find(g => g.selected)?.lst
	if (groups.length && !geneList?.length) throw `missing or invalid geneLst or groups argument`
	else if (!geneList && !groups.length) geneList = []

	const tip2 = new Menu({ padding: '0px', parent_menu: holder.node(), test: 'test' })
	holder.selectAll('*').remove()
	// must not hardcode div width to 850px, gives broken ui
	// FIXME should set min and max width for div to maintain proper look
	const div = holder.append('div').style('padding', '5px')

	let backBtn
	if (arg.backBtn) {
		backBtn = div
			.append('div')
			.attr('tabindex', 0)
			.style('text-decoration', 'underline')
			.style('cursor', 'pointer')
			.style('margin-bottom', '12px')
			.html(arg.backBtn.target ? `&#171; Back to ${arg.backBtn.target}` : '&#171; Go Back')
			.on('click', () => {
				tip2.hide()
				if (arg.parent_menu) arg.parent_menu.hide()
				arg.backBtn.callback()
			})
			.on('keyup', event => {
				if (event.key == 'Enter') event.target.click()
			})
	}

	let groupSelect, groupInput, selectedGroup
	if (groups?.length) {
		const grpDiv = div.append('div').style('padding', '5px 0')
		const label = grpDiv.append('label')
		label.append('span').html('Group to edit: ')
		groupSelect = label.append('select').on('change', () => {
			selectedGroup = groups[groupSelect.property('value')]
			geneList = selectedGroup.lst
			if (arg.getMode) {
				mode = arg.getMode(selectedGroup)
				renderRightDiv()
			}
			renderGenes()
		})

		for (const [i, group] of groups.entries()) {
			group.origLst = structuredClone(group.lst)
			group.origNames = JSON.stringify(group.lst.map(t => t.name).sort())
			group.label = group.name || `Unlabeled group # ${i + 1}`
		}

		groupSelect
			.selectAll('option')
			.data(groups)
			.enter()
			.append('option')
			.property('selected', grp => grp.selected)
			.attr('value', (d, i) => i)
			.html(grp => grp.label)

		selectedGroup = groups[groupSelect.property('value')]
	} else if (groups && !groups.length) {
		// an empty groups array indicates to show the input for a new group name
		const grpDiv = div.append('div').style('padding', '5px')
		const label = grpDiv.append('label')
		label.append('span').html('Group to Add ')
		groupInput = label
			.append('input')
			.attr('placeholder', 'Name')
			.on('input', function () {
				const name = groupInput.node().value
				submitBtn.property('disabled', name == '' || !geneList.length)
				setSubmitText()
			})
	}

	const api: API = {
		dom: {
			tdbBtns: {},
			holder: div,
			loadBtn: null,
			clearBtn: null,
			restoreBtn: null,
			genesDiv: null,
			submitBtn: null,
			submitText: ''
		},
		params: [],
		destroy(_obj) {
			const obj = _obj || api.dom
			for (const key in obj) {
				if (obj[key] == null) continue
				if (key == 'holder') continue
				else if (key == 'tdbBtns') {
					api.destroy(obj[key])
				} else {
					obj[key].remove()
				}
				delete obj[key]
			}
			if (obj.holder) obj.holder.remove()
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

	const genesDiv = div
		.append('div')
		.attr('contenteditable', true)
		.style('display', 'flex')
		.style('flex-wrap', 'wrap')
		.style('gap', '5px')
		.style('min-height', '20px')
		.style('border-style', 'solid')
		.style('border-width', '2px')
		.style('border-color', '#eee')
		.style('margin', '10px 0px')
		.style('padding', '2px 0px')
		.style('min-height', '30px')

	api.dom.genesDiv = genesDiv

	const footerDiv = div.append('div')
	const submitBtn = footerDiv
		.append('button')
		.property('disabled', !geneList?.length)
		.text(`Submit`)
		.on('click', () => {
			callback({
				geneList,
				groupIndex: groupSelect?.property('value'),
				groupName: groupInput?.property('value')
			})
		})

	api.dom.submitBtn = submitBtn

	const submitText = footerDiv.append('span').style('margin-left', '5px').text('')

	function renderRightDiv() {
		rightDiv.selectAll('*').remove()

		if (mode == 'expression' && vocabApi.termdbConfig?.queries?.topVariablyExpressedGenes) {
			if (vocabApi.termdbConfig.queries.topVariablyExpressedGenes.arguments) {
				for (const param of vocabApi.termdbConfig.queries.topVariablyExpressedGenes.arguments) addParameter(param)
			}
			rightDiv
				.append('button')
				.text('Load top variably expressed genes')
				.on('click', async event => {
					event.target.disabled = true
					const args = {
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
						for (const gene of result.genes) geneList.push({ name: gene })
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
					for (const gene of result.genes) geneList.push({ name: gene })
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
					.html(`Load ${tdb.label} gene set &#9660;`)
					.on('click', async () => {
						tip2.clear()
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
										for (const gene of geneset) geneList.push({ name: gene.symbol })
										renderGenes()
									}
									tip2.hide()
									submitBtn.node().focus()
								}
							}
						})
						tip2.showunder(api.dom.tdbBtns[key].node())
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

		if (groups) {
			api.dom.restoreBtn = rightDiv
				.append('button')
				.property('disabled', true)
				.text('Restore')
				.on('click', () => {
					geneList = groups[groupSelect.property('value')].origLst
					renderGenes()
				})
		}
	}

	function renderGenes() {
		genesDiv.selectAll('*').remove()

		genesDiv
			.selectAll('div')
			.data(geneList || [])
			.enter()
			.append('div')
			.attr('title', 'click to delete')
			.attr('class', 'sja_menuoption')
			.style('position', 'relative')
			.style('display', 'inline-block')
			.style('padding', '5px 16px 5px 9px')
			.style('margin-left', '5px')
			.text(gene => gene.name)
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

		api.dom.clearBtn.property('disabled', !geneList?.length)
		const hasChanged =
			(!groups?.length && geneList.length) ||
			(groups?.length && selectedGroup?.origNames !== JSON.stringify(geneList.map(t => t.name).sort()))
		api.dom.restoreBtn.property('disabled', !hasChanged)
		api.dom.submitBtn.property('disabled', !hasChanged)
		if (hasChanged) submitBtn.node().focus()
		setSubmitText()
	}

	function addGene() {
		const name = geneSearch.geneSymbol
		for (const gene of geneList) {
			if (gene.name == name) {
				alert(`The gene ${name} has already been added`)
				return
			}
		}

		geneList.push({ name })
		renderGenes()
	}

	function deleteGene(event, d) {
		const i = geneList.findIndex(g => g.name === d.name)
		if (i != -1) {
			geneList.splice(i, 1)
			renderGenes()
		}
	}

	function setSubmitText() {
		if (!groups?.length) {
			const newGrpName = groupInput?.property('value')
			submitText.html(newGrpName ? ` geneset for ${newGrpName}` : '')
		} else {
			submitText.html(`geneset for ${selectedGroup?.label}`)
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
