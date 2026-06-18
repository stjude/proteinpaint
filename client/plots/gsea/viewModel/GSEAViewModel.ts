import type { GSEA } from '../gsea'

export class GSEAViewModel {
	gsea: GSEA
	//Initial pathway opts from ds. Do not mutate this directly
	initPathwayOpts: { label: string; value: string; selected?: boolean }[]
	viewData!: any

	constructor(gsea: GSEA) {
		this.gsea = gsea
		this.initPathwayOpts = structuredClone(gsea.app.opts.genome.termdbs.msigdb.analysisGenesetGroups)
	}

	processData() {
		const settings = this.gsea.state.config.settings.gsea

		this.viewData = {
			pathwayOpts: this.getPathwayOpts(settings)
		}
	}

	getPathwayOpts(settings) {
		//Do not mutation the initial array
		const pathwayOpts = structuredClone(this.initPathwayOpts)
		if (this.gsea.testEnabled && settings.gsea_method == 'blitzgsea') {
			pathwayOpts.push(
				{ label: 'REACTOME (blitzgsea)', value: 'REACTOME--blitzgsea' },
				{ label: 'KEGG (blitzgsea)', value: 'KEGG--blitzgsea' },
				{ label: 'WikiPathways (blitzgsea)', value: 'WikiPathways--blitzgsea' }
			)
		}
		if (settings.pathway) {
			//Note: in the ds file, `{ label: '-', value: '-' }` is analysisGenesetGroups[0]
			pathwayOpts.shift()
			const opt = pathwayOpts.find(opt => opt.value == settings.pathway)
			if (!opt) console.warn(`Selected pathway ${settings.pathway} not found in pathway options.`)
			else opt.selected = true
		}
		return pathwayOpts
	}
}
