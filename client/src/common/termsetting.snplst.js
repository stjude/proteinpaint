import { event as d3event } from 'd3-selection'

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
		.alleles
		//.validgtcount
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

/*
scenario I
when user accesses snplst option from noTermPromptOptions, this termsetting instance is "blank"
clicking Submit button from this UI will create self.term and self.q
it's important to note that, before clicking Submit, user can still hide the menu,
and launch another option from noTermPromptOptions.
thus, this UI must not alter self attributes (term and q) until Submit is created
to avoid creating attributes on self that's irrelevant to the new term

scenario II
self.term is set, either recovered from state, or from user input in scenario I
both .term and .q should be present
run the same ui code but is populated with existing settings
user can make changes to snp list, and other controls
and must click Submit to save
*/
function makeEditMenu(self, div) {
	// the ui will create following controls, to be accessed upon clicking Submit button
	let textarea, select_alleleType, select_geneticModel, select_missingGenotype

	// table of two columns
	const tr = div
		.append('table')
		.style('margin', '15px')
		.append('tr')

	// left column
	const tdleft = tr
		.append('td')
		.style('vertical-align', 'top')
		.style('padding-right', '20px')

	if (self.term && self.term.snps) {
		// show list of snps as well as status for each: {invalid, alleles, validgtcount}
		// allow to delete or add to this list
		let rowcount = 0,
			maxAllelCount = 0,
			maxGenotypeCount = 0
		maxAllelCount = Math.max.apply(Math, self.term.snps.map(s => s.allele2count).map(o => Object.keys(o).length))
		maxGenotypeCount = Math.max.apply(Math, self.term.snps.map(s => s.gt2count).map(o => Object.keys(o).length))

		const splst_table = tdleft
			.append('table')
			.style('font-size', '.8em')
			.style('padding', '5px')

		const title_tr = splst_table.append('tr').style('opacity', 0.4)
		const col_titles = [
			{ title: 'SNPs' },
			{ title: 'Valid' },
			{ title: '#samples' },
			{ title: 'Alleles (frquency)', colspan: maxAllelCount },
			{ title: 'Genotype (frequency)', colspan: maxGenotypeCount }
		]
		col_titles.forEach((c, i) => {
			title_tr
				.append('td')
				.text(c.title)
				.attr('colspan', c.colspan || 1)
				.style('padding', '8px')
		})
		// delete button column
		title_tr.append('td')

		// SNPs
		for (const snp of self.term.snps) {
			console.log(snp)
			const tr = splst_table.append('tr').style('background', rowcount++ % 2 ? '#eee' : 'none')

			// col 1: rsid
			tr.append('td').text(snp.rsid)

			// col 2: valid
			tr.append('td')
				.style('text-align', 'center')
				.style('color', snp.invalid ? 'red' : 'green')
				.html(snp.invalid ? '&#10060;' : '&#10003;')

			// col 3: sample count
			const sample_count = Object.values(snp.gt2count).reduce((a, b) => a + b)
			tr.append('td').text(sample_count)

			// col 4: alleles (frequency)
			for (const [allele, freq] of Object.entries(snp.allele2count)) {
				tr.append('td')
					.style('padding', '3px')
					// .style('display','inline-block')
					.style('border-radius', '3px')
					.style('border', allele == snp.effectAllele ? '2px solid #bbb' : '')
					.text(`${allele} (${freq})`)
			}

			// col 5: genetype (frequency)
			for (const [gt, freq] of Object.entries(snp.gt2count)) {
				tr.append('td')
					.style('padding', '0 3px')
					.text(`${gt} (${freq})`)
			}

			// col 6: delete button
			tr.append('td')
				.append('button')
				.style('margin', '3px')
				.text('Remove')
		}
	}

	// temporary implementation: textarea can be created when no term;
	// if there's term, may instead create controls for each snp for setting up interactions etc
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

	// if (self.term && self.term.snps) {
	// 	// TODO show list of snps as well as status for each: {invalid, alleles, validgtcount}
	// 	// allow to delete or add to this list
	// }

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
		// textarea.text(snp2text(self))
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
	div
		.append('button')
		.style('margin', '0px 15px 15px 15px')
		.text('Submit')
		.on('click', async () => {
			// parse input text
			const snps = parseSnpFromText(textarea)
			if (snps.length == 0) return window.alert('No valid SNPs')
			// a snplst term is expected to not have a term.id
			if (!self.term) self.term = {}
			if (!self.q) self.q = {}
			// set term type in case the instance had a different term before
			self.term.type = 'snplst'
			self.term.name = getTermName(snps)
			self.term.snps = snps
			d3event.target.disabled = true
			d3event.target.innerHTML = 'Validating SNPs...'
			await validateInput(self)
			// self.term.id is now cache file name
			self.q.alleleType = select_alleleType.property('selectedIndex')
			self.q.geneticModel = select_geneticModel.property('selectedIndex')
			self.q.missingGenotype = select_missingGenotype.property('selectedIndex')
			self.dom.tip.hide()
			self.updateUI()
			self.runCallback()
		})
}

function getTermName(snps) {
	if (snps.length == 1) {
		const s = snps[0]
		if (s.rsid) return s.rsid
		return s.chr + ':' + s.pos
	}
	return snps.length + ' SNP' + (snps.length > 1 ? 's' : '')
}

function parseSnpFromText(ta) {
	// may support chr:pos
	const text = ta.property('value')
	const snps = []
	for (const tmp of text.trim().split('\n')) {
		const [rsid, ale] = tmp.trim().split(/[\s\t]/)
		if (rsid) {
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
	}
}

export async function fillTW(tw, vocabApi) {
	if (!tw.q) tw.q = {}
	if (!tw.term.name) tw.term.name = getTermName(tw.term.snps)
	await validateInput({
		term: tw.term,
		q: tw.q,
		vocabApi
	})
}
