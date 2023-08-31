const GenTitle = 'General:'
const FeatTitle = 'Features:'
const FixTitle = 'Fixes:'

module.exports = {
	GenTitle,
	FeatTitle,
	FixTitle,
	getSections(releaseTxt, _bySection = null) {
		const bySection = _bySection || {
			[GenTitle]: [],
			[FeatTitle]: [],
			[FixTitle]: []
		}
		const lines = releaseTxt.split('\n').map(l => l.trim())
		let currSection = bySection[GenTitle]
		for (const line of lines) {
			if (line in bySection) {
				// switch to the next section
				currSection = bySection[line]
			} else if (line?.startsWith('- ') && !currSection.includes(line)) {
				currSection.push(line)
			}
		}
		return bySection
	}
}
