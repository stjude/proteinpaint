# SJ Proteinpaint Portals

Each subdirectory in this folder tracks the portal deployment to the similarly named SJ host machine.

## Expected in each subdirectory

- **package.json**

```json
	"private": true,
	"dependencies": {
		"@stjude/proteinpaint-front": "...",
		"@stjude/proteinpaint-server": "...",
	},
	"files": [
		"public",
		"dataset",
		"genomes"
	]
```
- **deploy.sh**: a script to deploy the package and install at the target host machine
- **public**: a directory for tracking deployed html and static files in each subdirectory,
should be mostly relative symlinks to the public/* files and/or dirs
- **genomes**: relative symlinks to server/genomes, overrides, or additional ones
- **datasets**: relative symlinks to server/dataset, overrides, or additional ones
- **README.md**: optional, for adidtional information and any special instructions


