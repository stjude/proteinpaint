import fs from 'fs'
import path from 'path'
import serverconfig from './serverconfig.js'
import { validate_termdb } from './mds3.init.js'

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
