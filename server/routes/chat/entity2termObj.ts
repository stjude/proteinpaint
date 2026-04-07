export function inferTermObjFromEntity(entity: any, type: string) {
	if (type === 'summary') {
		for (const [key, value] of Object.entries(entity)) {
			if (value === undefined || !value) continue
			if (value.termType !== 'dictionary') continue
			console.log(`${key}: ${value.phrase}`)
		}
	}
}
