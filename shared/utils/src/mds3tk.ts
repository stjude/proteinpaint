import { dtcnv, dtsnvindel, dtsv, dtfusionrna } from './common.js'

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

/*
ssmid is not specific for ssm, it covers all alterations
gdc ssm are identified by a specific uuid, thus the design
*/
export function guessSsmid(ssmid) {
	const l = ssmid.split(ssmIdFieldsSeparator)
	if (l.length == 4) {
		const [chr, tmp, ref, alt] = l
		const pos = Number(tmp)
		if (Number.isNaN(pos)) throw 'ssmid snvindel pos not integer'
		return { dt: dtsnvindel, l: [chr, pos, ref, alt] }
	}
	if (l.length == 5) {
		// cnv. if type=cat, _value is blank string
		const [chr, _start, _stop, _class, _value] = l
		const start = Number(_start),
			stop = Number(_stop),
			value = _value == '' ? null : Number(_value)
		if (Number.isNaN(start) || Number.isNaN(stop)) throw 'ssmid cnv start/stop not integer'
		return { dt: dtcnv, l: [chr, start, stop, _class, value] }
	}
	if (l.length == 6) {
		if (l[3] == '+' || l[3] == '-') {
			// sv/fusion
			const [_dt, chr, _pos, strand, _pi, _mname] = l

			// mname is encoded in case it contains comma (and is same as ssmIdFieldsSeparator)
			const mname = decodeURIComponent(_mname)
			const dt = Number(_dt)
			if (dt != dtsv && dt != dtfusionrna) throw 'ssmid dt not sv/fusion'
			const pos = Number(_pos)
			if (Number.isNaN(pos)) throw 'ssmid svfusion position not integer'
			const pairlstIdx = Number(_pi)
			if (Number.isNaN(pairlstIdx)) throw 'ssmid pairlstIdx not integer'
			return { dt, l: [dt, chr, pos, strand, pairlstIdx, mname] }
		}
		// cnv with sample
		const [chr, _start, _stop, _class, _value, sample] = l
		const start = Number(_start),
			stop = Number(_stop),
			value = _value == '' ? null : Number(_value) // if cnv not using value, must avoid `Number('')=0`
		if (Number.isNaN(start) || Number.isNaN(stop)) throw 'ssmid cnv start/stop not integer'
		return { dt: dtcnv, l: [chr, start, stop, _class, value, sample] }
	}
	throw 'unknown ssmid'
}
