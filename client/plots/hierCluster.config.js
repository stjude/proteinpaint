import { copyMerge } from '../rx'
import { getPlotConfig as getMatrixPlotConfig } from './matrix.config'
import { dtgeneexpression } from '#shared/common.js'
import { fillTermWrapper, get$id } from '#termsetting'
import { showGenesetEdit } from '../dom/genesetEdit.ts' // cannot use '#dom/', breaks

export async function getPlotConfig(opts = {}, app) {
	opts.chartType = 'hierCluster'
	const config = await getMatrixPlotConfig(opts, app)
	// opts.genes will be processed as the hierCluster term group.lst
	delete config.genes

	config.settings.hierCluster = {
		/* type of data used for clustering
		exciting todo: (to introduce new dt values)
		- gene dependency
		- numeric dic term
		- non-gene genomic stuff that resolves into numeric quantities (cpg meth)
		- metabolite
		*/
		dataType: dtgeneexpression,
		// TODO: may adjust the default group name based on automatically detected term types
		// otherwise, should define it via opts or overrides
		termGroupName: 'Gene Expression',
		clusterMethod: 'average', // complete
		zScoreCap: 5,
		xDendrogramHeight: 100,
		yDendrogramHeight: 200,
		colorScale: { domain: [0, 0.5, 1], range: ['blue', 'white', 'red'] }
	}
	const overrides = app.vocabApi.termdbConfig.hierCluster || {}
	copyMerge(config.settings.hierCluster, overrides.settings, opts.settings?.hierCluster || {})

	// okay to validate state here?
	{
		const c = config.settings.hierCluster.colorScale
		if (!c) throw 'colorScale missing'
		if (!Array.isArray(c.domain) || c.domain.length == 0) throw 'colorScale.domain must be non-empty array'
		if (!Array.isArray(c.range) || c.range.length == 0) throw 'colorScale.range must be non-empty array'
		if (c.domain.length != c.range.length) throw 'colorScale domain[] and range[] of different length'
	}

	config.settings.matrix.collabelpos = 'top'

	const termGroupName = config.settings.hierCluster.termGroupName
	const hcTermGroup = config.termgroups.find(g => g.type == 'hierCluster' || g.name == termGroupName) || {
		name: termGroupName
	}
	// TODO: should compose the term group in launchGdcHierCluster.js, since this handling is customized to only that dataset?
	// the opts{} object should be standard, should pre-process the opts outside of this getPlotConfig()

	hcTermGroup.type = 'hierCluster' // ensure that the group.type is correct for recovered legacy sessions

	if (!hcTermGroup.lst?.length) {
		const genes = opts.genes || []
		if (!Array.isArray(opts.genes)) throw 'opts.genes[] not array (may show geneset edit ui)'

		const twlst = []
		for (const i of opts.genes) {
			let tw
			if (typeof i.term == 'object' && i.term.type == 'geneVariant') {
				// i is already well-formed tw object
				tw = i
			} else {
				// shape i into term{} and nest into tw{}
				i.type = 'geneVariant'
				if (i.name) {
				} else if (i.gene) {
					i.name = i.gene // TODO
				}
				tw = { term: i }
			}
			await fillTermWrapper(tw)
			twlst.push(tw)
		}

		hcTermGroup.lst = twlst
		if (config.termgroups.indexOf(hcTermGroup) == -1) config.termgroups.unshift(hcTermGroup)
	}

	config.settings.matrix.maxSample = 100000
	return config
}

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
        termdbConfig is accessible at chartsInstance.state.termdbConfig{}
        mass option is accessible at chartsInstance.app.opts{}
	*/

	// to fill in menu, create options in holder
	/*
	holder.append('div')
		.attr('class','sja_menuoption sja_sharp_border')
		.text('Single gene expression')
		.on('click',()=>{
			chartsInstance.dom.tip.hide()
			
		})
		*/
	const geneList = []
	const app = chartsInstance.app
	const tip = app.tip

	holder.selectAll('*').remove()
	const div = holder.append('div').style('padding', '5px')
	const label = div.append('label')
	label.append('span').text('Create ')
	let name
	const nameInput = label
		.append('input')
		.style('margin', '2px 5px')
		.style('width', '210px')
		.attr('placeholder', 'Group Name')
		.on('input', () => {
			name = nameInput.property('value')
		})
	const selectedGroup = {
		index: 0,
		name,
		label: name,
		lst: [],
		status: 'new'
	}

	showGenesetEdit({
		holder: holder.append('div'),
		/* running hier clustering and the editing group is the group used for clustering
	pass this mode value to inform ui to support the optional button "top variably exp gene"
	this is hardcoded for the purpose of gene expression and should be improved
	*/
		genome: app.opts.genome,
		geneList,
		mode: 'expression',
		vocabApi: app.vocabApi,
		callback: ({ geneList, groupName }) => {
			if (!selectedGroup) throw `missing selectedGroup`
			tip.hide()
			const group = { name: groupName || name, lst: [], type: 'hierCluster' }
			const lst = group.lst.filter(tw => tw.term.type != 'geneVariant')
			const tws = geneList.map(d => {
				//if it was present use the previous term, genomic range terms require chr, start and stop fields, found in the original term
				let tw = group.lst.find(tw => tw.term.name == d.symbol || tw.term.name == d.gene)
				if (!tw)
					tw = {
						$id: get$id(),
						term: {
							name: d.symbol || d.gene,
							type: 'geneVariant'
						},
						q: {}
					}
				return tw
			})
			group.lst = [...lst, ...tws]
			if (!group.lst.length) tg.splice(selectedGroup.index, 1)

			// close geneset edit ui after clicking submit
			holder.selectAll('*').remove()

			app.dispatch({
				type: 'plot_create',
				config: {
					chartType: 'hierCluster',
					termgroups: [group]
				}
			})
		}
	})
}
