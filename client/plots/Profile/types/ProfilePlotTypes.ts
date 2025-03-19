import type { Elem } from '../../../types/d3'

/** Types for super profile plots class
 *
 * TODO:
 * - Add comments
 * - Add base/main/super types for the following:
 *    - ProfilePlotConfig
 *    - ProfilePlotOpts
 */

export type ProfilePlotDom = {
	holder: Elem
	controlsDiv: Elem
	iconsDiv: Elem
	rightDiv: Elem
	plotDiv: Elem
}
