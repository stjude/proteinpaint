const tape = require("tape")
const d3s = require("d3-selection")
const treeInit = require("./tdb.tree").treeInit

const terms = [
	{
		id: 0,
		name: "Root",
		level: 0,
		terms: [
			{
				id: 1,
				name: "Cancer-Related",
				level: 1,
				terms: [
					{
						id: 3,
						name: "Diagnosis",
						level: 2,
						terms: [
							{
								id: 9,
								name: "Diagnosis Group",
								level: 3
							},
							{
								id: 10,
								name: "Diagnosis Year",
								level: 3
							}
						]
					},
					{
						id: 4,
						name: "Follow-up",
						level: 2
					},
					{
						id: 5,
						name: "Treatment",
						level: 2
					}
				]
			},
			{
				id: 2,
				name: "Demographics",
				level: 1,
				terms: [
					{
						id: 6,
						name: "Age",
						level: 2
					},
					{
						id: 7,
						name: "Sex",
						level: 2
					},
					{
						id: 8,
						name: "Race",
						level: 2
					}
				]
			}
		]
	}
]

tape("\n", function(test) {
	test.pass("-***- components/tree -***-")
	test.end()
})

tape.only("Tree Ui", function(test) {
	const tree = treeInit({
		terms,
		holder: d3s.select(document.body).append("div"),
		debug: true
	})
		.on("postRender.test", runTests)
		.main({ 0: true })

	function runTests() {
		test.equal(
			tree.Inner.dom.holder.selectAll(".termdiv-1").size(),
			terms[0].terms.length,
			"buttons should match the number of root terms"
		)
		test.end()
	}
})
