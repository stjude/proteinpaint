import { dtcnv } from './common.js'

// this script should contain mds3 track-related stuff shared between client and backend

/*
the separator is used to join essential bits of a variant obj into a string as the "ssm_id", aims to uniquely identify a variant irrespective of sample
this is to mimic the GDC "ssm_id" which is a random id, with below benefits:
- consistent way to pass request body for both gdc and non-gdc
- uniform identification of ssm/cnv/sv in non-gdc backend code
- uniform identification of all variants in client

ssm: chr + pos + ref + alt
cnv:  chr + start + stop + class
svfusion: dt + chr + pos + strand + pairlstidx + mname

the separator must avoid conflicting with characters from gene names, and can be changed based on needs
*/
export const ssmIdFieldsSeparator = '__'

/*
input: array of mixture of ssm, svfusion and cnv

output: sorted array. each element: [ class/dt, count of m ]
*/
export function summarize_mclass(mlst) {
	const m2c = new Map() // k: mclass, v: {}
	const cnvs = []
	for (const m of mlst) {
		if (m.dt == dtcnv) {
			cnvs.push(m)
			continue // process cnv later
		}
		// snvindel has m.class=str, svfusion has only dt=int
		const key = m.class || m.dt
		m2c.set(key, 1 + (m2c.get(key) || 0))
	}

	if (cnvs.length) {
		if (Number.isFinite(cnvs[0].value)) {
			// first cnv uses numeric value (assumes all the same). record by dt
			m2c.set(dtcnv, cnvs.length)
		} else {
			// cnv not numeric and uses class; record by each class
			for (const c of cnvs) {
				if (!c.class) continue // should not happen
				m2c.set(c.class, 1 + (m2c.get(c.class) || 0))
			}
		}
	}
	return [...m2c].sort((i, j) => j[1] - i[1])
}
