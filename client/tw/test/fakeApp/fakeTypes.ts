import { CategoricalValues } from '../../CategoricalValues'
import { CategoricalPredefinedGS } from '../../CategoricalPredefinedGS'
import { Handler } from '../../Handler'

// Declare argument type(s) that are specific to a method for a particulat plot, app, or component
export type PlotTwRenderOpts = {
	holder: string // in real apps, would be a d3-selection HTML element
	data: {
		[sampleId: string]: {
			[termId: string]: number | string
		}
	}
}

//
// Define an Addons type that will extend a Handler instance (not class),
// using Object.assign().
//
// Note that consumer code will typically require very specific definitions
// for addon method signatures and property types. Otherwise, tsc will not be able to
// effectively type check the use of the handler instances within consumer code.
//
export type Addons = {
	render: (arg: PlotTwRenderOpts) => void
	x: number
}
// Below is the extended handler type.
//
// Ideally, the addon method names will match what's already declared as optional
// in the Handler class, to have consistent naming convention for handler-related
// code. Also, populating optional props/methods that are already declared for a class
// is more easily optimized for lookup by browser engines.
//
export type TwHandler = (CategoricalValues | CategoricalPredefinedGS) & Addons

//
// Use a type guard to safely convert the Handler class to the addon TwHandler interface,
// otherwise the compiler will complain of a type mismatch for optional properties in Handler
// that are required in TwHandler. The runtime checks should verify the presence of
// required props/methods, and return a boolean to confirm that the argument matches the target type.
//
export function isPlotTwHandler(handler: Handler): handler is TwHandler {
	if (handler instanceof Handler && typeof handler.render == 'function') return true
	return true
}
