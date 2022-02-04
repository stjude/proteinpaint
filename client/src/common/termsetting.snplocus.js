import { event } from 'd3-selection'
import { makeSnpSelect } from './termsetting.snplst'

/* 
instance attributes

self.term{}
	.id: str, not really used
	.type: "snplst"
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
			if (!self.term) return
			return { text: self.term.snps.length + ' SNP' + (self.term.snps.length > 1 ? 's' : '') }
		},

		validateQ(data) {
			validateQ(self, data)
		},

		async showEditMenu(div) {
			await makeEditMenu(self, div)
		},

		async postMain() {
			if (self.q.chr) {
				await validateInput(self)
			}
		}
	}
}

async function makeEditMenu(self, div) {
	const searchbox = add_genesearchbox(self, div)

	const tmpinfoarg = await mayDisplayInfoFields(self, div)
	// TODO tmpinfoarg to be replaced with filter api

	// TODO following 3 dropdown controls are identical to snplst and should be shared

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
			const [chr, start, stop] = get_coordinput()
			event.target.disabled = true
			event.target.innerHTML = 'Validating input...'
			// parse input text
			if (self.term) {
			} else {
				self.term = { id: makeId() }
				self.q = {}
			}
			self.term.type = 'snplocus' // in case self.term was something else..
			self.term.name = `SNPs from ${chr}:${start}-${stop}`
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
	self.q.cacheid = data.cacheid
	self.term.snps = data.snps
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
	return searchbox
}

function get_coordinput() {
	return ['chr17', 7674304, 7676849]
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
