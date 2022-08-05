import { getCompInit, copyMerge } from '../rx'

class MassVariantBrowser {
	constructor(opts) {
		this.type = 'variantBrowser'
		this.dom = {
			holder: opts.holder.style('padding', '20px'),
			header: opts.header
		}
		this.rendered = false
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		return {
			config
			//filter: appState.termfilter.filter
		}
	}

	main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
		if (this.dom.header) {
			this.dom.header.html(`${this.config.term.term.name}: variants in matrix samples`)
		}

		if (!this.rendered) {
			this.dom.holder.selectAll('*').remove()
			const gene = this.config.term.term.name

			// TODO: may construct argument differently based on track type?
			const arg = {
				holder: this.dom.holder.node(),
				noheader: 1,
				nobox: 1,
				genome: this.app.vocabApi.vocab.genome,
				gene,
				geneName: gene,
				tracks: [
					{
						type: 'mds3',
						name: gene,
						custom_variants: this.config.custom_variants
					}
				]
			}

			// TODO: use blockInit()
			runproteinpaint(arg)
			this.rendered = true
		}
	}
}

export const variantBrowserInit = getCompInit(MassVariantBrowser)
export const componentInit = variantBrowserInit

export function getPlotConfig(opts, app) {
	// currently, there are no configurations options for
	// the geneVariant wrapper; may add appearance, styling options later
	const config = {}
	// may apply overrides to the default configuration
	return copyMerge(config, opts)
}
