import { handler as _handler } from './tvs.dt.js'
import { renderVariantConfig } from '#dom'

/*
TVS handler for dtsnvindel term
*/

export const handler = Object.assign({}, _handler, { type: 'dtsnvindel', fillMenu })

async function fillMenu(self, div, tvs) {
	// render snvindel config
	const data = await self.opts.vocabApi.getCategories(tvs.term, self.filter, self.opts.getCategoriesArguments || {})
	const arg = {
		holder: div,
		values: data.lst,
		selectedValues: tvs.values,
		mcount: tvs.mcount,
		wt: tvs.wt,
		callback: config => {
			const new_tvs = structuredClone(tvs)
			Object.assign(new_tvs, config)
			self.dom.tip.hide()
			self.opts.callback(new_tvs)
		}
	}
	renderVariantConfig(arg)
}
