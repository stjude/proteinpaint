import { stratinput } from '#shared/tree.js'
import { stratify } from 'd3-hierarchy'
import { scaleOrdinal } from 'd3-scale'
import { schemeCategory20 } from '#common/legacy-d3-polyfill'

/* legacy implementation, to work with "legacy" dataset
can be deleted when dataset is migrated to mds3
*/

export function validate_oldds(ds) {
	// old official ds
	if (ds.geneexpression) {
		if (ds.geneexpression.maf) {
			try {
				ds.geneexpression.maf.get = new Function(...ds.geneexpression.maf.get)
			} catch (e) {
				return 'invalid Javascript for get() of expression.maf of ' + ds.label
			}
		}
	}
	if (ds.cohort) {
		if (ds.cohort.raw && ds.cohort.tosampleannotation) {
			/*
			tosampleannotation triggers converting ds.cohort.raw to ds.cohort.annotation
			*/
			if (!ds.cohort.key4annotation) {
				return 'cohort.tosampleannotation in use by .key4annotation missing of ' + ds.label
			}
			if (!ds.cohort.annotation) {
				ds.cohort.annotation = {}
			}
			let nosample = 0
			for (const a of ds.cohort.raw) {
				const sample = a[ds.cohort.tosampleannotation.samplekey]
				if (sample) {
					const b = {}
					for (const k in a) {
						b[k] = a[k]
					}
					ds.cohort.annotation[sample] = b
				} else {
					nosample++
				}
			}
			if (nosample) return nosample + ' rows has no sample name from sample annotation of ' + ds.label
			delete ds.cohort.tosampleannotation
		}
		if (ds.cohort.levels) {
			if (ds.cohort.raw) {
				// to stratify
				// cosmic has only level but no cohort info, buried in snvindel
				const nodes = stratinput(ds.cohort.raw, ds.cohort.levels)
				ds.cohort.root = stratify()(nodes)
				ds.cohort.root.sum(i => i.value)
			}
		}
		if (ds.cohort.raw) {
			delete ds.cohort.raw
		}
		ds.cohort.suncolor = scaleOrdinal(schemeCategory20)
	}
	if (ds.snvindel_attributes) {
		for (const at of ds.snvindel_attributes) {
			if (at.get) {
				try {
					at.get = new Function(...at.get)
				} catch (e) {
					return 'invalid Javascript for getter of ' + JSON.stringify(at)
				}
			} else if (at.lst) {
				for (const at2 of at.lst) {
					if (at2.get) {
						try {
							at2.get = new Function(...at2.get)
						} catch (e) {
							return 'invalid Javascript for getter of ' + JSON.stringify(at2)
						}
					}
				}
			}
		}
	}
	if (ds.stratify) {
		if (!Array.isArray(ds.stratify)) {
			return 'stratify is not an array in ' + ds.label
		}
		for (const strat of ds.stratify) {
			if (!strat.label) {
				return 'stratify method lacks label in ' + ds.label
			}
			if (strat.bycohort) {
				if (!ds.cohort) {
					return 'stratify method ' + strat.label + ' using cohort but no cohort in ' + ds.label
				}
			} else {
				if (!strat.attr1) {
					return 'stratify method ' + strat.label + ' not using cohort but no attr1 in ' + ds.label
				}
				if (!strat.attr1.label) {
					return '.attr1.label missing in ' + strat.label + ' in ' + ds.label
				}
				if (!strat.attr1.k) {
					return '.attr1.k missing in ' + strat.label + ' in ' + ds.label
				}
			}
		}
	}

	if (ds.url4variant) {
		// quick fix for clinvar
		for (const u of ds.url4variant) {
			u.makelabel = new Function(...u.makelabel)
			u.makeurl = new Function(...u.makeurl)
		}
	}

	// no checking vcfinfofilter
	// no population freq filter
}
