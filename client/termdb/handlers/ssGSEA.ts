import { appInit } from '../app.js'
import { TermTypes } from '#types'
import { mayRenderSampleTypeRow, getTermSampleTypes, getChosenSampleTypes, getChildSampleTypeQuery } from '#dom'

export class SearchHandler {
	callback: any
	app: any
	sampleTypeSelect?: any
	async init(opts) {
		this.callback = opts.callback
		this.app = opts.app
		/* NOTE
		hardcodes to first of geneset db!
		later the db name will be specified in termdbConfig
		*/
		const genesetDbName = Object.keys(opts.genomeObj.termdbs || {})[0]
		if (!genesetDbName) throw 'genesetDbName missing'
		/* the sample types to read the geneset term for, as in the gene expression picker. The tree below is an app
		of its own, so the row is drawn in a div of its own above it */
		this.sampleTypeSelect = mayRenderSampleTypeRow(
			opts.holder.append('div').style('padding-top', '10px'),
			this.query,
			this.termdbConfig
		)
		await appInit({
			holder: opts.holder.append('div'),
			state: {
				dslabel: genesetDbName,
				genome: opts.genomeObj.name,
				nav: { header_mode: 'search_only' }
			},
			tree: {
				click_term: (term: any) => this.selectTerm(term)
			}
		})

		opts.holder.select('input.tree_search').attr('data-testid', 'sjpp-ssgsea-search')

		// TODO button to launch geneset edit ui to add geneset and compute custom term
		// TODO register this custom term
		// TODO show this custom term for selection
	}

	get termdbConfig() {
		return this.app?.vocabApi?.termdbConfig
	}

	/** the sample types of the geneset scores that have a parent, as the other term pickers and the genome
	 * browser offer them */
	get query() {
		return getChildSampleTypeQuery(this.termdbConfig?.queries?.ssGSEA, this.termdbConfig)
	}

	/** the picked geneset term, with the chosen sample types. None, or every one, reads every sample, as in the
	 * junction picker, so that a term picked without a choice is as before the sample type row */
	selectTerm(term: any) {
		const termSampleTypes = getTermSampleTypes(this.sampleTypeSelect, this.query, this.termdbConfig)
		// nothing selectable, which getTermSampleTypes() has alerted
		if (!termSampleTypes) return
		const sampleTypes = getChosenSampleTypes(this.query, termSampleTypes.sampleTypes)
		this.callback({
			id: term.id,
			type: TermTypes.SSGSEA,
			name: term.name,
			...(sampleTypes ? { sampleTypes, sampleTypeLabel: termSampleTypes.sampleTypeLabel } : {})
		})
	}
}
