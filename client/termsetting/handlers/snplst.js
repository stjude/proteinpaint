import { mayRunSnplstTask } from './snplst.sampleSum'

/* 
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
		getPillName(d) {
			return self.term.name
		},

		getPillStatus() {
			if (!self.term || !self.term.snps) return
			// return number of invalid entries
			const invalid = self.term.snps.reduce((i, j) => i + (j.invalid || !j.alleles ? 1 : 0), 0)
			if (invalid) return { text: invalid + ' invalid' }
		},

		validateQ(data) {
			validateQ(self, data)
		},

		async showEditMenu(div) {
			await makeEditMenu(self, div)
		}
	}
}

let snplst_table, textarea, tmp_snps, select_alleleType
async function makeEditMenu(self, div) {
	const select_ancestry = await mayRestrictAncestry(self, div)

	// table has two rows
	const table = div.append('table').style('margin', '5px 10px 30px 10px')

	// first row has 1 <td>, shows snp list
	const snplst_td = table
		.append('tr')
		.append('td')
		.attr('colspan', 2)
		.style('display', 'none')

	// second row has 2 <td>
	const tr = table.append('tr')

	// left column
	const tdleft = tr
		.append('td')
		.style('vertical-align', 'top')
		.style('padding-right', '20px')

	textarea = tdleft
		.append('textarea')
		.attr('rows', 5)
		.attr('cols', 20)
		.attr('placeholder', 'Enter variants')
	tdleft
		.append('div')
		.style('opacity', 0.4)
		.style('font-size', '.7em')
		.html(
			'One variant per line. Variant rsID in first column and optional effect allele in second column.<br><br>Effect allele is allele that will be used for testing in regression analysis.<br><br>Example:'
		)
		.append('div')
		.style('padding-top', '5px')
		.html('rs1641548<br>rs1642793 C<br>rs1042522<br>rs1642782 G')

	// right column
	const tdright = tr.append('td').style('vertical-align', 'top')
	const snpSelect = makeSnpSelect(tdright, self, 'snplst')
	const input_AFcutoff = snpSelect[0]
	select_alleleType = snpSelect[1]
	const select_geneticModel = snpSelect[2]
	const select_missingGenotype = snpSelect[3]

	if (self.term && self.term.snps && self.term.snps.length) {
		// snps given, generate snplst table
		// hide submission text box and restrictAncestries menu
		snplst_td.style('display', '')
		tdleft.style('display', 'none')
		self.dom.restrictAncestriesRow.remove()
		initSnpEditTable(snplst_td, self, select_alleleType)
	} else {
		// snps not given
		// hide setting options
		tdright.style('display', 'none')
		// empty the snplst_table
		// this is necessary if user deletes the snplst variable and
		// adds a new snplst variable
		// when snplst_table is empty then initSnpEditTable will be called (instead of renderSnpEditTable) to build new edit table
		snplst_table = undefined
	}

	// submit button
	const submit_btn = div
		.append('button')
		.style('margin', '0px 15px 15px 15px')
		.text(self.term && self.term.snps && self.term.snps.length ? 'Submit' : 'Validate variants')
		.on('click', async () => {
			snplst_td.style('display', '')
			// parse input text
			const snps = parseSnpFromText(self)
			if (snps.length && snps.find(snp => snp.effectAllele)) {
				// if user provides custom effect allele in input text
				// then set the select_alleleType option to be 'custom'
				select_alleleType.selectAll('option').nodes()[2].selected = 'selected'
			}
			if (self.term) {
				if (!self.term.snps) self.term.snps = [] // possible if term of a different type was there before?
				// already have term;
				// any valid input in textarea are added to existing term
				for (const s of snps) tmp_snps.push(s)
				// update self.term.snps with edit menu snps if changed
				self.term.snps = updateSnps(self.term.snps)
			} else {
				// no term; require valid submission in textarea
				if (!snps.length) return window.alert('No valid variants')
				// have valid input; create new term
				self.term = { id: makeId(), snps } // term does not have id
				self.q = {} // q does not have mode
			}
			if (snps.length) {
				// don't hide tip only when textarea have values
				self.doNotHideTipInMain = true
			}
			// set term type in case the instance had a different term before
			self.term.type = 'snplst'
			self.term.name = getTermName(self.term.snps)
			if (self.dom.pill_termname) {
				/* pill ui has already been created
				this is updating snps for an existing term
				as termsetting.js will not call self.enterPill() for pills already there,
				must do this for pill name to update to reflect current number of snps
				*/
				self.dom.pill_termname.text(self.term.name)
			}
			submit_btn.property('disabled', true)
			submit_btn.text('Validating variants...')
			try {
				await validateInput(self)
			} catch (e) {
				alert('Error: ' + (e.message || e))
			}
			//q.cacheid is set

			//after user gives valid input, hide the rsIDs input textbox and show the setting options
			if (self.term && self.term.snps && self.term.snps.length) {
				tdleft.style('display', 'none')
				tdright.style('display', 'inline-block')
				self.dom.restrictAncestriesRow.remove()
			}

			{
				const v = Number(input_AFcutoff.property('value'))
				self.q.AFcutoff = v <= 0 || v >= 100 ? 5 : v // set to default if invalid
			}
			self.q.alleleType = select_alleleType.property('selectedIndex')
			self.q.geneticModel = select_geneticModel.property('selectedIndex')
			self.q.missingGenotype = select_missingGenotype.property('selectedIndex')
			if (select_ancestry) {
				self.q.restrictAncestry = select_ancestry.node().options[
					select_ancestry.property('selectedIndex')
				].__ancestry_obj
			}

			await makeSampleSummary(self)

			if (snplst_table !== undefined) renderSnpEditTable(self, select_alleleType)
			else initSnpEditTable(snplst_td, self, select_alleleType)
			textarea.property('value', '')
			submit_btn.property('disabled', false)
			submit_btn.text('Submit')
			self.runCallback()
			self.updateUI()
			buttonHint.style('display', 'inline-block') //shown the submit button hint for the submit button on second window
		})

	//add a submit button hint when button is "Submit" not when button is "Validate Variants"
	const buttonHint = div
		.append('div')
		.style('display', 'inline-block')
		.style('margin', '5px')
		.style('opacity', 0.4)
		.style('font-size', '.7em')
		.text('Must press Submit button to apply changes.')
	if (!(self.term && self.term.snps && self.term.snps.length)) {
		buttonHint.style('display', 'none')
	}
}

function initSnpEditTable(snplst_td, self, select_alleleType) {
	snplst_td.style('padding-bottom', '25px')
	snplst_table = snplst_td.append('table')
	renderSnpEditTable(self, select_alleleType)

	snplst_td
		.append('div')
		.style('opacity', 0.4)
		.style('font-size', '.7em')
		.style('padding-top', '5px')
		.html(
			'<sup><b>*</b></sup> Number of samples with at least one valid genotype.<br><sup><b>**</b></sup>Effect alleles are highlighted in red. Click on an allele to set as the effect allele.'
		)
}

function renderSnpEditTable(self, select_alleleType) {
	tmp_snps = JSON.parse(JSON.stringify(self.term.snps))
	// allow to delete or add to this list
	snplst_table.selectAll('*').remove()
	const title_tr = snplst_table.append('tr').style('opacity', 0.4)
	const col_titles = [
		{ title: 'Variants' },
		{ title: 'No. samples<sup><b>*</b></sup>' },
		{ title: 'Reference allele<sup><b>**</b></sup><br>(frequency)' },
		{ title: 'Alternative allele(s)<sup><b>**</b></sup><br>(frequency)' },
		{ title: 'Genotype<br>(frequency)' },
		{ title: 'Delete' }
	]
	col_titles.forEach(c => {
		title_tr
			.append('td')
			.html(c.title)
			.style('font-size', '.8em')
			.style('text-align', 'center')
			.style('padding', '8px')
	})

	// SNPs
	for (const [i, snp] of tmp_snps.entries()) {
		//const invalid_snp = snp.invalid || (!snp.alleles && !snp.gt2count) ? true : false
		let invalid_snp = false
		if (snp.invalid) {
			invalid_snp = snp.invalid
		} else if (!snp.alleles && !snp.gt2count) {
			invalid_snp = 'NOT ANNNOTATED IN COHORT'
		}

		const rowcolor = (i + 2) % 2 ? '#eee' : '#fff'
		const tr = snplst_table.append('tr').style('background', rowcolor)

		// col 1: rsid
		tr.append('td')
			.text(snp.rsid)
			.style('padding', '8px')

		// col 2: sample count
		const sample_count = invalid_snp ? invalid_snp : Object.values(snp.gt2count).reduce((a, b) => a + b)
		tr.append('td')
			.style('text-align', 'center')
			.text(sample_count)

		// col 3: Reference allele (frequency)
		const ref_allele_td = tr.append('td')

		// col 4: Alternative allele(s) (frequency)
		const alt_allele_td = tr.append('td')

		if (!invalid_snp) {
			const effectAllele = self.q.snp2effAle ? self.q.snp2effAle[snp.rsid] : undefined
			const refAllele = snp.alleles.find(s => s.isRef)
			const altAlleles = snp.alleles.filter(s => !s.isRef)

			// create reference allele button
			createAlleleBtn(refAllele, ref_allele_td)
			// create alternative allele buttons
			for (const [j, al] of altAlleles.entries()) {
				createAlleleBtn(al, alt_allele_td)
			}

			function createAlleleBtn(al, td) {
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

				allele_div
					.append('div')
					.style('display', 'inline-block')
					.text(`${al.allele}  `)

				allele_div
					.append('div')
					.style('display', 'inline-block')
					.style('margin', '0px 5px')
					.style('font-size', '.8em')
					.text('(' + `${allele_freq}%` + ')')
			}
		}

		// col 5: genotype (frequency)
		const gt_td = tr.append('td')
		if (!invalid_snp) {
			const refGT = self.q.snp2refGrp ? self.q.snp2refGrp[snp.rsid] : undefined
			for (const [gt, freq] of Object.entries(snp.gt2count)) {
				//const gt_freq = Math.round((freq * 100) / sample_count)
				const gt_freq = ((freq * 100) / sample_count).toFixed(2)
				const gt_div = gt_td
					.append('div')
					.style('display', 'inline-block')
					.style('border', gt == refGT ? '3px solid #ff0000' : `3px solid ${rowcolor}`)

				gt_div
					.append('div')
					.style('display', 'inline-block')
					.style('padding', '3px 5px')
					.text(`${gt}`)

				gt_div
					.append('div')
					.style('display', 'inline-block')
					.style('padding', '0px 6px 0px 2px')
					.style('font-size', '.8em')
					.text('(' + `${gt_freq}%` + ')')
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
}

function updateSnps(snps) {
	// snp 'deleted' from edit menu or effectAllele changed
	for (const [i, s] of snps.entries()) {
		const s1 = tmp_snps.find(snp => snp.rsid == s.rsid)
		if (s1 === undefined) {
			throw 'snp not found in edit list'
		} else if (s1.tobe_deleted) {
			// snp selected for deletetion from edit menu, remove from term.snps
			snps = snps.filter(s => s.rsid !== s1.rsid)
		} else {
			// effectAllele changed from edit menu
			if (s.effectAllele !== s1.effectAllele) s.effectAllele = s1.effectAllele
		}
	}
	return snps
}

function getTermName(snps) {
	if (snps.length == 1) {
		const s = snps[0]
		if (s.rsid) return s.rsid
		return s.chr + ':' + s.pos
	}
	return snps.length + ' variant' + (snps.length > 1 ? 's' : '')
}

function parseSnpFromText(self) {
	// may support chr:pos
	const ta = textarea
	const text = ta.property('value')
	const snps = []
	for (const tmp of text.trim().split('\n')) {
		const [rsid, ale] = tmp.trim().split(/[\s\t]/)
		if (rsid) {
			// snp already in list, don't add again
			if (self.term && self.term.snps && self.term.snps.find(i => i.rsid == rsid)) continue
			if (snps.find(i => i.rsid == rsid)) continue // duplicate
			const s = { rsid }
			if (ale) s.effectAllele = ale
			snps.push(s)
		}
	}
	return snps
}

function snp2text(self) {
	if (!self.term || !self.term.snps) return ''
	const lines = []
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
async function validateInput(self) {
	const data = await self.vocabApi.validateSnps({ text: snp2text(self) })
	if (data.error) throw data.error
	// copy result to instance
	self.q.cacheid = data.cacheid
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
	const qlst = [`cacheid=${self.q.cacheid}`]

	// ** duplicated_and_flawed ** logic of handling tw.q.restrictAncestry
	const extraFilters = []
	if (self.q.restrictAncestry) extraFilters.push({ type: 'tvs', tvs: self.q.restrictAncestry.tvs })
	const filter = { type: 'tvslst', join: 'and', lst: [...extraFilters] }
	if (self.filter) filter.lst.push(self.filter)
	const data = await self.vocabApi.getCategories(self.term, filter, qlst)
	mayRunSnplstTask({ term: self.term, q: self.q }, data)
}

function validateQ(self, data) {
	if (!Number.isFinite(data.q.AFcutoff)) throw 'AFcutoff is not number'
	if (data.q.AFcutoff < 0 || data.q.AFcutoff > 100) throw 'AFcutoff is not within 0 to 100'
	if (![0, 1, 2].includes(data.q.alleleType)) throw 'alleleType value is not one of 0/1'
	if (![0, 1, 2, 3].includes(data.q.geneticModel)) throw 'geneticModel value is not one of 0/1'
	if (![0, 1, 2].includes(data.q.missingGenotype)) throw 'missingGenotype value is not one of 0/1'
}

export async function fillTW(tw, vocabApi) {
	try {
		validateQ(null, tw)
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
export function makeSnpSelect(div, self, termtype) {
	let input_AFcutoff_label, input_AFcutoff, select_geneticModel, select_missingGenotype

	// input - af cutoff
	{
		input_AFcutoff_label = div
			.append('div')
			.style('opacity', 0.4)
			.style('font-size', '.7em')
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
		row.append('span').text('%')
		let text
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
			.text(text)
	}

	// select - allele type
	div
		.append('div')
		.style('margin-top', '10px')
		.style('opacity', 0.4)
		.style('font-size', '.7em')
		.text('SET EFFECT ALLELE AS')
	select_alleleType = div.append('select')
	select_alleleType.append('option').text('Minor allele')
	select_alleleType.append('option').text('Alternative allele')
	if (termtype !== 'snplocus') {
		select_alleleType.append('option').text('Custom allele') //snplocus has two options, snplist has three options
	}
	select_alleleType.on('change', async () => {
		for (const snp of self.term.snps) {
			// clear effect alleles when user changes
			// the 'set effect allele as' setting
			snp.effectAllele = false
		}
		self.q.alleleType = select_alleleType.property('selectedIndex')
		await makeSampleSummary(self)
		renderSnpEditTable(self, select_alleleType)
	})

	// select - genetic model
	div
		.append('div')
		.style('margin-top', '10px')
		.style('opacity', 0.4)
		.style('font-size', '.7em')
		.text('GENETIC MODEL')
	select_geneticModel = div.append('select')
	select_geneticModel.append('option').text('Additive: EE=2, EN=1, NN=0')
	select_geneticModel.append('option').text('Dominant: EE=1, EN=1, NN=0')
	select_geneticModel.append('option').text('Recessive: EE=1, EN=0, NN=0')
	select_geneticModel.append('option').text('By genotype: EE and EN compared to NN')

	//a hint message to indicate that E = effect allele; N = non-effect allele
	div
		.append('div')
		.style('display', 'inline-block')
		.style('margin-left', '15px')
		.style('opacity', 0.4)
		.style('font-size', '.7em')
		.html('E = effect allele; N = non-effect allele')

	// select - missing genotype
	const missingGenotypeLabel = div
		.append('div')
		.style('margin-top', '10px')
		.style('opacity', 0.4)
		.style('font-size', '.7em')
	if (termtype == 'snplocus') {
		// do not create <select> for this option
		missingGenotypeLabel.text('Samples with missing genotypes are dropped.')
	} else {
		missingGenotypeLabel.text('MISSING GENOTYPE')
		select_missingGenotype = div.append('select')
		select_missingGenotype.append('option').text('Impute as homozygous for non-effect allele')
		select_missingGenotype.append('option').text('Drop sample')
	}

	if (self.term) {
		// .term and .q is available on the instance; populate UI with values
		input_AFcutoff.property('value', self.q.AFcutoff)
		select_alleleType.property('selectedIndex', self.q.alleleType)
		select_geneticModel.property('selectedIndex', self.q.geneticModel)
		if (select_missingGenotype) {
			select_missingGenotype.property('selectedIndex', self.q.missingGenotype)
		}
	}

	return [input_AFcutoff, select_alleleType, select_geneticModel, select_missingGenotype]
}

export async function mayRestrictAncestry(self, holder) {
	const tdbcfg = await self.vocabApi.getTermdbConfig()
	if (!tdbcfg.restrictAncestries) return
	const row = holder.append('div').style('margin', '15px')
	self.dom.restrictAncestriesRow = row
	row
		.append('span')
		.text('Restrict analysis to')
		.style('margin-right', '5px')
		.style('opacity', 0.5)
	const select = row.append('select')
	for (const ancestry of tdbcfg.restrictAncestries) {
		// ancestry: {name, tvs}
		const opt = select.append('option').text(ancestry.name)
		opt.node().__ancestry_obj = ancestry
	}
	if (self.q && self.q.restrictAncestry) {
		const i = tdbcfg.restrictAncestries.findIndex(i => i.name == self.q.restrictAncestry.name)
		if (i == -1) throw 'unknown restrictAncestry: ' + self.q.restrictAncestry.name
		select.property('selectedIndex', i)
	}
	return select
}
