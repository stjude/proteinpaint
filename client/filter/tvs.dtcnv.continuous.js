import { handler as _handler } from './tvs.dt.js'
import { renderCnvConfig } from '#dom'

/*
TVS handler for dtcnv term (continuous cnv data)
*/

export const handler = Object.assign({}, _handler, { type: 'dtcnv', fillMenu, get_pill_label })

function fillMenu(self, div, tvs) {
	// get cnv cutoff values
	const termdbConfig = self.opts.vocabApi.termdbConfig || self.opts.vocabApi.parent_termdbConfig
	const dscnv = termdbConfig.queries?.cnv
	if (!dscnv) throw 'cnv query is missing'
	const cnvDefault = dscnv.cnvCutoffsByGene?.[tvs.term.parentTerm.name] || {
		cnvMaxLength: dscnv.cnvMaxLength,
		cnvGainCutoff: dscnv.cnvGainCutoff,
		cnvLossCutoff: dscnv.cnvLossCutoff
	}
	const cnv = Object.assign({}, cnvDefault, tvs)

	// build argument for rendering cnv config
	const arg = {
		holder: div,
		cnvGainCutoff: cnv.cnvGainCutoff,
		cnvLossCutoff: cnv.cnvLossCutoff,
		cnvMaxLength: cnv.cnvMaxLength,
		cnvWT: cnv.cnvWT,
		WTtoggle: true,
		callback: config => {
			const new_tvs = structuredClone(tvs)
			Object.assign(new_tvs, config)
			new_tvs.continuousCnv = true
			self.dom.tip.hide()
			self.opts.callback(new_tvs)
		}
	}

	// render cnv config
	renderCnvConfig(arg)
}

function get_pill_label(tvs) {
	return { txt: tvs.cnvWT ? 'Wildtype' : 'Altered' }
}
