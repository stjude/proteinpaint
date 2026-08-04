import type { AggregateMatrix } from "../AggregateMatrix"
import { controlsInit } from '#plots/controls.js'
import { validateMinMax } from '../settings/defaults.ts'
import { capitalizeFirstLetter } from '#dom'

export async function setControls(controlsDiv, ag: AggregateMatrix) {
	const settings = ag.state.config.settings.aggregateMatrix
	const chartType = ag.type
	const gradienLabel = capitalizeFirstLetter(settings.gradientMethod)

	const inputs: any = [
		{
				label: `${gradienLabel} start color`,
				type: 'color',
				chartType,
				settingsKey: 'startColor'
		},
		{
				label: `${gradienLabel} stop color`,
				type: 'color',
				chartType,
				settingsKey: 'stopColor'
		},
		{
			label: 'Min dot size',
			title: 'Set the minimum dot size. Number must be between 2 and 35',
			type: 'number',
			chartType,
			settingsKey: 'minDotSize',
			step: 1,
			max: settings.dotInputMax,
			min: settings.dotInputMin,
			width: 55,
			debounceInterval: 300,
			processInput: (val: number) => {
				const config = ag.state
				const isValid = validateMinMax(settings, val, config.maxDotSize)
				if (isValid !== null) {
					alert(isValid)
					return config.minDotSize
				}
				return val
			}
		},
		{
			label: 'Max dot size',
			title: 'Set the maximum dot size. Number must be between 2 and 35',
			type: 'number',
			chartType,
			settingsKey: 'maxDotSize',
			step: 1,
			max: settings.dotInputMax,
			min: settings.dotInputMin,
			width: 55,
			debounceInterval: 300,
			processInput: (val: number) => {
				const config = ag.state
				const isValid = validateMinMax(settings, config.minDotSize, val)
				if (isValid !== null) {
					alert(isValid)
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