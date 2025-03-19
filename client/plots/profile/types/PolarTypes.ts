import type { Elem, Svg } from '../../../types/d3'
import type { PlotConfig } from '#mass/types/mass'
import type { ProfilePlotDom } from './ProfilePlotTypes'

/** TODO:
 * - Add comments
 * - Add opts type that extends profile plot opts
 */

type ModuleScore = {
	module: string
	score: { term: { color: string } }
	maxScore: any
	i?: number
}

export type ProfilePolarConfig = PlotConfig & {
	terms: ModuleScore[]
	title: string
}

export type ProfilePolarDom = ProfilePlotDom & {
	svg: Svg
	tableDiv: Elem
}
