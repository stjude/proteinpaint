export type TypeTester = (t: any) => boolean

export type DocArg = {
	type: string
	test: TypeTester
}

export const test = {} as any

export function doc(opts: DocArg) {
	if (opts.type in test) throw `test['${opts.type}'] already exists`
	test[opts.type] = opts.test
}
