import { Menu } from '../dom/menu'

/*
Renderer for CNV config UI

 - Inputs for CNV gain cutoff, loss cutoff, and max length
 - Checkbox for toggling wildtype genotype
 - Resulting CNV config is provided through callback function
*/

type Arg = {
	holder: any // D3 holder where UI is rendered
	cnvGainCutoff?: number // minimum positive value (log2 ratio) to consider a CNV as gain
	cnvLossCutoff?: number // maximum negative value (log2 ratio) to consider a CNV as loss
	cnvMaxLength?: number | null // max segment length in base pairs; null = no length limit (UI shows -1)
	callback: (config: {
		cnvGainCutoff?: number
		cnvLossCutoff?: number
		cnvMaxLength?: number | null
		cnvWT?: boolean
	}) => void // called when user clicks APPLY
	cnvWT?: boolean // wildtype for CNV alteration specified by cnvGainCutoff, cnvLossCutoff, and cnvMaxLength
	WTtoggle?: boolean // display wildtype checkbox
}

export function renderCnvConfig(arg: Arg) {
	const { cnvGainCutoff, cnvLossCutoff } = arg
	const cnvMaxLength = arg.cnvMaxLength === null ? -1 : arg.cnvMaxLength

	if (!Number.isFinite(cnvGainCutoff) && !Number.isFinite(cnvLossCutoff) && !Number.isFinite(cnvMaxLength)) {
		// no cutoffs defined, do not render config UI
		return
	}

	const div = arg.holder
	div.style('margin', '10px')
	const tip = new Menu({ padding: '5px' })

	div.append('div').style('margin-bottom', '10px').text('Specify criteria for a CNV alteration:')

	const configDiv = div.append('div').style('margin-left', '10px')

	// CNV gain input
	let cnvGainInput
	if (Number.isFinite(cnvGainCutoff)) {
		const cnvGainDiv = configDiv.append('div').style('margin-bottom', '5px')
		cnvGainDiv.append('span').style('opacity', 0.7).text('Minimum CNV Gain (log2 ratio)') // TODO: verify that this will always be log2 ratio
		cnvGainInput = cnvGainDiv
			.append('input')
			.attr('data-testid', 'sjpp-cnv-gain-input')
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
	}

	// CNV loss input
	let cnvLossInput
	if (Number.isFinite(cnvLossCutoff)) {
		const cnvLossDiv = configDiv.append('div').style('margin-bottom', '5px')
		cnvLossDiv.append('span').style('opacity', 0.7).text('Maximum CNV Loss (log2 ratio)') // TODO: verify that this will always be log2 ratio
		cnvLossInput = cnvLossDiv
			.append('input')
			.attr('data-testid', 'sjpp-cnv-loss-input')
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
	}

	// CNV max length input
	let cnvLengthInput
	if (Number.isFinite(cnvMaxLength)) {
		const cnvLengthDiv = configDiv.append('div').style('margin-bottom', '5px')
		cnvLengthDiv.append('span').style('opacity', 0.7).text('CNV Max Length')
		cnvLengthInput = cnvLengthDiv
			.append('input')
			.attr('data-testid', 'sjpp-cnv-length-input')
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
	}

	// CNV wildtype checkbox
	let wtCheckbox
	if (arg.WTtoggle) {
		const cnvWT = arg.cnvWT || false
		const wtDiv = configDiv.append('div').style('margin-bottom', '5px')
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
			const config: any = {}
			if (cnvGainInput) config.cnvGainCutoff = Number(cnvGainInput.property('value'))
			if (cnvLossInput) config.cnvLossCutoff = Number(cnvLossInput.property('value'))
			if (cnvLengthInput) {
				const tempCnvMaxLength = Number(cnvLengthInput.property('value'))
				// no max length if value == -1
				config.cnvMaxLength = tempCnvMaxLength == -1 ? null : tempCnvMaxLength
			}
			if (wtCheckbox) config.cnvWT = wtCheckbox.property('checked')
			arg.callback(config)
		})
}

function isValidNumber(s: string) {
	if (s === '') return false
	const n = Number(s)
	return Number.isFinite(n)
}
