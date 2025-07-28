import serverconfig from '@sjcrh/proteinpaint-server/src/serverconfig.js'
import * as path from 'path'
import fs from 'fs'
import { spawnSync } from 'child_process'

/*
	copyDataFilesFromRepo2Tp()
	- does not work when tp is not writable, such as when the tp dir is mounted as read-only onto a container
	- must be called before genome and dataset init steps in initGenomeDs(), 
	  such as by calling in the genome js file like in genome/hg38.test.ts
*/
export async function copyDataFilesFromRepo2Tp(testPath) {
	// when running tests where the tp directory is not writable (such as from inside a container),
	// the workflow script should copy the server/test/tp dir as serverconfig.tpmasterdir
	// and not trigger the symlinks below
	if (fs.existsSync('/home/root/pp')) {
		console.warn('skipped TermdbTest copying, assumed the mounted host tp dir is not writable from within a container')
		return
	}

	const targetDir = path.join(serverconfig.binpath, 'test/tp', testPath)
	const datadir = path.join(serverconfig.tpmasterdir, testPath)

	// no need to copy files or set the symlink when the target TermdbTest dir
	// already equals the datadir under serverconfig.tpmasterdir
	if (targetDir === datadir) return

	try {
		await fs.promises.access(serverconfig.tpmasterdir)
	} catch {
		// the tp dir is not readable and/or writable,
		// may still be okay if the tp/files/hg38/TermdbTest already exists and is up-to-date
		console.log(`!!! insufficient permissions to create or update TermdbTest directory or symlink !!!`)
		return
	}

	try {
		if (!fs.existsSync(datadir)) {
			fs.symlinkSync(targetDir, datadir)
		} else if (fs.statSync(datadir).isDirectory()) {
			// support an option to have an actual TermdbTest dir locally instead of a symlink,
			// to make it easier to switch between native or container dev/test process,
			// since a local symlink will not work as a container mount
			console.log(`copying TermdbTest files to tp dir ...`)
			// do not delete, copy files from repo to tp
			const ps = spawnSync(`rsync`, ['-av', `${targetDir}/`, datadir], { encoding: 'utf-8' })
			if (ps.stderr) throw ps.stderr
			//console.log(421, [ps.stdout, ps.stderr])
		} else {
			console.log('replacing the TermdbTest symlink ...')
			fs.unlinkSync(datadir)
			fs.symlinkSync(targetDir, datadir)
		}
	} catch (error) {
		console.warn('Error while copying data files from Repo to Tp: ', error)
	}
}
