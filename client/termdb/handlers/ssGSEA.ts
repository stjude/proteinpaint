import { appInit } from '../app.js'
import { TermTypes } from '#shared/terms.js'

export class SearchHandler {
	callback: any
	app: any
	async init(opts) {
		this.callback = opts.callback
		this.app = opts.app
		/* NOTE
		hardcodes to first of geneset db!
		later the db name will be specified in termdbConfig
		*/
		const genesetDbName = Object.keys(opts.genomeObj.termdbs || {})[0]
		if (!genesetDbName) throw 'genesetDbName missing'
		await appInit({
			holder: opts.holder,
			state: {
				dslabel: genesetDbName,
				genome: opts.genomeObj.name,
				nav: { header_mode: 'search_only' }
			},
			tree: {
				click_term: (term: any) => {
					// todo
					this.callback({ id: term.id, type: TermTypes.SSGSEA, name: term.name })
				}
			}
		})

		// TODO button to launch geneset edit ui to add geneset and compute custom term
		// TODO register this custom term
		// TODO show this custom term for selection
	}
}
