import { handler as _handler } from './tvs.dt.js'
import { renderCnvConfig } from '#dom'

/*
TVS handler for dtcnv term (continuous cnv data)
*/

export const handler = Object.assign({}, _handler, { type: 'dtcnv', fillMenu, get_pill_label })

function fillMenu(self, div, tvs) {
	// render cnv cutoff values
	const termdbConfig = self.opts.vocabApi.termdbConfig || self.opts.vocabApi.parent_termdbConfig
	const dscnv = termdbConfig.queries?.cnv
	if (!dscnv) throw 'cnv query is missing'
	// default cnv cutoff values from dataset
	const cnvDefault = dscnv.cnvCutoffsByGene?.[tvs.term.parentTerm.name] || {
		cnvMaxLength: dscnv.cnvMaxLength,
		cnvGainCutoff: dscnv.cnvGainCutoff,
		cnvLossCutoff: dscnv.cnvLossCutoff
	}
	// build argument for rendering cnv config
	const arg = {
		holder: div,
		cnvGainCutoff: tvs.cnvGainCutoff || cnvDefault.cnvGainCutoff,
		cnvLossCutoff: tvs.cnvLossCutoff || cnvDefault.cnvLossCutoff,
		cnvMaxLength: Number.isFinite(tvs.cnvMaxLength)
			? tvs.cnvMaxLength
			: tvs.cnvMaxLength === null
			? -1
			: cnvDefault.cnvMaxLength,
		cnvWT: tvs.cnvWT || false,
		callback: config => {
			const new_tvs = structuredClone(tvs)
			new_tvs.continuousCnv = true
			new_tvs.cnvWT = config.cnvWT
			new_tvs.cnvGainCutoff = config.cnvGainCutoff
			new_tvs.cnvLossCutoff = config.cnvLossCutoff
			// no max length if value == -1
			new_tvs.cnvMaxLength = config.cnvMaxLength == -1 ? null : config.cnvMaxLength
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
