import { event } from 'd3-selection'
import { makeSnpSelect } from './termsetting.snplst'
import { filterInit, getNormalRoot } from './filter'
import { keyupEnter, get_one_genome, gmlst2loci } from '../client'
import { debounce } from 'debounce'
import { dofetch3 } from './dofetch'
import { Menu } from '../dom/menu'
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
			return { text: `${self.q.chr}:${self.q.start}-${self.q.stop} (n=${self.term.snps.length})` }
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
	const searchbox = add_genesearchbox(self, div)

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
			const tmp = get_coordinput(searchbox)
			if (!tmp) return window.alert('Invalid coordinate')
			event.target.disabled = true
			event.target.innerHTML = 'Validating input...'
			// parse input text
			if (self.term) {
			} else {
				self.term = { id: makeId() }
				self.q = {}
			}
			self.term.type = 'snplocus' // in case self.term was something else..
			self.q.chr = tmp[0]
			self.q.start = tmp[1]
			self.q.stop = tmp[2]
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
	self.q.cacheid = data.cacheid
	self.term.snps = data.snps
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
	const tip = new Menu({ padding: '0px' })
	const row = div.append('div').style('margin', '10px')
	const searchbox = row
		.append('input')
		.attr('type', 'text')
		.attr('placeholder', 'Type gene, position, or SNP')
		.style('width', '200px')
		.on('keyup', async () => {
			const input = event.target
			const v = input.value.trim()
			if (v.length <= 1) return tip.hide()
			if (keyupEnter()) {
				input.blur()
				await search4coord(v)
				return
			}
			if (event.code == 'Escape') {
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
	if (self.q && self.q.chr) {
		searchbox.property('value', self.q.chr + ':' + self.q.start + '-' + self.q.stop)
	}

	async function search4coord(v) {
		const pos = string2pos(v, await get_one_genome(self.vocabApi.getGenomeName()))
		if (pos) {
			hit(pos)
			return
		}
		await geneCoordSearch(v)
	}

	async function geneNameMatch() {
		const v = searchbox.property('value').trim()
		if (!v) return
		tip.showunder(searchbox.node()).clear()
		try {
			const data = await dofetch3('genelookup', {
				method: 'POST',
				body: JSON.stringify({ genome: self.vocabApi.getGenomeName(), input: v })
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
				body: JSON.stringify({ genome: self.vocabApi.getGenomeName(), input: s, deep: 1 })
			})
			if (data.error) throw data.error
			if (!data.gmlst || data.gmlst.length == 0) {
				// replace with self.genome
				const g = await get_one_genome(self.vocabApi.getGenomeName())
				if (g.hasSNP) {
					if (s.toLowerCase().startsWith('rs')) {
						await searchSNP(s)
					} else {
						showErr('Not a gene or SNP')
					}
				} else {
					showErr('No match to gene name')
				}
				return
			}
			const loci = gmlst2loci(data.gmlst)
			if (loci.length == 1) {
				hit(loci[0])
				return
			}
			tip.showunder(searchbox.node()).clear()
			for (const r of loci) {
				tip.d
					.append('div')
					.attr('class', 'sja_menuoption')
					.text(r.name + ' ' + r.chr + ':' + r.start + '-' + r.stop)
					.on('click', () => {
						tip.hide()
						hit(r)
					})
			}
		} catch (e) {
			showErr(e.message || e)
		}
	}

	async function searchSNP(s) {
		const data = await dofetch3('snp', {
			method: 'POST',
			body: JSON.stringify({ byName: true, genome: self.vocabApi.getGenomeName(), lst: [s] })
		})
		if (data.error) throw data.error
		if (!data.results || data.results.length == 0) throw 'Not a SNP'
		const r = data.results[0]
		hit({ chr: r.chrom, start: r.chromStart, stop: r.chromEnd })
	}

	function showErr(msg) {
		tip
			.showunder(searchbox.node())
			.clear()
			.d.append('div')
			.text(msg)
	}

	function hit(r) {
		searchbox.property('value', r.chr + ':' + r.start + '-' + r.stop)
	}

	return searchbox
}

function get_coordinput(searchbox) {
	const v = searchbox.property('value').trim()
	if (!v) return
	const tmp = v.split(/[-:\s]+/)
	if (tmp.length == 3) {
		const start = Number(tmp[1]),
			stop = Number(tmp[2])
		if (Number.isInteger(start) && Number.isInteger(stop)) return [tmp[0], start, stop]
	}
	return null
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
