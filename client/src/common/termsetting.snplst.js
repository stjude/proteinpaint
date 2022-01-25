import { event as d3event } from 'd3-selection'
import { get_effectAllele } from './termsetting.snplst.effAle'

/* 
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
*/

// self is the termsetting instance
export function getHandler(self) {
	return {
		get_term_name(d) {
			return self.term.name
		},

		get_status_msg() {
			return ''
		},

		async showEditMenu(div) {
			makeEditMenu(self, div)
		},

		async postMain() {
			// rerun server-side validation to generate new cache id, and recount samples to account for filter/subcohort change
			if (self.term && self.term.snps) {
				await validateInput(self)
			}
		}
	}
}

function makeEditMenu(self, div) {
	// the ui will create following controls, to be accessed upon clicking Submit button
	let snplst_table, textarea, select_alleleType, select_geneticModel, select_missingGenotype, tmp_snps

	// table has two rows
	const table = div.append('table').style('margin', '15px')

	// first row has 1 <td>, shows snp list
	const snplst_td = table
		.append('tr')
		.append('td')
		.attr('colspan', 2)
	if (self.term && self.term.snps) {
		// show list of snps as well as status for each
		initSnpEditTable()
	}

	// second row has 2 <td>
	const tr = table.append('tr')

	// left column
	const tdleft = tr
		.append('td')
		.style('vertical-align', 'top')
		.style('padding-right', '20px')

	tdleft
		.append('div')
		.style('display', 'none')
		.style('opacity', 0.4)
		.style('font-size', '.7em')
		.style('margin-bottom', '5px')
		.text('ADDITIONAL SNPs')

	textarea = tdleft
		.append('textarea')
		.attr('rows', 5)
		.attr('cols', 20)
		.attr('placeholder', 'Enter rs IDs')
	tdleft
		.append('div')
		.style('opacity', 0.4)
		.style('font-size', '.7em')
		.html('One rs ID per line; define optional<br>effect allele on 2nd column.<br>Separate columns by tab or space.')

	// right column
	const tdright = tr.append('td').style('vertical-align', 'top')

	// select - allele type
	tdright
		.append('div')
		.style('opacity', 0.4)
		.style('font-size', '.7em')
		.text('ALLELE TYPE')
	select_alleleType = tdright.append('select')
	select_alleleType.append('option').text('Major (d) vs minor (D) from data')
	select_alleleType.append('option').text('Reference (r) vs alternative (A)')
	select_alleleType.on('change', updateOptionText)
	// select - genetic model
	tdright
		.append('div')
		.style('margin-top', '10px')
		.style('opacity', 0.4)
		.style('font-size', '.7em')
		.text('GENETIC MODEL')
	select_geneticModel = tdright.append('select')
	select_geneticModel.append('option') // additive
	select_geneticModel.append('option') // dominant
	select_geneticModel.append('option') // recessive
	select_geneticModel.append('option') // by genotype
	// select - missing gt
	tdright
		.append('div')
		.style('margin-top', '10px')
		.style('opacity', 0.4)
		.style('font-size', '.7em')
		.text('MISSING GENOTYPE')
	select_missingGenotype = tdright.append('select')
	select_missingGenotype.append('option').property('selected', self.missingGenotype == 'homo')
	select_missingGenotype
		.append('option')
		.text('Impute numerically as average value')
		.property('selected', self.missingGenotype == 'average')
	select_missingGenotype
		.append('option')
		.text('Drop sample')
		.property('selected', self.missingGenotype == 'average')

	if (self.term) {
		// .term and .q is available on the instance; populate UI with values
		select_alleleType.property('selectedIndex', self.q.alleleType)
		select_geneticModel.property('selectedIndex', self.q.geneticModel)
		select_missingGenotype.property('selectedIndex', self.q.missingGenotype)
	}

	updateOptionText()
	function updateOptionText() {
		// when allele type <select> is changed, update text of some other options
		const is0 = select_alleleType.property('selectedIndex') == 0 // 0 is the choice of major/minor
		const o = select_geneticModel.node().options
		o[0].innerHTML = 'Additive: ' + (is0 ? 'DD=2, Dd=1, dd=0' : 'AA=2, Ar=1, rr=0')
		o[1].innerHTML = 'Dominant: ' + (is0 ? 'DD=1, Dd=1, dd=0' : 'AA=1, Ar=1, rr=0')
		o[2].innerHTML = 'Recessive: ' + (is0 ? 'DD=1, Dd=0, dd=0' : 'AA=1, Ar=0, rr=0')
		o[3].innerHTML = 'By genotype: ' + (is0 ? 'DD and Dd compared to dd' : 'AA and Ar compared to rr')
		select_missingGenotype.node().options[0].innerHTML =
			'Impute as homozygous ' + (is0 ? 'major' : 'reference') + ' allele'
	}

	// submit button
	const submit_btn = div
		.append('button')
		.style('margin', '0px 15px 15px 15px')
		.text(self.term && self.term.snps && self.term.snps.length ? 'Submit' : 'Validate')
		.on('click', async () => {
			// parse input text
			const snps = parseSnpFromText(self, textarea)
			if (self.term) {
				if (!self.term.snps) self.term.snps = [] // possible if term of a different type was there before?
				// already have term;
				// any valid input in textarea are added to existing term
				for (const s of snps) tmp_snps.push(s)
				// update self.term.snps with edit menu snps if changed
				updateSnps(self.term.snps, tmp_snps)
			} else {
				// no term; require valid submission in textarea
				if (!snps.length) return window.alert('No valid SNPs')
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
			submit_btn.property('disabled', true)
			submit_btn.text('Validating SNPs...')
			await validateInput(self)
			await getSnpData(self)
			//q.cacheid is set
			self.q.alleleType = select_alleleType.property('selectedIndex')
			self.q.geneticModel = select_geneticModel.property('selectedIndex')
			self.q.missingGenotype = select_missingGenotype.property('selectedIndex')
			if (snplst_table !== undefined) renderSnpEditTable(snplst_table)
			else initSnpEditTable()
			textarea.property('value', '')
			submit_btn.property('disabled', false)
			submit_btn.text('Submit')
			self.runCallback()
			self.updateUI()
		})

	function initSnpEditTable() {
		snplst_td.style('padding-bottom', '20px')
		snplst_table = snplst_td.append('table')
		renderSnpEditTable(snplst_table)

		snplst_td
			.append('div')
			.style('opacity', 0.4)
			.style('font-size', '.7em')
			.html(
				'Note: Click on allele to make it effect allele.</br>#samples is the number of samples with at least one valid genotype'
			)
	}

	function renderSnpEditTable(snplst_table) {
		tmp_snps = JSON.parse(JSON.stringify(self.term.snps))
		// allow to delete or add to this list
		snplst_table.selectAll('*').remove()
		const title_tr = snplst_table.append('tr').style('opacity', 0.4)
		const col_titles = [
			{ title: 'SNPs' },
			{ title: '#samples' },
			{ title: 'Alleles (frquency)' },
			{ title: 'Genotype (frequency)' }
		]
		col_titles.forEach(c => {
			title_tr
				.append('td')
				.text(c.title)
				.style('font-size', '.8em')
				.style('text-align', 'center')
				.style('padding', '8px')
		})
		// delete button column
		title_tr.append('td')

		// SNPs
		for (const [i, snp] of tmp_snps.entries()) {
			const invalid_snp = snp.invalid || (!snp.alleles && !snp.gt2count) ? true : false
			const tr = snplst_table.append('tr').style('background', (i + 2) % 2 ? '#eee' : 'none')

			// col 1: rsid
			tr.append('td').text(snp.rsid)

			// col 2: sample count
			const sample_count = invalid_snp ? 'INVALID' : Object.values(snp.gt2count).reduce((a, b) => a + b)
			tr.append('td')
				.style('text-align', 'center')
				.text(sample_count)

			// col 3: alleles (frequency)
			const allele_td = tr.append('td')

			if (!invalid_snp) {
				const effectAllele = get_effectAllele(self.q.alleleType, snp)

				for (const [j, al] of snp.alleles.entries()) {
					const allele_freq = Math.round((al.count * 100) / (sample_count * 2))
					const allele_div = allele_td
						.append('button')
						.style('display', 'inline-block')
						.style('margin', '0px 3px')
						.style('padding', '3px 7px')
						.style('border-radius', '3px')
						.style('width', '100px')
						.style('background-color', '#d9ead3')
						.style('border', al.allele == effectAllele ? '2px solid #bbb' : 'none')
						.on('mouseover', () => {
							if (snp.effectAllele  && snp.effectAllele == al.allele) return
							else {
								allele_div.style('background-color', '#fff2cc').style('cursor', 'pointer')
							}
						})
						.on('mouseout', () => {
							if (snp.effectAllele  && snp.effectAllele == al.allele) return
							else {
								allele_div.style('background', '#d9ead3')
							}
						})
						.on('click', () => {
							snp.effectAllele = al.allele
							allele_td.selectAll('button').style('border', 'none')
							allele_div.style('border', '2px solid #bbb').style('background', '#d9ead3')
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
						.text(`${allele_freq}%`)

					// show reference allele tag
					if (al.isRef) {
						allele_div
							.append('div')
							.style('display', 'inline-block')
							.style('padding', '1px 5px')
							.style('border', '1px solid #bbb')
							.style('border-radius', '10px')
							.style('color', '#999')
							.style('font-size', '.5em')
							.text('REF')
					}
				}
			}

			// col 4: genetype (frequency)
			const gt_td = tr.append('td')
			if (!invalid_snp) {
				for (const [gt, freq] of Object.entries(snp.gt2count)) {
					const gt_freq = Math.round((freq * 100) / sample_count)
					gt_td
						.append('div')
						.style('display', 'inline-block')
						.style('padding', '3px 5px')
						.text(`${gt}`)

					gt_td
						.append('div')
						.style('display', 'inline-block')
						.style('padding', '0px 6px 0px 2px')
						.style('font-size', '.8em')
						.text(`${gt_freq}%`)
				}
			}

			// col 6: delete button
			tr.append('td')
				.style('background', '#fff')
				.append('div')
				.style('margin', '3px')
				.style('opacity', 0.4)
				.style('font-size', '.8em')
				.style('cursor', 'pointer')
				.text('DELETE')
				.on('click', () => {
					self.term.snps = self.term.snps.filter(s => s.rsid !== snp.rsid)
					renderSnpEditTable(snplst_table)
				})
		}
	}
}

function updateSnps(snps, tmp_snps) {
	// return if rsids and effect alleles are same for both copy of snps, 
	// as rsid and effect allele are only editable property from edit menu
	if (arrayEquals(snps.map(s=>s.effectAllele), tmp_snps.map(s=>s.effectAllele)) &&
		arrayEquals(snps.map(s=>s.rsid), tmp_snps.map(s=>s.rsid)))
		return
	else {
		// 'deleted' from edit menu
		// check each tw.snps, if missing from tmp_snps, delete it
		for (const [i, s] of snps.entries()) {
			const s1 = tmp_snps.find(snp => snp.rsid == s.rsid)
			// snp deleted from edit menu, remove from tw.snps
			if (s1 === undefined) {
				snps.splice(i, 1)
			} else {
				// effectAllele changed from edit menu 
				if (s.effectAllele !== s1.effectAllele)
				s.effectAllele = s1.effectAllele
			}
		}
		// added from textarea
		// check each tmp_snps, if missing from tw.snps, add it 
		for (const [i, s] of tmp_snps.entries()) {
			const s1 = snps.find(snp => snp.rsid == s.rsid)
			// snp added from text area, add to tmp_snps
			if (s1 === undefined) { snps.push(s) }
		}
	}
}

function arrayEquals(array1, array2) {
	return Array.isArray(array1) &&
    	Array.isArray(array2) &&
    	array1.length === array2.length &&
    	array1.every((v, i) => v === array2[i])
}

function getTermName(snps) {
	if (snps.length == 1) {
		const s = snps[0]
		if (s.rsid) return s.rsid
		return s.chr + ':' + s.pos
	}
	return snps.length + ' SNP' + (snps.length > 1 ? 's' : '')
}

function parseSnpFromText(self, ta) {
	// may support chr:pos
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
	const data = await self.vocabApi.validateSnps(snp2text(self))
	if (data.error) throw data.error
	// copy result to instance
	self.q.cacheid = data.cacheid
	for (const [i, s] of self.term.snps.entries()) {
		const s1 = data.snps[i]
		s.snpid = s1.snpid
		s.invalid = s1.invalid
		s.referenceAllele = s1.referenceAllele
	}
}

async function getSnpData(self) {
	const qlst = [`cacheid=${self.q.cacheid}`]
	const data = await self.vocabApi.getCategories(self.term, self.filter, qlst)
	if (!data) throw `no data for term.id='${self.term.id}'`
	if (data.error) throw data.error
	for (const s of data.snps) {
		// { snpid, alleles{}, gt2count{} }
		const snp = self.term.snps.find(i => i.snpid == s.snpid)
		if (!snp) throw 'snp not found by id'
		snp.alleles = s.alleles
		snp.gt2count = s.gt2count
	}
	self.q.numOfSampleWithAnyValidGT = data.numOfSampleWithAnyValidGT
}

export async function fillTW(tw, vocabApi) {
	if (!tw.q) tw.q = {}
	if (!tw.term.name) tw.term.name = getTermName(tw.term.snps)
	if ('id' in tw) {
		if (!('id' in tw.term)) {
			tw.term.id = tw.id
		}
	} else {
		if (!('id' in tw.term)) tw.term.id = makeId()
		tw.id = tw.term.id
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
