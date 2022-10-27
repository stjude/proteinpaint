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
- **public**: a directory for tracking deployed html and static files in each subdirectory,
should be mostly relative symlinks to the public/* files and/or dirs
- **genomes**: relative symlinks to server/genomes, overrides, or additional ones
- **datasets**: relative symlinks to server/dataset, overrides, or additional ones
- **README.md**: optional, for additional information and any special instructions

[Workspace and Portal Topography](https://docs.google.com/drawings/d/1mNADxpq78wdl578CNLiI0YFVhGmgfZ9Qsya_ES9uSRc/edit?usp=sharing)

![Build reorg](https://user-images.githubusercontent.com/411031/195737050-874d47db-b5e7-45fc-a77a-21e44cdc1eab.png)
