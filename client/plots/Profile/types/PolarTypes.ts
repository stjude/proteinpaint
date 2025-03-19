import type { Elem, Svg } from '../../../types/d3'
import type { PlotConfig } from '#mass/types/mass'
import type { ProfilePlotDom } from './ProfilePlotTypes'

/** TODO:
 * - Add comments
 * - Add opts type that extends profile plot opts
 */

/** Already a 'Term' in types */
type Term = {
	module: string
	score: { term: { color: string } }
	maxScore: any
	i?: number
}

export type ProfilePolarConfig = PlotConfig & {
	terms: Term[]
	title: string
}

export type ProfilePolarDom = ProfilePlotDom & {
	svg: Svg
	tableDiv: Elem
}
