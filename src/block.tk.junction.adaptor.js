export function junctionfromtemplate(tk, template) {
	if (!template.tracks) {
		if (template.file || template.url) {
			/*
			no .tracks[] but has .file/.url
			old format of defining single track
			or for adding a member track by clicking a dot in beeswarm plot
			*/
			template.tracks = [
				{
					file: template.file,
					url: template.url,
					indexURL: template.indexURL
				}
			]
			delete template.file
			delete template.url
			delete template.indexURL
			delete tk.file
			delete tk.url
			delete tk.indexURL
		} else {
			// no tracks
			return '.tracks[] missing from junction track template'
		}
	}
	tk.tracks = []
	for (const t0 of template.tracks) {
		const t1 = {}
		for (const k in t0) {
			t1[k] = t0[k]
		}
		tk.tracks.push(t1)
	}
	if (tk.tracks.length == 0) {
		return '.tracks[] has 0 length for junction track'
	}

	/*
	INITSETSIZE
	axisheight and other size remains undefined
	for it needs to know if the track is single sample or multi-sample
	upon first time data load, it will be able to tell that and set size accordingly
	*/

	if (template.categories) {
		tk.categories = {}
		for (const k in template.categories) {
			const t = template.categories[k]
			tk.categories[k] = {
				color: t.color,
				label: t.label
			}
		}
	} else {
		// no category preconfig, if found .type from data, will create on the fly
		tk.nocatepreconfig = true
	}
	return null
}

export function junctionmaketk(tk, block) {
	tk.uninitialized = true
}

export function junctionload(tk, block) {
	import('./block.tk.junction').then(_ => {
		_.junctionload(tk, block)
	})
}
