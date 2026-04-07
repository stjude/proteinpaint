import { initByInput } from '#plots/controls.config.js'
import { fillTermWrapper, get$id } from '#termsetting'
import { Menu, GeneSetEditUI } from '#dom'
import { TermTypes } from '#shared/terms.js'
import { getGEunit } from '#tw/geneExpression'

const tip = new Menu({ padding: '' })

export function setGenesBtn(self: any, s: any) {
	const l = s.controlLabels
	const renderStyleOptions = [
		{
			label: `&nbsp;Stacked <span style="font-size:.7em;color:#555;">Show stacked rectangles in the same matrix cell to render variants for the same ${l.sample} and gene</span>`,
			value: '',
			title: `Show stacked rectangles in the same matrix cell to render variants for the same ${l.sample} and gene`
		},
		{
			label: `&nbsp;OncoPrint <span style="font-size:.7em;color:#555;">Show overlapping rectangles in the same matrix cell to render variants for the same ${l.sample} and gene</span>`,
			value: 'oncoprint',
			title: `Show overlapping rectangles in the same matrix cell to render variants for the same ${l.sample} and gene`
		}
	]
	if (s.addMutationCNVButtons && self.parent.chartType !== 'hierCluster')
		renderStyleOptions.unshift({
			label: `&nbsp;Single <span style="font-size:.7em;color:#555;">Show a single rectangle in a matrix cell to render the most severe variant (truncating > indels > missense > synonymous) for the same ${l.sample} and gene</span>`,
			value: 'single',
			title: `Show a single rectangle in a matrix cell to render the most severe variant (truncating > indels > missense > synonymous) for the same ${l.sample} and gene`
		})
	self.opts.holder
		.append('button')
		//.property('disabled', d => d.disabled)
		.datum({
			label: 'Genes',
			getCount: () =>
				self.parent.termOrder?.filter(
					(t: any) => t.tw.term.type == TermTypes.GENE_VARIANT || t.tw.term.type == TermTypes.GENE_EXPRESSION
				).length || 0,
			customInputs: addGeneInputs,
			rows: [
				{
					label: `Display ${l.Sample} Counts for Gene`,
					title: `Include the ${l.sample} count in the gene label`,
					type: 'radio',
					chartType: 'matrix',
					settingsKey: 'samplecount4gene',
					styles: { display: 'inline-block' },
					options: [
						{ label: 'Absolute', value: 'abs' },
						{ label: `Percent`, value: 'pct' },
						{ label: `None`, value: '' }
					],
					getDisplayStyle(plot: any) {
						return self.parent.termOrder?.filter((t: any) => t.tw.term.type == 'geneVariant').length
							? 'table-row'
							: 'none'
					}
				},
				// TODO: implement this contol option
				// {
				// 	label: `Exclude From ${l.Sample} Displayed Counts`,
				// 	title: `Do not include these variations/mutations when counting samples for a gene.`,
				// 	type: 'text',
				// 	chartType: 'matrix',
				// 	settingsKey: 'geneVariantCountSamplesSkipMclass',
				// 	processInput: tw => {},
				// },
				{
					label: 'Genomic Alterations Rendering',
					title: `Set how to indicate a ${l.sample}'s applicable variant types in the same matrix cell`,
					type: 'radio',
					chartType: 'matrix',
					settingsKey: 'cellEncoding',
					options: renderStyleOptions,
					styles: { padding: '5px 0px', margin: 0 },
					labelDisplay: 'block',
					getDisplayStyle(plot: any) {
						return self.parent.termOrder?.filter((t: any) => t.tw.term.type == 'geneVariant').length
							? 'table-row'
							: 'none'
					},
					callback: self.parent.geneStyleControlCallback
				},
				{
					label: 'Sort Genes',
					title: 'Set how to order the genes as rows',
					type: 'radio',
					chartType: 'matrix',
					settingsKey: 'sortTermsBy',
					options: [
						{ label: 'By Input Data Order', value: 'asListed' },
						{ label: `By ${l.sample} Count`, value: 'sampleCount' }
					],
					styles: { padding: 0, 'padding-right': '10px', margin: 0, display: 'inline-block' },
					getDisplayStyle(plot: any) {
						return self.parent.termOrder?.filter((t: any) => t.tw.term.type == 'geneVariant').length
							? 'table-row'
							: 'none'
					}
				}
			]
		})
		.html((d: any) => d.label)
		.style('margin', '2px 0')
		.on('click', (event: any, d: any) => self.callback(event, d))
}

export async function addGeneInputs(self: any, app: any, parent: any, table: any) {
	if (parent.chartType == 'hierCluster' && parent.config.dataType == TermTypes.GENE_EXPRESSION) {
		appendGeneInputs(self, app, parent, table, 'hierCluster')
	}
	if (
		parent.state?.termdbConfig?.allowedTermTypes?.includes(TermTypes.GENE_VARIANT) ||
		parent.state.termdbConfig.queries.snvindel
	)
		appendGeneInputs(self, app, parent, table)
}

export async function appendGeneInputs(
	self: any,
	app: any,
	parent: any,
	table: any,
	geneInputType?: string
) {
	tip.clear()
	if (!parent.selectedGroup) parent.selectedGroup = 0

	if (parent.opts.customInputs?.genes) {
		// these are embedder portal specific controls
		for (const inputConfig of parent.opts.customInputs.genes) {
			inputConfig.chartType = 'matrix'
			const holder = table.append('tr')
			if (inputConfig.title) holder.attr('aria-label', inputConfig.title)
			const input = await initByInput[inputConfig.type](
				Object.assign(
					{},
					{
						holder,
						app,
						id: parent.id,
						debug: self.opts.debug,
						parent
					},
					inputConfig
				)
			)
			input.main(parent.config)
		}
	}
	let geneInputTr
	if (geneInputType == 'hierCluster' || parent.chartType !== 'hierCluster') {
		// Insert the gene set edit UI at the top
		geneInputTr = table.insert('tr', () => table.select('tr').node())
	} else {
		// Insert after first gene set edit UI
		const secondTr = table.selectAll('tr').nodes()[1] || null
		// Add visual separator: <hr> row
		const hrTr = table.insert('tr', () => secondTr)
		hrTr.append('td').attr('colspan', 2).append('hr').style('border', '1px solid #ccc')
		geneInputTr = table.insert('tr', () => secondTr)
	}
	addGenesetInput(self, app, parent, geneInputTr, geneInputType)
}

export function addGenesetInput(self: any, app: any, parent: any, tr: any, geneInputType?: string) {
	const controlPanelBtn = self.btns.filter((d: any) => d.label.endsWith('Genes'))?.node()
	const tip = app.tip //new Menu({ padding: '5px' })
	const tg = parent.config.termgroups

	let selectedGroup: any
	const triggerGenesetEdit = (holder: any) => {
		holder.selectAll('*').remove()
		const geneList = selectedGroup.lst.map((item: any) => {
			return { gene: item.name }
		}) //To do, selectedGroup.lst may replace name with gene as well
		new GeneSetEditUI({
			holder,
			genome: app.opts.genome,
			geneList,
			// Remove the GFF Loads Gene Sets option from unclustered genes panel.
			customInputs:
				parent.chartType !== 'hierCluster' || geneInputType == 'hierCluster'
					? self.parent.opts.customInputs?.geneset
					: undefined,
			/* running hier clustering and the editing group is the group used for clustering
			pass this mode value to inform ui to support the optional button "top variably exp gene"
			this is hardcoded for the purpose of gene expression and should be improved
			*/

			mode: selectedGroup.mode,
			minNumGenes: selectedGroup.mode == 'geneExpression' ? 3 : 1,
			vocabApi: self.opts.app.vocabApi,
			callback: async ({ geneList, groupName }: any) => {
				if (!selectedGroup) throw `missing selectedGroup`
				tip.hide()
				const group = selectedGroup.status == 'new' ? { name: groupName, lst: [] } : tg[selectedGroup.index]
				if (selectedGroup.status == 'new') tg.push(group)
				const targetTermType = selectedGroup.mode == 'geneExpression' ? 'geneExpression' : 'geneVariant'
				// remove gene terms to be replaced by the new lst, keep all other term types in the group
				const lst = group.lst.filter((tw: any) => tw.term.type != targetTermType)
				const tws = await Promise.all(
					geneList.map(async (d: any) => {
						let term
						if (targetTermType == 'geneExpression') {
							const gene = d.symbol || d.gene
							const unit = getGEunit(app.vocabApi)
							const name = `${gene} ${unit}`
							term = { gene, name, type: 'geneExpression' }
						} else {
							term = {
								gene: d.symbol || d.gene,
								name: d.symbol || d.gene,
								type: 'geneVariant'
							}
						}
						//if it was present use the previous term, genomic range terms require chr, start and stop fields, found in the original term
						let tw = group.lst.find((t: any) => {
							const geneName = t.term.gene || t.term.name
							const match = d.symbol ? geneName === d.symbol : d.gene ? geneName === d.gene : false
							return match && t.term.type == targetTermType
						})
						if (!tw) {
							tw = { term }
							await fillTermWrapper(tw, self.opts.app.vocabApi)
						} else if (!tw.$id) {
							tw.$id = await get$id(self.opts.app.vocabApi.getTwMinCopy({ term }))
						}
						return tw
					})
				)
				group.lst = [...lst, ...tws]
				if (!group.lst.length) tg.splice(selectedGroup.index, 1)
				app.dispatch({
					type: 'plot_edit',
					id: self.parent.id,
					config: {
						termgroups: tg
					}
				})
			},
			backBtn: {
				target: 'Genes Menu',
				callback: () => {
					controlPanelBtn.click()
				}
			},
			termsAsListed:
				(geneInputType == 'hierCluster' && !self.parent.config.settings.hierCluster.clusterRows) ||
				(geneInputType != 'hierCluster' && self.parent.config.settings.matrix.sortTermsBy == 'asListed')
		})
	}

	//the number of groups in the current matrix that is editable: hiercluster group should not be edited from "Genes" control panel.
	const numOfEditableGrps = tg.filter((g: any) => g.type != 'hierCluster').length

	tr.append('td')
		.attr('class', 'sja-termdb-config-row-label')
		.html(geneInputType == 'hierCluster' ? 'Hierarchical Clustering Gene Set' : 'Genomic Alteration Gene Set')

	if (numOfEditableGrps > 0 || geneInputType == 'hierCluster') {
		const td1 = tr.append('td').style('display', 'block').style('padding', '5px 0px')
		const editGrpDiv = td1.append('div').append('label')

		const editBtn = editGrpDiv
			.append('button')
			.html(
				numOfEditableGrps > 1 && geneInputType !== 'hierCluster'
					? 'Edit Selected Group'
					: geneInputType == 'hierCluster'
					? 'Edit Gene Set'
					: 'Edit Current Group'
			)
			.on('click', () => {
				tip.clear()
				setMenuBackBtn(tip.d.append('div').style('padding', '5px'), () => controlPanelBtn.click(), `Back`)
				const genesetEdiUiHolder = tip.d.append('div')
				triggerGenesetEdit(genesetEdiUiHolder)
			})

		if (numOfEditableGrps > 1 && geneInputType !== 'hierCluster') {
			const { nonHierClusterGroups, groupSelect } = setTermGroupSelector(self, editGrpDiv, tg)
			selectedGroup = nonHierClusterGroups.find((g: any) => g.selected)
			groupSelect.on('change', () => {
				selectedGroup = nonHierClusterGroups[groupSelect.property('value')]
			})
		} else {
			const s = parent.config.settings.hierCluster
			const g =
				geneInputType == 'hierCluster' ? tg.find((g: any) => g.type == 'hierCluster') : tg.find((g: any) => g.type != 'hierCluster')

			selectedGroup = {
				index:
					geneInputType == 'hierCluster' ? tg.findIndex((g: any) => g.type == 'hierCluster') : tg[0].type == g.type ? 0 : 1,
				name: g.name,
				type: g.type,
				lst:
					g.type == 'hierCluster'
						? g.lst.map((tw: any) => ({ name: tw.term.gene || tw.term.name }))
						: g.lst.filter((tw: any) => tw.term.type == TermTypes.GENE_VARIANT).map((tw: any) => ({ name: tw.term.name })),
				mode:
					g.type == 'hierCluster'
						? s.dataType // is clustering group, pass dataType
						: // !!subject to change!! when group is not clustering, and ds has mutation, defaults to MUTATION_CNV_FUSION
						self.parent.state.termdbConfig.queries?.snvindel
						? TermTypes.GENE_VARIANT
						: '',
				selected: true
			}
		}
	}

	if (geneInputType == 'hierCluster') {
		// Gene set edit UI under "Clustering" control panel doen't need "create New Group"
		return
	}
	const td2 = tr.append('td').style('display', 'block').style('padding', '5px 0px')
	const createNewGrpDiv = td2.append('div').append('label')

	const createBtn = createNewGrpDiv
		.append('button')
		.html('Create New Group')
		.property('disabled', true)
		.on('click', () => {
			tip.clear()
			setMenuBackBtn(tip.d.append('div'), () => controlPanelBtn.click(), 'Back')
			const name = nameInput.property('value')
			selectedGroup = {
				index: tg.length,
				name,
				label: name,
				lst: [],
				status: 'new',
				mode: parent.state.termdbConfig.queries?.snvindel ? TermTypes.GENE_VARIANT : ''
			}
			triggerGenesetEdit(tip.d.append('div'))
		})

	const nameInput = createNewGrpDiv
		.append('input')
		.style('margin', '2px 5px')
		.style('width', '210px')
		.attr('placeholder', 'Group Name')
		.on('input', () => {
			createBtn.property('disabled', !nameInput.property('value'))
		})
		.on('keyup', (event: any) => {
			if (event.key == 'Enter' && !createBtn.property('disabled')) {
				createBtn.node().click()
			}
		})

	// if (parent.opts.customInputs?.geneset) {
	// 	for (const btn of parent.opts.customInputs.geneset) {
	// 		td.append('button')
	// 			.html(btn.label)
	// 			.on('click', () => {
	// 				tip.hide()
	// 				btn.showInput({
	// 					callback: genesArr => {
	// 						const geneLst = genesArr.map(gene => ({ gene }))
	// 						// TODO: this may not be the first term group
	// 						let group = tg.find(g => g.lst.find(tw => tw.term?.type == 'geneVariant'))
	// 						if (!group) group = tg[0]
	// 						const lst = group.lst.filter(tw => tw.term.type != 'geneVariant')
	// 						const tws = geneLst.map(d => {
	// 							//if it was present use the previous term, genomic range terms require chr, start and stop fields, found in the original term
	// 							let tw = group.lst.find(tw => tw.term.name == d.symbol || tw.term.name == d.gene)
	// 							if (!tw)
	// 								tw = {
	// 									$id: get$id(),
	// 									term: {
	// 										name: d.symbol || d.gene,
	// 										type: 'geneVariant'
	// 									},
	// 									q: {}
	// 								}
	// 							return tw
	// 						})
	// 						group.lst = [...lst, ...tws]
	// 						if (!group.lst.length) tg.splice(selectedGroup.index, 1)
	// 						app.dispatch({
	// 							type: 'plot_edit',
	// 							id: self.parent.id,
	// 							config: {
	// 								termgroups: tg
	// 							}
	// 						})
	// 					}
	// 				})
	// 			})
	// 	}
	// }
}

export function setMenuBackBtn(holder: any, callback: any, label: string) {
	holder
		.attr('tabindex', 0)
		.style('padding', '5px')
		.style('text-decoration', 'underline')
		.style('cursor', 'pointer')
		.style('margin-bottom', '12px')
		.html(`&#171; ${label}`)
		.on('click', callback)
		.on('keyup', (event: any) => {
			if (event.key == 'Enter') event.target.click()
		})
}

export function setTermGroupSelector(self: any, holder: any, tg: any) {
	//const label = grpDiv.append('label')
	//label.append('span').html('')
	const firstGrpWithGeneTw = tg.find((g: any) =>
		g.lst.find((tw: any) => tw.term.type == TermTypes.GENE_VARIANT && g.type !== 'hierCluster')
	)
	const groups = tg.map((g: any, index: number) => {
		return {
			index,
			name: g.name,
			type: g.type,
			lst: g.lst.filter((tw: any) => tw.term.type == TermTypes.GENE_VARIANT).map((tw: any) => ({ name: tw.term.name })),
			mode: self.parent.state.termdbConfig.queries?.snvindel ? TermTypes.GENE_VARIANT : '',
			selected: g === firstGrpWithGeneTw
		}
	})
	const nonHierClusterGroups = groups.filter((g: any) => g.type != 'hierCluster')

	const groupSelect = holder.append('select').style('width', '218px').style('margin', '2px 5px')
	for (const [i, group] of nonHierClusterGroups.entries()) {
		if (group.label) continue
		if (group.name) group.label = group.name
		else group.label = `Unlabeled group #${i + 1}` // cannot assume "gene" group
	}

	groupSelect
		.selectAll('option')
		.data(nonHierClusterGroups)
		.enter()
		.append('option')
		.property('selected', (grp: any) => grp.selected)
		.attr('value', (d: any, i: number) => i)
		.html((grp: any) => grp.label)

	return { nonHierClusterGroups, groupSelect }
}
