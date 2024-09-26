import { StartUnboundedBin, StopUnboundedBin, FullyBoundedBin, NumericTerm } from '../terms/numeric'

/*
	Non-asserted type definition tests 
	
	For training only 
	- these tests are not meant to be written for all declared types
	
	- meant for simple "sanity check", that a declaration makes sense and CATCHES ERRORS
	
	- quick tests on lines commented with @ts-expect-error 
		- remove a // @ts-expect-error comment to see error message as emitted by the tsc compiler
		- fix the variable declaration value to match the expected type, tsc should emit "Unused '@ts-expect-error' directive"
*/

/*****************
 * Simple tests
 ******************/

{
	// in unit and integration spec files, use the numeric type definitions
	// to make sure that test data matches expectations, otherwise incorrect
	// test data can lead to false passing or failing tests.
	const valid: NumericTerm = {
		type: 'float',
		id: 'someid',
		name: 'Some Dosage',
		bins: {
			default: {
				type: 'regular-bin',
				bin_size: 1,
				first_bin: {
					startunbounded: true,
					stop: 1
				}
			},
			less: {
				type: 'custom-bin',
				lst: [{ start: 0, stop: 1 }]
			}
		}
	}

	// @ts-expect-error, wrong term.type
	const A: NumericTerm = { name: 'test', type: 'categorical' }
	// @ts-expect-error, missing other required properties
	const B: NumericTerm = { type: 'integer' }
	const C: NumericTerm = {
		// @ts-expect-error, should be string
		name: 7,
		type: 'integer',
		bins: {
			default: {
				type: 'regular-bin',
				bin_size: 1,
				// tsc can detect type errors for deeply nested property values
				// @ts-expect-error, does not match either StartUnboundedBin | FullyBoundedBin
				first_bin: {
					stop: 1
				}
			},
			less: {
				type: 'custom-bin',
				// @ts-expect-error, empty lst array
				lst: []
			}
		}
	}
}

/*************************
 * !!! How NOT to type !!!
 **************************/

// Example of a bad type declaration, where everything is optional.
// Avoid declaring types with lots of optional properties, unless that's really expected.
// In the PP codebase, a union of types is more likely to be the correct way to declare
// a type with mutually exlusive properties based on, for example, term.type or gene variant value dt number.
type UselessBinType = {
	startunbounded?: boolean
	startinclusive?: boolean
	start?: number
	stop?: number
	stopinclusive?: boolean
	stopunbounded?: boolean
}

{
	// The UselesBinType matches objects with conflicting property values, which does not make sense.
	// We want tsc to emit an error when unallowed, non-sensical combination of properties exist.
	//
	// For example, it does not make sense for a bin to have these combinations of property-values:
	// - startunbounded: true and startinclusive: true    // cannot "contain" infinity
	// - startunbounded: true and start: 0                // conflict, start is supposed to be unbounded and yet is assigned a finite value
	// - startunbounded: true and stopunbounded: true     // an infinite bin
	//
	// Many other pairing of the property-values below do not make sense.
	// Note that running the tsc on this file does not emit an error, but it should for values that do not make sense.
	// To get tsc to emit errors, we should use the bin types from server/shared/types/terms/numeric.ts,
	// or from the 'better' bin type examples farther down below (which will require more code changes).
	const A: UselessBinType = {
		startunbounded: true,
		startinclusive: true,
		start: 0,
		stop: 1,
		stopinclusive: true,
		stopunbounded: true
	}

	// no error is thrown by an empty object because all properties are optional,
	// but we want tsc to emit an error in this scenario
	const B: UselessBinType = {}
	// @ts-expect-error, not fully useless since an error is thrown because 'extraProp' is not defined as an optional property
	B.extraProp = 'test'
}

/********************************************
 * Testing types that are able to catch errors
 *********************************************/

// Start unbounded Bin
{
	// valid example
	const A: StartUnboundedBin = {
		startunbounded: true,
		stop: 1
	}

	// invalid examples
	// @ts-expect-error, conflict between startunbounded and start values
	const B: StartUnboundedBin = { startunbounded: true, start: 0, stop: 1 }
	// @ts-expect-error, missing start value
	const C: StartUnboundedBin = { startunbounded: true }
	// @ts-expect-error, conflict between unbounded flags and assigned finite values for start, stop
	const D: StartUnboundedBin = { startunbounded: true, start: 0, stop: 1, stopunbounded: true }
	// @ts-expect-error, missing properties
	const E: StartUnboundedBin = {}
	// @ts-expect-error, adding a property that was not defined for this type
	E.extraProp = 'test'
}

// Stop unbounded bin
{
	// valid example
	const A: StopUnboundedBin = {
		stopunbounded: true,
		start: 0
	}

	// invalid examples
	// @ts-expect-error, conflict between stopunbounded and stop values
	const B: StopUnboundedBin = { stopunbounded: true, start: 0, stop: 1 }
	// @ts-expect-error, missing stop value
	const C: StopUnboundedBin = { stopunbounded: true }
	// @ts-expect-error, conflict between unbounded flags and assigned finite values for start, stop
	const D: StopUnboundedBin = { startunbounded: true, start: 0, stop: 1, stopunbounded: true }
}

// Fully bounded bin
{
	// valid example
	const A: FullyBoundedBin = {
		startinclusive: true,
		start: 0,
		stop: 1
	}

	// invalid examples
	// @ts-expect-error, missing start value
	const B: FullyBoundedBin = { stop: 1 }
	// @ts-expect-error, missing stop value
	const C: FullyBoundedBin = { start: 0 }
}

/*** test of union type being fed into a subtype-specific "handler" function ***/
// to be used as a 'generic' argument
type NumericBin = StartUnboundedBin | StopUnboundedBin | FullyBoundedBin

const handlers = {
	startUnbounded(bin: StartUnboundedBin) {
		console.log(bin)
	},
	fullyBounded(bin: FullyBoundedBin) {
		console.log(bin)
	},
	stopUnbounded(bin: StopUnboundedBin) {
		console.log(bin)
	}
}

/**********************************************************************
 * Test that tsc can infer that a type can be derived from
 * a union of types. This is important for the general approach
 * in the PP codebase to route arguments to specific handler functions.
 ***********************************************************************/

// these functions routes the bin argument to the correct handler function
function correctlyTypedProcessBin(bin: NumericBin) {
	if (bin.startunbounded) handlers.startUnbounded(bin as StartUnboundedBin)
	else if (bin.stopunbounded) handlers.stopUnbounded(bin as StopUnboundedBin)
	else handlers.fullyBounded(bin as FullyBoundedBin)
}

// not declared as part of the NumericBin type
type NonNumericBin = { fake: true }
// even though has an extra property compared to FullyBoundedBin,
// the tsc compiler would consider this equivalent
type LikeFullyBoundedBin = {
	start: number
	stop: number
	test: boolean
}

function incorrectProcessBin(bin: FullyBoundedBin) {
	// @ts-expect-error, the argument type is not StartUnboundedBin
	if (bin.startunbounded) handlers.startUnbounded(bin as StartUnboundedBin)
	// @ts-expect-error, the argument type is not StopUnboundedBin
	else if (bin.stopunbounded) handlers.stopUnbounded(bin as StopUnboundedBin)
	else {
		// @ts-expect-error, expects StartUnbounded as argument type
		handlers.startUnbounded(bin as FullyBoundedBin)
		// @ts-expect-error, expects StopUnbounded as argument type
		handlers.stopUnbounded(bin as FullyBoundedBin)
		// @ts-expect-error, since this function's argument type (NumericBin) does not include NonNumericBin
		handlers.fullyBounded(bin as NonNumericBinType)
		// !!! SHOULD WORK !!!
		handlers.fullyBounded(bin as LikeFullyBoundedBin)
		// !!! SHOULD WORK !!!
		handlers.fullyBounded(bin as FullyBoundedBin)
	}
}

/************************************************************************
 * Examples of better ways to define data structures to proactively avoid
 * any chance of having flag values that may conflict with each other
 *************************************************************************/

// Example of better type declarations
//
// NOTE: The bin type declarations in server/shared/types/terms/numeric.ts are good for now,
// the types below are meant to illustrate that there are different ways to write types that work.
//
// TODO: Use these better types, which will require code changes
//
type BetterStartUnboundedBin = {
	stop: number
	// by not using a flag, the 'inclusive' property completely avoids unintentionally having
	// `startinclusive: true && stopinclusive: true` at the same time
	inclusive: 'stop'
}

// NOTE: This approach also lessens the number of attributes/properties to define.
// A problem with flags is it's very easy to have too many of them, and each one has to be defined,
// and if they are mutually exclusive, most of the time that is not readily apparent.
type BetterStopUnboundedBin = {
	start: number
	inclusive: 'start'
}

type BetterFullyBoundedBin = {
	start: number
	stop: number
	// for numeric bins that are NOT standalone, using `inclusive: 'both'` will lead to conflict,
	// since adjoining bins can both contain the same boundary value
	inclusive: 'start' | 'stop'
}

type StandaloneBin = {
	start: number
	stop: number
	// for standalone bins, the option to include both start and stop values will not lead to conflict
	inclusive: 'start' | 'stop' | 'both'
}

type BetterNumericBin = BetterStartUnboundedBin | BetterStopUnboundedBin | BetterFullyBoundedBin | StandaloneBin
