#!/usr/bin/env node

;(async () => {
	const { default: serverconfig } = await import('../server/src/serverconfig.js')

	const propName = process.argv[2]
	if (!propName) {
		console.log(JSON.stringify(serverconfig, null, '   '))
	} else {
		let value = serverconfig
		for (const key of propName.split('.')) {
			value = value[key]
		}
		if (typeof value == 'object') console.log(JSON.stringify(value))
		else console.log(value)
	}
})()
