// Below are request payload validator functions that are likely to be reused across many server routes.
// Route-specific validators should be coded in server/routes or server/checkers files.

export function validBoolean(input, err?: string): boolean {
	if (typeof input != 'boolean') throw err || `input must be a boolean`
	return input
}

// may use spread operator (return {...validGenomeDs, otherProp: '...'}) for convenience
// in request payloads that expect both genome and dslabel
export function validGenomeDs(input): { genome: string; dslabel: string } {
	const genome = validGenome(input.genome)
	const dslabel = validDslabel(input.dslabel)
	// TODO: may pass the genomes object as an argument
	return { genome, dslabel }
}

export function validGenome(value) {
	if (typeof value != 'string' || !value) throw 'genome should be a non-empty string'
	if (/\s+/.test(value)) throw 'invalid genome character'
	return value
}

export function validDslabel(value) {
	if (typeof value != 'string') throw 'dslabel should be a non-empty string'
	if (/\s+/.test(value)) throw 'invalid dslabel character'
	return value
}

export function validString(input, err?: string): string {
	if (typeof input != 'string' || !input) throw err || 'input must be a non-empty string'
	return input
}

export function validStringArr(input, err?: string): string[] {
	if (Array.isArray(input)) throw `input must be an array`
	for (const v of input) {
		if (typeof v != 'string' || !v) throw err || `array entry must be a non-empty string`
	}
	return input
}

export function validNumber(input): number {
	if (typeof input != 'number') throw 'dslabel should be a non-empty string'
	return input
}

export function validNumberArr(input, err?: string): string[] {
	if (Array.isArray(input)) throw `input must be an array`
	for (const v of input) {
		if (typeof v != 'number') throw err || `array entry must be a number`
	}
	return input
}
