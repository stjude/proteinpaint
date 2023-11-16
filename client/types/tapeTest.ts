export type Tape = {
	/** Runs only that test in the file or in the test as a whole. If more than one, will throw an error. https://github.com/ljharb/tape#testonlyname-opts-cb*/
	only: () => void
	/** Skips test whilst running the test file or all tests*/
	skip: () => void
}

export type Test = {
	/**Strict comparisons (i.e.===) https://github.com/ljharb/tape#tdeepequalactual-expected-msg */
	deepEqual: (a: any, b: any, message: string) => void
	/**Equivalent to Object.is(actual, expected). Not the same as test.deepEqual. https://github.com/ljharb/tape#tenderr */
	end: () => void
	/**https://github.com/ljharb/tape#tequalactual-expected-msg */
	equal: (a: any, b: any, message: string) => void
	/**Displays a simple message in the console when test fails. https://github.com/ljharb/tape#tfailmsg */
	fail: (a: string) => void
	/**If statement (a) is false, test passes. Equivalent to test.false and not the preferred method*/
	false: (a: any, message: string) => void
	/** Returns true if all tests pass. Fails if any tests fails. Used at the end of the file*/
	_ok: boolean
	/**If statement (a) is true, test passes. Equivalent of .true. https://github.com/ljharb/tape#tokvalue-msg*/
	ok: (a: any, message: string) => void
	/** https://github.com/ljharb/tape#tnotdeepequalactual-expected-msg*/
	notDeepEqual: (a: any, b: any, message: string) => void
	/**https://github.com/ljharb/tape#tnotequalactual-expected-msg */
	notEqual: (a: any, b: any, message: string) => void
	/**https://github.com/ljharb/tape#tfailmsg */
	notOk: (a: any, message: string) => void
	/** Displays a simple message in the console when test passes. https://github.com/ljharb/tape#tfailmsg */
	pass: (message: string) => void
	/**Number of tests within the entire tape function expected. test.end() is not required when test.plan is present. https://github.com/ljharb/tape#tplann */
	plan: (n: number) => void
	/**Number of ms before the test fails. Important for rendering testing. https://github.com/ljharb/tape#ttimeoutafterms */
	timeoutAfter: (ms: number) => void
	/**If statement (a) is true, test passes. Equivalent of .ok*/
	true: (a: any, message: string) => void
}
