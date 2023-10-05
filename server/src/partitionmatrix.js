/*
opts {}
.sample2term Map
	k: sample
	v: Map
		k: term id
		v: value id
.terms[]
	each ele a term obj
.termlst[]
	TODO
	predefined ordered term id list as 1 dimension
allow to divide sample to groups, and separately partition each group
allow to filter samples, restricting contents in samplelst_unordered[]

assumptions:
1. samples are always automatically ordered, and no predefined order
2. when ordering blocks, unannotated block is always the last one

returns:
termlst[{}]
	.id
	.name
	.samplecount
	.blocks[ {} ]
		.value  // may be missing for a block of samples unannotated by this term
		.samplecount
		.color
		.children[] // available for all blocks
*/

export function draw_partition(opts) {
	validateOpts(opts)
	const termlst = get_termlst(opts)

	const samplelst_unordered = getSampleLst_unordered(opts, termlst)
	// for grouped samples, samplelst is a nested array and iterate through it with partition_byterms

	partition_byterms(opts, termlst, samplelst_unordered)
	tidyup(termlst, opts)

	set_symbolic_blockwidth(termlst)

	return termlst
}

function validateOpts(opts) {
	if (!opts.sample2term) throw '.sample2term missing'
	if (!opts.terms) throw '.terms[] missing'
	if (!opts.config) throw '.config{} missing'
}

function get_termlst(opts) {
	const term2count = new Map()
	// k: term id
	// v: number of samples annotated by this term
	for (const t2v of opts.sample2term.values()) {
		for (const termid of t2v.keys()) {
			term2count.set(termid, 1 + (term2count.get(termid) || 0))
		}
	}
	if (opts.config.termidorder) {
		// predefined order
		const lst = []
		for (const id of opts.config.termidorder) {
			const samplecount = term2count.get(id)
			if (samplecount == undefined) continue
			lst.push({ id, samplecount })
		}
		return lst
	}
	// sort to descending order
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
superblocks: [ {} ]
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
			const thisblock = {
				value: i[0],
				samples: i[1],
				children: []
			}
			blocks.push(thisblock)
			if (sb.children) sb.children.push(thisblock)
		}
		if (notannotated.length) {
			const thisgap = {
				isgap: true,
				samples: notannotated,
				children: []
			}
			blocks.push(thisgap)
			if (sb.children) sb.children.push(thisgap)
		}
	}
	return blocks
}

function tidyup(termlst, opts) {
	for (const t of termlst) {
		const t0 = opts.terms.find(i => i.id == t.id)
		t.name = t0.name
		for (const b of t.blocks) {
			b.samplecount = b.samples.length
			delete b.samples
			if (b.value) {
				b.color = t0.values[b.value].color
			}
		}
	}
}

function set_symbolic_blockwidth(termlst) {
	for (let i = termlst.length - 1; i >= 0; i--) {
		const term = termlst[i]
		for (const b of term.blocks) {
			let symbolwidth_children = 0
			for (const c of b.children) {
				symbolwidth_children += c.symbolwidth
			}
			const selfsymbolwidth = b.isgap ? 1 : b.samplecount.toString().length
			b.symbolwidth = Math.max(selfsymbolwidth, symbolwidth_children)
		}
	}
	let x = 0
	for (const b of termlst[0].blocks) {
		b.x = x
		let cx = x
		for (const c of b.children) {
			c.x = cx
			cx += c.symbolwidth
		}
		x += b.symbolwidth
	}
	for (let i = 1; i < termlst.length; i++) {
		for (const b of termlst[i].blocks) {
			let cx = b.x
			for (const c of b.children) {
				c.x = cx
				cx += c.symbolwidth
			}
		}
	}
	for (const t of termlst) delete t.children
}
