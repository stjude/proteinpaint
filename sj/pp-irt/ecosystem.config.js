module.exports = {
	apps: [
		{
			script: 'server.js',
			args: 'start',
			instances: 4,
			exec_mode: 'cluster',
			kill_timeout: 3000,
			wait_ready: true,
			listen_timeout: 3000
		}
	]
}
