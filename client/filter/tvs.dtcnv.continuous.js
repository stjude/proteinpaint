import { handler as _handler } from './tvs.dt.js'
import { Menu } from '../dom/menu'

/*
TVS handler for dtcnv term (continuous cnv data)
*/

export const handler = Object.assign({}, _handler, { type: 'dtcnv', fillMenu, get_pill_label })

async function fillMenu(self, div, tvs) {
	div.style('margin', '10px')
	const tip = new Menu({ padding: '5px' })

	div.append('div').style('margin-bottom', '10px').text('Specify criteria for a CNV alteration:')

	const settingsDiv = div.append('div').style('margin-left', '10px')

	// get cnv cutoff values
	const termdbConfig = self.opts.vocabApi.termdbConfig || self.opts.vocabApi.parent_termdbConfig
	const cnvObj = termdbConfig.queries?.cnv
	const cnvDefault = {
		cnvMaxLength: cnvObj.cnvMaxLength,
		cnvGainCutoff: cnvObj.cnvGainCutoff,
		cnvLossCutoff: cnvObj.cnvLossCutoff
	}
	const cnv = cnvObj.cnvCutoffsByGene?.[tvs.term.parentTerm.name] || cnvDefault

	let cnvGainCutoff
	if (cnv.cnvGainCutoff) {
		cnvGainCutoff = tvs.cnvGainCutoff || cnv.cnvGainCutoff
		const cnvGainDiv = settingsDiv.append('div').style('margin-bottom', '5px')
		cnvGainDiv.append('span').style('opacity', 0.7).text('Minimum CNV Gain (log2 ratio)') // TODO: verify that this will always be log2 ratio
		cnvGainDiv
			.append('input')
			.attr('type', 'number')
			.property('value', cnvGainCutoff)
			.style('width', '100px')
			.style('margin-left', '15px')
			.on('change', event => {
				const value = event.target.value
				if (value === '' || !Number.isFinite(Number(value))) {
					window.alert('Please enter a numeric value.')
					event.target.value = cnvGainCutoff
					return
				}
				const newValue = Number(value)
				if (newValue < 0) {
					window.alert('Value must be a positive value.')
					event.target.value = cnvGainCutoff
					return
				}
				cnvGainCutoff = newValue
			})
	}

	let cnvLossCutoff
	if (cnv.cnvLossCutoff) {
		cnvLossCutoff = tvs.cnvLossCutoff || cnv.cnvLossCutoff
		const cnvLossDiv = settingsDiv.append('div').style('margin-bottom', '5px')
		cnvLossDiv.append('span').style('opacity', 0.7).text('Maximum CNV Loss (log2 ratio)') // TODO: verify that this will always be log2 ratio
		cnvLossDiv
			.append('input')
			.attr('type', 'number')
			.property('value', cnvLossCutoff)
			.style('width', '100px')
			.style('margin-left', '15px')
			.on('change', event => {
				const value = event.target.value
				if (value === '' || !Number.isFinite(Number(value))) {
					window.alert('Please enter a numeric value.')
					event.target.value = cnvLossCutoff
					return
				}
				const newValue = Number(value)
				if (newValue > 0) {
					window.alert('Value must be a negative value.')
					event.target.value = cnvLossCutoff
					return
				}
				cnvLossCutoff = newValue
			})
	}

	let cnvMaxLength
	if (cnv.cnvMaxLength) {
		cnvMaxLength = tvs.cnvMaxLength || cnv.cnvMaxLength
		const cnvLengthDiv = settingsDiv.append('div').style('margin-bottom', '5px')
		cnvLengthDiv.append('span').style('opacity', 0.7).text('CNV Max Length')
		cnvLengthDiv
			.append('input')
			.attr('type', 'number')
			.property('value', cnvMaxLength)
			.style('width', '100px')
			.style('margin-left', '15px')
			.on('change', event => {
				const value = event.target.value
				if (value === '' || !Number.isFinite(Number(value))) {
					window.alert('Please enter a numeric value.')
					event.target.value = cnvMaxLength
					return
				}
				const newValue = Number(value)
				// no max length if value == -1
				cnvMaxLength = newValue == -1 ? null : newValue
			})
			.on('mouseover', event => {
				tip.clear()
				tip.d.append('div').text('Please enter a positive value. To include all CNV segments, enter -1.')
				tip.showunder(event.target)
			})
			.on('mouseout', () => {
				tip.hide()
			})
	}

	let cnvWT = tvs.cnvWT || false
	const wtDiv = settingsDiv.append('div').style('margin-bottom', '5px')
	wtDiv.append('span').style('margin-right', '3px').style('opacity', 0.7).text('Wildtype')
	const wtCheckbox = wtDiv
		.append('input')
		.attr('type', 'checkbox')
		.property('checked', cnvWT)
		.style('vertical-align', 'middle')
		.style('margin-right', '3px')
		.on('change', () => {
			cnvWT = wtCheckbox.property('checked')
		})
	wtDiv
		.append('span')
		.style('opacity', 0.7)
		.style('font-size', '0.7em')
		.style('margin-left', '10px')
		.text('wildtype for alteration specified above')

	// Apply button
	div
		.append('div')
		.append('button')
		.attr('class', 'sja_filter_tag_btn sjpp_apply_btn')
		.style('border-radius', '13px')
		.style('margin-top', '15px')
		.style('font-size', '.8em')
		.text('APPLY')
		.on('click', () => {
			const new_tvs = structuredClone(tvs)
			new_tvs.continuousCnv = true
			new_tvs.cnvWT = cnvWT
			if (cnvGainCutoff) new_tvs.cnvGainCutoff = cnvGainCutoff
			if (cnvLossCutoff) new_tvs.cnvLossCutoff = cnvLossCutoff
			if (cnvMaxLength) new_tvs.cnvMaxLength = cnvMaxLength
			self.dom.tip.hide()
			self.opts.callback(new_tvs)
		})
}

function get_pill_label(tvs) {
	return { txt: tvs.cnvWT ? 'Wildtype' : 'Altered' }
}
