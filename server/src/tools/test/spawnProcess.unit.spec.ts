import tape from 'tape'
import path from 'path'
import { spawnSync } from 'child_process'
import { spawnProcess, unsupportedComputation } from '../spawnProcess.ts'

/*
Tests
	spawnProcess()
*/

const modulePath = path.join(import.meta.dirname, '../spawnProcess.ts')

tape('\n', test => {
	test.comment('-***- tools/spawnProcess -***-')
	test.end()
})

tape('spawnProcess() starts a process when a child process is allowed', async test => {
	const code = await new Promise(resolve => spawnProcess('true', []).on('close', resolve))
	test.equal(code, 0, 'should run the command')
	test.end()
})

tape('spawnProcess() throws a neutral error when the permission model does not allow a child process', test => {
	// a node process with the permission model and without --allow-child-process, which may read only this module
	const checks = `
		const { spawnProcess, unsupportedComputation } = await import(${JSON.stringify(modulePath)})
		try {
			spawnProcess('/usr/local/bin/bcftools', ['view'])
			console.log('started')
		} catch (e) {
			console.log(e === unsupportedComputation ? 'neutral error' : 'other error: ' + e)
		}`
	const result = spawnSync(
		process.execPath,
		['--permission', `--allow-fs-read=${path.dirname(modulePath)}`, '--input-type=module', '-e', checks],
		{ encoding: 'utf8' }
	)
	test.equal(result.stdout.trim(), 'neutral error', 'should throw the neutral error, without starting the process')
	test.ok(result.stderr.includes('bcftools: not started'), 'should log the tool name')
	test.notOk(unsupportedComputation.includes('child'), 'should not name the permission in the error')
	test.end()
})
