import { table2col } from '#dom'

export class MetadataRenderer {
	//TODO: Need an example for testing
	renderMetadata(holder: any, imageViewData: any) {
		if (!imageViewData.metadata) return
		holder.select('div[id="metadata"]').remove()
		const holderDiv = holder.append('div').attr('id', 'metadata')

		const table = table2col({ holder: holderDiv })

		// Create table rows for each key-value pair
		Object.entries(JSON.parse(imageViewData.metadata)).forEach(([key, value]) => {
			const [c1, c2] = table.addRow()
			c1.html(key)
			c2.html(value)
		})
	}
}
