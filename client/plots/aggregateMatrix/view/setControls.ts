import type { AggregateMatrix } from "../AggregateMatrix"
import { controlsInit } from '#plots/controls.js'

export async function setControls(controlsDiv, ag: AggregateMatrix) {
    const inputs: any = [
       {
			label: 'Min dot size',
			title: 'Set the minimum dot size. Number must be between 2 and 35',
			type: 'number',
			chartType: 'aggregateMatrix',
			settingsKey: 'minDotSize',
			step: 1,
			max: 35,
			min: 2,
            width: 55,
			debounceInterval: 300,
            processInput: (val: number) => {
                const config = ag.state
                if (config.maxDotSize < val) {
                    alert(`Min dot size cannot be greater than max dot size (${config.maxDotSize})`)
                    return config.minDotSize
                }
                return val
            }
		},
        {
			label: 'Max dot size',
			title: 'Set the maximum dot size. Number must be between 2 and 35',
			type: 'number',
			chartType: 'aggregateMatrix',
			settingsKey: 'maxDotSize',
			step: 1,
			max: 35,
			min: 2,
            width: 55,
			debounceInterval: 300,
            processInput: (val: number) => {
                const config = ag.state
                if (config.minDotSize > val) {
                    alert(`Max dot size cannot be less than min dot size (${config.minDotSize})`)
                    return config.maxDotSize
                }
                return val
            }
		}
    ]

    ag.components.controls = await controlsInit({
		app: ag.app,
		id: ag.id,
		holder: controlsDiv,
		inputs: inputs
	})
}