import { appInit } from '#plots/plot.app.js'
import { showGenesetEdit } from '../dom/genesetEdit.ts'
import { vocabInit } from '#termdb/vocabulary'
import { fillTermWrapper } from '#termsetting'

const gdcGenome = 'hg38'
const gdcDslabel = 'GDC'

export async function launchWithGenes(api, genes, genome, arg, settings, holder, tempDiv, chartDiv) {
	const chartType = api.type || 'matrix'
	if (!genes.length) {
		// the GFF will supply these options, should handle gracefully if missing in test code
		if (!arg.opts) arg.opts = {}
		if (!arg.opts[chartType]) arg.opts[chartType] = {}
		if (!arg.opts[chartType].callbacks) arg.opts[chartType].callbacks = {}
		arg.opts[chartType].callbacks['postInit.genesetEdit'] = async chartApi => {
			// geneset edit ui requires vocabApi
			const toolName = api.type == 'hierCluster' ? 'Gene Expression Clustering' : 'OncoMatrix'
			tempDiv.append('p').text(`No default genes. Please change the cohort or define a gene set to launch ${toolName}.`)
			showGenesetEdit({
				holder: tempDiv.append('div'),
				genome,
				vocabApi: await vocabInit({ state: { genome: gdcGenome, dslabel: gdcDslabel } }),
				callback: async result => {
					tempDiv.remove()
					chartDiv.style('display', '')
					const twlst = await Promise.all(
						result.geneList.map(async i => {
							return await fillTermWrapper({ term: { name: i.gene || i.name, type: 'geneVariant' } })
						})
					)

					if (api.type == 'hierCluster') {
						const termgroups = structuredClone(plotAppApi.getState().plots[0].termgroups)
						const hcTermGroup = termgroups.find(group => group.type == 'hierCluster')
						hcTermGroup.lst = twlst
						plotAppApi.dispatch({
							type: 'plot_edit',
							id: chartApi.id,
							config: { termgroups }
						})
					} else if (arg.termgroups) {
						const termgroups = arg.termgroups || []
						// arg.termgroups was not rehydrated on the appInit() of plotApp,
						// need to rehydrate here manually

						for (const group of arg.termgroups) {
							group.lst = await Promise.all(group.lst.map(fillTermWrapper))
						}

						plotAppApi.dispatch({
							type: 'plot_edit',
							id: chartApi.id,
							config: {
								termgroups: [...(arg.termgroups || []), { lst: twlst }]
							}
						})
					}
				}
			})
		}
	}

	const opts = {
		holder: chartDiv,
		genome,
		state: {
			genome: gdcGenome,
			dslabel: gdcDslabel,
			termfilter: { filter0: arg.filter0 },
			plots: [
				{
					chartType,
					// avoid making a dictionary request when there is no gene data;
					// if there is gene data, then the arg.termgroups can be submitted and rehydrated on app/store.init()
					termgroups:
						api.type == 'hierCluster'
							? undefined
							: !genes.length
							? [{ lst: genes }]
							: [...(arg.termgroups || []), { lst: genes }],
					genes: api.type == 'hierCluster' ? genes : undefined,
					divideBy: arg.divideBy || undefined,
					// moved default settings to gdc.hg38.js termdb[chartType].settings
					// but can still override in the runpp() argument
					settings
				}
			]
		},
		app: {
			features: ['recover'],
			callbacks: arg.opts?.app?.callbacks || {}
		},
		recover: {
			undoHtml: 'Undo',
			redoHtml: 'Redo',
			resetHtml: 'Restore',
			adjustTrackedState(state) {
				const s = structuredClone(state)
				delete s.termfilter.filter0
				return s
			}
		},
		[chartType]: Object.assign(
			{
				// these will display the inputs together in the Genes menu,
				// instead of being rendered outside of the chart holder
				customInputs: {
					genes: [
						{
							label: `Maximum # Genes`,
							title: 'Limit the number of displayed genes',
							type: 'number',
							chartType,
							settingsKey: 'maxGenes',
							callback: async value => {
								const genes = await getGenes(arg, arg.filter0, { maxGenes: value })
								api.update({
									termgroups: [{ lst: genes }],
									settings: {
										[chartType]: { maxGenes: value }
									}
								})
							}
						}
					]
				}
			},
			arg.opts?.[chartType] || {}
		)
	}
	const plotAppApi = await appInit(opts)
	return plotAppApi
}
