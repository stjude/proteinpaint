import { handler as _handler, getTvsByOrigin, getTvsOrigins } from './tvs.dt.js'
import { getOriginLabel } from '#shared/terms.js'
import { renderCnvConfig, escapeHtml } from '#dom'

/*
TVS handler for dtcnv term (continuous cnv data)
*/

export const handler = Object.assign({}, _handler, { type: 'dtcnv', fillMenu, get_pill_label })

function fillMenu(self, div, tvs) {
	// get cnv cutoff values
	const dscnv = self.opts.vocabApi.termdbConfig.queries?.cnv
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
		genotypeToggle: true,
		fractionOverlap: cnv.fractionOverlap,
		showOverlap: true,
		byOrigin: getTvsByOrigin(self, tvs),
		selectedOrigins: getTvsOrigins(self, tvs),
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

function get_pill_label(tvs, self) {
	const txt = tvs.cnvWT ? 'Wildtype' : 'Altered'
	// see the same note in get_pill_label() of tvs.dt.js. escaped because the label comes
	// from the dataset and the pill renders it as html, see updatePill() in tvs.js
	const originLabel = getOriginLabel(tvs.origins, self && getTvsByOrigin(self, tvs))
	return { txt: originLabel ? escapeHtml(`${txt} (${originLabel})`) : txt }
}
