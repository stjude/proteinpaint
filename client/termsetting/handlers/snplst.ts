import { mayRunSnplstTask } from './snplst.sampleSum'
import type { SnpsQ, SnpsTW, SnpsVocabApi, SnpsTerm } from '#types'

/* 
TODO clean up ui logic, may use table.js?

********************* EXPORT
getHandler()
fillTW()
mayRestrictAncestry()
makeSnpSelect()

*********************

storing snps on self.term but not self so it can be written to state,
allow snps to be supplied from self.main(),
and prevent snps from being included in regression request string

instance attributes

self.term{}
	.$id: str
	.id: str, not really used
	.type: "snplst"
	.snps[ {} ]
		.rsid: str
		.effectAllele: str
		// following attributes are computed by validation
		.snpid
		.invalid
		.alleles[ {allele, count, isRef} ]
		.gt2count
self.q{}
	.alleleType: int
	.geneticModel: int
	.missingGenotype: int
	.cacheid
		the cache file name storing the snp-by-sample genotypes, for samples based on current filter
		!!NOTE!! id changes for every validation, e.g. for snp/cohort/filter update

Exports following functions shared with snplocus term
1. makeSnpSelect
2. mayRestrictAncestry
*/

// self is the termsetting instance
export function getHandler(self) {
	return {
		getPillName() {
			return self.term.name
		},

		getPillStatus() {
			if (!self.term?.snps) return
			// return number of invalid entries
			const invalid = self.term.snps.reduce((i, j) => i + (j.invalid || !j.alleles ? 1 : 0), 0)
			if (invalid) return { text: invalid + ' invalid' }
		},

		validateQ(data: any) {
			validateQ(data)
		},

		async showEditMenu(div: any) {
			await makeEditMenu(self, div)
		}
	}
}

/*
ui switches between two modes
1. input ui - show textarea for user to enter snp list and validate
              has "validate" button, click to launch edit ui and do not run callback
2. edit ui  - after validation, table display list of snps and show options
              has "submit" button, click to run callback
			  can click "Back to input" to go back to input ui

if the instance carries snps (self.term.snps), directly enter edit ui
else, enter input ui; after validating raw input, show edit ui
*/
async function makeEditMenu(self, div0: any) {
	const div = div0.append('div').style('margin', '15px')

	const select_ancestry = await mayRestrictAncestry(self, div)

	// input ui holder
	const inputUIholder = div.append('div')

	const textarea = inputUIholder
		.append('textarea')
		.attr('rows', 5)
		.attr('cols', 20)
		.attr('placeholder', 'Enter variants')

	const prompt = inputUIholder.append('div').style('opacity', 0.8).style('font-size', '.8em')

	prompt
		.append('div')
		.html(
			`Enter a list of variants (dbSNP accessions). One variant per line. Max 500 allowed.${
				self.usecase.target == 'dataDownload'
					? ''
					: '<br>Effect alleles (alleles tested against in the analysis) can be specified here or<br>after variant validation.'
			}`
		)

	const exampleInput = [
		{ id: 'rs1641548', effectAllele: 'T' },
		{ id: 'rs4968204', effectAllele: 'C' },
		{ id: 'rs9893249', effectAllele: 'T' },
		{ id: 'rs1042522', effectAllele: 'G' }
	]

	const example1 = prompt
		.append('ul')
		.style('display', 'inline-block')
		.style('list-style-type', 'none')
		.style('padding', '0px')
	const example2 = prompt
		.append('ul')
		.style('display', self.usecase.target == 'dataDownload' ? 'none' : 'inline-block')
		.style('list-style-type', 'none')
		.style('padding', '0px')
		.style('margin-left', '40px')

	example1.append('li').style('text-decoration', 'underline').text('Example:')
	example2.append('li').style('text-decoration', 'underline').text('Example (with effect alleles):')

	for (const variant of exampleInput) {
		example1.append('li').text(variant.id)
		example2.append('li').html(`${variant.id}&nbsp;${variant.effectAllele}`)
	}

	const validateBtn = inputUIholder
		.append('div')
		.style('margin-top', '15px')
		.append('button')
		.text('Validate variants')
		.on('click', async () => {
			// parse input text
			const snps: any = parseSnpFromText(textarea)

			if (!snps.length) return window.alert('No valid variants')

			// have valid input, if no term yet, create new
			if (!self.term) {
				self.term = { id: makeId(), type: 'snplst' } as SnpsTerm
			}
			if (self.term.snps) {
				// append new ones to existing array
				for (const n of snps) {
					if (self.term.snps.find(i => i.rsid == n.rsid)) continue
					self.term.snps.push(n)
				}
			} else {
				self.term.snps = snps
			}
			self.term.name = getTermName(self.term.snps)

			// if self.q already exists, do not overwrite to keep settings e.g. doNotRestrictAncestry
			if (!self.q) self.q = {}

			// don't hide tip only when textarea have values
			self.doNotHideTipInMain = true

			if (self.dom.pill_termname) {
				/* pill ui has already been created
				this is updating snps for an existing term
				as termsetting.js will not call self.enterPill() for pills already there,
				must do this for pill name to update to reflect current number of snps
				*/
				self.dom.pill_termname.text(self.term.name)
			}

			validateBtn.text('Validating...').property('disabled', true)

			try {
				await validateInput(self)
			} catch (e: any) {
				alert('Error: ' + (e.message || e))
				validateBtn.text('Validate variants').property('disabled', false)
				return
			}

			// successfully validated, q.cacheid is set

			// fill default q{} parameters to run summary
			if (!Number.isFinite(self.q.AFcutoff)) {
				self.q.AFcutoff = 5
				input_AFcutoff.property('value', self.q.AFcutoff)
			}

			if (!Number.isInteger(self.q.alleleType)) {
				self.q.alleleType = snps.find(snp => snp.effectAllele) ? 2 : 0
				select_alleleType.property('selectedIndex', self.q.alleleType)
				div.select('.sjpp-allele-type-hint').text(getAlleleTypeHint(select_alleleType))
			}

			if (!Number.isInteger(self.q.geneticModel)) {
				self.q.geneticModel = 0
				select_geneticModel.property('selectedIndex', self.q.geneticModel)
			}

			if (!Number.isInteger(self.q.missingGenotype)) {
				self.q.missingGenotype = 0
				select_missingGenotype.property('selectedIndex', self.q.missingGenotype)
			}

			if (select_ancestry) {
				self.q.restrictAncestry =
					select_ancestry.node().options[select_ancestry.property('selectedIndex')].__ancestry_obj
			}

			await makeSampleSummary(self)

			inputUIholder.style('display', 'none')
			editUIholder.style('display', '')

			if (self.dom.snplst_table) {
				renderSnpEditTable(self, select_alleleType)
			} else {
				initSnpEditTable(snplstTableDiv, self, select_alleleType)
			}
		})

	// edit ui: either directly populate with existing snps, or remain hiden for now and allow input ui to switch to this
	const editUIholder = div.append('div')

	// switch back to input
	editUIholder
		.append('p')
		.append('span')
		.html('&laquo; Back to input')
		.attr('class', 'sja_clbtext')
		.on('click', () => {
			inputUIholder.style('display', '')
			editUIholder.style('display', 'none')
			validateBtn.text('Validate variants').property('disabled', false)
		})

	const snplstTableDiv = editUIholder.append('div').style('margin-bottom', '25px')
	const [input_AFcutoff, select_alleleType, select_geneticModel, select_missingGenotype] = makeSnpSelect(
		editUIholder.append('div').attr('class', 'sjpp-snp-select'),
		self,
		'snplst'
	)

	// hide snp select for data download
	if (self.usecase.target == 'dataDownload') editUIholder.select('.sjpp-snp-select').style('display', 'none')

	// bottom row for submit button and message
	const btnRow = editUIholder.append('div').style('margin-top', '20px')
	btnRow
		.append('button')
		.text('Submit')
		.on('click', async () => {
			self.term.snps = self.term.snps!.filter(i => !i.tobe_deleted)

			if (self.term.snps.find(snp => !snp.effectAllele))
				return window.alert('Effect allele not specified for one or more variants')

			self.term.name = getTermName(self.term.snps)

			if (self.dom.pill_termname) {
				/* pill ui has already been created
				this is updating snps for an existing term
				as termsetting.js will not call self.enterPill() for pills already there,
				must do this for pill name to update to reflect current number of snps
				*/
				self.dom.pill_termname.text(self.term.name)
			}

			try {
				await validateInput(self)
			} catch (e: any) {
				alert('Error: ' + (e.message || e))
			}
			//q.cacheid is set

			{
				const v = Number(input_AFcutoff.property('value'))
				self.q.AFcutoff = v < 0 || v >= 100 ? 5 : v // set to default if invalid
			}
			self.q.alleleType = select_alleleType.property('selectedIndex')
			self.q.geneticModel = select_geneticModel.property('selectedIndex')
			self.q.missingGenotype = select_missingGenotype.property('selectedIndex')
			if (select_ancestry) {
				self.q.restrictAncestry =
					select_ancestry.node().options[select_ancestry.property('selectedIndex')].__ancestry_obj
			}

			await makeSampleSummary(self)

			if (self.dom.snplst_table) {
				renderSnpEditTable(self, select_alleleType)
			} else {
				initSnpEditTable(snplstTableDiv, self, select_alleleType)
			}

			delete self.doNotHideTipInMain

			self.api.runCallback()
			self.updateUI()
		})

	//add a hint
	btnRow
		.append('span')
		.style('padding-left', '15px')
		.style('opacity', 0.8)
		.style('font-size', '.8em')
		.text(
			self.usecase.target == 'dataDownload'
				? ''
				: 'Variants will be treated as separate covariates in the regression model'
		)

	// both input and edit UIs are rendered
	// decide visibility of edit and input UIs

	if (self.term?.snps?.length) {
		// snps given, show "edit mode" ui
		// hide "input mode" ui and restrictAncestries menu
		initSnpEditTable(snplstTableDiv, self, select_alleleType)
		inputUIholder.style('display', 'none')
	} else {
		// snps not given, show "input mode" ui, hide "edit" ui
		editUIholder.style('display', 'none')
		// discard reference to the snplst_table
		// this is necessary if user deletes the snplst variable and
		// adds a new snplst variable
		// when snplst_table is empty then initSnpEditTable will be called (instead of renderSnpEditTable) to build new edit table
		//delete self.dom.snplst_table
	}
}

function initSnpEditTable(div: any, self, select_alleleType: any) {
	self.dom.snplst_table = div.append('table')
	renderSnpEditTable(self, select_alleleType)
	div
		.append('p')
		.style('opacity', 0.8)
		.style('font-size', '.8em')
		.style('display', self.usecase.target == 'dataDownload' ? 'none' : 'block')
		.html('Effect alleles are highlighted in red. Click on an allele to set as the effect allele.')
}

function renderSnpEditTable(self, select_alleleType: any) {
	// allow to delete or add to this list
	self.dom.snplst_table.selectAll('*').remove()
	const title_tr = self.dom.snplst_table.append('tr').style('opacity', 0.4)
	const col_titles = [
		{ title: 'Variants' },
		{ title: '# genotyped<br>samples' },
		{ title: 'Reference allele<br>(frequency)' },
		{ title: 'Alternative allele(s)<br>(frequency)' },
		{ title: 'Genotype<br>(frequency)' },
		{ title: 'Delete' }
	]
	if (self.usecase.target == 'dataDownload') col_titles.splice(4, 1)
	col_titles.forEach(c => {
		title_tr.append('td').html(c.title).style('font-size', '.8em').style('text-align', 'center').style('padding', '8px')
	})

	// SNPs
	if (!self.term.snps) throw `Missing term.snps [snplst.ts renderSnpEditTable()]`
	for (const [i, snp] of self.term.snps.entries()) {
		//const invalid_snp = snp.invalid || (!snp.alleles && !snp.gt2count) ? true : false
		let invalid_snp: boolean | string = false
		if (snp.invalid || (!snp.alleles && !snp.gt2count)) invalid_snp = 'NOT ANNNOTATED IN COHORT'

		const rowcolor = (i + 2) % 2 ? '#eee' : '#fff'
		const tr = self.dom.snplst_table.append('tr').style('background', rowcolor)

		// col 1: rsid
		tr.append('td').text(snp.rsid).style('padding', '8px')

		// col 2: sample count
		const sample_count: any = invalid_snp
			? invalid_snp
			: snp.gt2count
			? Object.values(snp.gt2count).reduce((a: number, b: any) => a + b, 0)
			: `Missing sample count for snp`

		tr.append('td').style('text-align', 'center').text(sample_count)

		// col 3: Reference allele (frequency)
		const ref_allele_td = tr.append('td')

		// col 4: Alternative allele(s) (frequency)
		const alt_allele_td = tr.append('td')

		if (!invalid_snp) {
			if (!snp.alleles) throw `Missing alleles for snp = ${snp} [snplst.ts renderSnpEditTable()]`
			const effectAllele = self.q.snp2effAle ? self.q.snp2effAle[snp.rsid] : undefined
			const refAllele = snp.alleles.find((s: any) => s.isRef)
			const altAlleles = snp.alleles.filter((s: any) => !s.isRef)

			if (self.usecase.target == 'dataDownload') {
				// render ref allele
				const allele_freq = ((refAllele.count * 100) / (sample_count * 2)).toFixed(2)
				const refAlleleText = `${refAllele.allele} (${allele_freq}%)`
				ref_allele_td.style('text-align', 'center').style('padding', '8px').text(refAlleleText)
				// render alt alleles
				const altAllelesText = altAlleles
					.map(al => {
						const allele_freq = ((al.count * 100) / (sample_count * 2)).toFixed(2)
						return `${al.allele} (${allele_freq}%)`
					})
					.join(', ')
				alt_allele_td.style('text-align', 'center').style('padding', '8px').text(altAllelesText)
			} else {
				// create reference allele button
				createAlleleBtn(refAllele, ref_allele_td, effectAllele, sample_count, snp, rowcolor, tr)
				// create alternative allele buttons
				for (const al of altAlleles.values()) {
					createAlleleBtn(al, alt_allele_td, effectAllele, sample_count, snp, rowcolor, tr)
				}
			}
		}

		// col 5: genotype (frequency)
		if (self.usecase.target != 'dataDownload') {
			const gt_td = tr.append('td')
			if (!invalid_snp) {
				const refGT = self.q.snp2refGrp ? self.q.snp2refGrp[snp.rsid] : undefined
				if (!snp.gt2count) throw `Missing gt2count for snp = ${snp} [snplst.ts renderSnpEditTable()]`
				for (const [gt, freq] of Object.entries(snp.gt2count)) {
					//const gt_freq = Math.round((freq * 100) / sample_count)
					const gt_freq = (((freq as number) * 100) / sample_count).toFixed(2)
					const gt_div = gt_td
						.append('div')
						.style('display', 'inline-block')
						.style('border', gt == refGT ? '3px solid #ff0000' : `3px solid ${rowcolor}`)

					gt_div.append('div').style('display', 'inline-block').style('padding', '3px 5px').text(`${gt}`)

					gt_div
						.append('div')
						.style('display', 'inline-block')
						.style('padding', '0px 6px 0px 2px')
						.style('font-size', '.8em')
						.text('(' + `${gt_freq}%` + ')')
				}
			}
		}

		// col 6: delete checkboxes
		const snp_checkbox = tr
			.append('td')
			.style('text-align', 'center')
			.append('input')
			.attr('type', 'checkbox')
			.on('change', () => {
				snp.tobe_deleted = snp_checkbox.node().checked
			})
	}

	function createAlleleBtn(al: any, td: any, effectAllele: any, sample_count: any, snp: any, rowcolor: any, tr: any) {
		//Moved b/c of linter error
		//const allele_freq = Math.round((al.count * 100) / (sample_count * 2))
		const allele_freq = ((al.count * 100) / (sample_count * 2)).toFixed(2)
		const allele_div = td
			.style('text-align', 'center')
			.append('button')
			.style('display', 'inline-block')
			.style('margin', '0px 3px')
			.style('padding', '3px 7px')
			.style('border-radius', '3px')
			.style('background-color', '#d9ead3')
			.style('border', al.allele == effectAllele ? '3px solid #ff0000' : `3px solid ${rowcolor}`)
			.on('mouseover', () => {
				if (snp.effectAllele && snp.effectAllele == al.allele) return
				else {
					allele_div.style('background-color', '#fff2cc').style('cursor', 'pointer')
				}
			})
			.on('mouseout', () => {
				if (snp.effectAllele && snp.effectAllele == al.allele) return
				else {
					allele_div.style('background', '#d9ead3')
				}
			})
			.on('click', () => {
				snp.effectAllele = al.allele
				tr.selectAll('button').style('border', 'none')
				allele_div.style('border', '3px solid #ff0000').style('background', '#d9ead3')
				select_alleleType.selectAll('option').nodes()[2].selected = 'selected'
			})

		allele_div.append('div').style('display', 'inline-block').text(`${al.allele}  `)

		allele_div
			.append('div')
			.style('display', 'inline-block')
			.style('margin', '0px 5px')
			.style('font-size', '.8em')
			.text('(' + `${allele_freq}%` + ')')
	}
}

// not in use
// function updateSnps(snps, _tmp_snps) {
// 	// snp 'deleted' from edit menu or effectAllele changed
// 	for (const [i, s] of snps.entries()) {
// 		const s1 = _tmp_snps.find(snp => snp.rsid == s.rsid)
// 		if (s1 === undefined) {
// 			throw 'snp not found in edit list'
// 		} else if (s1.tobe_deleted) {
// 			// snp selected for deletetion from edit menu, remove from term.snps
// 			snps = snps.filter(s => s.rsid !== s1.rsid)
// 		} else {
// 			// effectAllele changed from edit menu
// 			if (s.effectAllele !== s1.effectAllele) s.effectAllele = s1.effectAllele
// 		}
// 	}
// 	return snps
// }

function getTermName(snps: any) {
	if (snps.length == 1) {
		const s = snps[0]
		if (s.rsid) return s.rsid
		return s.chr + ':' + s.pos
	}
	return snps.length + ' variant' + (snps.length > 1 ? 's' : '')
}

function parseSnpFromText(textarea: any) {
	// may support chr:pos
	const text = textarea.property('value')
	const snps: any = []
	for (const tmp of text.trim().split('\n')) {
		const [rsid, ale] = tmp.trim().split(/[\s\t]/)
		if (!rsid) continue
		if (snps.find((i: any) => i.rsid == rsid)) continue // duplicate
		const s: { rsid: string; effectAllele?: string } = { rsid }
		if (ale) s.effectAllele = ale
		snps.push(s)
	}
	if (snps.length > 500) return snps.slice(0, 500)
	return snps
}

function snp2text(self) {
	if (!self.term || !self.term.snps) return ''
	const lines: any = []
	for (const a of self.term.snps) {
		const l = a.rsid + (a.effectAllele ? ' ' + a.effectAllele : '')
		lines.push(l)
	}
	return lines.join('\n')
}

/* 
Argument
self: may be a termsetting instance or any object

snp validation will query bigbed to convert to pos, and bcf file
very expensive step
will write snp-by-sample gt matrix to a cache file, using all samples from bcf file of this dataset
do not apply sample filtering
*/
async function validateInput(self: any) {
	const data = await self.vocabApi.validateSnps({ text: snp2text(self) })
	if (data.error) throw data.error
	// copy result to instance
	self.q.cacheid = data.cacheid
	if (!self.term.snps) throw `Missing term.snps [snplst.ts validateInput()]`
	for (const [i, s] of self.term.snps.entries()) {
		const s1 = data.snps[i]
		s.snpid = s1.snpid
		s.invalid = s1.invalid
	}
}

/* 
as identical logic will run in regression.input.term updateTerm()
and updated sample summary will be copied back to termsetting instance via pill.main()
only need it to instantly update snp table in menu
thus this function is not needed
if there's a way to automatically update menu then can delete it TODO
*/
async function makeSampleSummary(self) {
	const body = { cacheid: self.q.cacheid }

	// ** duplicated_and_flawed ** logic of handling tw.q.restrictAncestry

	const extraFilters: any = []
	let f!: any // copy of self.filter and to be combined with extraFilters

	if (self.q.restrictAncestry) {
		if (self.filter) {
			// tricky: detect if self.filter contains the same ancestry term
			f = structuredClone(self.filter)
			const idx = f.lst.findIndex(i => i.tvs?.term?.id == (self.q.restrictAncestry.tvs.term as SnpsTerm).id)
			if (idx != -1) {
				// has the same term! must overwrite to avoid two tvs of the same ancestry term, each with a different ancestry which will result in 0 samples
				f.lst[idx] = { type: 'tvs', tvs: self.q.restrictAncestry.tvs }
			} else {
				extraFilters.push({ type: 'tvs', tvs: self.q.restrictAncestry.tvs })
			}
		} else {
			extraFilters.push({ type: 'tvs', tvs: self.q.restrictAncestry.tvs })
		}
	} else {
		if (self.filter) extraFilters.push(self.filter)
	}

	const filter = { type: 'tvslst', join: 'and', lst: [...extraFilters] }
	if (f) filter.lst.push(f)
	const data = await self.vocabApi.getCategories(self.term as SnpsTerm, filter, body)
	mayRunSnplstTask(
		{
			term: self.term as SnpsTerm,
			q: self.q as SnpsQ
		} as any, //quick fix for $id being required in BaseTw type
		data
	)
}

function validateQ(data: any) {
	if (!Number.isFinite(data.q.AFcutoff)) throw 'AFcutoff is not number'
	if (data.q.AFcutoff < 0 || data.q.AFcutoff > 100) throw 'AFcutoff is not within 0 to 100'
	if (![0, 1, 2].includes(data.q.alleleType)) throw 'alleleType value is not one of 0/1'
	if (![0, 1, 2, 3].includes(data.q.geneticModel)) throw 'geneticModel value is not one of 0/1'
	if (![0, 1].includes(data.q.missingGenotype)) throw 'missingGenotype value is not one of 0/1'
}

export async function fillTW(tw: SnpsTW, vocabApi: SnpsVocabApi) {
	try {
		validateQ(tw)
	} catch (e) {
		throw 'snplst validateQ(): ' + e
	}
	if (!Array.isArray(tw.term.snps)) throw 'tw.term.snps[] is not an array'
	if (tw.term.snps.length == 0) throw 'tw.term.snps[] array is 0 length'
	if (!tw.term.name) tw.term.name = getTermName(tw.term.snps)
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
	return 'snplst' + Math.random()
}

/*
shared between snplst and snplocus term type
create following dom elements and return in an array
- AF cutoff <input>
- allele type <select>
- genetic model <select>
- missing gt <select>
  (missing gt is not created for snplocus)

*/
export function makeSnpSelect(div: any, self, termtype: string) {
	let input_AFcutoff_label: any, input_AFcutoff: any, select_missingGenotype: any

	// input - af cutoff
	{
		input_AFcutoff_label = div
			.append('div')
			.style('opacity', 0.5)
			.style('font-size', '.8em')
			.style('margin-bottom', '2px')
			.text('EFFECT ALLELE FREQUENCY CUTOFF')

		self.dom.input_AFcutoff_label = input_AFcutoff_label
		const row = div.append('div')
		input_AFcutoff = row
			.append('input')
			.attr('type', 'number')
			.attr('min', 0)
			.attr('max', 100)
			// default 0.05 to be shown when launching edit menu to create new term
			// if value is set in self.q, will be overwritten later
			.property('value', 5)
			.style('border-color', '#858585')
			.style('margin', '0px')
		row.append('span').text('%')
		let text: string
		if (termtype == 'snplst') {
			// snplst term
			text = 'Variants below this cutoff are discarded'
		} else {
			// snplocus term
			if (self.usecase.regressionType == 'linear') {
				text = 'Variants below this cutoff are analyzed by the Wilcoxon rank sum test'
			} else if (self.usecase.regressionType == 'logistic') {
				text = "Variants below this cutoff are analyzed by the Fisher's exact test"
			} else {
				text = 'Variants below this cutoff are analyzed by the cumulative incidence test'
			}
		}
		row
			.append('span')
			.style('margin-left', '10px')
			.style('opacity', 0.5)
			.style('font-size', '.7em')
			.style('font-style', 'italic')
			.text(text)
	}

	// select - allele type
	div
		.append('div')
		.style('margin-top', '15px')
		.style('opacity', 0.5)
		.style('font-size', '.8em')
		.style('margin-bottom', '2px')
		.text('SET EFFECT ALLELE AS')
	const select_alleleType = div.append('select')
	select_alleleType.append('option').text('Minor allele')
	select_alleleType.append('option').text('Alternative allele')
	if (termtype !== 'snplocus') {
		select_alleleType.append('option').text('Custom allele') //snplocus has two options, snplist has three options
	}

	// hint message to indicate which allele will be used as the effect allele
	// for multi-allelic variants
	div
		.append('div')
		.attr('class', 'sjpp-allele-type-hint')
		.style('display', 'inline-block')
		.style('margin-left', '15px')
		.style('opacity', 0.5)
		.style('font-size', '.7em')
		.style('font-style', 'italic')
		.text(getAlleleTypeHint(select_alleleType))

	select_alleleType.on('change', async () => {
		div.select('.sjpp-allele-type-hint').text(getAlleleTypeHint(select_alleleType))
		self.q.alleleType = select_alleleType.property('selectedIndex')
		if (termtype !== 'snplocus') {
			if (!self.term.snps) throw `Missing term.snps [snplst.ts makeSnpSelect()]`
			for (const snp of self.term.snps) {
				// clear effect alleles when user changes
				// the 'set effect allele as' setting
				snp.effectAllele = false
			}
			await makeSampleSummary(self)
			renderSnpEditTable(self, select_alleleType)
		}
	})

	// select - genetic model
	div
		.append('div')
		.style('margin-top', '15px')
		.style('margin-bottom', '2px')
		.style('opacity', 0.5)
		.style('font-size', '.8em')
		.text('GENETIC MODEL')
	const select_geneticModel = div.append('select')
	select_geneticModel.append('option').text('Additive: EE=2, EN=1, NN=0')
	select_geneticModel.append('option').text('Dominant: EE=1, EN=1, NN=0')
	select_geneticModel.append('option').text('Recessive: EE=1, EN=0, NN=0')
	select_geneticModel.append('option').text('By genotype: EE and EN compared to NN')

	//a hint message to indicate that E = effect allele; N = non-effect allele
	div
		.append('div')
		.style('display', 'inline-block')
		.style('margin-left', '15px')
		.style('opacity', 0.5)
		.style('font-size', '.7em')
		.style('font-style', 'italic')
		.html('E = effect allele; N = non-effect allele')

	// select - missing genotype
	const missingGenotypeLabel = div
		.append('div')
		.style('margin-top', '15px')
		.style('opacity', 0.5)
		.style('font-size', '.7em')
	if (termtype == 'snplocus') {
		// do not create <select> for this option
		missingGenotypeLabel.text('Samples with missing genotypes are dropped.')
	} else {
		missingGenotypeLabel.text('MISSING GENOTYPE').style('font-size', '.8em').style('margin-bottom', '2px')
		select_missingGenotype = div.append('select')
		select_missingGenotype.append('option').text('Impute as homozygous for non-effect allele')
		select_missingGenotype.append('option').text('Drop sample')
	}

	if (Number.isInteger(self.q?.alleleType)) select_alleleType.property('selectedIndex', self.q.alleleType)
	if (Number.isFinite(self.q?.AFcutoff)) input_AFcutoff.property('value', self.q.AFcutoff)
	if (Number.isInteger(self.q?.geneticModel)) select_geneticModel.property('selectedIndex', self.q.geneticModel)
	if (select_missingGenotype && Number.isInteger(self.q?.missingGenotype))
		select_missingGenotype.property('selectedIndex', self.q.missingGenotype)

	return [input_AFcutoff, select_alleleType, select_geneticModel, select_missingGenotype]
}

export async function mayRestrictAncestry(self, holder: any) {
	if (self.q?.doNotRestrictAncestry) return

	const tdbcfg = await self.vocabApi.getTermdbConfig()
	if (!tdbcfg.restrictAncestries) return
	const row = holder.append('div').style('margin-bottom', '15px')
	self.dom.restrictAncestriesRow = row
	row.append('span').text('Restrict analysis to').style('margin-right', '5px').style('opacity', 0.5)
	const select = row.append('select')
	for (const ancestry of tdbcfg.restrictAncestries) {
		// ancestry: {name, tvs}
		const opt = select.append('option').text(ancestry.name)
		opt.node().__ancestry_obj = ancestry
	}
	if (self.q && self.q.restrictAncestry) {
		const i = tdbcfg.restrictAncestries.findIndex((i: any) => i.name == self.q.restrictAncestry!.name)
		if (i == -1) throw 'unknown restrictAncestry: ' + self.q.restrictAncestry.name
		select.property('selectedIndex', i)
	}
	return select
}

// return corresponding hint messages based on the option users select for "SET EFFECT ALLELE AS"
function getAlleleTypeHint(select_alleleType: any) {
	let hint: string
	const i = select_alleleType.property('selectedIndex')
	if (i == 0) {
		hint = 'For multi-allelic variants, the second most common allele is used as the effect allele'
	} else if (i == 1) {
		hint = 'For multi-allelic variants, the most common alternative allele is used as the effect allele'
	} else {
		hint = ''
	}
	return hint
}
