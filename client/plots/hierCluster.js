import { Matrix } from './matrix'
import { getCompInit, deepEqual } from '../rx'
import * as renderers from './hierCluster.renderers'
import * as interactivity from './hierCluster.interactivity'
import { dofetch3 } from '#common/dofetch'
import { extent } from 'd3-array'
import { scaleLinear } from 'd3-scale'
import { filterJoin } from '#filter'
import { getNormalRoot } from '#filter'
export * from './hierCluster.config'
import { clusterMethodLst, distanceMethodLst } from '#shared/clustering'
import { TermTypes } from '../shared/terms'
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
			.attr('data-testid', 'hierCluster_top_dendrogram')
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
		this.dom.leftDendrogram = this.dom.svg
			.insert('g', 'g')
			.attr('class', 'sjpp-matrix-dendrogram')
			.attr('data-testid', 'hierCluster_left_dendrogram')
		//.attr('clip-path', `url(#${this.seriesClipId})`)
	}

	async setHierClusterData(_data = {}) {
		this.prevServerData = this.currServerData
		const abortCtrl = new AbortController()
		const [d, stale] = await this.api.detectStale(() => this.requestData({ signal: abortCtrl.signal }), { abortCtrl })
		if (stale) throw `stale sequenceId`
		if (d.error) throw d.error
		this.currServerData = structuredClone(d)
		if (!deepEqual(this.prevServerData, this.currServerData)) {
			// do not persist highlighted dendrogram branch selection
			// when the cohort, clustering method, or other config changes the server data
			delete this.clickedClusterIds
		}
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
		const data = await dofetch3('termdb/cluster', { body, signal })
		console.log('hierCluster data', data)
		return data
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
		const terms = this.getClusterRowTermsAsParameter()
		if (!terms.length) throw 'no data'
		// !!! NOTE !!!
		// all parameters here must remove payload properties that are
		// not relevant to the data request, so that the dofetch and/or
		// browser caching would work

		// Checking if cluster and distance method for hierarchial clustering is valid
		if (!clusterMethodLst.find(i => i.value == s.clusterMethod)) throw 'Invalid cluster method'
		if (!distanceMethodLst.find(i => i.value == s.distanceMethod)) throw 'Invalid distance method'
		const body = {
			genome: state.vocab.genome,
			dslabel: state.vocab.dslabel,
			dataType: state.config.dataType || TermTypes.GENE_EXPRESSION,
			clusterMethod: s.clusterMethod,
			distanceMethod: s.distanceMethod,
			terms,
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
		const lst = [...this.hcTermGroup.lst.map(tw => tw.term)]
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
