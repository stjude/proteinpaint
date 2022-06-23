import { event } from 'd3-selection'
import { makeSnpSelect, mayRestrictAncestry } from './snplst'
import { filterInit, getNormalRoot } from '#filter'
import { addGeneSearchbox } from '#dom/genesearch'

/* 
***************** EXPORT
getHandler()
fillTW()

***************** instance attributes

self.term{}
	.id: str, not really used
	.type: "snplocus"
	.snps[]
self.q{}
	.alleleType: int
	.geneticModel: int
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
				text +=
					'<span style="margin-left: 6px; background:#aaa; font-size:1em;font-style: normal; border-radius: 7px;color:white;padding:0px 5px;">&#9888;<span>'
			}
			return { text }
		},

		validateQ(data) {
			validateQ(self, data)
		},

		async showEditMenu(div) {
			await makeEditMenu(self, div)
		}

		/* no need for postMain()
		cache file contains all samples,
		variants in a cache file is only determined by locus range and info fields
		thus no need to regenerate cache file upon subcohort or filter change via pill.main()
		async postMain() {
			if (self.q && self.q.chr) {
				await validateInput(self)
			}
		}
		*/
	}
}

async function makeEditMenu(self, div) {
	const select_ancestry = await mayRestrictAncestry(self, div)

	const coordResult = addGeneSearchbox({
		genome: self.opts.genomeObj,
		tip: self.dom.tip2,
		row: div.append('div').style('margin', '15px'),
		defaultCoord: self.q && self.q.chr ? { chr: self.q.chr, start: self.q.start, stop: self.q.stop } : null
	})

	await mayDisplayVariantFilter(self, div)

	const [input_AFcutoff, select_alleleType, select_geneticModel] = makeSnpSelect(
		div.append('div').style('margin', '15px'),
		self,
		'snplocus'
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

			/* in case term.snps[] is present, must delete old list of snp
			as by pressing Submit button it will query variants from updated region/info filter
			and must reassign term.snps[]
			must delete term.snps so validateInput will assign new snps to term
			*/
			delete self.term.snps
			self.q.variant_filter = getNormalRoot(self.variantFilter.active)
			await validateInput(self)
			// q.cacheid is set
			// self.term.snps[] is set

			{
				const v = Number(input_AFcutoff.property('value'))
				self.q.AFcutoff = v <= 0 || v >= 100 ? 5 : v // set to default if invalid
			}
			self.q.alleleType = select_alleleType.property('selectedIndex')
			self.q.geneticModel = select_geneticModel.property('selectedIndex')
			if (select_ancestry) {
				// ancestry restriction is optional
				self.q.restrictAncestry = select_ancestry.node().options[
					select_ancestry.property('selectedIndex')
				].__ancestry_obj
			}

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
snp validation will write snp-by-sample gt matrix to a cache file, using all samples from bcf file of this dataset
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
	if (!Number.isFinite(q.AFcutoff)) throw 'AFcutoff is not number'
	if (q.AFcutoff < 0 || q.AFcutoff > 100) throw 'AFcutoff is not within 0 to 100'
	if (![0, 1].includes(q.alleleType)) throw 'alleleType value is not one of 0/1'
	if (![0, 1, 2, 3].includes(q.geneticModel)) throw 'geneticModel value is not one of 0/1'
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

async function mayDisplayVariantFilter(self, holder) {
	if (!self.variantFilter) {
		self.variantFilter = await self.vocabApi.get_variantFilter()
		// variantFilter should be {opts{}, filter{}, terms[]}
		// can be empty object if this dataset does not have info filter
	}
	if (!self.variantFilter.terms) {
		// this dataset does not have info filter
		return
	}
	if (!self.variantFilter.opts) throw 'variantFilter.opts{} missing'
	if (!self.variantFilter.filter) throw '.filter missing from variantFilter{}'
	if (!Array.isArray(self.variantFilter.terms) || self.variantFilter.terms.length == 0)
		throw 'variantFilter.terms[] is not non-empty array'

	if (self.q && self.q.variant_filter) {
		// use existing filter
		self.variantFilter.active = JSON.parse(JSON.stringify(self.q.variant_filter))
	} else {
		// use default filter from dataset
		self.variantFilter.active = JSON.parse(JSON.stringify(self.variantFilter.filter))
	}
	const div = holder.append('div').style('margin', '15px')
	div
		.append('div')
		.text('VARIANT FILTERS')
		.style('font-size', '.7em')
		.style('opacity', 0.4)

	filterInit({
		joinWith: self.variantFilter.opts.joinWith,
		emptyLabel: '+Variant Filter',
		holder: div.append('div'),
		vocab: { terms: self.variantFilter.terms },
		callback: filter => {
			// once the filter is updated from UI, it's only updated here
			// user must press submit button to attach current filter to self.q{}
			self.variantFilter.active = filter
		}
	}).main(self.variantFilter.active)
}
