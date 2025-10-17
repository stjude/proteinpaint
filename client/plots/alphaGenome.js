import { PlotBase } from './PlotBase'
import { getCompInit, copyMerge } from '#rx'
import { dofetch3 } from '#common/dofetch'
import { controlsInit } from './controls'

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
		this.opts.header.text('Alpha Genome Variant Predictor')
		const { sampleTypes } = await dofetch3('alphaGenomeSampleTypes', {})
		this.setControls({ sampleTypes })
	}

	async setControls({ sampleTypes }) {
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
				label: 'Sample type ',
				type: 'dropdown',
				multiple: true,
				options: sampleTypes,
				title:
					'Ontology term. If none provided will plot all: UBERON:0000955(brain), UBERON:0000310(breast), UBERON:0002107(liver), UBERON:0002367(prostate), UBERON:0002048(lung), UBERON:0001155(colon)',
				chartType: this.type,
				settingsKey: 'ontologyTerms'
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
			ontologyTerms: settings.ontologyTerms
		}
		const data = await dofetch3('alphaGenome', { body })
		if (data.error) throw data.error
		this.dom.plotDiv.selectAll('*').remove()
		this.dom.plotDiv.append('img').attr('width', '1250px').attr('src', data.plotImage)
	}
}

export function getPlotConfig(opts) {
	const config = {
		hidePlotFilter: true,
		settings: {
			alphaGenome: {
				controls: { isOpen: false },
				chromosome: 'chr22',
				position: 36201698,
				reference: 'A',
				alternate: 'C',
				ontologyTerms: [
					'UBERON:0000955', // brain
					'UBERON:0000310', // female breast
					'UBERON:0002107', // liver
					'UBERON:0002367', // prostate
					'UBERON:0002048', // lung
					'UBERON:0001155' // colon
				]
			}
		}
	}
	copyMerge(config, opts)

	return config
}

export const alphaGenomeInit = getCompInit(AlphaGenome)
export const componentInit = alphaGenomeInit
