/********************************************
Unit tests for the sjcrh package versions in the /healthcheck versionInfo.deps (server/src/health.ts getDeps())

Uses temporary fixture package.json files, laid out as installed packages:
  <tmp>/node_modules/@sjcrh/proteinpaint-server/package.json
  <tmp>/node_modules/@sjcrh/proteinpaint-front/package.json
  <tmp>/package.json (the embedding project)

Run with (must use tsx + the sjpp/dev condition):
  cd proteinpaint/server && npx tsx --conditions=sjpp/dev src/test/healthDeps.unit.spec.ts
or run the whole unit suite (as CI does):
  cd proteinpaint/server && npm run test:unit
*********************************************/
import tape from 'tape'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getDeps } from '#src/health.ts'

/**************
 helper functions
***************/

// create a fixture dir with the given package.json contents, an undefined value means the package is not installed
function getFixture(pkgs: { server?: any; front?: any; project?: any }) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-healthdeps-'))
	const binpath = path.join(dir, 'node_modules/@sjcrh/proteinpaint-server')
	const write = (pkgDir: string, json: any) => {
		fs.mkdirSync(pkgDir, { recursive: true })
		fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify(json))
	}
	if (pkgs.server) write(binpath, pkgs.server)
	if (pkgs.front) write(path.join(dir, 'node_modules/@sjcrh/proteinpaint-front'), pkgs.front)
	if (pkgs.project) write(dir, pkgs.project)
	return { dir, binpath, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) }
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- health getDeps() -***-')
	test.end()
})

tape('getDeps(): reports the client version that is pinned by the installed front package', test => {
	const f = getFixture({
		server: { version: '2.215.0', _buildTime: '2026-09-30T00:00:00Z' },
		front: {
			version: '2.215.0',
			_buildTime: '2026-09-30T00:00:00Z',
			devDependencies: { '@sjcrh/proteinpaint-client': '2.215.0', webpack: '^5.76.0' }
		},
		project: { dependencies: { '@sjcrh/proteinpaint-server': '2.215.0', '@sjcrh/proteinpaint-front': '2.215.0' } }
	})
	try {
		test.deepEqual(
			getDeps(f.binpath, f.dir),
			{
				'@sjcrh/proteinpaint-server': { installed: '2.215.0', buildTime: '2026-09-30T00:00:00Z', entry: '2.215.0' },
				'@sjcrh/proteinpaint-front': { installed: '2.215.0', buildTime: '2026-09-30T00:00:00Z', entry: '2.215.0' },
				'@sjcrh/proteinpaint-client': { bundled: '2.215.0' }
			},
			'should report the installed, declared, and bundled versions'
		)
	} finally {
		f.cleanup()
	}
	test.end()
})

tape('getDeps(): a front package without devDependencies', test => {
	const f = getFixture({ server: { version: '2.215.0' }, front: { version: '2.215.0' } })
	try {
		const deps = getDeps(f.binpath, f.dir)
		test.deepEqual(
			deps['@sjcrh/proteinpaint-front'],
			{ installed: '2.215.0', buildTime: undefined },
			'should report front'
		)
		test.equal(deps['@sjcrh/proteinpaint-client'], undefined, 'should not report a client version')
	} finally {
		f.cleanup()
	}
	test.end()
})

tape('getDeps(): a declared front package that is not installed', test => {
	const f = getFixture({
		server: { version: '2.215.0' },
		project: { dependencies: { '@sjcrh/proteinpaint-front': '^2.215.0' } }
	})
	try {
		const deps = getDeps(f.binpath, f.dir)
		test.deepEqual(deps['@sjcrh/proteinpaint-front'], { entry: '^2.215.0' }, 'should only report the declared entry')
		test.equal(deps['@sjcrh/proteinpaint-client'], undefined, 'should not report a client version')
	} finally {
		f.cleanup()
	}
	test.end()
})
