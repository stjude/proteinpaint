import { event as d3event } from 'd3-selection'
import { keyupEnter } from '../client'

// self is the termsetting instance
export function getHandler(self) {
	return {
		get_term_name(d) {
			if (!self.opts.abbrCutoff) return d.name
			return d.name.length <= self.opts.abbrCutoff + 2
				? d.name
				: '<label title="' + d.name + '">' + d.name.substring(0, self.opts.abbrCutoff) + '...' + '</label>'
		},

		get_status_msg() {
			return ''
		},

		async showEditMenu(div) {
			initSetting(self)
			makeEditMenu(self, div)
		}
	}
}

function initSetting(self) {
	// assign default values to missing settings before creating ui
	if (!self.alleleType) self.alleleType = 'major'
	if (!self.geneticModel) self.geneticModel = 'additive'
	if (!self.missingGenotype) self.missingGenotype = 'drop'
}

/* snplst instance can be launched without a term
it will show text area for user to submit the list and create the term
afterwards, it allows user to edit the existing list and associated settings
*/
function makeEditMenu(self, div) {
	// the ui will create following controls, to be accessed upon clicking Submit button
	let textarea, // will be created if no term on self
		select_alleleType,
		select_geneticModel,
		select_missingGenotype

	// table of two columns
	const tr = div
		.append('table')
		.style('margin', '7px')
		.style('border-spacing', '17px')
		.style('border-collapse', 'separate')
		.append('tr')

	// left column
	const tdleft = tr.append('td').style('vertical-align', 'top')

	// temporary implementation: textarea can be created when no term;
	// if there's term, may create controls for each snp for setting up interactions etc
	textarea = tdleft
		.append('textarea')
		.attr('rows', 5)
		.attr('cols', 20)
		.attr('placeholder', 'Enter rs IDs')
	if (self.term) {
		textarea.text(self.term.snps.join('\n'))
	}

	// right column
	const tdright = tr.append('td').style('vertical-align', 'top')

	tdright
		.append('div')
		.style('opacity', 0.4)
		.style('font-size', '.7em')
		.text('ALLELE TYPE')
	select_alleleType = tdright.append('select')
	select_alleleType.append('option').text('Major (d) vs minor (D) from data')
	select_alleleType.append('option').text('Reference (r) vs alternative (A)')
	select_alleleType.property('selectedIndex', self.alleleType == 'major' ? 0 : 1).on('change', updateOptionText)
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
	select_geneticModel.append('option') // genotype
	updateOptionText()
	function setModelOptionText() {
		const is0 = select_alleleType.property('selectedIndex') == 0
		const o = select_geneticModel.node().options
		o[0].innerHTML = 'Additive: ' + (is0 ? 'DD=2, Dd=1, dd=0' : 'AA=2, Ar=1, rr=0')
		o[1].innerHTML = 'Dominant: ' + (is0 ? 'DD=1, Dd=1, dd=0' : 'AA=1, Ar=1, rr=0')
		o[2].innerHTML = 'Recessive: ' + (is0 ? 'DD=1, Dd=0, dd=0' : 'AA=1, Ar=0, rr=0')
		o[3].innerHTML = 'By genotype: ' + (is0 ? 'DD and Dd compared to dd' : 'AA and Ar compared to rr')
	}
}
