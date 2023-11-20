/*
	Non-asserted type declaration tests 
	
	For training only 
	- these tests are not meant to be written for all declared types
	
	- meant for simple "sanity check", that a declaration makes sense and catches errors
	
	- quick tests on lines commented with @ts-expect-error 
		- remove a // @ts-expect-error comment to see error message as emitted by the tsc compiler
		- fix the variable declaration value to match the expected type, tsc should emit "Unused '@ts-expect-error' directive"
	
	- !!! see the UselessBinType below for an example on how NOT to declare types !!!
*/
import { StartUnboundedBin, StopUnboundedBin, FullyBoundedBin } from '../terms/numeric.ts'

// Start unbounded Bin
{
	// valid example
	const A: StartUnboundedBin = {
		startunbounded: true,
		stop: 1
	}

	// invalid examples
	// @ts-expect-error
	const B: StartUnboundedBin = { startunbounded: true, start: 0, stop: 1 }
	// @ts-expect-error
	const C: StartUnboundedBin = { startunbounded: true }
	// @ts-expect-error
	const D: StartUnboundedBin = { startunbounded: true, start: 0, stop: 1, stopunbounded: true }
}

// Stop unbounded bin
{
	// valid example
	const A: StopUnboundedBin = {
		stopunbounded: true,
		start: 0
	}

	// invalid examples
	// @ts-expect-error
	const B: StopUnboundedBin = { stopunbounded: true, start: 0, stop: 1 }
	// @ts-expect-error
	const C: StopUnboundedBin = { stopunbounded: true }
	// @ts-expect-error
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
	// @ts-expect-error
	const B: FullyBoundedBin = { stop: 1 }
	// @ts-expect-error
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

// these functions routes the bin argument to the correct handler function
function correctlyTypedProcessBin(bin: NumericBin) {
	if (bin.startunbounded) handlers.startUnbounded(bin as StartUnboundedBin)
	else if (bin.stopunbounded) handlers.stopUnbounded(bin as StopUnboundedBin)
	else handlers.fullyBounded(bin as FullyBoundedBin)
}

// not declared as part of the NumericBin type
type NonNumericBin = { fake: true }
// even though has an extra property compared to FullyBoundedBin,
// the tsc compiler would si
type LikeFullyBoundedBin = {
	start: number
	stop: number
	test: boolean
}

function incorrectProcessBin(bin: FullyBoundedBin) {
	// @ts-expect-error
	if (bin.startunbounded) handlers.startUnbounded(bin as StartUnboundedBin)
	// @ts-expect-error
	else if (bin.stopunbounded) handlers.stopUnbounded(bin as StopUnboundedBin)
	else {
		// @ts-expect-error
		handlers.startUnbounded(bin as FullyBoundedBin)
		// @ts-expect-error
		handlers.stopUnbounded(bin as FullyBoundedBin)
		// @ts-expect-error, since this function's argument type (NumericBin) does not include NonNumericBin
		handlers.fullyBounded(bin as NonNumericBinType)
		// !!! SHOULD WORK !!!
		handlers.fullyBounded(bin as LikeFullyBoundedBin)
		// !!! SHOULD WORK !!!
		handlers.fullyBounded(bin as FullyBoundedBin)
	}
}

// Example of a bad type declaration, where everything is optional.
// Avoid declaring types with lots of optional properties, unless that's really expected.
// In the PP codebase, a union of types is more likely to be the correct way to declare
// a type when there are lots of optional properties that may conflict with each other.
type UselessBinType = {
	startunbounded?: boolean
	startinclusive?: boolean
	start?: number
	stop?: number
	stopinclusive?: boolean
	stopunbounded?: boolean
}

{
	// the UselesBinType matches objects with conflicting property values, which does not make sense
	const A: UselessBinType = {
		startunbounded: true,
		startinclusive: true,
		start: 0,
		stop: 1,
		stopinclusive: true,
		stopunbounded: true
	}
}

// Example of better type declaration
// TODO: Use these better types, which will require code changes
type BetterStartUnboundedBin = {
	stop: number
	// by not using a flag, completely avoids unintentionally having
	// `startinclusive: true && stopinclusive: true` at the same time
	inclusive: 'stop'
}

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
