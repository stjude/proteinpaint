import { event } from 'd3-selection'
import { makeSnpSelect } from './termsetting.snplst'
import { filterInit, getNormalRoot } from './filter'
import { keyupEnter, gmlst2loci } from '../client'
import { debounce } from 'debounce'
import { dofetch3 } from './dofetch'
import { string2pos } from '../coord'

/* 
instance attributes

self.term{}
	.id: str, not really used
	.type: "snplocus"
self.q{}
	.alleleType: int
	.geneticModel: int
	.missingGenotype: int
	.chr/start/stop: defines the locus
	.variant_filter: optional filter root

	.cacheid
		the cache file name storing the snp-by-sample genotypes, for samples based on current filter
		!!NOTE!! id changes for every validation, e.g. for snp/cohort/filter update
*/

const term_name = 'Variants in a locus'

// self is the termsetting instance
export function getHandler(self) {
	return {
		getPillName(d) {
			return self.term.name
		},

		getPillStatus() {
			if (!self.term || !self.q) return
			let text = `${self.q.chr}:${self.q.start}-${self.q.stop}, ${self.term.snps.length} variant${
				self.term.snps.length > 1 ? 's' : ''
			}`
			if (self.term.reachedVariantLimit) {
				text += ' &#9888;'
			}
			return { text }
		},

		validateQ(data) {
			validateQ(self, data)
		},

		async showEditMenu(div) {
			await makeEditMenu(self, div)
		},

		async postMain() {
			if (self.q && self.q.chr) {
				await validateInput(self)
			}
		}
	}
}

async function makeEditMenu(self, div) {
	// lacks a way to validate constructor option based on type-specific logic
	if (!self.opts.genomeObj) throw 'opts.genomeObj{} is required for snplocus termsetting UI'
	const coordResult = add_genesearchbox(self, div)

	await mayDisplayVariantFilter(self, div)

	const [select_alleleType, select_geneticModel, select_missingGenotype] = makeSnpSelect(
		div.append('div').style('margin', '10px'),
		self
	)

	// submit button
	div
		.append('button')
		.style('margin', '0px 15px 15px 15px')
		.text('Submit')
		.on('click', async () => {
			if (!coordResult.chr) return window.alert('Invalid coordinate')
			event.target.disabled = true
			event.target.innerHTML = 'Validating input...'
			// parse input text
			if (self.term) {
			} else {
				self.term = { id: makeId() }
				self.q = {}
			}
			self.term.type = 'snplocus' // in case self.term was something else..
			self.q.chr = coordResult.chr
			self.q.start = coordResult.start
			self.q.stop = coordResult.stop
			self.term.name = term_name
			self.q.variant_filter = getNormalRoot(self.variantFilter.active)
			await validateInput(self)
			// q.cacheid is set

			self.q.alleleType = select_alleleType.property('selectedIndex')
			self.q.geneticModel = select_geneticModel.property('selectedIndex')
			self.q.missingGenotype = select_missingGenotype.property('selectedIndex')

			self.runCallback()
		})

	div
		.append('div')
		.style('display', 'inline-block')
		.style('margin', '5px')
		.style('opacity', 0.4)
		.style('font-size', '.7em')
		.text('Must press Submit button to apply changes.')
}

/* 
Argument
self: may be a termsetting instance or any object

snp validation will query bigbed to convert to pos, and bcf file
very expensive step
will write snp-by-sample gt matrix to a cache file, using all samples from bcf file of this dataset
do not apply sample filtering
*/
async function validateInput(self) {
	const data = await self.vocabApi.validateSnps(self.q)
	if (data.error) throw data.error
	// copy result to instance
	self.q.cacheid = data.cacheid
	self.term.snps = data.snps
	self.term.reachedVariantLimit = data.reachedVariantLimit
}

function validateQ(self, data) {
	const q = data.q
	if (![0, 1].includes(q.alleleType)) throw 'alleleType value is not one of 0/1'
	if (![0, 1, 2, 3].includes(q.geneticModel)) throw 'geneticModel value is not one of 0/1'
	if (![0, 1, 2].includes(q.missingGenotype)) throw 'missingGenotype value is not one of 0/1'
	if (!q.chr) throw 'chr missing'
	if (!Number.isInteger(q.start)) throw 'start coordinate is not integer'
	if (!Number.isInteger(q.stop)) throw 'stop coordinate is not integer'
	if (q.start < 0) throw 'start < 0'
	if (q.stop <= q.start) throw 'stop <= start'
}

export async function fillTW(tw, vocabApi) {
	try {
		// to catch any error in q{} before running validateInput()
		validateQ(null, tw)
	} catch (e) {
		throw 'snplocus validateQ(): ' + e
	}
	if (!tw.term.name) tw.term.name = term_name
	if (tw.id == undefined || tw.id == '') {
		// tw is missing id
		if (tw.term.id == undefined || tw.term.id == '') {
			// tw.term is also missing id
			tw.term.id = makeId()
		}
		tw.id = tw.term.id
	} else {
		if (tw.term.id == undefined || tw.term.id == '') {
			tw.term.id = tw.id
		}
	}

	await validateInput({
		term: tw.term,
		q: tw.q,
		vocabApi
	})
}

function makeId() {
	return 'snplocus' + Math.random()
}

function add_genesearchbox(self, div) {
	// some code duplication with block.js
	const tip = self.dom.tip2

	const row = div.append('div').style('margin', '10px')

	row
		.append('div')
		.text('Type gene, position, or SNP')
		.style('font-size', '.7em')
		.style('opacity', 0.4)

	const searchbox = row
		.append('input')
		.attr('type', 'text')
		.attr('placeholder', 'Search')
		.style('width', '200px')
		.on('focus', () => {
			event.target.select()
		})
		.on('keyup', async () => {
			const input = event.target
			const v = input.value.trim()
			if (v.length <= 1) return tip.hide()
			if (keyupEnter()) {
				input.blur()
				// pressed enter, try to parse input as coordinate string e.g. chr:pso
				const pos = string2pos(v, self.opts.genomeObj)
				if (pos) {
					// input is coordinate
					getResult(pos, 'Valid coordinate')
					return
				}
				// input is not coord; see if matches with a gene and can be converted to coord
				await geneCoordSearch(v)
				return
			}
			if (event.code == 'Escape') {
				// abandon changes to <input>
				tip.hide()
				if (self.q && self.q.chr) {
					input.value = self.q.chr + ':' + self.q.start + '-' + self.q.stop
				}
				input.blur()
				return
			}
			if (v.length > 6) return
			debouncer()
		})
	searchbox.node().focus()

	const searchStat = {
		mark: row.append('span').style('margin-left', '5px'),
		word: row
			.append('span')
			.style('margin-left', '5px')
			.style('font-size', '.8em')
			.style('opacity', 0.6)
	}

	async function geneNameMatch() {
		const v = searchbox.property('value').trim()
		if (!v) return
		tip.showunder(searchbox.node()).clear()
		try {
			const data = await dofetch3('genelookup', {
				method: 'POST',
				body: JSON.stringify({ genome: self.opts.genomeObj.name, input: v })
			})
			if (data.error) throw data.error
			if (!data.hits || data.hits.length == 0) return tip.hide()
			for (const s of data.hits) {
				tip.d
					.append('div')
					.text(s)
					.attr('class', 'sja_menuoption')
					.on('click', () => {
						geneCoordSearch(s)
					})
			}
		} catch (e) {
			tip.d.append('div').text(e.message || e)
		}
	}
	const debouncer = debounce(geneNameMatch, 300)

	async function geneCoordSearch(s) {
		tip.hide()
		try {
			const data = await dofetch3('genelookup', {
				method: 'POST',
				body: JSON.stringify({ genome: self.opts.genomeObj.name, input: s, deep: 1 })
			})
			if (data.error) throw data.error
			if (!data.gmlst || data.gmlst.length == 0) {
				// no match to gene
				if (self.opts.genomeObj.hasSNP) {
					if (s.toLowerCase().startsWith('rs')) {
						// genome has snp and input looks like a snp
						await searchSNP(s)
					} else {
						getResult(null, 'Not a gene or SNP')
					}
				} else {
					getResult(null, 'No match to gene name')
				}
				return
			}
			// matches with some isoforms
			const loci = gmlst2loci(data.gmlst)
			if (loci.length == 1) {
				// all isoforms are at the same locus
				getResult(loci[0], s)
				return
			}
			// isoform are spread across multiple discontinuous loci
			tip.showunder(searchbox.node()).clear()
			for (const r of loci) {
				tip.d
					.append('div')
					.attr('class', 'sja_menuoption')
					.text(r.name + ' ' + r.chr + ':' + r.start + '-' + r.stop)
					.on('click', () => {
						tip.hide()
						getResult(r, r.name)
					})
			}
		} catch (e) {
			getResult(null, e.message || e)
		}
	}

	async function searchSNP(s) {
		const data = await dofetch3('snp', {
			method: 'POST',
			body: JSON.stringify({ byName: true, genome: self.opts.genomeObj.name, lst: [s] })
		})
		if (data.error) throw data.error
		if (!data.results || data.results.length == 0) throw 'Not a gene or SNP'
		const r = data.results[0]
		getResult({ chr: r.chrom, start: r.chromStart, stop: r.chromEnd }, s)
	}

	const result = {}
	if (self.q && self.q.chr) {
		searchbox.property('value', self.q.chr + ':' + self.q.start + '-' + self.q.stop)
		result.chr = self.q.chr
		result.start = self.q.start
		result.stop = self.q.stop
	}

	function getResult(r, fromWhat) {
		// call to show a valid result, or error
		// if result is valid, provide r: {chr,start,stop} to show coord in <input>, also show &check;
		// if result is invalid, r is null, show &cross;
		// fromWhat is optional gene or snp name to show in search stat
		if (r) {
			searchbox.property('value', r.chr + ':' + r.start + '-' + r.stop)
			result.chr = r.chr
			result.start = r.start
			result.stop = r.stop
			searchStat.mark.style('color', 'green').html('&check;')
		} else {
			searchStat.mark.style('color', 'red').html('&cross;')
		}
		searchStat.word.text(fromWhat)
	}

	return result //searchbox
}

async function mayDisplayVariantFilter(self, holder) {
	if (!self.variantFilter) {
		self.variantFilter = await self.vocabApi.get_variantFilter()
	}
	if (self.q && self.q.variant_filter) {
		// use existing filter
		self.variantFilter.active = JSON.parse(JSON.stringify(self.q.variant_filter))
	} else {
		// use default filter from dataset
		self.variantFilter.active = JSON.parse(JSON.stringify(self.variantFilter.filter))
	}
	const filter = self.variantFilter.active
	const terms = self.variantFilter.terms
	if (!filter || !terms || !terms.length) return
	const div = holder.append('div').style('margin', '15px 15px 15px 10px')
	div
		.append('div')
		.text('VARIANT FILTERS')
		.style('font-size', '.7em')
		.style('opacity', 0.4)

	filterInit({
		joinWith: self.variantFilter.opts.joinWith,
		emptyLabel: '+Variant Filter',
		holder: div.append('div'),
		vocab: { terms },
		callback: filter => {
			self.variantFilter.active = filter
			// user must press submit button to attach current filter to self.q{}
		}
	}).main(filter)
}
