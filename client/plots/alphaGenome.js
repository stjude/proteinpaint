import { PlotBase } from './PlotBase'
import { getCompInit, copyMerge } from '#rx'
import { dofetch3 } from '#common/dofetch'
import { controlsInit } from './controls'
import { interval } from 'd3'

class AlphaGenome extends PlotBase {
	constructor(opts) {
		super(opts)
		this.type = 'alphaGenome'
		this.dom = {
			holder: opts.holder,
			controlsDiv: opts.holder.append('div').style('display', 'inline-block'),
			plotDiv: opts.holder.append('div').style('display', 'inline-block')
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config
		}
	}

	async init(appState) {
		const body = {
			dslabel: this.app.vocabApi.vocab.dslabel
		}
		this.opts.header.text('Alpha Genome Variant Predictor')
		const { ontologyTerms, outputTypes, intervals } = await dofetch3('AlphaGenomeTypes', { body })

		this.setControls({ ontologyTerms, outputTypes, intervals })
	}

	async setControls({ ontologyTerms, outputTypes, intervals }) {
		const inputs = [
			{
				label: 'Chromosome',
				type: 'text',
				chartType: this.type,
				settingsKey: 'chromosome',
				title: 'Genomic chromosome of the variant'
			},
			{
				label: 'Position',
				type: 'number',
				chartType: this.type,
				settingsKey: 'position',
				title: 'Genomic position of the variant'
			},
			{
				label: 'Reference Bases',
				type: 'text',
				chartType: this.type,
				settingsKey: 'reference',
				title: 'Reference base of the variant'
			},
			{
				label: 'Alternate Bases',
				type: 'text',
				chartType: this.type,
				settingsKey: 'alternate',
				title: 'Alternate base of the variant'
			},
			{
				label: 'Ontology term',
				type: 'dropdown',
				options: ontologyTerms,
				title: 'Ontology term',
				chartType: this.type,
				settingsKey: 'ontologyTerm'
			},
			{
				label: 'Output type',
				type: 'dropdown',
				options: outputTypes,
				title: 'Output type',
				chartType: this.type,
				settingsKey: 'outputType'
			},
			{
				label: 'Interval',
				type: 'dropdown',
				options: intervals,
				title: 'Interval',
				chartType: this.type,
				settingsKey: 'interval'
			}
		]
		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controlsDiv,
				inputs
			})
		}
	}

	async main() {
		const settings = this.state.config.settings[this.type]
		const body = {
			genome: this.app.vocabApi.vocab.genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			chromosome: settings.chromosome,
			position: settings.position,
			reference: settings.reference,
			alternate: settings.alternate,
			ontologyTerms: [settings.ontologyTerm],
			outputType: settings.outputType,
			interval: Number(settings.interval)
		}
		const data = await dofetch3('alphaGenome', { body })
		if (data.error) throw data.error
		this.dom.plotDiv.selectAll('*').remove()
		this.dom.plotDiv.append('img').attr('width', '1250px').attr('src', data.plotImage)
	}
}

export function getPlotConfig(opts, app) {
	const alphaGenome = (app.vocabApi.termdbConfig.alphaGenome = app.vocabApi.termdbConfig.queries.alphaGenome)
	const config = {
		hidePlotFilter: true,
		settings: {
			alphaGenome: {
				controls: { isOpen: false },
				...alphaGenome.default,
				interval: 16384
			}
		}
	}
	copyMerge(config, opts)

	return config
}

export const alphaGenomeInit = getCompInit(AlphaGenome)
export const componentInit = alphaGenomeInit
