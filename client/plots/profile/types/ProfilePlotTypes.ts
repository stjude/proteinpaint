import type { Elem } from '../../../types/d3'
import type { ImpressionZone } from '../renderImpressionThermometer'
import type { ResponseDistributionTexts } from '../renderResponseDistribution'

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
	/** overlay shown over the plot area while the chart's data is fetched/rendered */
	loadingDiv: Elem
}

/** Dataset config for the profileForms impression view (`impression` in the plot config) */
export type ImpressionConfig = {
	/** block title; {module} is replaced with the module name */
	titleTemplate: string
	/** comparison line; {group} is replaced with the responder-group label */
	comparisonTitle: string
	chartTitles: { thermometer: string; distribution: string }
	/** title of the thermometer's rating axis */
	ratingAxisLabel: string
	/** performance-zone bins on the rating axis, shared by the thermometer and the distribution chart */
	zones: Omit<ImpressionZone, 'color'>[]
	/** zone background color by module name, then by zone label; every rendered module and zone must have one */
	zoneColors: { [module: string]: { [zoneLabel: string]: string } }
	distribution: ResponseDistributionTexts
	/** series names: sc also labels the single group of a module with no POC responders */
	legend: { sc: string; poc: string }
}
