////////////////////////////////////
//
//  shared between client and server
//
////////////////////////////////////

import * as common from './common.js'

export default {}

export function init_bulk_flag(genome) {
	if (!genome) {
		return null
	}
	const mclasslabel2key = {}
	for (const n in common.mclass) {
		mclasslabel2key[common.mclass[n].label.toUpperCase()] = n
	}
	return {
		genome: genome,
		mclasslabel2key: mclasslabel2key,
		data: {},
		sample2disease: {}, // (proof) k: sample, v: disease
		// will only record this when origin is used
		patient2st: {},
		// k: patient, v: { k: sampletype, v: sample }
		// new sample names always override old
		good: 0,
		geneToUpper: true, // option to not force uppercase on gene names
		snv: {
			loaded: false,
			header: null,
			badlines: [],
			// jinghui: based on missense/silent ratio of entire dataset to decide whether to include silent when importing...
			// hard-coded class codes
			missense: 0,
			silent: 0
		},
		svjson: {
			loaded: false,
			header: null,
			badlines: []
		},
		fusion: {
			loaded: false,
			header: null,
			badlines: [],
			original: []
		},
		sv: {
			loaded: false,
			header: null,
			badlines: [],
			original: []
		},
		cnv: {
			loaded: false,
			header: null,
			badlines: []
		},
		itd: {
			loaded: false,
			header: null,
			badlines: []
		},
		del: {
			loaded: false,
			header: null,
			badlines: []
		},
		truncation: {
			loaded: false,
			header: null,
			badlines: []
		}
	}
}

export function parsesample(m, flag, i, lst, badline) {
	let variantorigin = common.moriginsomatic
	if (m.sampletype) {
		const s = m.sampletype.toLowerCase()
		switch (s) {
			case 'relapse':
				variantorigin = common.moriginrelapse
				break
			case 'germline':
				variantorigin = common.morigingermline
				break
			case 'somatic':
			case 'diagnosis':
				break
		}
		if (m.sample) {
			if (m.patient) {
				// good
			} else {
				m.patient = m.sample + ' ' + m.sampletype
			}
		} else {
			if (m.patient) {
				m.sample = m.patient + ' ' + m.sampletype
			} else {
				// neither sample or patient, will quit later
			}
		}
	} else {
		if (m.patient) {
			if (m.sample) {
				m.sampletype = m.sample
			} else {
				m.sample = m.sampletype = m.patient
			}
		} else {
			if (m.sample) {
				m.sampletype = m.sample
			} else {
				// no patient/sample, will quit later
			}
		}
	}
	if (m.origin) {
		// override existing variantorigin
		const s = m.origin.toLowerCase()
		switch (s) {
			case 'r':
			case 'relapse':
				variantorigin = common.moriginrelapse
				m.isrim2 = true
				break
			case 'g':
			case 'germline':
				variantorigin = common.morigingermline
				m.isrim1 = true
				break
			case 'gp':
			case 'germline pathogenic':
				variantorigin = common.morigingermlinepathogenic
				m.isrim1 = true
				break
			case 'gnp':
			case 'germline nonpathogenic':
			case 'germline non-pathogenic':
				variantorigin = common.morigingermlinenonpathogenic
				m.isrim1 = true
				break
			case 's':
			case 'somatic':
			case 'diagnosis':
				variantorigin = common.moriginsomatic
				break
		}
	}
	m.origin = variantorigin

	if (!m.sample && !m.patient) {
		// will not go into sample table
		return
	}

	const nopatientname = 'no patient/individual name'
	let p
	if (m.patient) {
		if (!flag.patient2st[m.patient]) {
			flag.patient2st[m.patient] = {}
		}
		flag.patient2st[m.patient][m.sampletype] = m.sample
	} else {
		if (!flag.patient2st[nopatientname]) {
			flag.patient2st[nopatientname] = {}
		}
		flag.patient2st[nopatientname][m.sampletype] = m.sample
	}

	if (m.sample) {
		if (m.disease) {
			if (m.sample in flag.sample2disease) {
				if (m.disease != flag.sample2disease[m.sample]) {
					flag.snv.badlines.push([
						i,
						'conflict of disease types for sample "' +
							m.sample +
							'": ' +
							m.disease +
							', ' +
							flag.sample2disease[m.sample],
						lst
					])
					return true
				}
			} else {
				flag.sample2disease[m.sample] = m.disease
			}
		}
	}
	return false
}
