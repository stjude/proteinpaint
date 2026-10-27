import { run_R } from '@sjcrh/proteinpaint-r'

/*
Checks the external tools at launch. Every tool is optional: a missing or unusable tool is logged and recorded in
dependencies{}, instead of stopping the server, and a request that needs the tool fails with an error.
*/

/** true if a tool passed its check, false if it did not, undefined if it was not checked */
export const dependencies = { R: undefined }

export async function checkDependenciesAndVersions(serverconfig) {
	if (serverconfig.features.skip_checkDependenciesAndVersions) {
		console.log('SKIPPED checkDependenciesAndVersions()')
		return dependencies
	}

	// test if R has all required libraries
	dependencies.R = await isUsable('R', () => run_R('validate.pkgs.R', null, null, 'utils'))
	return dependencies
}

/** returns true if check() resolves, or logs the error and returns false */
async function isUsable(name, check) {
	try {
		await check()
		return true
	} catch (e) {
		console.warn(`WARNING: ${name} is not usable, requests that need it will fail: ${e?.message || e}`)
		return false
	}
}
