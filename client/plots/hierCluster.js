import { Matrix } from './matrix'
import { getCompInit, copyMerge } from '../rx'
import { getPlotConfig as getMatrixPlotConfig } from './matrix.config'
import * as renderers from './hierCluster.renderers'
import * as interactivity from './hierCluster.interactivity'
import { dofetch3 } from '#common/dofetch'
import { fillTermWrapper, get$id } from '#termsetting'
import { extent } from 'd3-array'
import { scaleLinear } from 'd3-scale'
import { renderTable } from '../dom/table'
import { Menu } from '../dom/menu'
import { dtgeneexpression } from '#shared/common.js'
import { filterJoin } from '#filter'
import { showGenesetEdit } from '../dom/genesetEdit.ts' // cannot use '#dom/', breaks
import { getNormalRoot } from '#filter'

/*
FIXME items

- should not hardcode this.geneExpValues, incompatible for future expansion
*/

export class HierCluster extends Matrix {
	constructor(opts) {
		super(opts)
		this.type = 'hierCluster'
		this.chartType = 'hierCluster'
	}

	async init(appState) {
		await super.init(appState)

		this.maySetSandboxHeader()

		this.hcClipId = this.seriesClipId + '-hc'
		this.dom.hcClipRect = this.dom.svg
			.select('defs')
			.append('clipPath')
			.attr('id', this.hcClipId)
			//.attr('clipPathUnits', 'objectBoundingBox')
			.attr('clipPathUnits', 'userSpaceOnUse')
			.append('rect')
			.attr('display', 'block')

		this.dom.topDendrogram = this.dom.svg
			.insert('g', 'g')
			.attr('clip-path', `url(#${this.hcClipId})`)
			.append('g')
			.attr('class', 'sjpp-matrix-dendrogram')
			.on('click', event => {
				const clickedClusterId = this.getClusterFromTopDendrogram(event)
				if (clickedClusterId) {
					this.clickedClusterIds = this.getAllChildrenClusterIds(clickedClusterId)
					this.clickedClusterIds.push(clickedClusterId)

					const clickedCluster = this.hierClusterData.clustering.col.mergedClusters.get(clickedClusterId)
					const clickedClusterSampleNames = clickedCluster.children.map(c => c.name)
					this.addSelectedSamplesOptions(clickedClusterSampleNames, event)
				} else {
					// if not clicking on a cluster, change highlighted cluster color from red back to black
					delete this.clickedClusterIds
				}

				// rerender the col Dendrogram
				this.plotDendrogramHclust(true)
			})
		this.dom.leftDendrogram = this.dom.svg.insert('g', 'g').attr('class', 'sjpp-matrix-dendrogram') //.attr('clip-path', `url(#${this.seriesClipId})`)
	}

	async setHierClusterData(_data = {}) {
		const abortCtrl = new AbortController()
		const [d, stale] = await this.api.detectStale(() => this.requestData({ signal: abortCtrl.signal }), { abortCtrl })
		if (stale) throw `stale sequenceId`
		if (d.error) throw d.error
		const s = this.settings.hierCluster
		const twlst = this.hcTermGroup.lst

		if (!d.clustering) {
			// stop-gap data validation, lacks essential data part
			if (d.gene) {
				// for now backend returns {gene:str, data:{}} if there's only 1 eligible gene
				throw `Cannot do clustering: data is only available for 1 gene (${d.gene}). Try again by adding more genes.`
			}
			throw 'Cannot do clustering: invalid server response (lacks .clustering{})'
		}
		this.hierClusterData = d

		const c = this.hierClusterData.clustering
		this.setHierColorScale(c)

		const zScoreCap = this.settings.hierCluster.zScoreCap // used in loops below

		const samples = {}

		/* see comments inside plotDendrogramHclust() on structure of d.clustering.row{} and col{}
		assumes c.col is samples and c.row is non-sample things (genes for now); later may flip to c.row be samples instead!!
		*/

		for (const [i, column] of c.col.order.entries()) {
			samples[column.name] = { sample: column.name }
			for (const [j, row] of c.row.order.entries()) {
				const tw = twlst.find(tw => tw.term.name === row.name)
				const value = c.matrix[j][i]
				samples[column.name][tw.$id] = {
					key: tw.term.name,
					values: [
						{
							sample: column.name,
							dt: this.settings.hierCluster.dataType,
							class: 'geneexpression', // FIXME since there's no class defined for dtgeneexpression in common.js, best not to require value.class
							label: s.termGroupName,
							gene: tw.term.name,
							chr: tw.term.chr,
							pos: `${tw.term.start}-${tw.term.stop}`,
							value
							// the color will be computed in matrix.cells, so that
							// it can get updated even when there are no nonsetting state diff
						}
					]
				}
			}
		}

		this.hcTermNameOrder = c.row.order.map(row => row.name)
		this.hcTermSorter = (a, b) => {
			const i = this.hcTermNameOrder.indexOf(a.tw.term.name)
			const j = this.hcTermNameOrder.indexOf(b.tw.term.name)
			if (i == -1 && j == -1) return 0
			if (i == -1) return 1
			if (j == -1) return -1
			return i - j
		}

		this.hcSampleNameOrder = c.col.order.map(col => col.name)
		this.hcSampleSorter = (a, b) => {
			const i = this.hcSampleNameOrder.indexOf(a.sample)
			const j = this.hcSampleNameOrder.indexOf(b.sample)
			if (i == -1 && j == -1) return 0
			if (i == -1) return 1
			if (j == -1) return -1
			return i - j
		}

		// from d.byTermId to byTermId: change byTermId keys from gene names to $ids
		const byTermId = {}
		for (const tw of twlst) {
			if (d.byTermId[tw.term.name]) byTermId[tw.$id] = d.byTermId[tw.term.name]
		}
		this.hierClusterSamples = {
			refs: { byTermId, bySampleId: d.bySampleId },
			lst: c.col.order.map(c => samples[c.name]),
			samples
		}
	}

	async requestData({ signal }) {
		const body = this.currRequestOpts?.hierCluster || this.getHCRequestBody(this.state)
		return await dofetch3('termdb/cluster', { body, signal })
	}

	getHCRequestBody(state) {
		this.hcTermGroup =
			this.config.termgroups.find(grp => grp.type == 'hierCluster') ||
			this.termOrder?.find(t => t.grp.type == 'hierCluster')?.grp

		const s = state.config.settings.hierCluster
		// temporary fix to get rid of hard/soft filter and only keep dictionary legend filter,
		// soft filter shouldn't be used to filter out any samples for hierCluster
		// TODO: add hard filter back to filter out samples
		const dictionaryLegendFilter = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: state.config.legendValueFilter.lst.filter(f => !f.tvs.legendFilterType)
		}
		const genes = this.getClusterRowTermsAsParameter()
		if (!genes.length) throw 'no data'
		const body = {
			genome: state.vocab.genome,
			dslabel: state.vocab.dslabel,
			dataType: s.dataType,
			genes,
			clusterMethod: s.clusterMethod,
			filter: getNormalRoot(filterJoin([state.filter, dictionaryLegendFilter])),
			filter0: state.filter0
		}
		return body
	}

	combineData() {
		if (!this.hierClusterSamples) return
		const d = this.data // matrix data
		const samples = {}
		const lst = []
		// the gene expression samples will be used as a filter for the matrix samples
		for (const sampleId in this.hierClusterSamples.samples) {
			const s = this.hierClusterSamples.samples[sampleId]
			samples[sampleId] = s
			lst.push(s)
			if (sampleId in d.samples) Object.assign(s, d.samples[sampleId])
			const _ref_ = this.hierClusterSamples.refs.bySampleId[sampleId] || {}
			if (!s._ref_) s._ref_ = _ref_
			// hierCluster refs.bySampleId will overwrite matrix reference properties with the same name
			else Object.assign(s._ref_, _ref_)
		}

		// combine this.hierClusterSamples.refs.byTermId into this.data.refs.byTermId
		const t = this.hierClusterSamples.refs.byTermId
		for (const $id of Object.keys(t)) {
			d.refs.byTermId[$id] = Object.assign({}, d.refs.byTermId[$id] || {}, t[$id])
		}
		this.data = { samples, lst, refs: d.refs }
	}

	setHierColorScale(c) {
		const hc = this.settings.hierCluster
		const scale = scaleLinear(hc.colorScale.domain, hc.colorScale.range).clamp(true)
		const globalMinMaxes = []
		for (const row of c.matrix) {
			globalMinMaxes.push(...extent(row))
		}
		const absMax = Math.min(hc.zScoreCap, Math.max(...extent(globalMinMaxes).map(Math.abs)))
		const [min, max] = [-absMax, absMax]
		// what's purpose of assigning this.geneExpValues{}, to signal something to matrix code?
		this.geneExpValues = { scale, min, max }
	}

	getValueColor(value) {
		const zScoreCap = this.settings.hierCluster.zScoreCap
		return this.geneExpValues.scale((value - -zScoreCap) / (zScoreCap * 2))
	}

	/* returns list of gene terms as request parameter, e.g. {gene,chr,start,stop}
	request parameter only need term but not tw, as it will simply fetch continuous sample values on terms without transform

	use of this function is unfortunate because:
		the incomplete migration of {name} to {gene} for gene-based term
		geneset edit ui is hardcoded to return {name}
		existing plot states contain {name}

	!!! migration instruction !!!
	- term.name is for display only, if a term is gene-based, it has term.gene=str
	- a geneVariant term can be based on a genomic range (and not a gene), in that case it won't have term.gene and cannot be used where gene is expected, e.g. gene-based clustering analysis

	*/
	getClusterRowTermsAsParameter() {
		const lst = []
		if (this.config.settings.hierCluster.dataType == dtgeneexpression) {
			/* all items from .lst[] are expected to be {gene} */
			for (const tw of this.hcTermGroup.lst) {
				if (tw.term.type != 'geneVariant') throw 'not geneVariant term while dataType==dtgeneexpression'
				// FIXME when {name} is fully migrated to {gene}, delete following line and use continue to skip non-gene terms
				if (!tw.term.gene) {
					if (!tw.term.name) throw 'geneVariant term missing gene/name'
					// adding tw properties should be done in fillTermWrapper(),
					// otherwise it makes state-tracked tw comparison unreliable
					// tw.term.gene = tw.term.name
				}
				// see notes above, avoid modifying the state unnecessarily
				// select the properties to include, since GDC term.values (computed incrementally)
				// or cohort-dependent term.categories2samplecount can affect caching
				lst.push({ name: tw.term.name, type: tw.term.type, gene: tw.term.gene || tw.term.name })
			}
		} else {
			throw 'unknown dataType'
		}
		// this helps caching by having a more consistent URL string
		lst.sort((a, b) => (a.name < b.name ? -1 : 1))
		return lst
	}
}

for (const methods of [renderers, interactivity]) {
	for (const methodName in methods) HierCluster.prototype[methodName] = methods[methodName]
}

export const hierClusterInit = getCompInit(HierCluster)
export const componentInit = hierClusterInit

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
