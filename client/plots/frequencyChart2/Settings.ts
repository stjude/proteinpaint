import type { RunChart2Settings } from '../runChart2/Settings.ts'

/** Extends RunChart2Settings so FrequencyChart2View is assignable to RunChart2View without changing RunChart2. */
export interface FrequencyChart2Settings extends RunChart2Settings {
	showCumulativeFrequency: boolean
}
