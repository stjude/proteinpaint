import child_process from 'child_process'
import { run_R } from '@sjcrh/proteinpaint-r'

export async function checkDependenciesAndVersions(serverconfig) {
	if (serverconfig.features.skip_checkDependenciesAndVersions) {
		console.log('SKIPPED checkDependenciesAndVersions()')
		return
	}

	// test if R has all required libraries
	await run_R('validate.pkgs.R', null, null, 'utils')

	// samtools and bcftools usually have similar installed versions
	const htslibMinorVer = 10
	{
		const lines = child_process
			.execSync(serverconfig.samtools + ' --version', { encoding: 'utf8' })
			.trim()
			.split('\n')
		// first line should be "samtools 1.14"
		const [name, v] = lines[0].split(' ')
		if (name != 'samtools' || !v) throw 'cannot run "samtools version"'
		const [major, minor] = v.split('.')
		if (major != '1') throw 'samtools not 1.*'
		const i = Number(minor)
		if (i < htslibMinorVer) throw `samtools not >= 1.${htslibMinorVer}`
	}
	{
		const lines = child_process
			.execSync(serverconfig.bcftools + ' -v', { encoding: 'utf8' })
			.trim()
			.split('\n')
		// first line should be "bcftools 1.14"
		const [name, v] = lines[0].split(' ')
		if (name != 'bcftools' || !v) throw 'cannot run "bcftools version"'
		const [major, minor] = v.split('.')
		if (major != '1') throw 'bcftools not 1.*'
		const i = Number(minor)
		if (i < htslibMinorVer) throw `bcftools not >= 1.${htslibMinorVer}`
	}
}
