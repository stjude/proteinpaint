/*
	Helper script for stopping selected pp processes
	that are monitored by forever

	- assumes all pp processes will have a forever uid='pp'
*/
const forever = require('forever')

forever.list(false, (err, lst) => {
	if (err) throw err
	const pplst = lst.filter(p => p.uid === 'pp')
	// sort from oldest to newest pp process
	pplst.sort((a, b) => a.ctime - b.ctime) //console.log(pplst)
	const arg2 = process.argv[2]
	let retain
	if (arg2 == 'error') {
		if (pplst.length > 1) {
			// keep the oldest existing process if there is an error
			retain = pplst.slice(0, 1)
		} else {
			// delete the only active pp process if it is in error
			retain = []
		}
	} else if (arg2) {
		// slice with the user-supplied argument
		retain = pplst.slice(...JSON.parse(arg2))
	} else {
		// default to keep the most recent process
		retain = pplst.slice(-1)
	}
	console.log('arg2=', arg2, 'retain.length=', retain.length)
	for (const ps of pplst) {
		if (!retain.includes(ps)) {
			const i = lst.indexOf(ps)
			console.log(`stopping pp process index=${i} ...`)
			forever.stop(i)
			console.log(`NOTE: if this hangs:
			$ Control^C
			$ ssh [host]
			$ cd /opt/app/pp
			
			$ forever stop ${i} # may have to repeat multiple times
			# - OR - 
			$ ps aux | forever
			$ kill [process ID of pp-forever process]
			
			# fix your error in data, code, and/or configuration
			$ ./proteinpaint_run_node.sh # or re-deploy again
			`)
		}
	}
})
