import { Menu, make_radios } from '#dom'

/*
Renderer for CNV config UI
	- radio buttons for toggling altered vs. wildtype
	- inputs for CNV gain cutoff, loss cutoff, and max length
	- resulting CNV config is provided through callback function
*/

type Arg = {
	holder: any // D3 holder where UI is rendered
	cnvGainCutoff?: number // minimum positive value (log2 ratio) for CNV gain
	cnvLossCutoff?: number // maximum negative value (log2 ratio) for CNV loss
	cnvMaxLength?: number | null // max segment bp length; null = no length limit (UI shows -1)
	callback: (config: {
		cnvGainCutoff?: number
		cnvLossCutoff?: number
		cnvMaxLength?: number | null
		cnvWT?: boolean
	}) => void // called upon clicking apply
	cnvWT?: boolean // wildtype for CNV specified by cutoffs
	genotypeToggle?: boolean // display altered vs. wildtype genotype toggle
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

	const genotypeDiv = div.append('div').style('margin-bottom', '10px')

	// CNV genotype radio buttons
	let genotypeRadio
	if (arg.genotypeToggle) {
		const cnvWT = arg.cnvWT || false
		genotypeDiv
			.append('div')
			.style('display', 'inline-block')
			.style('margin-right', '5px')
			.style('opacity', 0.7)
			.text('CNV genotype')
		genotypeRadio = make_radios({
			holder: genotypeDiv,
			styles: { display: 'inline-block' },
			options: [
				{ label: 'Altered', value: 'altered', checked: !cnvWT },
				{ label: 'Wildtype', value: 'wildtype', checked: cnvWT }
			],
			callback: () => {}
		})
	}

	const cutoffsDiv = div.append('div')
	cutoffsDiv.append('div').style('opacity', 0.7).style('margin-bottom', '10px').text('CNV cutoffs:')
	const inputsDiv = cutoffsDiv.append('div').style('margin-left', '10px')

	// CNV gain input
	let cnvGainInput
	if (Number.isFinite(cnvGainCutoff)) {
		const cnvGainDiv = inputsDiv.append('div').style('margin-bottom', '5px')
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
		const cnvLossDiv = inputsDiv.append('div').style('margin-bottom', '5px')
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
		const cnvLengthDiv = inputsDiv.append('div').style('margin-bottom', '5px')
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
			if (genotypeRadio) {
				const radios = genotypeRadio.inputs.nodes()
				const selected = radios.find(r => r.checked)
				if (!selected) throw 'no selected radio found'
				config.cnvWT = selected.value == 'wildtype'
			}
			arg.callback(config)
		})
}

function isValidNumber(s: string) {
	if (s === '') return false
	const n = Number(s)
	return Number.isFinite(n)
}
