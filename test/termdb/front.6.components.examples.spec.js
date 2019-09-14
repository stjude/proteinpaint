const tape = require("tape")
const d3s = require("d3-selection")
const termjson = require("./termjson").termjson
const helpers = require("../front.helpers.js")
const treeInit = require("../../src/components/tree").init

const terms = [
	{
		id: 0,
		name: "Cancer-Related",
		level: 0,
		terms: [
			{
				id: 3,
				name: "Diagnosis",
				level: 1
			},
			{
				id: 4,
				name: "Follow-up",
				level: 1
			},
			{
				id: 5,
				name: "Treatment",
				level: 1
			}
		]
	},
	{
		id: 1,
		name: "Demographics",
		level: 0,
		terms: [
			{
				id: 6,
				name: "Age",
				level: 1
			},
			{
				id: 7,
				name: "Sex",
				level: 1
			},
			{
				id: 8,
				name: "Race",
				level: 1
			}
		]
	} /* {
	id: 2,
	name: "Outcomes",
	level: 0,
	terms: []
}*/
]

tape("\n", function(test) {
	test.pass("-***- components/tree -***-")
	test.end()
})

tape.skip("Tree Ui", function(test) {
	const tree = treeInit({
		terms,
		holder: d3s.select(document.body).append("div"),
		debug: true
	})
		.on("postRender.test", runTests)
		.main()

	function runTests() {
		console.log(tree)
		test.equal(
			tree.priv.dom.holder.selectAll(".termbtn-0").size(),
			terms.length,
			"buttons should match the number of root terms"
		)
		test.end()
	}
})
