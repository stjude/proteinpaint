const fs = require('fs')
const path = require('path')

const sjppDir = path.join(__dirname, '../../sjpp')
// some lint issues should be errors locally to force developers to address issues
// sooner rather than being seen by others or in remote CI;
// these same issues should be warning in remote CI to not block workflows
const errOrWarn = fs.existsSync(sjppDir) ? 'error' : 'warn'

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
