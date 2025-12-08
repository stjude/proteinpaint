import tape from 'tape'
import { renderCnvConfig } from '../cnvConfig'
import { select } from 'd3-selection'

/*
test sections:
    - basic render
    - input values
	- null max length input
	- no gain/loss cutoffs
	- no cutoffs
    - apply callback
    - wildtype toggle
    - no wildtype toggle
*/

tape('\n', test => {
	test.comment('-***- dom/cnvConfig unit tests-***-')
	test.end()
})

tape('basic render', test => {
	const holder = select(document.body).append('div')

	renderCnvConfig({
		holder,
		cnvGainCutoff: 0.5,
		cnvLossCutoff: -0.5,
		cnvMaxLength: 1000,
		callback: () => {}
	})

	test.ok(holder.select('input[data-testid="sjpp-cnv-gain-input"]').node(), 'gain cutoff input rendered')
	test.ok(holder.select('input[data-testid="sjpp-cnv-loss-input"]').node(), 'loss cutoff input rendered')
	test.ok(holder.select('input[data-testid="sjpp-cnv-length-input"]').node(), 'max length input rendered')
	test.ok(holder.select('button').node(), 'apply button rendered')

	holder.remove()
	test.end()
})

tape('input values', test => {
	const holder = select(document.body).append('div')

	renderCnvConfig({
		holder,
		cnvGainCutoff: 0.5,
		cnvLossCutoff: -0.5,
		cnvMaxLength: 500,
		callback: () => {}
	})

	const gainInput = holder.select('input[data-testid="sjpp-cnv-gain-input"]')
	const lossInput = holder.select('input[data-testid="sjpp-cnv-loss-input"]')
	const maxLenInput = holder.select('input[data-testid="sjpp-cnv-length-input"]')

	test.equal(gainInput.property('value'), '0.5', 'gain input has correct initial value')
	test.equal(lossInput.property('value'), '-0.5', 'loss input has correct initial value')
	test.equal(maxLenInput.property('value'), '500', 'max length input has correct initial value')

	holder.remove()
	test.end()
})

tape('null max length input', test => {
	const holder = select(document.body).append('div')
	let newConfig

	renderCnvConfig({
		holder,
		cnvGainCutoff: 0.5,
		cnvLossCutoff: -0.5,
		cnvMaxLength: null,
		callback: config => (newConfig = config)
	})

	const maxLenInput = holder.select('input[data-testid="sjpp-cnv-length-input"]')
	test.equal(maxLenInput.property('value'), '-1', 'max length input shows -1 when initialized as null')

	// apply with -1
	const applyBtn = holder.select('button').node() as HTMLButtonElement
	applyBtn.click()

	test.equal(newConfig.cnvMaxLength, null, 'callback normalizes -1 to null')

	// apply with new value
	maxLenInput.property('value', 500)
	applyBtn.click()
	test.equal(newConfig.cnvMaxLength, 500, 'callback receives updated max length')

	holder.remove()
	test.end()
})

tape('no gain/loss cutoffs', test => {
	const holder = select(document.body).append('div')

	renderCnvConfig({
		holder,
		cnvMaxLength: 500,
		callback: () => {}
	})

	const gainInput = holder.select('input[data-testid="sjpp-cnv-gain-input"]').node() as HTMLInputElement
	const lossInput = holder.select('input[data-testid="sjpp-cnv-loss-input"]').node() as HTMLInputElement
	const maxLenInput = holder.select('input[data-testid="sjpp-cnv-length-input"]').node() as HTMLInputElement

	test.notOk(gainInput, 'gain input should not be rendered')
	test.notOk(lossInput, 'loss input should not be rendered')
	test.equal(maxLenInput.value, '500', 'max length input has correct initial value')

	holder.remove()
	test.end()
})

tape('no cutoffs', test => {
	const holder = select(document.body).append('div')

	renderCnvConfig({
		holder,
		callback: () => {}
	})

	const gainInput = holder.select('input[data-testid="sjpp-cnv-gain-input"]').node() as HTMLInputElement
	const lossInput = holder.select('input[data-testid="sjpp-cnv-loss-input"]').node() as HTMLInputElement
	const maxLenInput = holder.select('input[data-testid="sjpp-cnv-length-input"]').node() as HTMLInputElement

	test.notOk(gainInput, 'gain input should not be rendered')
	test.notOk(lossInput, 'loss input should not be rendered')
	test.notOk(maxLenInput, 'max length input should not be rendered')

	holder.remove()
	test.end()
})

tape('apply callback', test => {
	const holder = select(document.body).append('div')
	let newConfig

	renderCnvConfig({
		holder,
		cnvGainCutoff: 0.5,
		cnvLossCutoff: -0.5,
		cnvMaxLength: 1000,
		callback: config => (newConfig = config)
	})

	// modify inputs
	const gainInput = holder.select('input[data-testid="sjpp-cnv-gain-input"]')
	const lossInput = holder.select('input[data-testid="sjpp-cnv-loss-input"]')

	gainInput.property('value', 1)
	lossInput.property('value', -1)

	// click apply button
	const applyBtn = holder.select('button').node() as HTMLButtonElement
	applyBtn.click()

	test.equal(newConfig.cnvGainCutoff, 1, 'callback receives updated gain cutoff')
	test.equal(newConfig.cnvLossCutoff, -1, 'callback receives updated loss cutoff')
	test.equal(newConfig.cnvMaxLength, 1000, 'max length should not change')

	holder.remove()
	test.end()
})

tape('wildtype toggle', test => {
	const holder = select(document.body).append('div')
	let newConfig

	renderCnvConfig({
		holder,
		cnvGainCutoff: 0.5,
		cnvLossCutoff: -0.5,
		cnvMaxLength: 1000,
		WTtoggle: true,
		cnvWT: false,
		callback: config => (newConfig = config)
	})

	const wtCheckbox = holder.select('input[type="checkbox"]').node() as HTMLInputElement
	test.ok(wtCheckbox, 'wildtype checkbox rendered when WTtoggle=true')

	// toggle checkbox
	wtCheckbox.checked = true
	const applyBtn = holder.select('button').node() as HTMLButtonElement
	applyBtn.click()

	test.equal(newConfig.cnvWT, true, 'callback receives updated wildtype state')

	holder.remove()
	test.end()
})

tape('no wildtype toggle', test => {
	const holder = select(document.body).append('div').attr('id', 'test-cnv-5')

	renderCnvConfig({
		holder,
		cnvGainCutoff: 0.5,
		cnvLossCutoff: -0.5,
		cnvMaxLength: 1000,
		WTtoggle: false,
		callback: () => {}
	})

	const wtCheckbox = holder.select('input[type="checkbox"]').node()
	test.notOk(wtCheckbox, 'wildtype checkbox not rendered when WTtoggle=false')

	holder.remove()
	test.end()
})
