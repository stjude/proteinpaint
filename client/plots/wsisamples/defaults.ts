import type Settings from './Settings'
import { copyMerge } from '#rx'

export default function wsiSamplesDefaults(overrides = {}): Settings {
	const defaults = {
		selectedSampleIndex: -1
	}
	return copyMerge(defaults, overrides)
}
