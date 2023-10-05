import fs from 'fs'
import path from 'path'
import serverconfig from './serverconfig'
import { validate_termdb } from './mds3.init'

export function server_updateAttr(ds, sds) {
	/*
	ds: 
		an entry in genomes[{datasets:[ ... ]}]

	sds:
		bootstrap objects, that are elements of the "datasets" array from serverconfig, may contain .updateAttr[]
	*/
	if (!sds.updateAttr || ds.label) return
	for (const row of sds.updateAttr) {
		let pointer = ds
		for (const field of row) {
			// to guard against invalid keys, could be manual errors or updated dataset spec
			if (!pointer) continue

			if (typeof field == 'object') {
				// apply the key-value overrides to the object that is pointed to
				for (const k in field) {
					pointer[k] = field[k]
				}
			} else {
				// reset the reference to a subnested object
				pointer = pointer[field]
			}
		}
	}
	// do not re-update the attributes in case a dataset is reloaded
	// by itself without a full server restart
	if (ds.label) delete sds.updateAttr
}

/* 
	Set server routes to trigger the refresh the ds database from the web browser,
	without having to restart the server.
	
	Requires the following entry in the serverconfig.json under a genome.dataset:
	dataset = {"updateAttr": ["cohort", 'db', {"refresh": {route, files, cmd}}]}
	where
		.route STRING
			- the server route that exposes the db refresh feature
			- should contain a random substring for weak security,
			  for example 'pnet-refresh-r4Nd0m-5tr1n8', which will then be used as
			  http://sub.domain.ext:port/termdb-refresh.html?route=pnet-refresh-r4Nd0m-5tr1n8
*/

export function setDbRefreshRoute(ds, app, basepath) {
	if (!ds.cohort?.db?.refresh) return
	const r = ds.cohort.db.refresh
	// delete the optional 'refresh' attribute
	// so that the routes below will not be reset again
	// when init_db() is called after a
	// data file has been updated
	delete ds.cohort.db.refresh

	app.get(`${basepath}/${r.route}`, async (req, res) => {
		res.send({ label: ds.label, files: [] })
	})

	/*
		req.body{}
		.dbfile=path/to/dbfile to copy to ppr:/opt/data/pp/tp_native_dir/files/... (the dataset's data directory)
			e.g., file/hg19/pnet/clinical/db relative to serverconfig.tpmasterdir
	*/
	app.post(`${basepath}/${r.route}`, async (req, res) => {
		try {
			const dbfile = ds.cohort.db?.file?.startsWith(serverconfig.tpmasterdir)
				? ds.cohort.db.file
				: path.join(serverconfig.tpmasterdir, ds.cohort.db.file || '')
			// save file to text
			const q = req.body
			if (q.dbfile) {
				const source = path.join(serverconfig.tpmasterdir, q.dbfile)
				const stat = await fs.stat(source)
				if (!stat) throw `dbfile not found: '${source}'`
				const target = ds.cohort.db.file_fullpath || dbfile
				if (source === target) throw `db file source and target are the same`
				console.log(`copying ${source} to ${target}`)
				await fs.copyFile(source, target)
			} else {
				throw (
					`Updating input text files via the termdb-refresh page has been deprecated.` +
					`Please use the buildTermdb.bundle.js. pipeline before triggering this route to replace the db file.`
				)
			}
			await validate_termdb(ds)
			res.send({ status: 'ok' })
		} catch (e) {
			console.log(e)
			res.send({ error: e.error || e })
		}
	})
}
