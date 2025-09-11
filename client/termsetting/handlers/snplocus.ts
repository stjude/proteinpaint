import { makeSnpSelect, mayRestrictAncestry } from './snplst'
import { filterInit, getNormalRoot } from '#filter'
import { addGeneSearchbox } from '#dom'
import type { SnpsTW, SnpsQ, SnpsVocabApi, SnpsTerm } from '#types'

/* 
***************** EXPORT
getHandler()
fillTW()
mayDisplayVariantFilter()

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
		getPillName() {
			return self.term.name
		},

		getPillStatus() {
			if (!self.term || !self.q) return
			if (!self.term.snps) throw `Missing term.snps [snplocs.ts getPillStatus()]`
			let text = `${self.q.chr}:${self.q.start}-${self.q.stop}, ${self.term.snps.length} variant${
				self.term.snps.length > 1 ? 's' : ''
			}`
			if (self.term.reachedVariantLimit) {
				text +=
					'<span style="margin-left: 6px; background:#aaa; font-size:1em;font-style: normal; border-radius: 7px;color:white;padding:0px 5px;">&#9888;<span>'
			}
			return { text }
		},

		validateQ(data: any) {
			validateQ(data)
		},

		async showEditMenu(div: any) {
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

async function makeEditMenu(self, div0: any) {
	const div = div0.append('div').style('margin', '15px')

	const select_ancestry = await mayRestrictAncestry(self, div)

	const coordResult = addGeneSearchbox({
		genome: self.opts.genomeObj,
		tip: self.dom.tip2,
		row: div.append('div').style('margin-top', '20px'),
		defaultCoord: self.q && self.q.chr ? { chr: self.q.chr, start: self.q.start, stop: self.q.stop } : undefined
	})

	div.select('.sja_genesearchinput').style('margin', '0px')

	div
		.append('span')
		.style('margin', '5px 0px')
		.style('display', 'inline-block')
		.style('opacity', 0.4)
		.style('font-size', '.7em')
		.html(
			'"Gene": Gene name (e.g. AKT1)</br>"Position": chr:start-stop (e.g. chr1:5000-6000)</br>"dbSNP": dbSNP accession (e.g. rs1042522)'
		)

	await mayDisplayVariantFilter(self, self.q?.variant_filter, div)

	const [input_AFcutoff, select_alleleType, select_geneticModel] = makeSnpSelect(
		div.append('div').attr('class', 'sjpp-snp-select').style('margin-top', '15px'),
		self,
		'snplocus'
	)

	// hide snp select for data download
	if (self.usecase.target == 'dataDownload') div.select('.sjpp-snp-select').style('display', 'none')

	// submit button
	const btnRow = div.append('div').style('margin-top', '15px')
	btnRow
		.append('button')
		.style('margin-top', '15px')
		.text('Submit')
		.on('click', async event => {
			if (!coordResult.chr) return window.alert('Invalid coordinate')
			event.target.disabled = true
			event.target.innerHTML = 'Validating input...'
			// parse input text
			if (self.term) {
				//ignore
			} else {
				self.term = { id: makeId() } as SnpsTerm
			}

			// if self.q already exists, do not overwrite to keep settings e.g. doNotRestrictAncestry
			if (!self.q) self.q = {}

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
				self.q.AFcutoff = v < 0 || v >= 100 ? 5 : v // set to default if invalid
			}
			self.q.alleleType = select_alleleType.property('selectedIndex')
			self.q.geneticModel = select_geneticModel.property('selectedIndex')
			if (select_ancestry) {
				// ancestry restriction is optional
				self.q.restrictAncestry =
					select_ancestry.node().options[select_ancestry.property('selectedIndex')].__ancestry_obj
			}

			self.api.runCallback()
		})

	btnRow
		.append('span')
		.style('padding-left', '15px')
		.style('opacity', 0.8)
		.style('font-size', '.8em')
		.text(
			self.usecase.target == 'dataDownload' ? '' : 'Variants will be treated individually in separate regression models'
		)
}

/* 
Argument
self: may be a termsetting instance or any object
snp validation will write snp-by-sample gt matrix to a cache file, using all samples from bcf file of this dataset
do not apply sample filtering
*/
async function validateInput(self: any) {
	const data = await self.vocabApi.validateSnps(self.q)
	if (data.error) throw data.error
	// copy result to instance
	self.q.cacheid = data.cacheid
	self.term.snps = data.snps
	self.term.reachedVariantLimit = data.reachedVariantLimit
}

function validateQ(data: any) {
	const q = data.q as SnpsQ
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

export async function fillTW(tw: SnpsTW, vocabApi: SnpsVocabApi) {
	try {
		// to catch any error in q{} before running validateInput()
		validateQ(tw)
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

/*
self { vocabApi }
	.variantFilter{} is attached to it
filterInState{}
	optional filter obj, tracked in state
callback2
	optional callback to run upon filter update, no parameter
*/
async function mayDisplayVariantFilter(self, filterInState: any, holder: any, callback2?: any) {
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

	if (filterInState) {
		// use existing filter
		self.variantFilter.active = JSON.parse(JSON.stringify(filterInState))
	} else {
		// use default filter from dataset
		self.variantFilter.active = JSON.parse(JSON.stringify(self.variantFilter.filter))
	}
	const div = holder.append('div').style('margin-top', '15px')

	div.append('span').text('VARIANT FILTERS').style('font-size', '.8em').style('opacity', 0.5)

	const filterBody = div.append('div')

	filterInit({
		joinWith: self.variantFilter.opts.joinWith,
		emptyLabel: '+Variant Filter',
		holder: filterBody,
		vocab: { terms: self.variantFilter.terms },
		callback: async filter => {
			// once the filter is updated from UI, it's only updated here
			// user must press submit button to attach current filter to self.q{}
			self.variantFilter.active = filter
			if (callback2) await callback2()
		}
	}).main(self.variantFilter.active)
}
