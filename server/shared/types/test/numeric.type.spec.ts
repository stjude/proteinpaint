/*
	Non-asserted type declaration tests 
	
	For training only 
	- these tests are not meant to be written for all declared types
	- meant for simple "sanity check", that a declaration makes sense and catches errors
	- the // @ts-expect-error comment tells tsc to expect type errors on the next line,
		where tsc should not emit a message, but if there are no detected type errors
		then emit a message ("Unused '@ts-expect-error' directive")
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
type NonNumericBinType = { fake: true }
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
		// @ts-expect-error, since this function's argument type (NumericBin) does not include NonNumericBinType
		handlers.fullyBounded(bin as NonNumericBinType)
		// !!! SHOULD WORK !!!
		handlers.fullyBounded(bin as LikeFullyBoundedBin)
		// !!! SHOULD WORK !!!
		handlers.fullyBounded(bin as FullyBoundedBin)
	}
}
