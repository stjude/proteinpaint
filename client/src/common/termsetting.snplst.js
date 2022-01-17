/* instance attributes

self.term{}
	.type: "snplst"
self.q{}
	.snps[ {} ]
		.rsid: str
		.effectAllele: str
	.alleleType: int
	.geneticModel: int
	.missingGenotype: int
*/

// self is the termsetting instance
export function getHandler(self) {
	return {
		get_term_name(d) {
			return self.q.snps.length + ' SNP' + (self.q.snps.length > 1 ? 's' : '')
		},

		get_status_msg() {
			return ''
		},

		async showEditMenu(div) {
			makeEditMenu(self, div)
		},

		async postMain() {
			// TODO show "loading..." on pill
			await mayValidateSnps(self)
			// close "loading..."
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
		textarea.text(snp2text(self))
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
			if (!self.term) {
				// doesn't have a term, create new one on this instance
				self.term = {
					id: 'dummy.required.by.store',
					name: 'dummy.required.by.store'
				}
				self.q = {}
			}
			// set term type in case the instance had a different term before
			self.term.type = 'snplst'
			self.q.snps = snps
			self.q.alleleType = select_alleleType.property('selectedIndex')
			self.q.geneticModel = select_geneticModel.property('selectedIndex')
			self.q.missingGenotype = select_missingGenotype.property('selectedIndex')
			self.runCallback()
		})
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
	if (!self.q || !self.q.snps) return ''
	const lines = []
	for (const a of self.q.snps) {
		const l = a.rsid + (a.effectAllele ? ' ' + a.effectAllele : '')
		lines.push(l)
	}
	return lines.join('\n')
}

/* snp validation requires finding out #cases with a valid gt call for each snp
will query bigbed to convert to pos, and bcf file
very expensive step
when filter/subcohort changes, the underlying cohort changes and have to rerun validation again
thus the validation must run in postMain()
*/
async function mayValidateSnps(self) {
	if (!self.q || !self.q.snps) return
	const data = await self.vocabApi.validateSnps(snp2text(self), self.filter)
	if (data.error) throw data.error
	console.log(data)
}
