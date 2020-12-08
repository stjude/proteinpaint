import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'

const serverdata = {
	host: 'http://localhost:3000',
	basepath: 'proteinpaint/'
}

ReactDOM.render(<App serverdata = {serverdata} />, document.getElementById('aaa'))
