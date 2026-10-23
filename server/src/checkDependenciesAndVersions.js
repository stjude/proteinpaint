import { run_R } from '@sjcrh/proteinpaint-r'
import { runToolOutput } from './tools/index.ts'

/*
Checks the external tools at launch. Every tool is optional: a missing or unusable tool is logged and recorded in
dependencies{}, instead of stopping the server, and a request that needs the tool fails with an error.
*/

/** true if a tool passed its check, false if it did not, undefined if it was not checked */
export const dependencies = { R: undefined, bcftools: undefined }

export async function checkDependenciesAndVersions(serverconfig) {
	if (serverconfig.features.skip_checkDependenciesAndVersions) {
		console.log('SKIPPED checkDependenciesAndVersions()')
		return dependencies
	}
	// R and bcftools are started as child processes, which an image without them does not allow, see
	// PP_ALLOW_CHILD_PROCESS in container/envHelpers.mjs
	if (process.permission && !process.permission.has('child')) {
		console.log('the node permission model does not allow a child process, so R and bcftools are not usable')
		dependencies.R = false
		dependencies.bcftools = false
		return dependencies
	}

	// test if R has all required libraries
	dependencies.R = await isUsable('R', () => run_R('validate.pkgs.R', null, null, 'utils'))
	dependencies.bcftools = await isUsable('bcftools', checkBcftools)
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

async function checkBcftools() {
	// bcftools has the version of the htslib that it is built with
	const htslibMinorVer = 10
	const lines = (await getVersionOutput('bcftools.version')).split('\n')
	// first line should be "bcftools 1.14"
	const [name, v] = lines[0].split(' ')
	if (name != 'bcftools' || !v) throw 'cannot run "bcftools version"'
	const [major, minor] = v.split('.')
	if (major != '1') throw 'bcftools not 1.*'
	const i = Number(minor)
	if (i < htslibMinorVer) throw `bcftools not >= 1.${htslibMinorVer}`
}

// returns the trimmed stdout of a version check; throws if the tool exits with an error, like execSync() did
async function getVersionOutput(op) {
	const { code, stdout, stderr } = await runToolOutput(op, {})
	if (code !== 0) throw `${op} exited with code ${code}: ${stderr.trim()}`
	return stdout.trim()
}
