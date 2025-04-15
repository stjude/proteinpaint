import { handler as catHandler } from './tvs.categorical.js'

export const handler = Object.assign({}, catHandler, { type: 'dtcnv' })

handler.fillMenu = contfillMenu // TODO: use fillMenu from catHandler if CNV data is categorical

// fill menu for continuous CNV data
async function contfillMenu(self, div, tvs) {
	div.style('margin-top', '10px').style('margin-left', '10px')

	const cnv = self.opts.vocabApi.parent_termdbConfig?.queries?.cnv

	let cnvWT = false
	const wtDiv = div.append('div').style('margin-bottom', '5px')
	wtDiv.append('span').style('margin-right', '3px').style('opacity', 0.7).text('Wildtype')
	const wtCheckbox = wtDiv
		.append('input')
		.attr('type', 'checkbox')
		.property('checked', cnvWT)
		.style('vertical-align', 'top')
		.style('margin-right', '3px')
		.on('change', () => {
			cnvWT = wtCheckbox.property('checked')
		})

	let cnvGainCutoff
	if (cnv.cnvGainCutoff) {
		cnvGainCutoff = cnv.cnvGainCutoff
		const cnvGainDiv = div.append('div').style('margin-bottom', '5px')
		cnvGainDiv.append('span').style('opacity', 0.7).text('CNV Gain Cutoff')
		cnvGainDiv
			.append('input')
			.attr('type', 'number')
			.property('value', cnv.cnvGainCutoff)
			.style('width', '100px')
			.style('margin-left', '15px')
			.on('change', event => {
				const value = event.target.value
				if (value === '' || !Number.isFinite(Number(value))) {
					window.alert('Please enter a numeric value.')
					event.target.value = defaultValue
					return
				}
				const newValue = Number(value)
				// no gain cutoff if value > 100
				cnvGainCutoff = newValue <= 100 ? newValue : null
			})
	}

	let cnvLossCutoff
	if (cnv.cnvLossCutoff) {
		cnvLossCutoff = cnv.cnvLossCutoff
		const cnvLossDiv = div.append('div').style('margin-bottom', '5px')
		cnvLossDiv.append('span').style('opacity', 0.7).text('CNV Loss Cutoff')
		cnvLossDiv
			.append('input')
			.attr('type', 'number')
			.property('value', cnv.cnvLossCutoff)
			.style('width', '100px')
			.style('margin-left', '15px')
			.on('change', event => {
				const value = event.target.value
				if (value === '' || !Number.isFinite(Number(value))) {
					window.alert('Please enter a numeric value.')
					event.target.value = defaultValue
					return
				}
				const newValue = Number(value)
				// no loss cutoff if value < -100
				cnvLossCutoff = newValue >= -100 ? newValue : null
			})
	}

	let cnvMaxLength
	if (cnv.cnvMaxLength) {
		cnvMaxLength = cnv.cnvMaxLength
		const cnvLengthDiv = div.append('div').style('margin-bottom', '5px')
		cnvLengthDiv.append('span').style('opacity', 0.7).text('CNV Max Length')
		cnvLengthDiv
			.append('input')
			.attr('type', 'number')
			.property('value', cnv.cnvMaxLength)
			.style('width', '100px')
			.style('margin-left', '15px')
			.on('change', event => {
				const value = event.target.value
				if (value === '' || !Number.isFinite(Number(value))) {
					window.alert('Please enter a numeric value.')
					event.target.value = defaultValue
					return
				}
				const newValue = Number(value)
				// no max length if value == -1
				cnvMaxLength = newValue == -1 ? null : newValue
			})
	}

	// Apply button
	div
		.append('div')
		.attr('class', 'sja_filter_tag_btn sjpp_apply_btn')
		.style('border-radius', '13px')
		.style('margin-top', '10px')
		.style('font-size', '.8em')
		.text('APPLY')
		.on('click', () => {
			const new_tvs = structuredClone(tvs)
			new_tvs.cnvWT = cnvWT
			if (cnvGainCutoff) new_tvs.cnvGainCutoff = cnvGainCutoff
			if (cnvLossCutoff) new_tvs.cnvLossCutoff = cnvLossCutoff
			if (cnvMaxLength) new_tvs.cnvMaxLength = cnvMaxLength
			console.log('new_tvs:', new_tvs)
			self.dom.tip.hide()
			self.opts.callback(new_tvs)
		})

	/* Possible wrapper for adding inputs
    function addInput(div, defaultValue, newValue, callback) {
        newValue = defaultValue
        console.log('newValue:', newValue)
        console.log('cnvLossCutoff:', cnvLossCutoff)
        const newDiv = div.append('div')
        newDiv.append('span').style('opacity', 0.7).text('CNV Loss Cutoff')
        newDiv
            .append('input')
            .attr('type', 'number')
            .property('value', defaultValue)
            .style('width', '100px')
            .style('margin-left', '15px')
            .on('change', event => {
                const inputValue = event.target.value
                if (inputValue === '' || !Number.isFinite(Number(inputValue))) {
                    window.alert('Please enter a numeric value.')
                    event.target.value = defaultValue
                    return
                }
                const value = Number(inputValue)
                newValue = callback(value)
                console.log('newValue:', newValue)
            })
    }*/
}
