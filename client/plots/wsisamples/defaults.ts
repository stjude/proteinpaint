import Settings from './Settings'
import { copyMerge } from '#rx'

export default function wsiSamplesDefaults(overrides = {}): Settings {
	const defaults = {}
	return copyMerge(defaults, overrides)
}
