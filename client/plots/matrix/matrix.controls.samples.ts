import { getSorterUi } from './matrix.sorterUi'
import { fillTermWrapper } from '#termsetting'
import { make_radios, make_one_checkbox } from '#dom'
import { select } from 'd3-selection'
import { isNumericTerm } from '#shared/terms.js'

export function setSamplesBtn(self: any, s: any) {
	const l = s.controlLabels
	const controls = self
	const parent = self.parent
	const rows: any[] = [
		{
			label: `Maximum # ${l.Samples}`,
			title: `Limit the number of displayed ${l.samples}`,
			type: 'number',
			chartType: 'matrix',
			settingsKey: 'maxSample',
			getDisplayStyle(plot: any) {
				return plot.chartType == 'hierCluster' ? 'none' : 'table-row'
			}
		},
		{
			label: `Sort ${l.Sample} Groups`,
			title: `Set how to sort ${l.sample} groups`,
			type: 'radio',
			chartType: 'matrix',
			settingsKey: 'sortSampleGrpsBy',
			options: [
				{
					label: 'Predefined or Group Name',
					value: 'name',
					title: `Sort by group name`
				},
				{
					label: `${l.Sample} Count`,
					value: 'sampleCount',
					title: `Sort by the number of samples in the group`
				},
				{
					label: `Hits`,
					value: 'hits',
					title: `Sort by the total number of variants for every ${l.sample} in the group`
				}
			],
			getDisplayStyle(plot: any) {
				return plot.divideBy && !plot.hierCluster ? 'table-row' : 'none'
			}
		},
		{
			label: `${l.Sample} Group Label Character Limit`,
			title: `Truncate the ${l.sample} group label if it exceeds this maximum number of characters`,
			type: 'number',
			chartType: 'matrix',
			settingsKey: 'sampleGrpLabelMaxChars',
			getDisplayStyle(plot: any) {
				return plot.divideBy && !plot.hierCluster ? 'table-row' : 'none'
			}
		},
		{
			label: `${l.Sample} Label Character Limit`,
			title: `Truncate the ${l.sample} label if it exceeds this maximum number of characters`,
			type: 'number',
			chartType: 'matrix',
			settingsKey: 'collabelmaxchars'
		},
		{
			label: `Toggle sample labels`,
			title: `Do not automatically show sample labels based on column width`,
			type: 'radio',
			chartType: 'matrix',
			settingsKey: 'sampleLabelsToggle',
			styles: { display: 'inline-block' },
			options: [
				{ label: `Based on column width`, value: 'auto' },
				{ label: 'Always hide', value: 'hide' }
			]
		},
		{
			label: `Group ${l.Samples} By`,
			title: `Select a variable with discrete values to group ${l.samples}`,
			type: 'term',
			chartType: 'matrix',
			configKey: 'divideBy',
			vocabApi: self.opts.app.vocabApi,
			state: {
				vocab: self.opts.vocab
				//activeCohort: appState.activeCohort
			},
			processInput: async (tw: any) => {
				if (tw?.term && isNumericTerm(tw.term)) {
					// any numeric term should be discrete when used as divideBy term
					// tw is missing when dividedBy term deleted
					tw.q = { ...tw.q, mode: 'discrete' }
				}
				if (tw) await fillTermWrapper(tw, self.opts.app.vocabApi)
				return tw
			},
			processConfig: (config: any) => {
				if (self.parent.chartType == 'hierCluster' && config['divideBy']) {
					config.settings = {
						hierCluster: {
							yDendrogramHeight: 0,
							clusterSamples: false
						}
					}
				}
				if (self.parent.config.divideBy)
					config.legendValueFilter = self.parent.mayRemoveTvsEntry(self.parent.config.divideBy)
			},
			getBodyParams: () => {
				// hierCluster hides the groupBy, so no need to consider gene expression term type
				const currentGeneNames = self.parent.termOrder
					.filter((t: any) => t.tw.term.type === 'geneVariant')
					.map((t: any) =>
						t.tw.term.chr ? `${t.tw.term.chr}:${t.tw.term.start}-${t.tw.term.stop}` : t.tw.term.gene || t.tw.term.name
					) // TODO term.gene replaces term.name
				if (currentGeneNames.length) return { currentGeneNames }
				return {}
			}
		}
	]

	rows.push({
		label: `Sort ${l.Sample} Priority`,
		title: `Set how to sort ${l.samples}`,
		type: 'custom',
		// the "input" argument is created by controls
		init(input: any) {
			const m = parent.config.settings.matrix
			if (!controls.activeTab) controls.activeTab = 'basic'
			input.dom.inputTd.style('padding', '5px')
			// **** !!! TODO: use dom/toggleButtons to create tabbed sections !!!
			const btnsDiv = input.dom.inputTd.append('div').style('margin-bottom', '5px')
			const basicBtn = btnsDiv
				.append('div')
				.style('display', 'inline-block')
				.style('padding-right', '5px')
				.style('border-right', '2px solid black')
				.style('text-decoration', controls.activeTab == 'basic' ? 'underline' : '')
				.style('cursor', 'pointer')
				.html('Basic')
				.on('click', () => {
					controls.activeTab = 'basic'
					basicBtn.style('text-decoration', 'underline')
					advancedBtn.style('text-decoration', '')
					basicDiv.style('display', '')
					advancedDiv.style('display', 'none')
				})
			const advancedBtn = btnsDiv
				.append('div')
				.style('display', 'inline-block')
				.style('margin-left', '5px')
				.style('text-decoration', controls.activeTab == 'advanced' ? 'underline' : '')
				.style('cursor', 'pointer')
				.html('Advanced')
				.on('click', () => {
					controls.activeTab = 'advanced'
					basicBtn.style('text-decoration', '')
					advancedBtn.style('text-decoration', 'underline')
					basicDiv.style('display', 'none')
					advancedDiv.style('display', '')
				})

			const basicDiv = input.dom.inputTd.append('div').style('display', controls.activeTab == 'basic' ? '' : 'none')
			const ssmDiv = basicDiv.append('div')
			ssmDiv.append('span').html('SSM')
			const { inputs } = make_radios({
				// holder, options, callback, styles
				holder: ssmDiv.append('span'),
				options: [
					{ label: 'by consequence', value: 'consequence', checked: m.sortByMutation === 'consequence' },
					{ label: 'by presence', value: 'presence', checked: m.sortByMutation === 'presence' }
				],
				styles: {
					display: 'inline-block'
				},
				callback: (sortByMutation: any) => {
					const sortOptions = parent.config.settings.matrix.sortOptions
					const activeOption = sortOptions.a
					const mutTb = activeOption.sortPriority[0].tiebreakers[1]
					mutTb.disabled = !sortByMutation
					mutTb.isOrdered = sortByMutation === 'consequence'

					parent.app.dispatch({
						type: 'plot_edit',
						id: parent.id,
						config: {
							settings: {
								matrix: {
									sortByMutation, // needed to show the correct status for checkbox, but actual sorting behavior
									sortOptions // is based on sortOptions.a[*].tiebreaker[*][disabled, isOrdered]
								}
							}
						}
					})
				}
			})

			inputs.style('margin', '2px 0 0 2px').style('vertical-align', 'top')
			const cnvDiv = basicDiv
				.append('div')
				.style('display', m.showMatrixCNV != 'none' && !m.allMatrixCNVHidden ? 'block' : 'none')

			cnvDiv.append('span').html('CNV')
			// holder, labeltext, callback, checked, divstyle
			const checkbox = make_one_checkbox({
				holder: cnvDiv.append('span'),
				divstyle: { display: 'inline-block' },
				checked: m.sortByCNV,
				labeltext: 'sort by CNV',
				callback: () => {
					const sortByCNV = checkbox.property('checked')
					const sortOptions = parent.config.settings.matrix.sortOptions
					const activeOption = sortOptions.a
					const cnvTb = activeOption.sortPriority[0].tiebreakers[2]
					cnvTb.disabled = !sortByCNV
					cnvTb.isOrdered = sortByCNV

					parent.app.dispatch({
						type: 'plot_edit',
						id: parent.id,
						config: {
							settings: {
								matrix: {
									sortByCNV, // needed to show the correct status for checkbox, but actual sorting behavior
									sortOptions // is based on sortOptions.a[*].tiebreaker[*][disabled, isOrdered]
								}
							}
						}
					})
				}
			})

			const advancedDiv = input.dom.inputTd
				.append('div')
				.style('display', controls.activeTab == 'advanced' ? '' : 'none')
			input.dom.row.on('mouseover', function (this: any) {
				this.style.backgroundColor = '#fff'
				this.style.textShadow = 'none'
			})

			if (!controls.sorterUi) {
				controls.sorterUi = getSorterUi({
					controls: controls,
					holder: advancedDiv,
					tip: controls.parent.app.tip
				})
			} else {
				controls.sorterUi.main(controls.parent.config.settings.matrix, { holder: advancedDiv })
			}

			return {
				main: (plot: any) => {
					const s = plot.settings.matrix
					// ssm
					inputs.property('checked', (d: any) => d.value == s.sortByMutation)
					// cnv
					checkbox.property('checked', s.sortByCNV)
					cnvDiv.style('display', s.showMatrixCNV != 'none' && !s.allMatrixCNVHidden ? 'block' : 'none')
				}
			}
		}
	})

	self.opts.holder
		.append('button')
		//.property('disabled', d => d.disabled)
		.datum({
			label: l.Samples || `Samples`,
			getCount: () =>
				'sampleCount' in self.overrides ? self.overrides.sampleCount : self.parent.sampleOrder?.length || 0,
			rows,
			customInputs: updateSamplesControls
		})
		.html((d: any) => d.label)
		.style('margin', '2px 0')
		.on('click', (event: any, d: any) => self.callback(event, d))
}

export function updateSamplesControls(self: any, app: any, parent: any, table: any) {
	if (parent.chartType == 'hierCluster' && parent.config.settings.hierCluster.clusterSamples) {
		const l = parent.config.settings.matrix.controlLabels
		const sortingControl = select(
			table
				.selectAll('td')
				.filter(function (this: any) {
					return select(this).text() == `Sort ${l.Sample} Priority`
				})
				.node()
				.closest('tr')
		)
		sortingControl.style('display', 'none')
	}
}
