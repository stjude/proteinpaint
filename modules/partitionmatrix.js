/*
opts {}
.sample2term Map
	k: sample
	v: Map
		k: term id
		v: value id
.terms[]
	each ele a term obj

TODO
.termlst[]
	predefined ordered term id list as 1 dimension
allow to divide sample to groups, and separately partition each group
allow to filter samples, restricting contents in samplelst_unordered[]

assumptions:
1. samples are always automatically ordered, and no predefined order
*/

exports.draw_partition = opts => {
	validateOpts(opts)
	const termlst = getTermLst_autorank(opts)

	const samplelst_unordered = getSampleLst_unordered(opts, termlst)

	partition_byterms(opts, termlst, samplelst_unordered)

	for (const t of termlst) {
		t.name = opts.terms.find(i => i.id == t.id).name
		for (const b of t.blocks) {
			b.samplecount = b.samples.length
			delete b.samples
		}
	}
	return termlst
}

function validateOpts(opts) {
	if (!opts.sample2term) throw '.sample2term missing'
	if (!opts.terms) throw '.terms missing'
	if (!opts.config) {
		// default config
		opts.config = {}
	}
}

function getTermLst_autorank(opts) {
	const term2count = new Map()
	// k: term id
	// v: number of samples annotated by this term
	for (const terms of opts.sample2term.values()) {
		for (const termid of terms.keys()) {
			term2count.set(termid, 1 + (term2count.get(termid) || 0))
		}
	}
	const tmp = [...term2count].sort((i, j) => j[1] - i[1])
	return tmp.map(i => {
		return { id: i[0], samplecount: i[1] }
	})
}

function getSampleLst_unordered(opts, termlst) {
	const samplelst = []
	for (const [samplenamestr, k2v] of opts.sample2term) {
		if (termlst.find(t => k2v.has(t.id))) {
			samplelst.push(samplenamestr)
		}
	}
	return samplelst
}

function partition_byterms(opts, termlst, samplelst) {
	for (const [i, term] of termlst.entries()) {
		const superblocks = i == 0 ? [{ samples: samplelst }] : termlst[i - 1].blocks
		term.blocks = divide2blocks(superblocks, term.id, opts)
	}
}

function divide2blocks(superblocks, termid, opts) {
	/*
superblocks: [ [] ]
	each ele an array of sample names
*/
	const blocks = []
	for (const sb of superblocks) {
		const value2samples = new Map()
		const notannotated = []
		for (const sample of sb.samples) {
			const termid2value = opts.sample2term.get(sample)
			if (termid2value) {
				const value = termid2value.get(termid)
				if (value == undefined) {
					notannotated.push(sample)
				} else {
					if (!value2samples.has(value)) value2samples.set(value, [])
					value2samples.get(value).push(sample)
				}
			} else {
				notannotated.push(sample)
			}
		}
		const lst = [...value2samples].sort((i, j) => j[1].length - i[1].length)
		for (const i of lst) {
			blocks.push({ value: i[0], samples: i[1] })
		}
		if (notannotated.length) blocks.push({ samples: notannotated })
	}
	return blocks
}
