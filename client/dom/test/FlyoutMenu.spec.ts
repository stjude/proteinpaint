import tape from 'tape'
import { FlyoutMenu, type FlyoutMenuOption } from '../FlyoutMenu'
import * as d3s from 'd3-selection'

/** Test file for development purposes only */

/**************
 helper functions
***************/

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
}

const mockOptions: FlyoutMenuOption[] = [
	{
		text: 'Header'
	},
	{
		label: 'Option 1 with callback only',
		callback: closeMenus => {
			console.log('Option 1 clicked')
			closeMenus()
		}
	},
	{
		html: '<p>Custom html</p>'
	},
	{
		label: 'Option 2 with Submenu',
		isSubmenu: true,
		options: [
			{
				text: 'First submenu'
			},
			{
				label: 'Option 1, close callback only',
				callback: closeMenus => {
					closeMenus()
				}
			},
			{
				label: 'Option 2 with Submenu',
				isSubmenu: true,
				options: [
					{
						text: 'Second submenu'
					},
					{
						label: 'Option 1, close callback only',
						callback: closeMenus => {
							closeMenus()
						}
					},
					{
						html: '<p>Custom html still works. </p>'
					},
					{
						label: 'Option 2 with flyout',
						isSubmenu: true,
						callback: holder => {
							holder.append('div').style('padding', '10px').text('Custom flyout content. Click out to close.')
						}
					}
				]
			}
		]
	},
	{
		label: 'Option 2 with flyout',
		isSubmenu: true,
		callback: holder => {
			holder.append('div').style('padding', '10px').text('Custom flyout content. Click out to close.')
		}
	}
]

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- dom/FlyoutMenu -***-')
	test.end()
})

tape('Default FlyoutMenu behavior', test => {
	test.timeoutAfter(2000)
	const holder = getHolder()
	holder
		.append('button')
		.text('Open Menu')
		.on('click', () => {
			new FlyoutMenu({
				options: mockOptions
			})
		})
	test.end()
})
