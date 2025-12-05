import { Menu } from '../dom/menu'

/* TODOs
- document arg
- are there cases when some cutoffs are defined (e.g. cnvGainCutoff and cnvLossCutoff), but not others (e.g. cnvMaxLength)?
*/

export function renderCnvConfig(arg) {
	const div = arg.holder
	div.style('margin', '10px')
	const tip = new Menu({ padding: '5px' })

	div.append('div').style('margin-bottom', '10px').text('Specify criteria for a CNV alteration:')

	const settingsDiv = div.append('div').style('margin-left', '10px') // TODO: may rename settingsDiv

	// CNV gain input
	const cnvGainCutoff = arg.cnvGainCutoff
	if (!isValidNumber(cnvGainCutoff)) throw 'cnvGainCutoff is not a valid number'
	const cnvGainDiv = settingsDiv.append('div').style('margin-bottom', '5px')
	cnvGainDiv.append('span').style('opacity', 0.7).text('Minimum CNV Gain (log2 ratio)') // TODO: verify that this will always be log2 ratio
	const cnvGainInput = cnvGainDiv
		.append('input')
		.attr('type', 'number')
		.property('value', cnvGainCutoff)
		.style('width', '100px')
		.style('margin-left', '15px')
		.on('change', event => {
			const value = event.target.value
			if (!isValidNumber(value)) {
				window.alert('Please enter a numeric value.')
				event.target.value = cnvGainCutoff
				return
			}
			if (Number(value) < 0) {
				window.alert('Value must be a positive value.')
				event.target.value = cnvGainCutoff
				return
			}
		})

	// CNV loss input
	const cnvLossCutoff = arg.cnvLossCutoff
	if (!isValidNumber(cnvLossCutoff)) throw 'cnvLossCutoff is not a valid number'
	const cnvLossDiv = settingsDiv.append('div').style('margin-bottom', '5px')
	cnvLossDiv.append('span').style('opacity', 0.7).text('Maximum CNV Loss (log2 ratio)') // TODO: verify that this will always be log2 ratio
	const cnvLossInput = cnvLossDiv
		.append('input')
		.attr('type', 'number')
		.property('value', cnvLossCutoff)
		.style('width', '100px')
		.style('margin-left', '15px')
		.on('change', event => {
			const value = event.target.value
			if (!isValidNumber(value)) {
				window.alert('Please enter a numeric value.')
				event.target.value = cnvLossCutoff
				return
			}
			if (Number(value) > 0) {
				window.alert('Value must be a negative value.')
				event.target.value = cnvLossCutoff
				return
			}
		})

	// CNV max length input
	const cnvMaxLength = arg.cnvMaxLength === null ? -1 : arg.cnvMaxLength
	if (!isValidNumber(cnvMaxLength)) throw 'cnvMaxLength is not a valid number'
	const cnvLengthDiv = settingsDiv.append('div').style('margin-bottom', '5px')
	cnvLengthDiv.append('span').style('opacity', 0.7).text('CNV Max Length')
	const cnvLengthInput = cnvLengthDiv
		.append('input')
		.attr('type', 'number')
		.property('value', cnvMaxLength)
		.style('width', '100px')
		.style('margin-left', '15px')
		.on('change', event => {
			const value = event.target.value
			if (!isValidNumber(value)) {
				window.alert('Please enter a numeric value.')
				event.target.value = cnvMaxLength
				return
			}
		})
		.on('mouseover', event => {
			tip.clear()
			tip.d.append('div').text('Please enter a positive value. To include all CNV segments, enter -1.')
			tip.showunder(event.target)
		})
		.on('mouseout', () => {
			tip.hide()
		})

	// CNV wildtype checkbox
	let wtCheckbox
	if (arg.WTtoggle) {
		const cnvWT = arg.cnvWT || false
		const wtDiv = settingsDiv.append('div').style('margin-bottom', '5px')
		wtDiv.append('span').style('margin-right', '3px').style('opacity', 0.7).text('Wildtype')
		wtCheckbox = wtDiv
			.append('input')
			.attr('type', 'checkbox')
			.property('checked', cnvWT)
			.style('vertical-align', 'middle')
			.style('margin-right', '3px')
		wtDiv
			.append('span')
			.style('opacity', 0.7)
			.style('font-size', '0.7em')
			.style('margin-left', '10px')
			.text('wildtype for alteration specified above')
	}

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
			const tempCnvMaxLength = Number(cnvLengthInput.property('value'))
			const config: any = {
				cnvGainCutoff: Number(cnvGainInput.property('value')),
				cnvLossCutoff: Number(cnvLossInput.property('value')),
				// no max length if value == -1
				cnvMaxLength: tempCnvMaxLength == -1 ? null : tempCnvMaxLength
			}
			if (arg.WTtoggle) config.cnvWT = wtCheckbox.property('checked')
			arg.callback(config)
		})
}

function isValidNumber(s: string) {
	if (s === '') return false
	const n = Number(s)
	return Number.isFinite(n)
}
