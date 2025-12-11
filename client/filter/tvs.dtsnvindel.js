import { handler as _handler } from './tvs.dt.js'
import { renderSnvIndelConfig } from '#dom'

/*
TVS handler for dtsnvindel term
*/

export const handler = Object.assign({}, _handler, { type: 'dtsnvindel', fillMenu })

async function fillMenu(self, div, tvs) {
	// render snvindel config
	const data = await self.opts.vocabApi.getCategories(tvs.term, self.filter, self.opts.getCategoriesArguments || {})
	const arg = {
		holder: div,
		mutations: data.lst,
		selectedMutations: tvs.values,
		wt: tvs.wt,
		callback: config => {
			const new_tvs = structuredClone(tvs)
			new_tvs.wt = config.wt
			new_tvs.values = config.selectedMutations || []
			self.dom.tip.hide()
			self.opts.callback(new_tvs)
		}
	}
	renderSnvIndelConfig(arg)
}
