const GenTitle = 'General:' // catch-all, will be used if there are no headings in the releaseTxt argument to getSections()
const FeatTitle = 'Features:' // enhancements, prototypes
const FixTitle = 'Fixes:' // bug fixes
const DevOpsTitle = 'DevOps:' // engineering tasks, includes build, CI, refactor, performance, tests
const BreakTitle = 'Breaking Change:' // anything that changes the runproteinpaint() or server API; TODO: how about new system deps or support files?
const DocsTitle = 'Documentation:' // includes chores, this change category should not trigger a release by itself?

// These are ordered as they should appear in the changelog release
const titles = [FeatTitle, FixTitle, GenTitle, DevOpsTitle, DocsTitle, BreakTitle]

module.exports = {
	titles,
	keywordsToTitle: {
		breaking: BreakTitle,
		general: GenTitle,
		feat: FeatTitle,
		fix: FixTitle,
		devops: DevOpsTitle,
		docs: DocsTitle
	},
	getSections(releaseTxt, _bySection = {}) {
		const bySection = Object.assign(
			{
				[BreakTitle]: [],
				[GenTitle]: [],
				[FeatTitle]: [],
				[FixTitle]: [],
				[DevOpsTitle]: [],
				[DocsTitle]: []
			},
			_bySection
		)

		const lines = releaseTxt.split('\n').map(l => l.trim())
		let currSection = bySection[GenTitle]
		for (const line of lines) {
			// l can be a section title or entry
			const matchingTitle = titles.find(t => t.toLowerCase().startsWith(line.toLowerCase()))
			const l = matchingTitle || line
			if (l in bySection) {
				// switch to the next section
				currSection = bySection[l]
			} else if (l?.startsWith('- ') && !currSection.includes(l)) {
				currSection.push(l)
			}
		}
		return bySection
	}
}
