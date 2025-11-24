import { renderTable, sayerror } from '#dom'

export class UsersRender {
	dom: any
	users: string[]

	constructor(dom: any, users: string[] = []) {
		this.dom = dom
		this.users = users.slice()
	}

	render() {
		// container
		const container = this.dom.holder
			.append('div')
			.attr('id', 'sjpp-users-render')
			.attr('class', 'sjpp-deletable-ai-prjt-admin-div')
			.style('padding', '10px')

		const inputRow = container.append('div').attr('class', 'sjpp-users-input-row').style('margin-bottom', '10px')

		const input = inputRow
			.append('input')
			.attr('type', 'text')
			.attr('placeholder', 'user@example.com')
			.attr('id', 'sjpp-user-email-input')
			.style('margin-right', '8px')
			.style('width', '300px')

		const addBtn = inputRow
			.append('div')
			.text('Add')
			.classed('sja_menuoption', true)
			.style('display', 'inline-block')
			.property('disabled', true)
			.on('click', () => {
				const email = input.property('value').trim()
				const showError = (msg: string) => {
					sayerror(this.dom.errorDiv, msg)
					// clear after 3s
					setTimeout(() => this.dom.errorDiv.selectAll('*').remove(), 3000)
				}

				if (email.length === 0) {
					return showError('Email cannot be empty')
				}

				const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

				if (!emailRe.test(email)) {
					return showError('Invalid email address')
				}

				if (this.users.includes(email)) {
					return showError('Email already added')
				}

				this.users.push(email)
				input.property('value', '')
				addBtn.property('disabled', true)
				this.renderTableArea(container)
			})

		input.on('input', () => {
			addBtn.property('disabled', input.property('value').trim().length === 0)
		})

		this.renderTableArea(container)
	}

	private renderTableArea(container: any) {
		container.select('.sjpp-users-table-area').remove()

		const tableDiv = container.append('div').attr('class', 'sjpp-users-table-area').style('padding', '6px 0')

		if (!this.users.length) {
			tableDiv.append('div').text('No users added yet.').style('color', '#666')
			return
		}

		const columns = [{ label: 'Email', sortable: true }]

		const columnButtons = [
			{
				text: '×',
				class: 'sja_menuoption',
				callback: (_, idx: number) => {
					// remove user and re-render
					this.users.splice(idx, 1)
					// clear and re-render table area
					container.select('.sjpp-users-table-area').remove()
					this.renderTableArea(container)
				}
			}
		]

		renderTable({
			div: tableDiv,
			rows: this.users.map(u => [{ value: u }]),
			columns,
			columnButtons,
			singleMode: false,
			striped: false,
			showLines: false,
			resize: true
		})
		tableDiv.selectAll('.sja_menuoption').html('×<div></div>')
	}
}
