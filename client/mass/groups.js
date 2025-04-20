import { copyMerge, getCompInit } from '#rx'
import { Menu, addGeneSearchbox, GeneSetEditUI, renderTable, table2col } from '#dom'
import { filterInit, getNormalRoot, filterPromptInit, getFilterItemByTag } from '#filter/filter'
import { appInit } from '#termdb/app'
import { get$id } from '#termsetting'
import { getCurrentCohortChartTypes } from './charts'
import { getColors } from '#shared/common.js'
import { rgb } from 'd3-color'
import { TermTypes, isNumericTerm, termType2label } from '#shared/terms.js'

/*
this
	app
		vocabApi
		opts
			genome{}
			state
				vocab{}
	state {}
		groups []
			group.name=str
			group.filter={}
		termfilter{}
			filter{}
*/

const colorScale = getColors(5)

// tip2 is used for showing the terms tree, which works as a submenu of this.tip, created here for reuse
let tip2
function addTip2(tip) {
	// FIXME hardcoded x pos is not generally applicable
	if (!tip2) tip2 = new Menu({ padding: 0, offsetX: 250, offsetY: -34, parent_menu: tip.d.node() })
	tip2.clear()
}

const geneTip = new Menu({ padding: '0px' })

class MassGroups {
	constructor(opts = {}) {
		this.type = 'groups'
		this.selectedGroupsIdx = new Set() // set of array index for this.state.groups[], for those selected in table ui
	}

	async init() {
		this.dom = {
			holder: this.opts.holder.append('div').style('margin', '10px')
		}
		initUI(this)
		this.tip = new Menu({ padding: '0px' })
	}

	getState(appState) {
		const state = {
			termfilter: appState.termfilter,
			groups: rebaseGroupFilter(appState),
			customTerms: appState.customTerms,
			currentCohortChartTypes: getCurrentCohortChartTypes(appState),
			matrixplots: this.app.vocabApi.termdbConfig.matrixplots
		}
		return state
	}

	async main() {
		await updateUI(this)
	}

	//////////////// rest are app-specific logic

	getMassFilter() {
		if (!this.state.termfilter.filter || this.state.termfilter.filter.lst.length == 0) {
			return { type: 'tvslst', in: true, join: '', lst: [] }
		}
		const f = getNormalRoot(structuredClone(this.state.termfilter.filter)) // strip tag
		return f
	}

	async groups2samplelst(groups) {
		const samplelstGroups = []
		const processedSamples = new Set(),
			overlap = []
		for (const g of groups) {
			const samples = await this.app.vocabApi.getFilteredSampleList(g.filter)

			const items = []
			for (const sample of samples) {
				const item = { sampleId: sample.id }
				if ('name' in sample) {
					item.sample = sample.name
				}
				//items.push(item)
				if (!processedSamples.has(sample.id)) items.push(item)
				else {
					for (const pg of samplelstGroups) {
						//if (pg.name === g.name) continue
						const i = pg.items.findIndex(i => i.sampleId === sample.id)
						if (i !== -1) overlap.push(...pg.items.splice(i, 1))
					}
				}
				processedSamples.add(item.sampleId)
			}
			if (items.length) samplelstGroups.push({ name: g.name, items, color: g.color })
		}

		if (overlap.length) {
			const ok = confirm(
				'Overlap detected: 1 or more samples belong to >1 groups. A new group will be created for these "overlap" samples.'
			)
			if (!ok) return
			samplelstGroups.push({ name: 'Group overlap', items: overlap })
		}

		if (groups.length == 1) {
			/* request rest of samples not in this single group, to form group2
			 */
			const filtercopy = structuredClone(groups[0].filter)
			if (this.app.vocabApi.termdbConfig.selectCohort) {
				// using cohort. assumes..
				if (!filtercopy.lst?.[1]) throw 'filtercopy.lst[1] missing when using cohort'
				filtercopy.lst[1].in = !filtercopy.lst[1].in
			} else {
				// not using cohort
				filtercopy.in = !filtercopy.in
			}
			const filter = Object.assign({}, this.app.getState().termfilter.filter, filtercopy)
			filter.lst[1].lst[0].tvs.isnot = true
			const samples = await this.app.vocabApi.getFilteredSampleList(filter)
			if (!samples.length) throw '0 samples for the other group'
			console.log(`Not in ${groups[0].name} has ${samples.length} samples`)
			const items = []
			for (const sample of samples) {
				const item = { sampleId: sample.id }
				if ('name' in sample) {
					item.sample = sample.name
				}
				items.push(item)
			}
			samplelstGroups.push({ name: 'Not in ' + groups[0].name, items, color: '#ccc' })
		}

		const tw2 = getSamplelstTW2(samplelstGroups)
		return tw2

		//////////////// delete rest of code

		const name = samplelstGroups.length == 1 ? samplelstGroups[0].name : 'Sample groups'
		const tw = getSamplelstTW(samplelstGroups, name, this.app.vocabApi)
		/* 
		when samplelstGroups has 1 group,
		tw.q.groups[0] has values as samplelstGroups[0].items, with a filter of {in: true}
		tw.q.groups[1] has values as samplelstGroups[0].items, with a filter of {in: false}
		*/

		//when there is only one group and need to create a others group
		if (groups.length == 1) {
			// find the sample count in current cohort
			let countSampleCount
			if (this.state.termfilter.filter.lst.length)
				countSampleCount = await this.app.vocabApi.getFilteredSampleCount(this.state.termfilter.filter)
			else countSampleCount = await this.app.vocabApi.getCohortSampleCount(this.activeCohortName)

			const countSampleCountInt = parseInt(countSampleCount, 10)

			// get the sample count in "others" group
			const othersGroup = Object.values(tw.term.values).find(v => v.key.startsWith('Not in'))
			othersGroup.othersGroupSampleNum = countSampleCountInt - othersGroup.list.length
		}

		// TEMP change, to be done elsewhere e.g. in getSamplelstTW()
		for (const g of tw.q.groups) {
			tw.term.values[g.name].list = g.values
			tw.term.values[g.name].inuse = g.inuse
		}

		return tw
	}

	updateLaunchButton() {
		// turn both off by default; selectively turn on
		this.dom.newTermSpan.style('display', 'none')
		this.dom.noGroupSelected.style('display', 'none')

		if (this.state.groups.length == 0) return // no groups

		if (this.state.groups.length == 1) {
			// only one group present, launch button is always on to work on this group
			this.dom.newTermSpan.style('display', '')
			this.dom.launchButton.text(`Create variable using "${this.state.groups[0].name}"`)
			this.dom.newTermNameInput.property('value', this.state.groups[0].name + ' vs others')
			return
		}

		// 2 or more groups, button is based on the number of selected groups
		const lst = [...this.selectedGroupsIdx]
		if (lst.length == 0) {
			// none selected
			this.dom.noGroupSelected.style('display', '')
			return
		}
		// at least 1 selected, display button
		this.dom.newTermSpan.style('display', '')
		if (lst.length == 1) {
			// only 1 selected
			this.dom.launchButton.text(`Create  variable using "${this.state.groups[lst[0]]?.name}"`)
			this.dom.newTermNameInput.property('value', this.state.groups[lst[0]].name + ' vs others')
			return
		}
		this.dom.launchButton.text(`Create variable using ${lst.length} groups`)
		this.dom.newTermNameInput.property('value', lst.map(i => this.state.groups[i].name).join(' vs '))
	}

	displayCustomTerms() {
		this.dom.customTermDiv.selectAll('*').remove()
		if (this.state.customTerms.length == 0) {
			this.dom.customTermDiv
				.append('div')
				.text('No custom variables. Use above controls to create new ones. Custom variables are added to dictionary.')
				.style('font-size', '.8em')
			return
		}
		this.dom.customTermDiv
			.append('div')
			.style('margin-bottom', '10px')
			.style('font-size', '.8em')
			.text('Following custom variables are available in all charts where variables are used. Click one to delete.')
		for (const { name, tw } of this.state.customTerms) {
			const div = this.dom.customTermDiv.append('div')
			div
				.text(name)
				.attr('class', 'sja_filter_tag_btn')
				.style('padding', '3px 6px')
				.style('border-radius', '6px')
				.style('margin-right', '5px')
				.on('click', event => {
					const deleteCallback = () => this.app.vocabApi.deleteCustomTerm(name)
					this.showGroupsMenu(event, tw, deleteCallback)
				})
		}
	}

	newId() {
		this.lastId = get$id()
		return this.lastId
	}

	showGroupsMenu(event, tw, deleteCallback) {
		const samplelstTW = structuredClone(tw)
		this.tip.clear()
		const menuDiv = this.tip.d.append('div')
		const id = this?.lastId

		const groupsInfo = menuDiv.append('div')

		const table = table2col({ holder: groupsInfo })
		for (const [grpKey, grp] of Object.entries(tw.term.values)) {
			const colorSquare = grp.color
				? `<span style="display:inline-block; width:12px; height:12px; background-color:${grp.color}" ></span>`
				: `<span style="display:inline-block; width:11px; height:11px; background-color:${'#fff'}; border: 0.1px solid black" ></span>`
			const [c1, c2] = table.addRow()
			c1.html(`${colorSquare} ${grp.label}:`)
			c2.html(`${grp.othersGroupSampleNum || grp.list.length} samples`)
		}

		addMatrixMenuItems(this.tip, menuDiv, samplelstTW, this.app, id, this.state, () => this.newId)

		if (this.state.currentCohortChartTypes.includes('DA') && samplelstTW.q.groups.length == 2)
			addDiffAnalysisPlotMenuItem(menuDiv, this, samplelstTW)

		if (this.state.currentCohortChartTypes.includes('survival'))
			addPlotMenuItem('survival', menuDiv, 'Compare survival', this.tip, samplelstTW, id, this, true)

		if (this.state.currentCohortChartTypes.includes('geneExpression'))
			addHierClusterPlotMenuItem('geneExpression', menuDiv, 'Gene expression', this.tip, samplelstTW, id, this, true)

		if (this.state.currentCohortChartTypes.includes('cuminc'))
			addPlotMenuItem('cuminc', menuDiv, 'Compare cumulative incidence', this.tip, samplelstTW, id, this, true)

		addSummarizeOption(menuDiv, this, samplelstTW, id)

		mayAddSamplescatterOption(menuDiv, this, samplelstTW)
		mayAddGenomebrowserOption(menuDiv, this, samplelstTW)

		//show option to delete custom variable
		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Delete variable')
			.on('click', event => {
				deleteCallback()
				this.tip.hide()
			})

		this.tip.showunder(event.target)
	}
}

export const groupsInit = getCompInit(MassGroups)

function addSummarizeOption(menuDiv, self, samplelstTW, id) {
	const summarizeDiv = menuDiv.append('div').attr('class', 'sja_menuoption sja_sharp_border').html('Summarize')
	summarizeDiv.insert('div').html('›').style('float', 'right')

	summarizeDiv.on('click', async () => {
		showTermsTree(
			summarizeDiv,
			term => {
				const tw = { term }
				if (isNumericTerm(term)) tw.q = { mode: 'continuous' }
				openSummaryPlot(tw, samplelstTW, self.app, id, () => self.newId)
			},
			self.app,
			self.tip
		)
	})
}

function mayAddGenomebrowserOption(menuDiv, self, samplelstTW) {
	if (!self.state.currentCohortChartTypes.includes('genomeBrowser')) return
	if (!self.app.vocabApi.termdbConfig.queries?.snvindel) return // for now only allow for snvindel
	if (samplelstTW.q.groups.length != 2) return // hardcoded to only support 2 groups
	const itemdiv = menuDiv
		.append('div')
		.attr('class', 'sja_menuoption sja_sharp_border')
		.text('Compare mutations')
		.on('click', () => {
			addTip2(self.tip)
			tip2.showunderoffset(itemdiv.node())
			const arg = {
				tip: geneTip,
				genome: self.app.opts.genome,
				row: tip2.d.append('div').style('margin', '10px'),
				callback: () => {
					const [f1, f2] = makeFiltersFromTwoSampleGroups(samplelstTW)
					const config = {
						chartType: 'genomeBrowser',
						geneSearchResult: result,
						snvindel: { filter: f1 }, // code filter in 1st tk
						subMds3TkFilters: [f2] // code filter in 2nd tk
					}
					self.app.dispatch({
						type: 'plot_create',
						config
					})
				}
			}
			const result = addGeneSearchbox(arg)
		})
}

function makeFiltersFromTwoSampleGroups(tw) {
	const [g1, g2] = tw.q.groups
	if (!g1 || !g2) throw 'not 2 groups in tw.q.groups[]'
	return [
		{
			in: g1.in,
			join: '',
			type: 'tvslst',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: {
							name: g1.name,
							type: 'samplelst',
							values: {
								[g1.name]: {
									key: g1.name,
									label: g1.name,
									list: g1.values
								}
							}
						}
					}
				}
			]
		},
		{
			in: g2.in,
			join: '',
			type: 'tvslst',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: {
							name: g2.name,
							type: 'samplelst',
							values: {
								[g2.name]: {
									key: g2.name,
									label: g2.name,
									list: g2.values
								}
							}
						}
					}
				}
			]
		}
	]
}

function mayAddSamplescatterOption(menuDiv, self, samplelstTW) {
	// this is only for pre-made scatterplots
	if (!self.app.vocabApi.termdbConfig.scatterplots) return
	for (const plot of self.app.vocabApi.termdbConfig.scatterplots) {
		if (plot.colorTW)
			//the plot supports overlay by a color term
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(`Overlay on ${plot.name}`)
				.on('click', () => {
					let config = {
						chartType: 'sampleScatter',
						name: plot.name
					}
					if (plot.sampleCategory)
						//if the plot filters by a sample category, like D1, R1
						config.sampleCategory = {
							tw: structuredClone(plot.sampleCategory.tw),
							order: plot.sampleCategory.order,
							defaultValue: plot.sampleCategory.defaultValue
						}
					if (plot.sampleType) config.sampleType = plot.sampleType //if the plot specifies the sample type to customize the legend
					config.colorTW = structuredClone(samplelstTW)

					if (plot.settings) config.settings = structuredClone(plot.settings) //if the plot specifies settings
					self.app.dispatch({
						type: 'plot_create',
						config: config
					})
					self.tip.hide()
				})
	}
}

function addDiffAnalysisPlotMenuItem(div, self, samplelstTW) {
	// DA app can be applied to multiple datatypes. show options based on availability for each datatype
	if (self.app.vocabApi.termdbConfig.queries?.rnaseqGeneCount) {
		// hardcoded! rnaseq genecount will correspond to gene exp term type on DA ui
		div
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(`Differential ${termType2label(TermTypes.GENE_EXPRESSION)} Analysis`)
			.on('click', e => {
				//Move this to diff analysis plot??
				//Do the check but not add to the state??
				const groups = []
				for (const group of samplelstTW.q.groups) {
					if (group.values && group.values.length > 0) {
						groups.push(group)
					} else {
						throw 'group does not contain samples for differential analysis'
					}
				}
				const config = {
					chartType: 'differentialAnalysis',
					state: self.state,
					samplelst: { groups },
					termType: TermTypes.GENE_EXPRESSION,
					tw: samplelstTW
				}
				self.tip.hide()
				self.app.dispatch({
					type: 'plot_create',
					config
				})
			})
	}

	if (self.app.vocabApi.termdbConfig.allowedTermTypes?.includes(TermTypes.METABOLITE_INTENSITY)) {
		div.append('div').text('DA should support metabolite')
	}

	// small text to explain which is case/control. always show this for all DA
	div
		.append('div')
		.html(
			`<span style="font-size:.8em;font-weight:bold">CASE</span> ${samplelstTW.q.groups[1].name}
		&nbsp;
		<span style="font-size:.8em;font-weight:bold">CONTROL</span> ${samplelstTW.q.groups[0].name}`
		)
		.style('font-size', '0.8em')
		.style('opacity', 0.8)
		.style('padding', '3px 3px 3px 10px')
}

function initUI(self) {
	self.dom.filterTableDiv = self.dom.holder.append('div').style('margin-bottom', '10px')

	// row of buttons
	const btnRow = self.dom.holder.append('div')

	// btn 1: prompt to add new group
	self.dom.addNewGroupBtnHolder = btnRow.append('span').style('margin-right', '20px')

	// btn 2: patch of controls to create new term
	self.dom.newTermSpan = btnRow.append('span') // contains "create button" and <input>, so they can toggle on/off together
	self.dom.newTermSpan.append('span').style('padding-left', '15px').text('Add variable:')
	self.dom.newTermNameInput = self.dom.newTermSpan.append('input').attr('type', 'text')

	self.dom.launchButton = self.dom.newTermSpan
		.append('span')
		.attr('class', 'sja_menuoption')
		.on('click', () => clickLaunchBtn(self))

	// msg: none selected
	self.dom.noGroupSelected = btnRow.append('span').text('No groups selected').style('opacity', 0.5)

	// bottom box to list custom terms
	self.dom.customTermDiv = self.dom.holder
		.append('div')
		.style('margin', '20px')
		.style('border-left', 'solid 1px black')
		.style('padding', '10px')

	self.dom.holder.on('click', event => {
		if (tip2) tip2.hide()
	})
}

async function updateUI(self) {
	// prompt button is an instance to a blank filter, can only make the button after state is filled
	// but not in instance.init()

	// create "Add new group" button as needed
	if (!self.filterPrompt) {
		self.filterPrompt = await filterPromptInit({
			holder: self.dom.addNewGroupBtnHolder,
			vocabApi: self.app.vocabApi,
			emptyLabel: 'Add group',
			termdbConfig: self.app.vocabApi.termdbConfig,
			callback: f => {
				addNewGroup(self.app, f, self.state.groups)
			},
			debug: self.opts.debug
		})
	}

	// filterPrompt.main() always empties the filterUiRoot data
	self.filterPrompt.main(self.getMassFilter()) // provide mass filter to limit the term tree

	// duplicate groups[] array to mutate and add to action.state for dispatching
	const groups = structuredClone(self.state.groups)

	if (!groups.length) {
		// no groups, do not show launch button, hide table
		self.updateLaunchButton()
		self.dom.filterTableDiv.style('display', 'none')
		self.displayCustomTerms()
		return
	}

	// clear table and populate rows
	self.dom.filterTableDiv.style('display', '').selectAll('*').remove()

	const tableArg = {
		div: self.dom.filterTableDiv,
		columns: [
			{
				label: 'NAME',
				editCallback: async (i, cell) => {
					const newName = cell.value
					const index = self.state.groups.findIndex(group => group.name == newName)
					if (index != -1) {
						alert(`Group named ${newName} already exists`)
						updateUI(self)
					} else
						await self.app.dispatch({
							type: 'rename_group',
							index: i,
							newName: cell.value
						})
				}
			},
			{
				label: 'COLOR',
				editCallback: async (i, cell) => {
					await self.app.dispatch({
						type: 'change_color_group',
						index: i,
						newColor: cell.color
					})
				}
			},
			{ label: '#SAMPLE' },
			{ label: 'FILTER' }
		],
		columnButtons: [
			{
				text: 'Delete',
				callback: (e, i) => {
					const group = groups[i]
					self.app.vocabApi.deleteGroup(group.name)
				}
			}
		],
		rows: []
	}
	for (const g of groups) {
		tableArg.rows.push([
			{ value: g.name }, // to allow click to show <input>
			{ color: g.color },
			{ value: 'n=' + (await self.app.vocabApi.getFilteredSampleCount(g.filter)) },
			{} // blank cell to show filter ui
		])
	}

	// clear existing selected groups
	self.selectedGroupsIdx.clear()

	if (groups.length == 1) {
		// only one group, add index 0
		self.selectedGroupsIdx.add(0)
	} else {
		// more than 1 group, show checkboxes for each row
		tableArg.noButtonCallback = (i, node) => {
			if (node.checked) self.selectedGroupsIdx.add(i)
			else self.selectedGroupsIdx.delete(i)
			self.updateLaunchButton() // update button text, based on how many groups are selected
		}
		//
		tableArg.selectedRows = []
		for (let i = 0; i < groups.length; i++) {
			tableArg.selectedRows.push(i) // check all rows by default
			self.selectedGroupsIdx.add(i)
		}
	}

	renderTable(tableArg)
	for (const [i, row] of tableArg.rows.entries()) {
		const group = groups[i]
		filterInit({
			holder: row[3].__td,
			vocabApi: self.app.vocabApi,
			termdbConfig: self.app.vocabApi.termdbConfig,
			callback: f => {
				if (!f || f.lst.length == 0) {
					// blank filter (user removed last tvs from this filter), delete this element from groups[]
					const i = groups.findIndex(g => g.name == group.name)
					groups.splice(i, 1)
				} else {
					// update filter
					group.filter = f
				}
				self.app.dispatch({
					type: 'app_refresh',
					state: { groups }
				})
			}
		}).main(group.filter)
	}

	self.updateLaunchButton()

	self.displayCustomTerms()
}

async function clickLaunchBtn(self) {
	// click button to create samplelst tw
	// collect groups in use
	const groups = []
	for (const i of self.selectedGroupsIdx) {
		const g = self.state.groups[i]
		if (g) groups.push(g)
	}

	if (groups.length == 0) throw 'No groups, should not happen'

	const name = self.dom.newTermNameInput.property('value')

	// 1 or more groups are in use, generate samplelst tw and save it to state
	const tw = await self.groups2samplelst(groups)
	if (!tw) return
	tw.term.name = name
	self.app.vocabApi.addCustomTerm({ name, tw })

	self.dom.newTermSpan.style('display', 'none')
}

/*
s = {groups[ {filter} ], termfilter{filter} }
termfilter is mass global filter
if provided, need to "rebase" group's visible filter to it
a group filter contains the shadowy global filter from previous state. when new state is provided, need to replace it
*/
export function rebaseGroupFilter(s) {
	if (!s.termfilter?.filter || s.termfilter.filter.lst.length == 0) {
		// blank filter
		return s.groups
	}
	const groups = [] // new groups
	for (const g of s.groups) {
		const f = getNormalRoot(structuredClone(s.termfilter.filter))
		const f2 = getFilterItemByTag(g.filter, 'filterUiRoot')
		if (!f2) {
			//console.log('filterUiRoot not found')
			groups.push(g)
			continue
		}
		f.lst.push(f2)
		f.join = f.lst.length > 1 ? 'and' : ''
		const g2 = {
			name: g.name,
			filter: f,
			color: g.color
		}
		groups.push(g2)
	}
	return groups
}

export async function openPlot(chartType, term, term2, app, id, newId) {
	let config = {
		chartType,
		term,
		term2
	}
	if (id) config.insertBefore = id
	if (newId) config.id = newId()
	await app.dispatch({
		type: 'plot_create',
		config
	})
}

export async function openSummaryPlot(tw, samplelstTW, app, id, newId) {
	const config = {
		chartType: 'summary',
		childType: tw.q?.mode == 'continuous' ? 'violin' : 'barchart',
		term: tw,
		term2: samplelstTW
	}
	if (id) config.insertBefore = id
	if (newId) config.id = newId()
	await app.dispatch({
		type: 'plot_create',
		config
	})
}
export async function showTermsTree(
	div,
	callback,
	app,
	tip,
	treeState = { tree: { usecase: { target: 'default', detail: 'term' } } },
	closeParent = true,
	shift = true,
	disable_terms = []
) {
	const activeCohort = app.getState().activeCohort
	//we need to pass the active cohort to build the tree with the correct terms
	const state = { activeCohort, ...treeState }
	addTip2(tip) // tip2 is added if missing and ready to use
	if (shift) tip2.showunderoffset(div.node())
	else tip2.showunder(div.node())
	appInit({
		holder: tip2.d,
		vocabApi: app.vocabApi,
		state,
		tree: {
			disable_terms,
			click_term: term => {
				callback(term)
				tip2.hide()
				if (closeParent) tip.hide()
			}
		}
	})
}
export function addPlotMenuItem(chartType, div, text, tip, samplelstTW, id, parent, openOnTop = false) {
	const itemDiv = div
		.append('div')
		.attr('class', 'sja_menuoption sja_sharp_border')
		//.html('Compare survival&nbsp;&nbsp;›')
		.html(`${text}&nbsp;&nbsp;›`)
		.on('click', e => {
			const state = { tree: { usecase: { target: chartType, detail: 'term' } } }
			if (chartType == 'survival') state.nav = { header_mode: 'hide_search' }
			showTermsTree(
				itemDiv,
				term => {
					openPlot(chartType, term, samplelstTW, parent.app, id, openOnTop ? () => parent.newId : null)
				},
				parent.app,
				tip,
				state
			)
		})
}

export function addHierClusterPlotMenuItem(chartType, div, text, tip, samplelstTW, id, parent, openOnTop = false) {
	const itemDiv = div
		.append('div')
		.attr('class', 'sja_menuoption sja_sharp_border')
		.html(`${text}&nbsp;&nbsp;›`)
		.on('click', () => {
			addTip2(tip) // tip2 is added if missing and ready to use
			tip2.showunderoffset(itemDiv.node())

			new GeneSetEditUI({
				holder: tip2.d,
				genome: parent.app.opts.genome,
				geneList: [],
				vocabApi: parent.app.vocabApi,
				callback: async ({ geneList, groupName }) => {
					tip.hide()
					const group = { name: groupName, lst: [], type: 'hierCluster' }
					const lst = group.lst.filter(tw => tw.term.type != 'geneExpression')

					const tws = await Promise.all(
						geneList.map(async d => {
							const term = {
								gene: d.symbol || d.gene,
								name: d.symbol || d.gene,
								type: 'geneExpression'
							}

							let tw = group.lst.find(tw => tw.term.name == d.symbol || tw.term.name == d.gene)
							if (!tw) {
								tw = { term, q: {} }
							}
							return tw
						})
					)

					// close geneset edit ui after clicking submit
					tip2.d.selectAll('*').remove()

					if (tws.length == 1) {
						const tw = tws[0]
						parent.app.dispatch({
							type: 'plot_create',
							config: {
								chartType: 'summary',
								term: tw,
								term2: samplelstTW
							}
						})
						return
					}

					if (tws.length == 2) {
						const tw = tws[0]
						const tw2 = tws[1]
						parent.app.dispatch({
							type: 'plot_create',
							config: {
								chartType: 'summary',
								term: tw,
								term2: tw2,
								colorTW: samplelstTW
							}
						})
						return
					}

					group.lst = [...lst, ...tws]

					parent.app.dispatch({
						type: 'plot_create',
						config: {
							chartType: 'hierCluster',
							termgroups: [group],
							dataType: TermTypes.GENE_EXPRESSION,
							divideBy: samplelstTW,
							settings: { hierCluster: { yDendrogramHeight: 0, clusterSamples: false } }
						}
					})
				}
			})
		})
}

export function addMatrixMenuItems(menu, menuDiv, tw, app, id, state, newId) {
	if (state.matrixplots) {
		for (const plot of state.matrixplots) {
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(plot.name)
				.on('click', async () => {
					const config = await app.vocabApi.getMatrixByName(plot.name)
					config.divideBy = tw
					config.insertBefore = id
					config.settings.matrix.colw = 0
					if (newId) config.id = newId()

					app.dispatch({
						type: 'plot_create',
						config
					})
					menu.hide()
				})
		}
	}
}

export function addNewGroup(app, filter, groups) {
	groups = JSON.parse(JSON.stringify(groups))
	let name = 'New group'
	let i = 0
	while (1) {
		const name2 = name + (i == 0 ? '' : ' ' + i)
		if (!groups.find(g => g.name == name2)) break
		i++
	}
	name = name + (i == 0 ? '' : ' ' + i)
	const newGroup = {
		name,
		filter,
		color: rgb(colorScale(groups.length)).formatHex()
	}
	groups.push(newGroup)
	app.dispatch({
		type: 'app_refresh',
		state: { groups }
	})
}

export function getSamplelstTWFromIds(ids) {
	if (!ids) throw 'getSamplelstTWFromIds: ids is empty'
	if (!Array.isArray(ids)) throw 'getSamplelstTWFromIds: ids must be an array'
	const name = 'group'
	const values = ids.map(id => {
		return { sampleId: id }
	})
	const qgroup = {
		name: name,
		in: true,
		values
	}

	const tw = {
		isAtomic: true,
		term: { name, type: 'samplelst', values: { [name]: { key: name, list: values } } },
		q: {
			groups: [qgroup]
		}
	}
	return tw
}

export function getFilter(samplelstTW) {
	let i = 0
	let noEdit = true
	for (const field in samplelstTW.term.values) {
		const values = samplelstTW.q.groups[i].values
		samplelstTW.term.values[field].list = values
		if (values[0] && 'sample' in values[0]) noEdit = false
		i++
	}
	const filter = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: { term: samplelstTW.term },
				noEdit
			}
		]
	}
	return filter
}

export function getSampleFilter(sampleId) {
	if (!sampleId) throw 'getSampleFilter: sampleId is empty'
	if (Array.isArray(sampleId)) throw 'getSampleFilter: sampleId arg cannot be an array'
	const group = { name: '', index: 0, items: [{ sampleId }] }
	const samplelst = getSamplelstTW([group], '', false)
	const filter = getFilter(samplelst)
	return filter
}

export function getSamplelstTW2(groups) {
	const values = {}
	const qgroups = []
	for (const group of groups) {
		const samples = getGroupSamples(group)
		const qgroup = {
			name: group.name,
			in: true,
			values: samples
		}
		qgroups.push(qgroup)
		values[group.name] = { key: group.name, label: group.name, color: group.color, list: samples } //samples need to be passed for the samplelst filter to work
	}
	const tw = {
		isAtomic: true,
		term: { name, type: 'samplelst', values },
		q: { groups: qgroups }
	}
	console.log('tw2', tw)
	return tw
}

export function getSamplelstTW(groups, name = 'groups', notIn = true) {
	const values = {}
	const qgroups = []
	let samples
	for (const group of groups) {
		samples = getGroupSamples(group)
		const qgroup = {
			name: group.name,
			in: true,
			values: samples
		}
		qgroups.push(qgroup)
		values[group.name] = { key: group.name, label: group.name, color: group.color, list: samples } //samples need to be passed for the samplelst filter to work
	}
	if (groups.length == 1 && notIn) {
		const name2 = 'Not in ' + groups[0].name
		values[name2] = { key: name2, label: name2, color: '#aaa', list: samples }
		qgroups.push({
			name: name2,
			in: false,
			values: samples
		})
	}
	const tw = {
		isAtomic: true,
		term: { name, type: 'samplelst', values },
		q: { groups: qgroups }
	}
	return tw
}
function getGroupSamples(group) {
	const values = []
	for (const item of group.items) {
		const value = { sampleId: item.sampleId }
		if ('sample' in item) {
			value.sample = item.sample
		}
		values.push(value)
	}
	return values
}
