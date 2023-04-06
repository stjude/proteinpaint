/*

This is a stand-alone wrapper application
for Circos-like plots. The 'dt' prefix
refers to the 'dt[#]' variant classification 
in pp/src/common.js.

*/

import AppState from './app.state'
import discoDefaults from './defaults'
import DiscoReference from './reference'
import DtDiscoSnv from './snv'
import DtDiscoCnv from './cnv'
import DtDiscoLoh from './loh'
import DtDiscoSv from './sv'
import Labels from './labels'
import DtDiscoLegend from './legend'
import DtDiscoEvents from './events'
import chord from './chord.js'
import { select, selectAll } from 'd3-selection'
import * as controls from './controls'
import { mclass } from '#shared/common'
import { sayerror } from '#src/client'
import { hideerrors } from './helper'

// these are shared across instances
const mlabel = {}
for (var key in mclass) {
	mlabel[mclass[key].label] = mclass[key]
	mlabel[key] = mclass[key]
}

export default class DtDisco extends AppState {
	constructor(opts) {
		super()
		this.opts = opts

		this.settings = discoDefaults(this.opts.settings)
		this.key = 'chord'
		this.history = []
		this.historyIndex = 0
		this.serverData = {}
		this.currData = null
		this.eventFxns = DtDiscoEvents(this)
		this.holderSelector = this.opts.holderSelector
		this.holder = typeof this.holderSelector == 'string' ? select(this.holderSelector) : this.holderSelector
		this.legendSelector = this.opts.legendSelector

		// in order of increasing layer radius
		this.dtNums = [
			2,
			5,
			4,
			10,
			1,
			'exonic',
			'non-exonic'

			/*
			"M", "E", "F", "N", "S", "D", "I", "P", "L",
			"Utr3", "Utr5",
			"mnv", "ITD", 
			"insertion", "deletion",
			"DEL", "NLOSS", "CLOSS",
			"Intron",  "X", "noncoding", 
			*/
		]

		this.snvClassLayer = {
			M: 'exonic',
			E: 'exonic',
			F: 'exonic',
			N: 'exonic',
			S: 'exonic',
			D: 'exonic',
			I: 'exonic',
			P: 'exonic',
			L: 'exonic',
			Utr3: 'exonic',
			Utr5: 'exonic',
			mnv: 'non-exonic',
			ITD: 'non-exonic',
			insertion: 'non-exonic',
			deletion: 'non-exonic',
			Intron: 'non-exonic',
			X: 'non-exonic',
			noncoding: 'non-exonic'
		}

		this.dtAlias = {
			1: 'snv', //
			2: 'sv', //'fusionrna',
			3: 'geneexpression',
			4: 'cnv',
			5: 'sv',
			6: 'snv', //'itd',
			7: 'snv', //'del',
			8: 'snv', //'nloss',
			9: 'snv', //'closs',
			10: 'loh'
		}

		this.processorClasses = {
			snv: DtDiscoSnv,
			cnv: DtDiscoCnv,
			sv: DtDiscoSv,
			loh: DtDiscoLoh
		} //console.log(this.processorClasses)

		this.sayerr = (message, type = null) => {
			if (Array.isArray(message)) {
				for (const m of message) {
					sayerror(this.holder, m, type)
				}
			} else {
				sayerror(this.holder, message, type)
			}
		}

		this.serverPromise = {}
		this.init()
		if (this.settings.selectedSamples.length) this.main()
	}

	init() {
		if (this.dom) return true
		if (!this.holder.size()) return false

		this.dom = {
			holder: this.holder.append('div'),
			svg: this.holder
				.append('div')
				.style('display', 'inline-block')
				//.style('margin-left','60px')
				.style('width', '100%')
				.style('text-align', 'center')
				.style('font-family', 'Arial')
				.append('svg')
		}

		if (!this.legendSelector) {
			this.legendSelector = this.holder.append('div').style('text-align', 'center')
		}

		this.renderer = chord(this, this.settings, this.eventFxns)

		if (this.settings.showControls) {
			this.controls = new controls.DtDiscoControls(this)
		}
		this.trackHistory('chord')
		this.mlabel = mlabel
	}

	main(opts = {}) {
		const s = this.settings
		if (s.mutationSignatures) {
			delete s.mutationSignatures
			delete s.mutationKey
		}
		hideerrors(this.holder)

		if ('settings' in opts) {
			Object.assign(s, opts.settings)
		}
		if ('mutation_signature' in opts) {
			s.mutationSignature = opts.mutation_signature.signatures
			s.signatureKey = opts.mutation_signature.key
		}

		if ('sampleName' in opts) {
			if (!opts.sampleName) {
				console.log('Invalid samplename (empty string)')
			} else {
				s.selectedSamples = [opts.sampleName]
			}
		}
		if (!s.selectedSamples.length) return

		if (opts.data) {
			this.currData = opts.data
		}

		if (!this.currData) {
			console.log('missing data')
			return
		}

		this.currData.forEach(d => {
			d.sampleName = d.sample
			if (opts.sampleName) d.sample = opts.sampleName
		})
		const responses = [this.currData]
		const errors = []
		this.processServerData(responses, errors)
	}

	processServerData(responses, errors) {
		const s = this.settings
		if (responses.length + errors.length < s.selectedSamples.length) {
			return
		}
		if (errors.length) {
			console.log('errors', errors)
		}
		if (!responses.length) {
			console.log('no server data to render')
			return
		}

		const serverData = []
		responses.forEach(d => serverData.push(...d))
		this.reference = new DiscoReference(this)
		//this.rows = trackers.getRowTracker(s, s.selectedSamples.length > 0)
		//this.samples = trackers.getSampleTracker(response, s.selectedSamples.length > 0)
		this.hits = { classes: [] } // used in legend
		//this.labels = trackers.getLabelTracker(s, s.selectedSamples.length > 0)

		this.processors = {
			labels: new Labels(this),
			legend: new DtDiscoLegend(this)
		}

		this.setResponseBySample(s, serverData)
		// for now, transform to an array of sample names to
		// make handling consistent with pg.disco
		const plots = []
		s.selectedSamples.forEach(sampleName => {
			plots.push(this.getPlotData(sampleName))
		})
		this.renderer(plots)
		this.processors.legend.render()
		this.eventFxns.setElems()
	}

	setResponseBySample(s, response) {
		// convert root variantType names in server response data
		// value to key mapping from pp/src/common.js
		response.forEach(data => {
			if (!this.dtNums.includes(data.dt)) return
			const alias = data.dt == 1 && s.snv.byClassWidth ? this.snvClassLayer[data.class] : this.dtAlias[data.dt]
			if (!this.processors[alias]) {
				this.processors[alias] = new this.processorClasses[data.dt == 1 ? 'snv' : alias](this, alias)
			}
			const cls = this.processors[alias].main(data)
			if (!this.hits.classes.includes(cls)) {
				this.hits.classes.push(cls)
			}
			//this.labels.track(s[data.dt==1 ? 'snv' : alias], data.gene, response.length, '')
		})
	}

	getPlotData(sampleName) {
		const s = this.settings
		const plot = {
			title: '', //sampleName,
			sample: sampleName,
			lastRadius: s.innerRadius,
			layers: []
		}

		this.dtNums.forEach(dt => {
			const alias = dt in this.dtAlias ? this.dtAlias[dt] : dt
			if (!this.processors[alias]) return
			const geneArcs = this.processors[alias].setLayer(plot, sampleName)
			this.processors.labels.setGeneArcs(geneArcs, alias)
		})
		this.reference.setLayer(plot)
		this.processors.labels.setLayer(plot)
		return plot
	}

	rescale(s) {
		this.dom.svg
			.transition()
			.duration(1000)
			.attr('transform', 'scale(' + s + ')')
	}
}
