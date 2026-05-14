const fs = require('fs')
const path = require('path')

module.exports = {
	root: false,
	rules: {
		'no-restricted-imports': [
			'error',
			{
				// Blocks all imports except relative imports starting with './'
				// note that using a subpath hash-prefixed #types pattern doesn't work
				patterns: [
					'*types',
					'*types/*',
					'*../src/*',
					'!./*.js',
					'*/client*',
					'*/server*',
					'*proteinpaint-client*',
					'*proteinpaint-server*'
				]
			}
		]

		// "import/no-restricted-paths": [
		// 	"error",
		// 	{
		//   	"zones": [
		//     	{
		//         "target": "./constants",    // Files in this folder...
		//         "from": "./src",   // ...cannot import from this folder.
		//         //"message": "shared/utils/constants code files should not import from any source outside the constants dir."
		//       },
		//       // {
		//       //   "target": "./constants",    // Files in this folder...
		//       //   "from": "../*",   // ...cannot import from this folder.
		//       //   "message": "shared/utils/constants code files should not import from any source outside the constants dir."
		//       // }
		//     ]
		//   }
		// ]
	}
}
