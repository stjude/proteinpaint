import typia from 'typia'

import { createIs, createValidate } from 'typia'
import { HealthCheckResponse } from '../../src/health'
export const isHealthCheckResponse = (input: any): input is HealthCheckResponse => {
	const $join = (createIs as any).join
	const $io0 = (input: any): boolean =>
		('ok' === input.status || 'error' === input.status) &&
		true &&
		(undefined === input.genomes ||
			('object' === typeof input.genomes &&
				null !== input.genomes &&
				false === Array.isArray(input.genomes) &&
				$io1(input.genomes))) &&
		'object' === typeof input.versionInfo &&
		null !== input.versionInfo &&
		'string' === typeof (input.versionInfo as any).pkgver &&
		'string' === typeof (input.versionInfo as any).codedate &&
		'string' === typeof (input.versionInfo as any).launchdate &&
		(undefined === input.w || (Array.isArray(input.w) && input.w.every((elem: any) => 'number' === typeof elem))) &&
		(undefined === input.rs || 'number' === typeof input.rs)
	const $io1 = (input: any): boolean =>
		Object.keys(input).every((key: any) => {
			const value = input[key]
			if (undefined === value) return true
			if (RegExp(/(.*)/).test(key)) return 'object' === typeof value && null !== value && $io2(value)
			return true
		})
	const $io2 = (input: any): boolean =>
		'object' === typeof input.genedb &&
		null !== input.genedb &&
		$io3(input.genedb) &&
		(undefined === input.termdbs ||
			('object' === typeof input.termdbs &&
				null !== input.termdbs &&
				false === Array.isArray(input.termdbs) &&
				$io5(input.termdbs)))
	const $io3 = (input: any): boolean =>
		'string' === typeof input.buildDate &&
		(undefined === input.tables ||
			('object' === typeof input.tables &&
				null !== input.tables &&
				false === Array.isArray(input.tables) &&
				$io4(input.tables)))
	const $io4 = (input: any): boolean =>
		Object.keys(input).every((key: any) => {
			const value = input[key]
			if (undefined === value) return true
			if (RegExp(/(.*)/).test(key)) return 'number' === typeof value
			return true
		})
	const $io5 = (input: any): boolean =>
		Object.keys(input).every((key: any) => {
			const value = input[key]
			if (undefined === value) return true
			if (RegExp(/(.*)/).test(key)) return 'object' === typeof value && null !== value && $io3(value)
			return true
		})
	return 'object' === typeof input && null !== input && $io0(input)
}
export const validHealthCheckResponse = (input: any): typia.IValidation<HealthCheckResponse> => {
	const errors = [] as any[]
	const __is = (input: any): input is HealthCheckResponse => {
		const $join = (createValidate as any).join
		const $io0 = (input: any): boolean =>
			('ok' === input.status || 'error' === input.status) &&
			true &&
			(undefined === input.genomes ||
				('object' === typeof input.genomes &&
					null !== input.genomes &&
					false === Array.isArray(input.genomes) &&
					$io1(input.genomes))) &&
			'object' === typeof input.versionInfo &&
			null !== input.versionInfo &&
			'string' === typeof (input.versionInfo as any).pkgver &&
			'string' === typeof (input.versionInfo as any).codedate &&
			'string' === typeof (input.versionInfo as any).launchdate &&
			(undefined === input.w || (Array.isArray(input.w) && input.w.every((elem: any) => 'number' === typeof elem))) &&
			(undefined === input.rs || 'number' === typeof input.rs)
		const $io1 = (input: any): boolean =>
			Object.keys(input).every((key: any) => {
				const value = input[key]
				if (undefined === value) return true
				if (RegExp(/(.*)/).test(key)) return 'object' === typeof value && null !== value && $io2(value)
				return true
			})
		const $io2 = (input: any): boolean =>
			'object' === typeof input.genedb &&
			null !== input.genedb &&
			$io3(input.genedb) &&
			(undefined === input.termdbs ||
				('object' === typeof input.termdbs &&
					null !== input.termdbs &&
					false === Array.isArray(input.termdbs) &&
					$io5(input.termdbs)))
		const $io3 = (input: any): boolean =>
			'string' === typeof input.buildDate &&
			(undefined === input.tables ||
				('object' === typeof input.tables &&
					null !== input.tables &&
					false === Array.isArray(input.tables) &&
					$io4(input.tables)))
		const $io4 = (input: any): boolean =>
			Object.keys(input).every((key: any) => {
				const value = input[key]
				if (undefined === value) return true
				if (RegExp(/(.*)/).test(key)) return 'number' === typeof value
				return true
			})
		const $io5 = (input: any): boolean =>
			Object.keys(input).every((key: any) => {
				const value = input[key]
				if (undefined === value) return true
				if (RegExp(/(.*)/).test(key)) return 'object' === typeof value && null !== value && $io3(value)
				return true
			})
		return 'object' === typeof input && null !== input && $io0(input)
	}
	if (false === __is(input)) {
		const $report = (createValidate as any).report(errors)
		;((input: any, _path: string, _exceptionable: boolean = true): input is HealthCheckResponse => {
			const $join = (createValidate as any).join
			const $vo0 = (input: any, _path: string, _exceptionable: boolean = true): boolean =>
				[
					'ok' === input.status ||
						'error' === input.status ||
						$report(_exceptionable, {
							path: _path + '.status',
							expected: '("error" | "ok")',
							value: input.status
						}),
					true,
					undefined === input.genomes ||
						((('object' === typeof input.genomes && null !== input.genomes && false === Array.isArray(input.genomes)) ||
							$report(_exceptionable, {
								path: _path + '.genomes',
								expected: '(BuildByGenome | undefined)',
								value: input.genomes
							})) &&
							$vo1(input.genomes, _path + '.genomes', true && _exceptionable)) ||
						$report(_exceptionable, {
							path: _path + '.genomes',
							expected: '(BuildByGenome | undefined)',
							value: input.genomes
						}),
					((('object' === typeof input.versionInfo && null !== input.versionInfo) ||
						$report(_exceptionable, {
							path: _path + '.versionInfo',
							expected: 'VersionInfo',
							value: input.versionInfo
						})) &&
						$vo6(input.versionInfo, _path + '.versionInfo', true && _exceptionable)) ||
						$report(_exceptionable, {
							path: _path + '.versionInfo',
							expected: 'VersionInfo',
							value: input.versionInfo
						}),
					undefined === input.w ||
						((Array.isArray(input.w) ||
							$report(_exceptionable, {
								path: _path + '.w',
								expected: '(Array<number> | undefined)',
								value: input.w
							})) &&
							input.w
								.map(
									(elem: any, _index1: number) =>
										'number' === typeof elem ||
										$report(_exceptionable, {
											path: _path + '.w[' + _index1 + ']',
											expected: 'number',
											value: elem
										})
								)
								.every((flag: boolean) => flag)) ||
						$report(_exceptionable, {
							path: _path + '.w',
							expected: '(Array<number> | undefined)',
							value: input.w
						}),
					undefined === input.rs ||
						'number' === typeof input.rs ||
						$report(_exceptionable, {
							path: _path + '.rs',
							expected: '(number | undefined)',
							value: input.rs
						})
				].every((flag: boolean) => flag)
			const $vo1 = (input: any, _path: string, _exceptionable: boolean = true): boolean =>
				[
					false === _exceptionable ||
						Object.keys(input)
							.map((key: any) => {
								const value = input[key]
								if (undefined === value) return true
								if (RegExp(/(.*)/).test(key))
									return (
										((('object' === typeof value && null !== value) ||
											$report(_exceptionable, {
												path: _path + $join(key),
												expected: 'GenomeBuildInfo',
												value: value
											})) &&
											$vo2(value, _path + $join(key), true && _exceptionable)) ||
										$report(_exceptionable, {
											path: _path + $join(key),
											expected: 'GenomeBuildInfo',
											value: value
										})
									)
								return true
							})
							.every((flag: boolean) => flag)
				].every((flag: boolean) => flag)
			const $vo2 = (input: any, _path: string, _exceptionable: boolean = true): boolean =>
				[
					((('object' === typeof input.genedb && null !== input.genedb) ||
						$report(_exceptionable, {
							path: _path + '.genedb',
							expected: 'DbInfo',
							value: input.genedb
						})) &&
						$vo3(input.genedb, _path + '.genedb', true && _exceptionable)) ||
						$report(_exceptionable, {
							path: _path + '.genedb',
							expected: 'DbInfo',
							value: input.genedb
						}),
					undefined === input.termdbs ||
						((('object' === typeof input.termdbs && null !== input.termdbs && false === Array.isArray(input.termdbs)) ||
							$report(_exceptionable, {
								path: _path + '.termdbs',
								expected: '(TermdbsInfo | undefined)',
								value: input.termdbs
							})) &&
							$vo5(input.termdbs, _path + '.termdbs', true && _exceptionable)) ||
						$report(_exceptionable, {
							path: _path + '.termdbs',
							expected: '(TermdbsInfo | undefined)',
							value: input.termdbs
						})
				].every((flag: boolean) => flag)
			const $vo3 = (input: any, _path: string, _exceptionable: boolean = true): boolean =>
				[
					'string' === typeof input.buildDate ||
						$report(_exceptionable, {
							path: _path + '.buildDate',
							expected: 'string',
							value: input.buildDate
						}),
					undefined === input.tables ||
						((('object' === typeof input.tables && null !== input.tables && false === Array.isArray(input.tables)) ||
							$report(_exceptionable, {
								path: _path + '.tables',
								expected: '(GenomeDbTableInfo | undefined)',
								value: input.tables
							})) &&
							$vo4(input.tables, _path + '.tables', true && _exceptionable)) ||
						$report(_exceptionable, {
							path: _path + '.tables',
							expected: '(GenomeDbTableInfo | undefined)',
							value: input.tables
						})
				].every((flag: boolean) => flag)
			const $vo4 = (input: any, _path: string, _exceptionable: boolean = true): boolean =>
				[
					false === _exceptionable ||
						Object.keys(input)
							.map((key: any) => {
								const value = input[key]
								if (undefined === value) return true
								if (RegExp(/(.*)/).test(key))
									return (
										'number' === typeof value ||
										$report(_exceptionable, {
											path: _path + $join(key),
											expected: 'number',
											value: value
										})
									)
								return true
							})
							.every((flag: boolean) => flag)
				].every((flag: boolean) => flag)
			const $vo5 = (input: any, _path: string, _exceptionable: boolean = true): boolean =>
				[
					false === _exceptionable ||
						Object.keys(input)
							.map((key: any) => {
								const value = input[key]
								if (undefined === value) return true
								if (RegExp(/(.*)/).test(key))
									return (
										((('object' === typeof value && null !== value) ||
											$report(_exceptionable, {
												path: _path + $join(key),
												expected: 'DbInfo',
												value: value
											})) &&
											$vo3(value, _path + $join(key), true && _exceptionable)) ||
										$report(_exceptionable, {
											path: _path + $join(key),
											expected: 'DbInfo',
											value: value
										})
									)
								return true
							})
							.every((flag: boolean) => flag)
				].every((flag: boolean) => flag)
			const $vo6 = (input: any, _path: string, _exceptionable: boolean = true): boolean =>
				[
					'string' === typeof input.pkgver ||
						$report(_exceptionable, {
							path: _path + '.pkgver',
							expected: 'string',
							value: input.pkgver
						}),
					'string' === typeof input.codedate ||
						$report(_exceptionable, {
							path: _path + '.codedate',
							expected: 'string',
							value: input.codedate
						}),
					'string' === typeof input.launchdate ||
						$report(_exceptionable, {
							path: _path + '.launchdate',
							expected: 'string',
							value: input.launchdate
						})
				].every((flag: boolean) => flag)
			return (
				((('object' === typeof input && null !== input) ||
					$report(true, {
						path: _path + '',
						expected: 'HealthCheckResponse',
						value: input
					})) &&
					$vo0(input, _path + '', true)) ||
				$report(true, {
					path: _path + '',
					expected: 'HealthCheckResponse',
					value: input
				})
			)
		})(input, '$input', true)
	}
	const success = 0 === errors.length
	return {
		success,
		errors,
		data: success ? input : undefined
	} as any
}
