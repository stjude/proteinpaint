import { vepinfo } from './common.js'

export function parse_ANN(str, header, m) {
	// snpEff
	if (!header) {
		return null
	}
	for (const thisannotation of str.split(',')) {
		const lst = thisannotation.replace(/&/g, ',').split('|')

		const o = {}

		for (let i = 0; i < header.length; i++) {
			if (lst[i]) {
				o[header[i].name] = lst[i]
			}
		}
		if (!o.Allele) {
			continue
		}
		let allele = null
		for (const a of m.alleles) {
			if (a.allele == o.Allele) {
				allele = a
				break
			}
		}
		if (!allele) {
			// cannot match to allele!!!
			continue
		}
		if (!allele.ann) {
			allele.ann = []
		}
		allele.ann.push(o)
		o._gene = o.Gene_Name
		// isoform
		if (o.Feature_Type && o.Feature_Type == 'transcript' && o.Feature_ID) {
			o._isoform = o.Feature_ID.split('.')[0]
		}
		// class
		if (o.Annotation) {
			const [dt, cls, rank] = vepinfo(o.Annotation)
			o._dt = dt
			o._class = cls
			o._csqrank = rank
		} else {
			// FIXME
			o._dt = dtsnvindel
			o._class = mclassnonstandard
		}
		// mname
		if (o['HGVS.p']) {
			//o._mname=decodeURIComponent(o.HGVSp.substr(o.HGVSp.indexOf(':')+1))
			o._mname = o['HGVS.p']
		} else if (o['HGVS.c']) {
			o._mname = o['HGVS.c']
		} else {
		}
	}
	return true
}
