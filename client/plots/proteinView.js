import { getCompInit, copyMerge } from '#rx'
import { dofetch3 } from '#common/dofetch'
import { NumericModes } from '#shared/terms.js'
import { toTvslstFilter } from './proteomeAbundance.js'
import { aa2gmcoord } from '#src/coord'
import { mclass } from '#shared/common.js'

const defaultConfig = {
	chartType: 'proteinView'
}

class ProteinView {
	static type = 'proteinView'

	constructor() {
		this.type = ProteinView.type
	}

	async init() {
		const holder = this.opts.holder.append('div').style('padding', '10px')
		this.dom = {
			holder,
			body: holder.append('div')
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return { config }
	}

	async main() {
		const term = this.state.config?.term?.term || this.state.config?.term
		if (!term?.name) throw 'proteinView: selected protein term is missing'

		if (this.opts.header) this.opts.header.style('padding-left', '7px').text(`Protein View: ${term.name}`)
		const body = {
			genome: this.app.opts.state.vocab.genome,
			dslabel: this.app.opts.state.vocab.dslabel,
			for: 'proteinView',
			term: this.state.config.term,
			filter: this.state.config.filter,
			filter0: this.state.config.filter0
		}

		const data = await dofetch3('termdb', { body })
		if (data.error) throw data.error
		renderFCSummary(this.dom.body, data, this)
		renderPTMLollipop(this.dom.body, data, this)
	}
}

function renderFCSummary(holder, data, self) {
	holder.selectAll('*').remove()

	// data.nonPTMAssays store the fold change for each nonPTM assay type, data.PTMs store the PTM data (including fold change) for each PTM assay type
	const nonPTMAssays = data?.nonPTMAssays || []

	let maxAbs = 0
	for (const assay of nonPTMAssays) {
		for (const c of assay.nonPTMCohorts || []) {
			const log2ratio = getLog2Ratio(c.value)
			if (Number.isFinite(log2ratio)) maxAbs = Math.max(maxAbs, Math.abs(log2ratio))
		}
	}
	if (maxAbs < 0.05) maxAbs = 0.05 // set a minimum scale for better visualization of small fold changes

	for (const assay of nonPTMAssays) {
		const assayName = assay.assayName
		const section = holder.append('div').style('margin-bottom', '18px')
		section.append('div').style('font-weight', 600).style('margin-bottom', '8px').text(`${assayName}`)

		const header = section
			.append('div')
			.style('display', 'grid')
			.style('grid-template-columns', '220px 30% 100px')
			.style('align-items', 'center')
			.style('gap', '8px')
			.style('margin', '0 0 6px 0')
			.style('font-size', '.75em')
			.style('font-weight', 600)
			.style('color', '#495057')

		header.append('div').text('Cohort')
		const scaleHeader = header.append('div').style('position', 'relative').style('height', '14px')

		scaleHeader.append('div').style('position', 'absolute').style('left', 0).style('top', 0).text((-maxAbs).toFixed(2))

		scaleHeader
			.append('div')
			.style('position', 'absolute')
			.style('left', '50%')
			.style('top', 0)
			.style('transform', 'translateX(-50%)')
			.text('0')

		scaleHeader.append('div').style('position', 'absolute').style('right', 0).style('top', 0).text(maxAbs.toFixed(2))

		header.append('div').text('log2 fold change')

		for (const c of assay.nonPTMCohorts || []) {
			const cohortName = c.cohortName
			const log2ratio = getLog2Ratio(c.value)
			const row = section
				.append('div')
				.style('display', 'grid')
				.style('grid-template-columns', '220px 30% 100px')
				.style('align-items', 'center')
				.style('gap', '8px')
				.style('margin', '4px 0')

			row.append('div').style('font-size', '.9em').text(cohortName)

			const track = row
				.append('div')
				.style('height', '14px')
				.style('background', '#f1f3f4')
				.style('border-radius', '7px')
				.style('position', 'relative')
				.style('overflow', 'hidden')
				.style('cursor', 'pointer')
				.attr('title', 'Click to show violin plot')
				.on('click', () => launchViolinPlot(self, assayName, cohortName))

			track
				.append('div')
				.style('position', 'absolute')
				.style('left', '50%')
				.style('top', 0)
				.style('bottom', 0)
				.style('width', '1px')
				.style('transform', 'translateX(-0.5px)')
				.style('background', '#868e96')
				.style('opacity', 0.7)

			const value = Number.isFinite(log2ratio) ? log2ratio : 0
			const ratio = maxAbs > 0 ? Math.abs(value) / maxAbs : 0
			const widthPct = Math.max(0, Math.min(50, ratio * 50))
			if (Number.isFinite(log2ratio) && widthPct > 0) {
				track
					.append('div')
					.style('position', 'absolute')
					.style('left', value >= 0 ? '50%' : `${50 - widthPct}%`)
					.style('top', 0)
					.style('bottom', 0)
					.style('width', `${widthPct}%`)
					.style('background', value >= 0 ? '#2b8a3e' : '#c92a2a')
					.style('opacity', 1)
			}

			row
				.append('div')
				.style('font-family', 'monospace')
				.style('font-size', '.85em')
				.style('cursor', 'pointer')
				.attr('title', 'Click to show violin plot')
				.on('click', () => launchViolinPlot(self, assayName, cohortName))
				.text(Number.isFinite(log2ratio) ? log2ratio.toFixed(3) : 'NA')
		}
	}
}

function launchViolinPlot(self, assayName, cohortName) {
	const selectedProtein = self.state.config?.term?.term || self.state.config?.term
	if (!selectedProtein) throw 'proteinView: selected protein term is missing'

	const action = {
		type: 'plot_create',
		config: {
			chartType: 'summary'
		}
	}

	action.config.assayCohortTitle = `${assayName}: ${cohortName}`
	action.config.proteomeDetails = { assay: assayName, cohort: cohortName }

	const termdbConfig = self.app.vocabApi.termdbConfig
	const cohortSelected = termdbConfig?.queries?.proteome?.assays?.[assayName]?.cohorts?.[cohortName]
	if (cohortSelected?.filter) action.config.filter = toTvslstFilter(cohortSelected.filter)

	const t = structuredClone(selectedProtein)
	t.proteomeDetails = { assay: assayName, cohort: cohortName }
	action.config.term = { term: t, q: { mode: NumericModes.continuous } }

	if (cohortSelected?.overlayTerm) {
		action.config.term2 = { term: structuredClone(cohortSelected.overlayTerm), q: {} }
	}

	self.app.dispatch(action)
}

async function renderPTMLollipop(holder, data, self) {
	if (!data?.PTMAssays?.length) return
	const custom_variants = []
	const mergedMclassOverride = {}
	const gmCache = new Map()
	for (const ptm of data.PTMAssays) {
		//use default gene model to get coordinates for all PTM sites, which is sufficient for most cases
		//and avoids the complexity of mapping between different isoforms. TODO:support isoform-specific mapping.
		const gm = await getGmForPTM(ptm.geneName, self.app.opts.genome.name, gmCache)
		if (!gm) continue
		const logValue = getLog2Ratio(ptm.foldChange)

		if (ptm.mclassOverride && typeof ptm.mclassOverride == 'object') {
			Object.assign(mergedMclassOverride, ptm.mclassOverride)
		}

		const site = parsePTMModSites(ptm.modSites)
		if (!site) continue
		const pos = aa2gmcoord(site, gm)
		if (!Number.isInteger(pos)) continue
		const ptmClass = Object.keys(ptm.mclassOverride || {})[0]
		custom_variants.push({
			chr: gm.chr,
			pos,
			mname: `${ptm.modSites}: ${ptm.cohortName}`,
			class: ptmClass,
			dt: 1,
			logValue
		})
	}
	if (!custom_variants.length) return

	const mclassOverride = {
		className: 'PTMs',
		classes: mergedMclassOverride
	}

	// apply mclass override to global mclass, which will be used by the mds3 track to display the PTM sites.
	// this is necessary because the lollipop plot relies on mclass for variant
	// TODO: find a better way (such as defining PTM-specific class keys) to pass mclass override to the track
	// without modifying global mclass, which can have unintended side effects on other plots.
	for (const key in mclassOverride.classes) {
		if (mclass[key]) Object.assign(mclass[key], mclassOverride.classes[key])
	}

	// create mds3 custom track using numeric mode with logValue on y-axis
	const tk = {
		type: 'mds3',
		name: 'PTMs',
		custom_variants: custom_variants,
		skewerModes: [
			{
				type: 'numeric',
				byAttribute: 'logValue',
				label: 'Log2FC Disease vs Control',
				inuse: true,
				axisheight: 100
			}
		],
		mclassOverride
	}

	// launch block in protein mode with custom track
	const arg = {
		holder: holder.append('div'),
		genome: self.app.opts.genome,
		nobox: true,
		tklst: [tk],
		mclassOverride,
		debugmode: self.app.opts.debug,
		query: data.PTMAssays[0].geneName
	}

	const _ = await import('#src/block.init')
	await _.default(arg)
}

// return the first valid modification site parsed from the modSites string, which is expected to be in the format like "S10", or "S10,T11"
// for now return the first valid site for simplicity. TODO: parse and display multiple sites if available.
function parsePTMModSites(modSites) {
	if (!modSites || typeof modSites != 'string') return null
	const regex = /([A-Za-z])(\d+)/g
	let m
	while ((m = regex.exec(modSites)) !== null) {
		const position = Number(m[2])
		if (!Number.isInteger(position) || position < 1) continue
		return position
	}
	return null
}

async function getGmForPTM(geneName, genomeName, gmCache) {
	if (!geneName) return null
	if (gmCache.has(geneName)) return gmCache.get(geneName)

	const d = await dofetch3('genelookup', {
		body: {
			deep: 1,
			genome: genomeName,
			input: geneName
		}
	})

	if (d.error || !Array.isArray(d.gmlst) || !d.gmlst.length) {
		gmCache.set(geneName, null)
		return null
	}

	const gm = d.gmlst.find(i => i.isdefault) || d.gmlst[0]
	gmCache.set(geneName, gm)
	return gm
}

function getLog2Ratio(foldChange) {
	if (!Number.isFinite(foldChange) || foldChange <= 0) return null
	return Math.log2(foldChange)
}

export async function getPlotConfig(opts) {
	const config = structuredClone(defaultConfig)
	if (!opts.term) throw 'proteinView requires opts.term'
	return copyMerge(config, opts)
}

export const proteinViewInit = getCompInit(ProteinView)
export const componentInit = proteinViewInit
