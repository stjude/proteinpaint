import { event } from 'd3-selection'

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
	.chr/start/stop: defines the locus
	.info_fields[ {} ]
		.key
		.label

	.cacheid
		the cache file name storing the snp-by-sample genotypes, for samples based on current filter
		!!NOTE!! id changes for every validation, e.g. for snp/cohort/filter update
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
		},

		async postMain() {
			// rerun server-side validation to generate new cache id, and recount samples to account for filter/subcohort change
			if (self.term && self.term.snps) {
				await validateInput(self)
			}
		}
	}
}

async function makeEditMenu(self, div) {
	// the ui will create following controls, to be accessed upon clicking Submit button
	let searchbox, select_alleleType, select_geneticModel, select_missingGenotype

	add_genesearchbox(self, div)

	const tmpinfoarg = await mayDisplayInfoFields(self, div)
	// TODO tmpinfoarg to be replaced with filter api

	const ctrldiv = div.append('div').style('margin', '10px')

	// select - allele type
	ctrldiv
		.append('div')
		.style('opacity', 0.4)
		.style('font-size', '.7em')
		.text('ALLELE TYPE')
	select_alleleType = ctrldiv.append('select')
	select_alleleType.append('option').text('Major (d) vs minor (D) from data')
	select_alleleType.append('option').text('Reference (r) vs alternative (A)')
	select_alleleType.on('change', updateOptionText)
	// select - genetic model
	ctrldiv
		.append('div')
		.style('margin-top', '10px')
		.style('opacity', 0.4)
		.style('font-size', '.7em')
		.text('GENETIC MODEL')
	select_geneticModel = ctrldiv.append('select')
	select_geneticModel.append('option') // additive
	select_geneticModel.append('option') // dominant
	select_geneticModel.append('option') // recessive
	select_geneticModel.append('option') // by genotype
	// select - missing gt
	ctrldiv
		.append('div')
		.style('margin-top', '10px')
		.style('opacity', 0.4)
		.style('font-size', '.7em')
		.text('MISSING GENOTYPE')
	select_missingGenotype = ctrldiv.append('select')
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
	div
		.append('button')
		.style('margin', '0px 15px 15px 15px')
		.text(self.term && self.term.snps && self.term.snps.length ? 'Submit' : 'Validate')
		.on('click', async () => {
			const [chr, start, stop] = get_coordinput()
			event.target.disabled = true
			event.target.innerHTML = 'Validating input...'
			// parse input text
			if (self.term) {
			} else {
				self.term = { id: makeId() }
				self.q = {}
			}
			self.q.chr = chr
			self.q.start = start
			self.q.stop = stop
			self.q.info_fields = tmpinfoarg
			await validateInput(self)
			// q.cacheid is set

			self.q.alleleType = select_alleleType.property('selectedIndex')
			self.q.geneticModel = select_geneticModel.property('selectedIndex')
			self.q.missingGenotype = select_missingGenotype.property('selectedIndex')

			self.runCallback()
			//self.updateUI()
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
}

function validateQ(self, data) {
	if (![0, 1].includes(data.q.alleleType)) throw 'alleleType value is not one of 0/1'
	if (![0, 1, 2, 3].includes(data.q.geneticModel)) throw 'geneticModel value is not one of 0/1'
	if (![0, 1, 2].includes(data.q.missingGenotype)) throw 'missingGenotype value is not one of 0/1'
}

export async function fillTW(tw, vocabApi) {
	// not done yet!
}

function makeId() {
	return 'snplst' + Math.random()
}

function add_genesearchbox(self, div) {
	const row = div.append('div').style('margin', '10px')
	const searchbox = row
		.append('input')
		.attr('type', 'text')
		.attr('placeholder', 'Type gene, position, or SNP')
		.style('width', '200px')
	// TODO design interactivities for searching gene and snp here
	row
		.append('span')
		.text('Limit range to under 10 Kb')
		.style('margin-left', '20px')
		.style('opacity', 0.5)
	if (self.q && self.q.chr) {
		searchbox.property('value', self.q.chr + ':' + self.q.start + '-' + self.q.stop)
	}
}

function get_coordinput() {
	return ['chr17', 7675517, 7676372]
}

async function mayDisplayInfoFields(self, holder) {
	const info_fields = (await self.vocabApi.get_infofields()).info_fields
	// TODO info fields to be changed to term objects
	if (!info_fields || info_fields.length == 0) return
	const div = holder.append('div').style('margin', '10px')
	// TODO show filter UI after info fields are converted to term objects
	// return filter ui api

	return tempFunction_getinfoarg(info_fields, div)
}

function tempFunction_getinfoarg(lst, div) {
	// temporary function, to be deleted later
	const tmpinfoarg = []
	for (const i of lst) {
		if (!i.isfilter || !i.isactivefilter) continue
		div.append('div').text(i.label)
		const j = { key: i.key }
		if (i.iscategorical) {
			j.iscategorical = true
			j.hiddenvalues = {}
			for (const k of i.values) {
				if (k.ishidden) j.hiddenvalues[k.key] = 1
			}
		} else if (i.isfloat || i.isinteger) {
			j.isnumerical = true
			j.range = i.range
		} else if (i.isflag) {
			j.isflag = true
			j.remove_yes = i.remove_yes
		} else {
			throw 'unknown filter ' + i
		}
		tmpinfoarg.push(j)
	}
	return tmpinfoarg
}
