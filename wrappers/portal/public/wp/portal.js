!(function(e, t) {
	if ('object' == typeof exports && 'object' == typeof module) module.exports = t()
	else if ('function' == typeof define && define.amd) define([], t)
	else {
		var n = t()
		for (var r in n) ('object' == typeof exports ? exports : e)[r] = n[r]
	}
})(window, function() {
	return (function(e) {
		var t = {}
		function n(r) {
			if (t[r]) return t[r].exports
			var a = (t[r] = { i: r, l: !1, exports: {} })
			return e[r].call(a.exports, a, a.exports, n), (a.l = !0), a.exports
		}
		return (
			(n.m = e),
			(n.c = t),
			(n.d = function(e, t, r) {
				n.o(e, t) || Object.defineProperty(e, t, { enumerable: !0, get: r })
			}),
			(n.r = function(e) {
				'undefined' != typeof Symbol &&
					Symbol.toStringTag &&
					Object.defineProperty(e, Symbol.toStringTag, { value: 'Module' }),
					Object.defineProperty(e, '__esModule', { value: !0 })
			}),
			(n.t = function(e, t) {
				if ((1 & t && (e = n(e)), 8 & t)) return e
				if (4 & t && 'object' == typeof e && e && e.__esModule) return e
				var r = Object.create(null)
				if ((n.r(r), Object.defineProperty(r, 'default', { enumerable: !0, value: e }), 2 & t && 'string' != typeof e))
					for (var a in e)
						n.d(
							r,
							a,
							function(t) {
								return e[t]
							}.bind(null, a)
						)
				return r
			}),
			(n.n = function(e) {
				var t =
					e && e.__esModule
						? function() {
								return e.default
						  }
						: function() {
								return e
						  }
				return n.d(t, 'a', t), t
			}),
			(n.o = function(e, t) {
				return Object.prototype.hasOwnProperty.call(e, t)
			}),
			(n.p = '/wp/'),
			n((n.s = 15))
		)
	})([
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }), (t.root = void 0), (t.Selection = R)
			var r = E(n(22)),
				a = E(n(23)),
				o = E(n(24)),
				i = E(n(25)),
				l = E(n(12)),
				u = E(n(27)),
				s = E(n(28)),
				f = E(n(29)),
				c = E(n(30)),
				d = E(n(31)),
				p = E(n(32)),
				h = E(n(33)),
				v = E(n(34)),
				m = E(n(35)),
				y = E(n(36)),
				g = E(n(37)),
				b = E(n(14)),
				_ = E(n(38)),
				x = E(n(39)),
				w = E(n(40)),
				j = E(n(41)),
				k = E(n(42)),
				O = E(n(43)),
				M = E(n(44)),
				P = E(n(45)),
				S = E(n(46)),
				A = E(n(47)),
				C = E(n(48)),
				N = E(n(7)),
				T = E(n(49))
			function E(e) {
				return e && e.__esModule ? e : { default: e }
			}
			var I = (t.root = [null])
			function R(e, t) {
				;(this._groups = e), (this._parents = t)
			}
			function L() {
				return new R([[document.documentElement]], I)
			}
			;(R.prototype = L.prototype = {
				constructor: R,
				select: r.default,
				selectAll: a.default,
				filter: o.default,
				data: i.default,
				enter: l.default,
				exit: u.default,
				merge: s.default,
				order: f.default,
				sort: c.default,
				call: d.default,
				nodes: p.default,
				node: h.default,
				size: v.default,
				empty: m.default,
				each: y.default,
				attr: g.default,
				style: b.default,
				property: _.default,
				classed: x.default,
				text: w.default,
				html: j.default,
				raise: k.default,
				lower: O.default,
				append: M.default,
				insert: P.default,
				remove: S.default,
				clone: A.default,
				datum: C.default,
				on: N.default,
				dispatch: T.default
			}),
				(t.default = L)
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					var t = (0, o.default)(e)
					return (t.local ? u : l)(t)
				})
			var r,
				a = n(3),
				o = (r = a) && r.__esModule ? r : { default: r },
				i = n(4)
			function l(e) {
				return function() {
					var t = this.ownerDocument,
						n = this.namespaceURI
					return n === i.xhtml && t.documentElement.namespaceURI === i.xhtml
						? t.createElement(e)
						: t.createElementNS(n, e)
				}
			}
			function u(e) {
				return function() {
					return this.ownerDocument.createElementNS(e.space, e.local)
				}
			}
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e, t) {
					var n = e.ownerSVGElement || e
					if (n.createSVGPoint) {
						var r = n.createSVGPoint()
						return (r.x = t.clientX), (r.y = t.clientY), [(r = r.matrixTransform(e.getScreenCTM().inverse())).x, r.y]
					}
					var a = e.getBoundingClientRect()
					return [t.clientX - a.left - e.clientLeft, t.clientY - a.top - e.clientTop]
				})
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					var t = (e += ''),
						n = t.indexOf(':')
					return (
						n >= 0 && 'xmlns' !== (t = e.slice(0, n)) && (e = e.slice(n + 1)),
						o.default.hasOwnProperty(t) ? { space: o.default[t], local: e } : e
					)
				})
			var r,
				a = n(4),
				o = (r = a) && r.__esModule ? r : { default: r }
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 })
			var r = (t.xhtml = 'http://www.w3.org/1999/xhtml')
			t.default = {
				svg: 'http://www.w3.org/2000/svg',
				xhtml: r,
				xlink: 'http://www.w3.org/1999/xlink',
				xml: 'http://www.w3.org/XML/1998/namespace',
				xmlns: 'http://www.w3.org/2000/xmlns/'
			}
		},
		function(e, t, n) {
			'use strict'
			function r() {}
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					return null == e
						? r
						: function() {
								return this.querySelector(e)
						  }
				})
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					return (e.ownerDocument && e.ownerDocument.defaultView) || (e.document && e) || e.defaultView
				})
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e, t, n) {
					var r,
						a,
						o = l(e + ''),
						i = o.length
					if (!(arguments.length < 2)) {
						for (f = t ? s : u, null == n && (n = !1), r = 0; r < i; ++r) this.each(f(o[r], t, n))
						return this
					}
					var f = this.node().__on
					if (f)
						for (var c, d = 0, p = f.length; d < p; ++d)
							for (r = 0, c = f[d]; r < i; ++r) if ((a = o[r]).type === c.type && a.name === c.name) return c.value
				}),
				(t.customEvent = function(e, n, r, o) {
					var i = a
					;(e.sourceEvent = a), (t.event = a = e)
					try {
						return n.apply(r, o)
					} finally {
						t.event = a = i
					}
				})
			var r = {},
				a = (t.event = null)
			'undefined' != typeof document &&
				('onmouseenter' in document.documentElement || (r = { mouseenter: 'mouseover', mouseleave: 'mouseout' }))
			function o(e, t, n) {
				return (
					(e = i(e, t, n)),
					function(t) {
						var n = t.relatedTarget
						;(n && (n === this || 8 & n.compareDocumentPosition(this))) || e.call(this, t)
					}
				)
			}
			function i(e, n, r) {
				return function(o) {
					var i = a
					t.event = a = o
					try {
						e.call(this, this.__data__, n, r)
					} finally {
						t.event = a = i
					}
				}
			}
			function l(e) {
				return e
					.trim()
					.split(/^|\s+/)
					.map(function(e) {
						var t = '',
							n = e.indexOf('.')
						return n >= 0 && ((t = e.slice(n + 1)), (e = e.slice(0, n))), { type: e, name: t }
					})
			}
			function u(e) {
				return function() {
					var t = this.__on
					if (t) {
						for (var n, r = 0, a = -1, o = t.length; r < o; ++r)
							(n = t[r]),
								(e.type && n.type !== e.type) || n.name !== e.name
									? (t[++a] = n)
									: this.removeEventListener(n.type, n.listener, n.capture)
						++a ? (t.length = a) : delete this.__on
					}
				}
			}
			function s(e, t, n) {
				var a = r.hasOwnProperty(e.type) ? o : i
				return function(r, o, i) {
					var l,
						u = this.__on,
						s = a(t, o, i)
					if (u)
						for (var f = 0, c = u.length; f < c; ++f)
							if ((l = u[f]).type === e.type && l.name === e.name)
								return (
									this.removeEventListener(l.type, l.listener, l.capture),
									this.addEventListener(l.type, (l.listener = s), (l.capture = n)),
									void (l.value = t)
								)
					this.addEventListener(e.type, s, n),
						(l = { type: e.type, name: e.name, value: t, listener: s, capture: n }),
						u ? u.push(l) : (this.__on = [l])
				}
			}
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function() {
					for (var e, t = r.event; (e = t.sourceEvent); ) t = e
					return t
				})
			var r = n(7)
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					return 'string' == typeof e
						? new r.Selection([[document.querySelector(e)]], [document.documentElement])
						: new r.Selection([[e]], r.root)
				})
			var r = n(0)
		},
		function(e, t, n) {
			'use strict'
			function r() {
				return []
			}
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					return null == e
						? r
						: function() {
								return this.querySelectorAll(e)
						  }
				})
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 })
			var r = function(e) {
				return function() {
					return this.matches(e)
				}
			}
			if ('undefined' != typeof document) {
				var a = document.documentElement
				if (!a.matches) {
					var o = a.webkitMatchesSelector || a.msMatchesSelector || a.mozMatchesSelector || a.oMatchesSelector
					r = function(e) {
						return function() {
							return o.call(this, e)
						}
					}
				}
			}
			t.default = r
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function() {
					return new i.Selection(this._enter || this._groups.map(o.default), this._parents)
				}),
				(t.EnterNode = l)
			var r,
				a = n(13),
				o = (r = a) && r.__esModule ? r : { default: r },
				i = n(0)
			function l(e, t) {
				;(this.ownerDocument = e.ownerDocument),
					(this.namespaceURI = e.namespaceURI),
					(this._next = null),
					(this._parent = e),
					(this.__data__ = t)
			}
			l.prototype = {
				constructor: l,
				appendChild: function(e) {
					return this._parent.insertBefore(e, this._next)
				},
				insertBefore: function(e, t) {
					return this._parent.insertBefore(e, t)
				},
				querySelector: function(e) {
					return this._parent.querySelector(e)
				},
				querySelectorAll: function(e) {
					return this._parent.querySelectorAll(e)
				}
			}
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					return new Array(e.length)
				})
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e, t, n) {
					return arguments.length > 1
						? this.each((null == t ? i : 'function' == typeof t ? u : l)(e, t, null == n ? '' : n))
						: s(this.node(), e)
				}),
				(t.styleValue = s)
			var r,
				a = n(6),
				o = (r = a) && r.__esModule ? r : { default: r }
			function i(e) {
				return function() {
					this.style.removeProperty(e)
				}
			}
			function l(e, t, n) {
				return function() {
					this.style.setProperty(e, t, n)
				}
			}
			function u(e, t, n) {
				return function() {
					var r = t.apply(this, arguments)
					null == r ? this.style.removeProperty(e) : this.style.setProperty(e, r, n)
				}
			}
			function s(e, t) {
				return (
					e.style.getPropertyValue(t) ||
					(0, o.default)(e)
						.getComputedStyle(e, null)
						.getPropertyValue(t)
				)
			}
		},
		function(e, t, n) {
			'use strict'
			var r = n(16),
				a = (function(e) {
					if (e && e.__esModule) return e
					var t = {}
					if (null != e) for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (t[n] = e[n])
					return (t.default = e), t
				})(n(18))
			n(20)
			console.log('test ....'), console.log(a.defaultcolor), console.log(10, r.runproteinpaint)
		},
		function(module, exports, __webpack_require__) {
			'use strict'
			;(function(module) {
				var __WEBPACK_AMD_DEFINE_FACTORY__,
					__WEBPACK_AMD_DEFINE_ARRAY__,
					__WEBPACK_AMD_DEFINE_RESULT__,
					_typeof2 =
						'function' == typeof Symbol && 'symbol' == typeof Symbol.iterator
							? function(e) {
									return typeof e
							  }
							: function(e) {
									return e && 'function' == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype
										? 'symbol'
										: typeof e
							  },
					t
				window,
					(t = function() {
						return (function(e) {
							function t(t) {
								for (var n, a, o = t[0], i = t[1], l = 0, s = []; l < o.length; l++)
									(a = o[l]), Object.prototype.hasOwnProperty.call(r, a) && r[a] && s.push(r[a][0]), (r[a] = 0)
								for (n in i) Object.prototype.hasOwnProperty.call(i, n) && (e[n] = i[n])
								for (u && u(t); s.length; ) s.shift()()
							}
							var n = {},
								r = { 27: 0 }
							function a(t) {
								if (n[t]) return n[t].exports
								var r = (n[t] = { i: t, l: !1, exports: {} })
								return e[t].call(r.exports, r, r.exports, a), (r.l = !0), r.exports
							}
							;(a.e = function(e) {
								var t = [],
									n = r[e]
								if (0 !== n)
									if (n) t.push(n[2])
									else {
										var o = new Promise(function(t, a) {
											n = r[e] = [t, a]
										})
										t.push((n[2] = o))
										var i,
											l = document.createElement('script')
										;(l.charset = 'utf-8'),
											(l.timeout = 120),
											a.nc && l.setAttribute('nonce', a.nc),
											(l.src = (function(e) {
												return a.p + '' + e + '.proteinpaint.js'
											})(e))
										var u = new Error()
										i = function(t) {
											;(l.onerror = l.onload = null), clearTimeout(s)
											var n = r[e]
											if (0 !== n) {
												if (n) {
													var a = t && ('load' === t.type ? 'missing' : t.type),
														o = t && t.target && t.target.src
													;(u.message = 'Loading chunk ' + e + ' failed.\n(' + a + ': ' + o + ')'),
														(u.name = 'ChunkLoadError'),
														(u.type = a),
														(u.request = o),
														n[1](u)
												}
												r[e] = void 0
											}
										}
										var s = setTimeout(function() {
											i({ type: 'timeout', target: l })
										}, 12e4)
										;(l.onerror = l.onload = i), document.head.appendChild(l)
									}
								return Promise.all(t)
							}),
								(a.m = e),
								(a.c = n),
								(a.d = function(e, t, n) {
									a.o(e, t) || Object.defineProperty(e, t, { enumerable: !0, get: n })
								}),
								(a.r = function(e) {
									'undefined' != typeof Symbol &&
										Symbol.toStringTag &&
										Object.defineProperty(e, Symbol.toStringTag, { value: 'Module' }),
										Object.defineProperty(e, '__esModule', { value: !0 })
								}),
								(a.t = function(e, t) {
									if ((1 & t && (e = a(e)), 8 & t)) return e
									if (4 & t && 'object' == (void 0 === e ? 'undefined' : _typeof2(e)) && e && e.__esModule) return e
									var n = Object.create(null)
									if (
										(a.r(n),
										Object.defineProperty(n, 'default', { enumerable: !0, value: e }),
										2 & t && 'string' != typeof e)
									)
										for (var r in e)
											a.d(
												n,
												r,
												function(t) {
													return e[t]
												}.bind(null, r)
											)
									return n
								}),
								(a.n = function(e) {
									var t =
										e && e.__esModule
											? function() {
													return e.default
											  }
											: function() {
													return e
											  }
									return a.d(t, 'a', t), t
								}),
								(a.o = function(e, t) {
									return Object.prototype.hasOwnProperty.call(e, t)
								}),
								(a.p = ''),
								(a.oe = function(e) {
									throw (console.error(e), e)
								})
							var o = (window.ppJsonp = window.ppJsonp || []),
								i = o.push.bind(o)
							;(o.push = t), (o = o.slice())
							for (var l = 0; l < o.length; l++) t(o[l])
							var u = i
							return a((a.s = 126))
						})([
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = n(127)
								Object.defineProperty(t, 'create', {
									enumerable: !0,
									get: function() {
										return x(r).default
									}
								})
								var a = n(21)
								Object.defineProperty(t, 'creator', {
									enumerable: !0,
									get: function() {
										return x(a).default
									}
								})
								var o = n(156)
								Object.defineProperty(t, 'local', {
									enumerable: !0,
									get: function() {
										return x(o).default
									}
								})
								var i = n(70)
								Object.defineProperty(t, 'matcher', {
									enumerable: !0,
									get: function() {
										return x(i).default
									}
								})
								var l = n(157)
								Object.defineProperty(t, 'mouse', {
									enumerable: !0,
									get: function() {
										return x(l).default
									}
								})
								var u = n(32)
								Object.defineProperty(t, 'namespace', {
									enumerable: !0,
									get: function() {
										return x(u).default
									}
								})
								var s = n(33)
								Object.defineProperty(t, 'namespaces', {
									enumerable: !0,
									get: function() {
										return x(s).default
									}
								})
								var f = n(22)
								Object.defineProperty(t, 'clientPoint', {
									enumerable: !0,
									get: function() {
										return x(f).default
									}
								})
								var c = n(68)
								Object.defineProperty(t, 'select', {
									enumerable: !0,
									get: function() {
										return x(c).default
									}
								})
								var d = n(158)
								Object.defineProperty(t, 'selectAll', {
									enumerable: !0,
									get: function() {
										return x(d).default
									}
								})
								var p = n(4)
								Object.defineProperty(t, 'selection', {
									enumerable: !0,
									get: function() {
										return x(p).default
									}
								})
								var h = n(34)
								Object.defineProperty(t, 'selector', {
									enumerable: !0,
									get: function() {
										return x(h).default
									}
								})
								var v = n(69)
								Object.defineProperty(t, 'selectorAll', {
									enumerable: !0,
									get: function() {
										return x(v).default
									}
								})
								var m = n(73)
								Object.defineProperty(t, 'style', {
									enumerable: !0,
									get: function() {
										return m.styleValue
									}
								})
								var y = n(159)
								Object.defineProperty(t, 'touch', {
									enumerable: !0,
									get: function() {
										return x(y).default
									}
								})
								var g = n(160)
								Object.defineProperty(t, 'touches', {
									enumerable: !0,
									get: function() {
										return x(g).default
									}
								})
								var b = n(35)
								Object.defineProperty(t, 'window', {
									enumerable: !0,
									get: function() {
										return x(b).default
									}
								})
								var _ = n(36)
								function x(e) {
									return e && e.__esModule ? e : { default: e }
								}
								Object.defineProperty(t, 'event', {
									enumerable: !0,
									get: function() {
										return _.event
									}
								}),
									Object.defineProperty(t, 'customEvent', {
										enumerable: !0,
										get: function() {
											return _.customEvent
										}
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function e(t, n, o, i) {
										function l(e) {
											return t((e = new Date(+e))), e
										}
										return (
											(l.floor = l),
											(l.ceil = function(e) {
												return t((e = new Date(e - 1))), n(e, 1), t(e), e
											}),
											(l.round = function(e) {
												var t = l(e),
													n = l.ceil(e)
												return e - t < n - e ? t : n
											}),
											(l.offset = function(e, t) {
												return n((e = new Date(+e)), null == t ? 1 : Math.floor(t)), e
											}),
											(l.range = function(e, r, a) {
												var o,
													i = []
												if (((e = l.ceil(e)), (a = null == a ? 1 : Math.floor(a)), !(e < r && a > 0))) return i
												do {
													i.push((o = new Date(+e))), n(e, a), t(e)
												} while (o < e && e < r)
												return i
											}),
											(l.filter = function(r) {
												return e(
													function(e) {
														if (e >= e) for (; t(e), !r(e); ) e.setTime(e - 1)
													},
													function(e, t) {
														if (e >= e)
															if (t < 0) for (; ++t <= 0; ) for (; n(e, -1), !r(e); );
															else for (; --t >= 0; ) for (; n(e, 1), !r(e); );
													}
												)
											}),
											o &&
												((l.count = function(e, n) {
													return r.setTime(+e), a.setTime(+n), t(r), t(a), Math.floor(o(r, a))
												}),
												(l.every = function(e) {
													return (
														(e = Math.floor(e)),
														isFinite(e) && e > 0
															? e > 1
																? l.filter(
																		i
																			? function(t) {
																					return i(t) % e == 0
																			  }
																			: function(t) {
																					return l.count(0, t) % e == 0
																			  }
																  )
																: l
															: null
													)
												})),
											l
										)
									})
								var r = new Date(),
									a = new Date()
							},
							function(e, t, n) {
								var r
								function a(e, t, n) {
									return (
										t in e
											? Object.defineProperty(e, t, { value: n, enumerable: !0, configurable: !0, writable: !0 })
											: (e[t] = n),
										e
									)
								}
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.mclasstester = function(e) {
										switch (e.toLowerCase()) {
											case 'missense_mutation':
												return 'M'
											case 'nonsense_mutation':
												return 'N'
											case 'splice_site':
												return 'L'
											case 'rna':
												return k
											case 'frame_shift_del':
											case 'frame_shift_ins':
												return 'F'
											case 'in_frame_del':
												return 'D'
											case 'in_frame_ins':
												return 'I'
											case 'translation_start_site':
												return j
											case 'nonstop_mutation':
												return 'N'
											case "3'utr":
												return x
											case "3'flank":
												return k
											case "5'utr":
												return w
											case "5'flank":
												return k
											default:
												return null
										}
									}),
									(t.validtkt = function(e) {
										for (var t in L) if (e == L[t]) return !0
										return !1
									}),
									(t.nt2aa = q),
									(t.bplen = function(e) {
										return e >= 1e9
											? (e / 1e9).toFixed(1) + ' Gb'
											: e >= 1e7
											? Math.ceil(e / 1e6) + ' Mb'
											: e >= 1e6
											? (e / 1e6).toFixed(1) + ' Mb'
											: e >= 1e4
											? Math.ceil(e / 1e3) + ' Kb'
											: e >= 1e3
											? (e / 1e3).toFixed(1) + ' Kb'
											: e + ' bp'
									}),
									(t.basecompliment = U),
									(t.reversecompliment = G),
									(t.spliceeventchangegmexon = function(e, t) {
										var n = { chr: e.chr, start: e.start, stop: e.stop, strand: e.strand, coding: [] }
										if (t.isskipexon || t.isaltexon)
											for (var r = 0; r < e.exon.length; r++) {
												var a = Math.max(e.codingstart, e.exon[r][0]),
													o = Math.min(e.codingstop, e.exon[r][1])
												a > o || (-1 == t.skippedexon.indexOf(r) && n.coding.push([a, o]))
											}
										else if (t.a5ss || t.a3ss) {
											var i = e.exon.map(function(e) {
													return [e[0], e[1]]
												}),
												l = '+' == e.strand
											t.a5ss
												? l
													? (i[t.exon5idx][1] = t.junctionB.start)
													: (i[t.exon5idx + 1][0] = t.junctionB.stop)
												: l
												? (i[t.exon5idx + 1][0] = t.junctionB.stop)
												: (i[t.exon5idx][1] = t.junctionB.start)
											var u = !0,
												s = !1,
												f = void 0
											try {
												for (var c, d = i[Symbol.iterator](); !(u = (c = d.next()).done); u = !0) {
													var p = c.value,
														h = Math.max(e.codingstart, p[0]),
														v = Math.min(e.codingstop, p[1])
													h > v || n.coding.push([h, v])
												}
											} catch (e) {
												;(s = !0), (f = e)
											} finally {
												try {
													!u && d.return && d.return()
												} finally {
													if (s) throw f
												}
											}
										}
										return n
									}),
									(t.fasta2gmframecheck = function(e, t) {
										var n = t.split('\n')
										n.shift(), (e.genomicseq = n.join('').toUpperCase())
										var r = q(e),
											a = i
										return r.indexOf(F) == r.length - 1 && (a = o), a
									}),
									(t.validate_vcfinfofilter = function(e) {
										if (!e.lst) return '.lst missing'
										if (!Array.isArray(e.lst)) return 'input is not an array'
										var t = !0,
											n = !1,
											r = void 0
										try {
											for (var a, o = e.lst[Symbol.iterator](); !(t = (a = o.next()).done); t = !0) {
												var i = a.value
												if (!i.name) return 'name missing from a set of .vcfinfofilter.lst'
												if (i.autocategory || i.categories) {
													if (!i.autocategory)
														for (var l in i.categories) {
															var u = i.categories[l]
															if (!i.autocolor && !u.color)
																return '.color missing for class ' + l + ' from .categories of set ' + i.name
															u.label || (u.label = l)
														}
													if (i.categoryhidden) {
														for (var s in i.categoryhidden)
															if (!i.categories[s])
																return 'unknown hidden-by-default category ' + s + ' from set ' + i.name
													} else i.categoryhidden = {}
												} else if (i.numericfilter) {
													var f = [],
														c = !0,
														d = !1,
														p = void 0
													try {
														for (var h, v = i.numericfilter[Symbol.iterator](); !(c = (h = v.next()).done); c = !0) {
															var m = h.value
															'number' == typeof m
																? f.push({ side: '<', value: m })
																: f.push({ side: m.side || '<', value: m.value })
														}
													} catch (e) {
														;(d = !0), (p = e)
													} finally {
														try {
															!c && v.return && v.return()
														} finally {
															if (d) throw p
														}
													}
													i.numericfilter = f
												}
												if (i.altalleleinfo) {
													if (!i.altalleleinfo.key) return '.key missing from .altalleleinfo from set ' + i.name
												} else {
													if (!i.locusinfo)
														return 'neither .altalleleinfo or .locusinfo is available from set ' + i.name
													if (!i.locusinfo.key) return '.key missing from .locusinfo from set ' + i.name
												}
											}
										} catch (e) {
											;(n = !0), (r = e)
										} finally {
											try {
												!t && o.return && o.return()
											} finally {
												if (n) throw r
											}
										}
									}),
									(t.contigNameNoChr = function(e, t) {
										for (var n in e.majorchr) if (-1 != t.indexOf(n.replace('chr', ''))) return !0
										if (e.minorchr) for (var r in e.minorchr) if (-1 != t.indexOf(r.replace('chr', ''))) return !0
										return !1
									}),
									(t.contigNameNoChr2 = function(e, t) {
										var n = 0,
											r = 0
										for (var a in e.majorchr) t.includes(a) ? r++ : t.includes(a.replace('chr', '')) && n++
										if (e.minorchr)
											for (var o in e.minorchr) t.includes(o) ? r++ : t.includes(o.replace('chr', '')) && n++
										return [n, r]
									}),
									(t.getMax_byiqr = function(e, t) {
										if (0 == e.length) return t
										e.sort(function(e, t) {
											return e - t
										})
										var n = e[e.length - 1]
										if (e.length <= 5) return n
										var r = e[Math.floor(e.length / 4)],
											a = e[Math.floor((3 * e.length) / 4)]
										return Math.min(a + 1.5 * (a - r), n)
									}),
									(t.alleleInGenotypeStr = function(e, t) {
										return !!e && (-1 != e.indexOf('/') ? -1 != e.split('/').indexOf(t) : -1 != e.split('|').indexOf(t))
									}),
									(t.vcfcopymclass = function(e, t) {
										if (e.csq) {
											var n = null
											if (t.usegm) {
												var r = !0,
													a = !1,
													o = void 0
												try {
													for (var i, u = e.csq[Symbol.iterator](); !(r = (i = u.next()).done); r = !0) {
														var s = i.value
														s._isoform == t.usegm.isoform && (n ? s._csqrank < n._csqrank && (n = s) : (n = s))
													}
												} catch (e) {
													;(a = !0), (o = e)
												} finally {
													try {
														!r && u.return && u.return()
													} finally {
														if (a) throw o
													}
												}
												n || t.gmmode != z.genomic || (n = e.csq[0])
											} else {
												n = e.csq[0]
												var f = !0,
													c = !1,
													d = void 0
												try {
													for (var p, h = e.csq[Symbol.iterator](); !(f = (p = h.next()).done); f = !0) {
														var v = p.value
														v._csqrank < n._csqrank && (n = v)
													}
												} catch (e) {
													;(c = !0), (d = e)
												} finally {
													try {
														!f && h.return && h.return()
													} finally {
														if (c) throw d
													}
												}
											}
											n &&
												((e.gene = n._gene),
												(e.isoform = n._isoform),
												(e.class = n._class),
												(e.dt = n._dt),
												(e.mname = n._mname),
												e.class == k && delete e.class)
										} else if (e.ann) {
											var y = null
											if (t.usegm) {
												var g = !0,
													b = !1,
													_ = void 0
												try {
													for (var x, w = e.ann[Symbol.iterator](); !(g = (x = w.next()).done); g = !0) {
														var O = x.value
														O._isoform == t.usegm.isoform && (y ? O._csqrank < y._csqrank && (y = O) : (y = O))
													}
												} catch (e) {
													;(b = !0), (_ = e)
												} finally {
													try {
														!g && w.return && w.return()
													} finally {
														if (b) throw _
													}
												}
												y || t.gmmode != z.genomic || (y = e.ann[0])
											} else {
												y = e.ann[0]
												var M = !0,
													P = !1,
													S = void 0
												try {
													for (var A, C = e.ann[Symbol.iterator](); !(M = (A = C.next()).done); M = !0) {
														var N = A.value
														N._csqrank < y._csqrank && (y = N)
													}
												} catch (e) {
													;(P = !0), (S = e)
												} finally {
													try {
														!M && C.return && C.return()
													} finally {
														if (P) throw S
													}
												}
											}
											y &&
												((e.gene = y._gene),
												(e.isoform = y._isoform),
												(e.class = y._class),
												(e.dt = y._dt),
												(e.mname = y._mname),
												e.class == k && delete e.class)
										}
										null == e.class &&
											(m[e.type]
												? ((e.class = e.type),
												  (e.dt = m[e.type].dt),
												  (e.mname = e.ref + '>' + e.alt),
												  e.mname.length > 15 && (e.mname = e.type))
												: ((e.class = j), (e.dt = l), (e.mname = e.type))),
											delete e.type
									}),
									(t.kernelDensityEstimator = function(e, t) {
										return function(n) {
											return t.map(function(t) {
												return [
													t,
													n
														.map(function(n) {
															return e(t - n)
														})
														.reduce(function(e, t) {
															return e + t
														}, 0) / n.length
												]
											})
										}
									}),
									(t.kernelEpanechnikov = function(e) {
										return function(t) {
											return Math.abs((t /= e)) <= 1 ? (0.75 * (1 - t * t)) / e : 0
										}
									}),
									(t.defaultcolor = '#8AB1D4'),
									(t.exoncolor = '#4F8053')
								var o = (t.IN_frame = !0),
									i = (t.OUT_frame = !1),
									l = (t.dtsnvindel = 1),
									u = (t.dtfusionrna = 2),
									s = ((t.dtgeneexpression = 3), (t.dtcnv = 4)),
									f = (t.dtsv = 5),
									c = (t.dtitd = 6),
									d = (t.dtdel = 7),
									p = (t.dtnloss = 8),
									h = (t.dtcloss = 9),
									v = (t.dtloh = 10),
									m =
										((t.dt2label =
											(a((r = {}), l, 'SNV/indel'),
											a(r, u, 'Fusion RNA'),
											a(r, s, 'CNV'),
											a(r, f, 'SV'),
											a(r, c, 'ITD'),
											a(r, d, 'Deletion'),
											a(r, p, 'N-loss'),
											a(r, h, 'C-loss'),
											a(r, v, 'LOH'),
											r)),
										(t.mclass = {
											M: {
												label: 'MISSENSE',
												color: '#3987CC',
												dt: l,
												desc: 'A substitution variant in the coding region resulting in altered protein coding.'
											},
											E: { label: 'EXON', color: '#bcbd22', dt: l, desc: 'A variant in the exon of a non-coding RNA.' },
											F: {
												label: 'FRAMESHIFT',
												color: '#db3d3d',
												dt: l,
												desc: 'An insertion or deletion variant that alters the protein coding frame.'
											},
											N: {
												label: 'NONSENSE',
												color: '#ff7f0e',
												dt: l,
												desc: 'A variant altering protein coding to produce a premature stopgain or stoploss.'
											},
											S: {
												label: 'SILENT',
												color: '#2ca02c',
												dt: l,
												desc: 'A substitution variant in the coding region that does not alter protein coding.'
											},
											D: {
												label: 'PROTEINDEL',
												color: '#7f7f7f',
												dt: l,
												desc:
													'A deletion resulting in a loss of one or more codons from the product, but not altering the protein coding frame.'
											},
											I: {
												label: 'PROTEININS',
												color: '#8c564b',
												dt: l,
												desc:
													'An insertion introducing one or more codons into the product, but not altering the protein coding frame.'
											},
											P: {
												label: 'SPLICE_REGION',
												color: '#9467bd',
												dt: l,
												desc: 'A variant in an intron within 10 nt of an exon boundary.'
											},
											L: {
												label: 'SPLICE',
												color: '#6633FF',
												dt: l,
												desc: 'A variant near an exon edge that may affect splicing functionality.'
											},
											Intron: { label: 'INTRON', color: '#bbbbbb', dt: l, desc: 'An intronic variant.' }
										})),
									y = (t.mclassitd = 'ITD')
								m[y] = { label: 'ITD', color: '#ff70ff', dt: c, desc: 'In-frame internal tandem duplication.' }
								var g = (t.mclassdel = 'DEL')
								m[g] = { label: 'DELETION, intragenic', color: '#858585', dt: d, desc: 'Intragenic deletion.' }
								var b = (t.mclassnloss = 'NLOSS')
								m[b] = {
									label: 'N-terminus loss',
									color: '#545454',
									dt: p,
									desc: 'N-terminus loss due to translocation'
								}
								var _ = (t.mclasscloss = 'CLOSS')
								m[_] = {
									label: 'C-terminus loss',
									color: '#545454',
									dt: h,
									desc: 'C-terminus loss due to translocation'
								}
								var x = (t.mclassutr3 = 'Utr3')
								m[x] = { label: 'UTR_3', color: '#998199', dt: l, desc: "A variant in the 3' untranslated region." }
								var w = (t.mclassutr5 = 'Utr5')
								m[w] = { label: 'UTR_5', color: '#819981', dt: l, desc: "A variant in the 5' untranslated region." }
								var j = (t.mclassnonstandard = 'X')
								m[j] = {
									label: 'NONSTANDARD',
									color: 'black',
									dt: l,
									desc: 'A mutation class that either does not match our notation, or is unspecified.'
								}
								var k = (t.mclassnoncoding = 'noncoding')
								m[k] = { label: 'NONCODING', color: 'black', dt: l, desc: 'Noncoding mutation.' }
								var O = (t.mclassfusionrna = 'Fuserna')
								m[O] = {
									label: 'Fusion transcript',
									color: '#545454',
									dt: u,
									desc:
										'Marks the break points leading to fusion transcripts, predicted by "Cicero" from RNA-seq data.<br><span style="font-size:150%">&#9680;</span> - 3\' end of the break point is fused to the 5\' end of another break point in a different gene.<br><span style="font-size:150%">&#9681;</span> - 5\' end of the break point is fused to the 3\' end of another break point in a different gene.'
								}
								var M = (t.mclasssv = 'SV')
								m[M] = {
									label: 'Structural variation',
									color: '#858585',
									dt: f,
									desc: 'Structural variation detected in genomic DNA.'
								}
								var P = (t.mclasscnvgain = 'CNV_amp')
								m[P] = { label: 'Copy number gain', color: '#e9a3c9', dt: s, desc: 'Copy number gain' }
								var S = (t.mclasscnvloss = 'CNV_loss')
								m[S] = { label: 'Copy number loss', color: '#a1d76a', dt: s, desc: 'Copy number loss' }
								var A = (t.mclasscnvloh = 'CNV_loh')
								m[A] = { label: 'LOH', color: '#12EDFC', dt: s, desc: 'Loss of heterozygosity' }
								var C = (t.mclasssnv = 'snv')
								m[C] = { label: 'SNV', color: '#5781FF', dt: l, desc: 'Single nucleotide variation' }
								var N = (t.mclassmnv = 'mnv')
								m[N] = { label: 'MNV', color: '#6378B8', dt: l, desc: 'Multiple nucleotide variation' }
								var T = (t.mclassinsertion = 'insertion')
								m[T] = { label: 'Sequence insertion', color: '#ED5C66', dt: l, desc: 'Sequence insertion' }
								var E = (t.mclassdeletion = 'deletion')
								;(m[E] = { label: 'Sequence deletion', color: '#F0B11F', dt: l, desc: 'Sequence deletion' }),
									(t.vepinfo = function(e) {
										var t = e.toLowerCase().split(','),
											n = 1
										return -1 != t.indexOf('transcript_ablation')
											? [d, g, n]
											: (n++,
											  -1 != t.indexOf('splice_acceptor_variant')
													? [l, 'L', n]
													: (n++,
													  -1 != t.indexOf('splice_donor_variant')
															? [l, 'L', n]
															: (n++,
															  -1 != t.indexOf('stop_gained')
																	? [l, 'N', n]
																	: (n++,
																	  -1 != t.indexOf('frameshift_variant')
																			? [l, 'F', n]
																			: (n++,
																			  -1 != t.indexOf('stop_lost')
																					? [l, 'N', n]
																					: (n++,
																					  -1 != t.indexOf('start_lost')
																							? [l, 'N', n]
																							: (n++,
																							  -1 != t.indexOf('transcript_amplification')
																									? [l, j, n]
																									: (n++,
																									  -1 != t.indexOf('inframe_insertion') ||
																									  -1 != t.indexOf('conservative_inframe_insertion') ||
																									  -1 != t.indexOf('disruptive_inframe_insertion')
																											? [l, 'I', n]
																											: (n++,
																											  -1 != t.indexOf('inframe_deletion') ||
																											  -1 != t.indexOf('conservative_inframe_deletion') ||
																											  -1 != t.indexOf('disruptive_inframe_deletion')
																													? [l, 'D', n]
																													: (n++,
																													  -1 != t.indexOf('missense_variant')
																															? [l, 'M', n]
																															: (n++,
																															  -1 != t.indexOf('protein_altering_variant')
																																	? [l, 'N', n]
																																	: (n++,
																																	  -1 != t.indexOf('splice_region_variant')
																																			? [l, 'P', n]
																																			: (n++,
																																			  -1 !=
																																			  t.indexOf('incomplete_terminal_codon_variant')
																																					? [l, 'N', n]
																																					: (n++,
																																					  -1 != t.indexOf('stop_retained_variant')
																																							? [l, 'S', n]
																																							: (n++,
																																							  -1 != t.indexOf('synonymous_variant')
																																									? [l, 'S', n]
																																									: (n++,
																																									  -1 !=
																																									  t.indexOf('coding_sequence_variant')
																																											? [l, j, n]
																																											: (n++,
																																											  -1 !=
																																											  t.indexOf(
																																													'mature_mirna_variant'
																																											  )
																																													? [l, 'E', n]
																																													: (n++,
																																													  -1 !=
																																													  t.indexOf(
																																															'5_prime_utr_variant'
																																													  )
																																															? [l, w, n]
																																															: (n++,
																																															  -1 !=
																																															  t.indexOf(
																																																	'3_prime_utr_variant'
																																															  )
																																																	? [l, x, n]
																																																	: (n++,
																																																	  -1 !=
																																																	  t.indexOf(
																																																			'non_coding_transcript_exon_variant'
																																																	  )
																																																			? [l, 'E', n]
																																																			: (n++,
																																																			  -1 !=
																																																			  t.indexOf(
																																																					'intron_variant'
																																																			  )
																																																					? [
																																																							l,
																																																							'Intron',
																																																							n
																																																					  ]
																																																					: (n++,
																																																					  -1 !=
																																																					  t.indexOf(
																																																							'nmd_transcript_variant'
																																																					  )
																																																							? [
																																																									l,
																																																									'S',
																																																									n
																																																							  ]
																																																							: (n++,
																																																							  -1 !=
																																																							  t.indexOf(
																																																									'non_coding_transcript_variant'
																																																							  )
																																																									? [
																																																											l,
																																																											'E',
																																																											n
																																																									  ]
																																																									: (n++,
																																																									  -1 !=
																																																									  t.indexOf(
																																																											'upstream_gene_variant'
																																																									  )
																																																											? [
																																																													l,
																																																													k,
																																																													n
																																																											  ]
																																																											: (n++,
																																																											  -1 !=
																																																											  t.indexOf(
																																																													'downstream_gene_variant'
																																																											  )
																																																													? [
																																																															l,
																																																															k,
																																																															n
																																																													  ]
																																																													: (n++,
																																																													  -1 !=
																																																													  t.indexOf(
																																																															'tfbs_ablation'
																																																													  )
																																																															? [
																																																																	l,
																																																																	k,
																																																																	n
																																																															  ]
																																																															: (n++,
																																																															  -1 !=
																																																															  t.indexOf(
																																																																	'tfbs_amplification'
																																																															  )
																																																																	? [
																																																																			l,
																																																																			k,
																																																																			n
																																																																	  ]
																																																																	: (n++,
																																																																	  -1 !=
																																																																	  t.indexOf(
																																																																			'tf_binding_site_variant'
																																																																	  )
																																																																			? [
																																																																					l,
																																																																					k,
																																																																					n
																																																																			  ]
																																																																			: (n++,
																																																																			  -1 !=
																																																																			  t.indexOf(
																																																																					'regulatory_region_ablation'
																																																																			  )
																																																																					? [
																																																																							l,
																																																																							k,
																																																																							n
																																																																					  ]
																																																																					: (n++,
																																																																					  -1 !=
																																																																					  t.indexOf(
																																																																							'regulatory_region_amplification'
																																																																					  )
																																																																							? [
																																																																									l,
																																																																									k,
																																																																									n
																																																																							  ]
																																																																							: (n++,
																																																																							  -1 !=
																																																																							  t.indexOf(
																																																																									'feature_elongation'
																																																																							  )
																																																																									? [
																																																																											l,
																																																																											k,
																																																																											n
																																																																									  ]
																																																																									: (n++,
																																																																									  -1 !=
																																																																									  t.indexOf(
																																																																											'regulatory_region_variant'
																																																																									  )
																																																																											? [
																																																																													l,
																																																																													k,
																																																																													n
																																																																											  ]
																																																																											: (n++,
																																																																											  -1 !=
																																																																											  t.indexOf(
																																																																													'feature_truncation'
																																																																											  )
																																																																													? [
																																																																															l,
																																																																															k,
																																																																															n
																																																																													  ]
																																																																													: (n++,
																																																																													  -1 !=
																																																																													  t.indexOf(
																																																																															'intergenic_variant'
																																																																													  )
																																																																															? [
																																																																																	l,
																																																																																	k,
																																																																																	n
																																																																															  ]
																																																																															: (n++,
																																																																															  [
																																																																																	l,
																																																																																	j,
																																																																																	n
																																																																															  ])))))))))))))))))))))))))))))))))))
									})
								var I = (t.germlinelegend =
										'<circle cx="7" cy="12" r="7" fill="#b1b1b1"></circle><path d="M6.735557395310443e-16,-11A11,11 0 0,1 11,0L9,0A9,9 0 0,0 5.51091059616309e-16,-9Z" transform="translate(7,12)" fill="#858585" stroke="none"></path>'),
									R = (t.morigin = {})
								;(R[(t.moriginsomatic = 'S')] = {
									label: 'Somatic',
									desc: 'A variant found only in a tumor sample. The proportion is indicated by lack of any arc.',
									legend: '<circle cx="7" cy="12" r="7" fill="#b1b1b1"></circle>'
								}),
									(R[(t.morigingermline = 'G')] = {
										label: 'Germline',
										desc:
											'A constitutional variant found in a normal sample. The proportion is indicated by the span of the solid arc within the whole circle.',
										legend: I
									}),
									(R[(t.moriginrelapse = 'R')] = {
										label: 'Relapse',
										desc:
											'A somatic variant found only in a relapse sample. The proportion is indicated by the span of the hollow arc within the whole circle.',
										legend:
											'<circle cx="7" cy="12" r="7" fill="#b1b1b1"></circle><path d="M6.735557395310443e-16,-11A11,11 0 0,1 11,0L9,0A9,9 0 0,0 5.51091059616309e-16,-9Z" transform="translate(7,12)" fill="none" stroke="#858585"></path>'
									}),
									(R[(t.morigingermlinepathogenic = 'GP')] = {
										label: 'Germline pathogenic',
										desc: 'A constitutional variant with pathogenic allele.',
										legend: I
									}),
									(R[(t.morigingermlinenonpathogenic = 'GNP')] = {
										label: 'Germline non-pathogenic',
										desc: 'A constitutional variant with non-pathogenic allele.',
										legend: I,
										hidden: !0
									})
								var L = (t.tkt = {
									usegm: 'usegm',
									ds: 'dataset',
									bigwig: 'bigwig',
									bigwigstranded: 'bigwigstranded',
									junction: 'junction',
									mdsjunction: 'mdsjunction',
									mdscnv: 'mdscnv',
									mdssvcnv: 'mdssvcnv',
									mdsexpressionrank: 'mdsexpressionrank',
									mdsvcf: 'mdsvcf',
									bedj: 'bedj',
									pgv: 'profilegenevalue',
									bampile: 'bampile',
									hicstraw: 'hicstraw',
									expressionrank: 'expressionrank',
									aicheck: 'aicheck',
									ase: 'ase',
									mds2: 'mds2',
									mds3: 'mds3',
									bedgraphdot: 'bedgraphdot',
									bam: 'bam'
								})
								;(t.mdsvcftype = { vcf: 'vcf' }),
									(t.custommdstktype = { vcf: 'vcf', svcnvitd: 'svcnvitd', geneexpression: 'geneexpression' })
								var D = (t.codon = {
										GCT: 'A',
										GCC: 'A',
										GCA: 'A',
										GCG: 'A',
										CGT: 'R',
										CGC: 'R',
										CGA: 'R',
										CGG: 'R',
										AGA: 'R',
										AGG: 'R',
										AAT: 'N',
										AAC: 'N',
										GAT: 'D',
										GAC: 'D',
										TGT: 'C',
										TGC: 'C',
										CAA: 'Q',
										CAG: 'Q',
										GAA: 'E',
										GAG: 'E',
										GGT: 'G',
										GGC: 'G',
										GGA: 'G',
										GGG: 'G',
										CAT: 'H',
										CAC: 'H',
										ATT: 'I',
										ATC: 'I',
										ATA: 'I',
										TTA: 'L',
										TTG: 'L',
										CTT: 'L',
										CTC: 'L',
										CTA: 'L',
										CTG: 'L',
										AAA: 'K',
										AAG: 'K',
										ATG: 'M',
										TTT: 'F',
										TTC: 'F',
										CCT: 'P',
										CCC: 'P',
										CCA: 'P',
										CCG: 'P',
										TCT: 'S',
										TCC: 'S',
										TCA: 'S',
										TCG: 'S',
										AGT: 'S',
										AGC: 'S',
										ACT: 'T',
										ACC: 'T',
										ACA: 'T',
										ACG: 'T',
										TGG: 'W',
										TAT: 'Y',
										TAC: 'Y',
										GTT: 'V',
										GTC: 'V',
										GTA: 'V',
										GTG: 'V'
									}),
									F = (t.codon_stop = '*')
								function q(e) {
									if (e.genomicseq) {
										var t = []
										if (e.coding) {
											var n = !0,
												r = !1,
												a = void 0
											try {
												for (var o, i = e.coding[Symbol.iterator](); !(n = (o = i.next()).done); n = !0) {
													var l = o.value,
														u = e.genomicseq.substr(l[0] - e.start, l[1] - l[0])
													'-' == e.strand ? t.push(G(u)) : t.push(u)
												}
											} catch (e) {
												;(r = !0), (a = e)
											} finally {
												try {
													!n && i.return && i.return()
												} finally {
													if (r) throw a
												}
											}
										}
										for (var s = t.join(''), f = [], c = 0; c < s.length; c += 3) {
											var d = D[s.substr(c, 3)]
											f.push(d || F)
										}
										return (e.cdseq = s), f.join('')
									}
								}
								function U(e) {
									switch (e) {
										case 'A':
											return 'T'
										case 'T':
											return 'A'
										case 'C':
											return 'G'
										case 'G':
											return 'C'
										case 'a':
											return 't'
										case 't':
											return 'a'
										case 'c':
											return 'g'
										case 'g':
											return 'c'
										default:
											return e
									}
								}
								function G(e) {
									for (var t = [], n = e.length - 1; n >= 0; n--) t.push(U(e[n]))
									return t.join('')
								}
								t.basecolor = { A: '#ca0020', T: '#f4a582', C: '#92c5de', G: '#0571b0' }
								var z = (t.gmmode = {
									genomic: 'genomic',
									splicingrna: 'splicing RNA',
									exononly: 'exon only',
									protein: 'protein',
									gmsum: 'aggregated exons'
								})
								t.not_annotated = 'Unannotated'
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = n(41)
								Object.defineProperty(t, 'color', {
									enumerable: !0,
									get: function() {
										return i(r).default
									}
								}),
									Object.defineProperty(t, 'rgb', {
										enumerable: !0,
										get: function() {
											return r.rgb
										}
									}),
									Object.defineProperty(t, 'hsl', {
										enumerable: !0,
										get: function() {
											return r.hsl
										}
									})
								var a = n(184)
								Object.defineProperty(t, 'lab', {
									enumerable: !0,
									get: function() {
										return i(a).default
									}
								}),
									Object.defineProperty(t, 'hcl', {
										enumerable: !0,
										get: function() {
											return a.hcl
										}
									})
								var o = n(185)
								function i(e) {
									return e && e.__esModule ? e : { default: e }
								}
								Object.defineProperty(t, 'cubehelix', {
									enumerable: !0,
									get: function() {
										return i(o).default
									}
								})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.root = void 0), (t.Selection = R)
								var r = E(n(128)),
									a = E(n(129)),
									o = E(n(130)),
									i = E(n(131)),
									l = E(n(71)),
									u = E(n(133)),
									s = E(n(134)),
									f = E(n(135)),
									c = E(n(136)),
									d = E(n(137)),
									p = E(n(138)),
									h = E(n(139)),
									v = E(n(140)),
									m = E(n(141)),
									y = E(n(142)),
									g = E(n(143)),
									b = E(n(73)),
									_ = E(n(144)),
									x = E(n(145)),
									w = E(n(146)),
									j = E(n(147)),
									k = E(n(148)),
									O = E(n(149)),
									M = E(n(150)),
									P = E(n(151)),
									S = E(n(152)),
									A = E(n(153)),
									C = E(n(154)),
									N = E(n(36)),
									T = E(n(155))
								function E(e) {
									return e && e.__esModule ? e : { default: e }
								}
								var I = (t.root = [null])
								function R(e, t) {
									;(this._groups = e), (this._parents = t)
								}
								function L() {
									return new R([[document.documentElement]], I)
								}
								;(R.prototype = L.prototype = {
									constructor: R,
									select: r.default,
									selectAll: a.default,
									filter: o.default,
									data: i.default,
									enter: l.default,
									exit: u.default,
									merge: s.default,
									order: f.default,
									sort: c.default,
									call: d.default,
									nodes: p.default,
									node: h.default,
									size: v.default,
									empty: m.default,
									each: y.default,
									attr: g.default,
									style: b.default,
									property: _.default,
									classed: x.default,
									text: w.default,
									html: j.default,
									raise: k.default,
									lower: O.default,
									append: M.default,
									insert: P.default,
									remove: S.default,
									clone: A.default,
									datum: C.default,
									on: N.default,
									dispatch: T.default
								}),
									(t.default = L)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.ENDED = t.ENDING = t.RUNNING = t.STARTED = t.STARTING = t.SCHEDULED = t.CREATED = void 0),
									(t.default = function(e, t, n, r, h, v) {
										var m = e.__transition
										if (m) {
											if (n in m) return
										} else e.__transition = {}
										!(function(e, t, n) {
											var r,
												o = e.__transition
											function i(d) {
												var v, m, y, g
												if (n.state !== u) return h()
												for (v in o)
													if ((g = o[v]).name === n.name) {
														if (g.state === f) return (0, a.timeout)(i)
														g.state === c
															? ((g.state = p),
															  g.timer.stop(),
															  g.on.call('interrupt', e, e.__data__, g.index, g.group),
															  delete o[v])
															: +v < t && ((g.state = p), g.timer.stop(), delete o[v])
													}
												if (
													((0, a.timeout)(function() {
														n.state === f && ((n.state = c), n.timer.restart(l, n.delay, n.time), l(d))
													}),
													(n.state = s),
													n.on.call('start', e, e.__data__, n.index, n.group),
													n.state === s)
												) {
													for (n.state = f, r = new Array((y = n.tween.length)), v = 0, m = -1; v < y; ++v)
														(g = n.tween[v].value.call(e, e.__data__, n.index, n.group)) && (r[++m] = g)
													r.length = m + 1
												}
											}
											function l(t) {
												for (
													var a =
															t < n.duration
																? n.ease.call(null, t / n.duration)
																: (n.timer.restart(h), (n.state = d), 1),
														o = -1,
														i = r.length;
													++o < i;

												)
													r[o].call(null, a)
												n.state === d && (n.on.call('end', e, e.__data__, n.index, n.group), h())
											}
											function h() {
												for (var r in ((n.state = p), n.timer.stop(), delete o[t], o)) return
												delete e.__transition
											}
											;(o[t] = n),
												(n.timer = (0, a.timer)(
													function(e) {
														;(n.state = u), n.timer.restart(i, n.delay, n.time), n.delay <= e && i(e - n.delay)
													},
													0,
													n.time
												))
										})(e, n, {
											name: t,
											index: r,
											group: h,
											on: o,
											tween: i,
											time: v.time,
											delay: v.delay,
											duration: v.duration,
											ease: v.ease,
											timer: null,
											state: l
										})
									}),
									(t.init = function(e, t) {
										var n = h(e, t)
										if (n.state > l) throw new Error('too late; already scheduled')
										return n
									}),
									(t.set = function(e, t) {
										var n = h(e, t)
										if (n.state > s) throw new Error('too late; already started')
										return n
									}),
									(t.get = h)
								var r = n(56),
									a = n(63),
									o = (0, r.dispatch)('start', 'end', 'interrupt'),
									i = [],
									l = (t.CREATED = 0),
									u = (t.SCHEDULED = 1),
									s = (t.STARTING = 2),
									f = (t.STARTED = 3),
									c = (t.RUNNING = 4),
									d = (t.ENDING = 5),
									p = (t.ENDED = 6)
								function h(e, t) {
									var n = e.__transition
									if (!n || !(n = n[t])) throw new Error('transition not found')
									return n
								}
							},
							function(module, exports, __webpack_require__) {
								Object.defineProperty(exports, '__esModule', { value: !0 }),
									(exports.bwSetting = exports.tip = exports.Menu = exports.domaincolorlst = exports.gmmode = exports.tkt = exports.textlensf = exports.colorctx = exports.colorantisense = exports.colorbgright = exports.colorbgleft = exports.coloroutframe = exports.colorinframe = exports.unspecified = exports.font = void 0)
								var _slicedToArray = function(e, t) {
										if (Array.isArray(e)) return e
										if (Symbol.iterator in Object(e))
											return (function(e, t) {
												var n = [],
													r = !0,
													a = !1,
													o = void 0
												try {
													for (
														var i, l = e[Symbol.iterator]();
														!(r = (i = l.next()).done) && (n.push(i.value), !t || n.length !== t);
														r = !0
													);
												} catch (e) {
													;(a = !0), (o = e)
												} finally {
													try {
														!r && l.return && l.return()
													} finally {
														if (a) throw o
													}
												}
												return n
											})(e, t)
										throw new TypeError('Invalid attempt to destructure non-iterable instance')
									},
									_createClass = (function() {
										function e(e, t) {
											for (var n = 0; n < t.length; n++) {
												var r = t[n]
												;(r.enumerable = r.enumerable || !1),
													(r.configurable = !0),
													'value' in r && (r.writable = !0),
													Object.defineProperty(e, r.key, r)
											}
										}
										return function(t, n, r) {
											return n && e(t.prototype, n), r && e(t, r), t
										}
									})(),
									_typeof =
										'function' == typeof Symbol && 'symbol' == _typeof2(Symbol.iterator)
											? function(e) {
													return void 0 === e ? 'undefined' : _typeof2(e)
											  }
											: function(e) {
													return e && 'function' == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype
														? 'symbol'
														: void 0 === e
														? 'undefined'
														: _typeof2(e)
											  }
								;(exports.get_one_genome = get_one_genome),
									(exports.initgenome = initgenome),
									(exports.dofetch = dofetch),
									(exports.dofetch2 = dofetch2),
									(exports.dofetch3 = dofetch3),
									(exports.may_get_locationsearch = may_get_locationsearch),
									(exports.appear = appear),
									(exports.disappear = disappear),
									(exports.menushow = menushow),
									(exports.menuunderdom = menuunderdom),
									(exports.sayerror = sayerror),
									(exports.axisstyle = axisstyle),
									(exports.newpane = newpane),
									(exports.getdomaintypes = getdomaintypes),
									(exports.sketchSplicerna = sketchSplicerna),
									(exports.sketchGmsum = sketchGmsum),
									(exports.sketchRna = sketchRna),
									(exports.sketchProtein2 = sketchProtein2),
									(exports.sketchGene = sketchGene),
									(exports.sketchProtein = sketchProtein),
									(exports.make_table_2col = make_table_2col),
									(exports.newpane3 = newpane3),
									(exports.to_svg = to_svg),
									(exports.filetypeselect = filetypeselect),
									(exports.export_data = export_data),
									(exports.flyindi = flyindi),
									(exports.labelbox = labelbox),
									(exports.category2legend = category2legend),
									(exports.bulk_badline = bulk_badline),
									(exports.ensureisblock = ensureisblock),
									(exports.fillbar = fillbar),
									(exports.mclasscolorchangeui = mclasscolorchangeui),
									(exports.mclasscolor2table = mclasscolor2table),
									(exports.first_genetrack_tolist = first_genetrack_tolist),
									(exports.tkexists = tkexists),
									(exports.ranksays = ranksays),
									(exports.rgb2hex = rgb2hex),
									(exports.keyupEnter = keyupEnter),
									(exports.may_findmatchingsnp = may_findmatchingsnp),
									(exports.snp_printhtml = snp_printhtml),
									(exports.may_findmatchingclinvar = may_findmatchingclinvar),
									(exports.clinvar_printhtml = clinvar_printhtml),
									(exports.gmlst2loci = gmlst2loci),
									(exports.tab2box = tab2box),
									(exports.tab_wait = tab_wait),
									(exports.add_scriptTag = add_scriptTag)
								var _d3Scale = __webpack_require__(29),
									_d3Selection = __webpack_require__(0),
									_d3Color = __webpack_require__(3),
									_d3Transition = __webpack_require__(114),
									_tree = __webpack_require__(58),
									_d3Hierarchy = __webpack_require__(55),
									_common = __webpack_require__(2),
									common = _interopRequireWildcard(_common)
								function _interopRequireWildcard(e) {
									if (e && e.__esModule) return e
									var t = {}
									if (null != e) for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (t[n] = e[n])
									return (t.default = e), t
								}
								function _toConsumableArray(e) {
									if (Array.isArray(e)) {
										for (var t = 0, n = Array(e.length); t < e.length; t++) n[t] = e[t]
										return n
									}
									return Array.from(e)
								}
								function _classCallCheck(e, t) {
									if (!(e instanceof t)) throw new TypeError('Cannot call a class as a function')
								}
								var font = (exports.font = 'Arial'),
									unspecified = (exports.unspecified = 'Unspecified'),
									colorinframe = (exports.colorinframe = 'green'),
									coloroutframe = (exports.coloroutframe = '#858585'),
									colorbgleft = (exports.colorbgleft = '#FCE3B8'),
									colorbgright = (exports.colorbgright = '#D2E2FC'),
									colorantisense = (exports.colorantisense = 'red'),
									colorctx = (exports.colorctx = '#DE3336'),
									textlensf = (exports.textlensf = 0.6),
									base_zindex = null,
									tkt = (exports.tkt = common.tkt),
									gmmode = (exports.gmmode = common.gmmode),
									domaincolorlst = (exports.domaincolorlst = [
										'#8dd3c7',
										'#bebada',
										'#fb8072',
										'#80b1d3',
										'#E8E89E',
										'#a6d854',
										'#fdb462',
										'#ffd92f',
										'#e5c494',
										'#b3b3b3'
									]),
									fetchTimers = {},
									fetchReported = {},
									maxAcceptableFetchResponseTime = 15e3,
									maxNumReportsPerSession = 2
								async function get_one_genome(e) {
									var t = await dofetch2('genomes?genome=' + e)
									if (!t.genomes) throw 'error'
									var n = t.genomes[e]
									if (!n) throw 'unknown genome: ' + e
									return initgenome(n), n
								}
								function initgenome(e) {
									for (var t in ((e.tkset = []),
									(e.isoformcache = new Map()),
									(e.junctionframecache = new Map()),
									(e.isoformmatch = function(t, n, r) {
										if (!t) return null
										var a = t.toUpperCase()
										if (!e.isoformcache.has(a)) return null
										var o = e.isoformcache.get(a)
										if (1 == o.length) return o[0]
										if (!n) return console.log('no chr provided for matching with ' + a), o[0]
										var i = null,
											l = !0,
											u = !1,
											s = void 0
										try {
											for (var f, c = o[Symbol.iterator](); !(l = (f = c.next()).done); l = !0) {
												var d = f.value
												d.chr.toUpperCase() == n.toUpperCase() && d.start <= r && d.stop >= r && (i = d)
											}
										} catch (e) {
											;(u = !0), (s = e)
										} finally {
											try {
												!l && c.return && c.return()
											} finally {
												if (u) throw s
											}
										}
										if (i) return i
										var p = !0,
											h = !1,
											v = void 0
										try {
											for (var m, y = o[Symbol.iterator](); !(p = (m = y.next()).done); p = !0) {
												var g = m.value
												if (g.chr.toUpperCase() == n.toUpperCase()) return g
											}
										} catch (e) {
											;(h = !0), (v = e)
										} finally {
											try {
												!p && y.return && y.return()
											} finally {
												if (h) throw v
											}
										}
										return null
									}),
									(e.chrlookup = {}),
									e.majorchr))
										e.chrlookup[t.toUpperCase()] = { name: t, len: e.majorchr[t], major: !0 }
									if (e.minorchr)
										for (var n in e.minorchr) e.chrlookup[n.toUpperCase()] = { name: n, len: e.minorchr[n] }
									e.tracks || (e.tracks = [])
									var r = !0,
										a = !1,
										o = void 0
									try {
										for (var i, l = e.tracks[Symbol.iterator](); !(r = (i = l.next()).done); r = !0)
											i.value.tkid = Math.random().toString()
									} catch (e) {
										;(a = !0), (o = e)
									} finally {
										try {
											!r && l.return && l.return()
										} finally {
											if (a) throw o
										}
									}
									for (var u in e.datasets) {
										var s = e.datasets[u]
										if (s.isMds);
										else {
											var f = validate_oldds(s)
											if (f) return '(old) official dataset error: ' + f
										}
									}
									return null
								}
								function validate_oldds(ds) {
									if (ds.geneexpression && ds.geneexpression.maf)
										try {
											ds.geneexpression.maf.get = eval('(' + ds.geneexpression.maf.get + ')')
										} catch (e) {
											return 'invalid Javascript for get() of expression.maf of ' + ds.label
										}
									if (ds.cohort) {
										if (ds.cohort.raw && ds.cohort.tosampleannotation) {
											if (!ds.cohort.key4annotation)
												return 'cohort.tosampleannotation in use by .key4annotation missing of ' + ds.label
											ds.cohort.annotation || (ds.cohort.annotation = {})
											var nosample = 0,
												_iteratorNormalCompletion4 = !0,
												_didIteratorError4 = !1,
												_iteratorError4 = void 0
											try {
												for (
													var _iterator4 = ds.cohort.raw[Symbol.iterator](), _step4;
													!(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done);
													_iteratorNormalCompletion4 = !0
												) {
													var a = _step4.value,
														sample = a[ds.cohort.tosampleannotation.samplekey]
													if (sample) {
														var b = {}
														for (var k in a) b[k] = a[k]
														ds.cohort.annotation[sample] = b
													} else nosample++
												}
											} catch (e) {
												;(_didIteratorError4 = !0), (_iteratorError4 = e)
											} finally {
												try {
													!_iteratorNormalCompletion4 && _iterator4.return && _iterator4.return()
												} finally {
													if (_didIteratorError4) throw _iteratorError4
												}
											}
											if (nosample) return nosample + ' rows has no sample name from sample annotation of ' + ds.label
											delete ds.cohort.tosampleannotation
										}
										if (ds.cohort.levels && ds.cohort.raw) {
											var nodes = (0, _tree.stratinput)(ds.cohort.raw, ds.cohort.levels)
											;(ds.cohort.root = (0, _d3Hierarchy.stratify)()(nodes)),
												ds.cohort.root.sum(function(e) {
													return e.value
												})
										}
										ds.cohort.raw && delete ds.cohort.raw,
											(ds.cohort.suncolor = (0, _d3Scale.scaleOrdinal)(_d3Scale.schemeCategory20))
									}
									if (ds.snvindel_attributes) {
										var _iteratorNormalCompletion5 = !0,
											_didIteratorError5 = !1,
											_iteratorError5 = void 0
										try {
											for (
												var _iterator5 = ds.snvindel_attributes[Symbol.iterator](), _step5;
												!(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done);
												_iteratorNormalCompletion5 = !0
											) {
												var at = _step5.value
												if (at.get)
													try {
														at.get = eval('(' + at.get + ')')
													} catch (e) {
														return 'invalid Javascript for getter of ' + JSON.stringify(at)
													}
												else if (at.lst) {
													var _iteratorNormalCompletion6 = !0,
														_didIteratorError6 = !1,
														_iteratorError6 = void 0
													try {
														for (
															var _iterator6 = at.lst[Symbol.iterator](), _step6;
															!(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done);
															_iteratorNormalCompletion6 = !0
														) {
															var at2 = _step6.value
															if (at2.get)
																try {
																	at2.get = eval('(' + at2.get + ')')
																} catch (e) {
																	return 'invalid Javascript for getter of ' + JSON.stringify(at2)
																}
														}
													} catch (e) {
														;(_didIteratorError6 = !0), (_iteratorError6 = e)
													} finally {
														try {
															!_iteratorNormalCompletion6 && _iterator6.return && _iterator6.return()
														} finally {
															if (_didIteratorError6) throw _iteratorError6
														}
													}
												}
											}
										} catch (e) {
											;(_didIteratorError5 = !0), (_iteratorError5 = e)
										} finally {
											try {
												!_iteratorNormalCompletion5 && _iterator5.return && _iterator5.return()
											} finally {
												if (_didIteratorError5) throw _iteratorError5
											}
										}
									}
									if (ds.stratify) {
										if (!Array.isArray(ds.stratify)) return 'stratify is not an array in ' + ds.label
										var _iteratorNormalCompletion7 = !0,
											_didIteratorError7 = !1,
											_iteratorError7 = void 0
										try {
											for (
												var _iterator7 = ds.stratify[Symbol.iterator](), _step7;
												!(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done);
												_iteratorNormalCompletion7 = !0
											) {
												var strat = _step7.value
												if (!strat.label) return 'stratify method lacks label in ' + ds.label
												if (strat.bycohort) {
													if (!ds.cohort)
														return 'stratify method ' + strat.label + ' using cohort but no cohort in ' + ds.label
												} else {
													if (!strat.attr1)
														return 'stratify method ' + strat.label + ' not using cohort but no attr1 in ' + ds.label
													if (!strat.attr1.label) return '.attr1.label missing in ' + strat.label + ' in ' + ds.label
													if (!strat.attr1.k) return '.attr1.k missing in ' + strat.label + ' in ' + ds.label
												}
											}
										} catch (e) {
											;(_didIteratorError7 = !0), (_iteratorError7 = e)
										} finally {
											try {
												!_iteratorNormalCompletion7 && _iterator7.return && _iterator7.return()
											} finally {
												if (_didIteratorError7) throw _iteratorError7
											}
										}
									}
									if (ds.url4variant) {
										var _iteratorNormalCompletion8 = !0,
											_didIteratorError8 = !1,
											_iteratorError8 = void 0
										try {
											for (
												var _iterator8 = ds.url4variant[Symbol.iterator](), _step8;
												!(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done);
												_iteratorNormalCompletion8 = !0
											) {
												var u = _step8.value
												;(u.makelabel = eval('(' + u.makelabel + ')')), (u.makeurl = eval('(' + u.makeurl + ')'))
											}
										} catch (e) {
											;(_didIteratorError8 = !0), (_iteratorError8 = e)
										} finally {
											try {
												!_iteratorNormalCompletion8 && _iterator8.return && _iterator8.return()
											} finally {
												if (_didIteratorError8) throw _iteratorError8
											}
										}
									}
								}
								function dofetch(e, t) {
									var n = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : null
									if (n && 'object' == (void 0 === n ? 'undefined' : _typeof(n)))
										return (
											n.serverData &&
												'object' == _typeof(n.serverData) &&
												(dofetch.serverData
													? n.serverData || (n.serverData = dofetch.serverData)
													: (dofetch.serverData = n.serverData)),
											dofetch2(e, { method: 'POST', body: JSON.stringify(t) }, n)
										)
									'/' == e[0] && (e = e.slice(1))
									var r = sessionStorage.getItem('jwt')
									r && (t.jwt = r)
									var a = e,
										o = sessionStorage.getItem('hostURL') || window.testHost || ''
									return (
										o && (a = o.endsWith('/') ? o + e : o + '/' + e),
										trackfetch(a, t),
										fetch(new Request(a, { method: 'POST', body: JSON.stringify(t) })).then(function(e) {
											return fetchTimers[a] && clearTimeout(fetchTimers[a]), e.json()
										})
									)
								}
								var cachedServerDataKeys = [],
									maxNumOfServerDataKeys = 20
								function dofetch2(e) {
									var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
										n = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {}
									'/' == e[0] && (e = e.slice(1))
									var r = sessionStorage.getItem('jwt')
									r && (t.headers || (t.headers = {}), (t.headers.authorization = 'Bearer ' + r))
									var a = e,
										o = sessionStorage.getItem('hostURL') || window.testHost || ''
									o && (a = o.endsWith('/') ? o + e : o + '/' + e)
									var i = a + ' | ' + t.method + ' | ' + t.body
									if (n.serverData) {
										i in n.serverData ||
											(trackfetch(a, t),
											(n.serverData[i] = fetch(a, t).then(function(e) {
												return fetchTimers[a] && clearTimeout(fetchTimers[a]), e.text()
											})))
										var l = cachedServerDataKeys.indexOf(i)
										if (
											(-1 !== l && cachedServerDataKeys.splice(l, 1),
											cachedServerDataKeys.unshift(i),
											cachedServerDataKeys.length > maxNumOfServerDataKeys)
										) {
											var u = cachedServerDataKeys.pop()
											delete n.serverData[u]
										}
										return n.serverData[i].then(function(e) {
											return JSON.parse(e)
										})
									}
									return (
										trackfetch(a, t),
										fetch(a, t).then(function(e) {
											return fetchTimers[a] && clearTimeout(fetchTimers[a]), e.json()
										})
									)
								}
								var defaultServerDataCache = {}
								function dofetch3(e) {
									var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
										n = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {}
									return (n.serverData = defaultServerDataCache), dofetch2(e, t, n)
								}
								function trackfetch(e, t) {
									maxAcceptableFetchResponseTime < 1 ||
										fetchTimers[e] ||
										fetchReported[e] ||
										!(Object.keys(fetchReported).length <= maxNumReportsPerSession) ||
										('proteinpaint.stjude.org' != window.location.hostname &&
											'proteinpaint.stjude.org' != sessionStorage.hostURL) ||
										(fetchTimers[e] = setTimeout(function() {
											fetchReported[e] = 1
											var n = {
												method: 'POST',
												headers: { 'content-type': 'application/json' },
												body: JSON.stringify({ issue: 'slow response', url: e, arg: t, page: window.location.href })
											}
											fetch('https://pecan.stjude.cloud/api/issue-tracker', n)
										}, maxAcceptableFetchResponseTime))
								}
								function may_get_locationsearch() {
									if (location.search) {
										var e = new Map(),
											t = !0,
											n = !1,
											r = void 0
										try {
											for (
												var a,
													o = decodeURIComponent(location.search.substr(1))
														.split('&')
														[Symbol.iterator]();
												!(t = (a = o.next()).done);
												t = !0
											) {
												var i = a.value.split('='),
													l = i[0].toLowerCase()
												e.set(l, i[1] || 1)
											}
										} catch (e) {
											;(n = !0), (r = e)
										} finally {
											try {
												!t && o.return && o.return()
											} finally {
												if (n) throw r
											}
										}
										return e
									}
								}
								function appear(e, t) {
									e.style('opacity', 0)
										.style('display', t || 'block')
										.transition()
										.style('opacity', 1)
								}
								function disappear(e, t) {
									e.style('opacity', 1)
										.transition()
										.style('opacity', 0)
										.call(function() {
											t ? e.remove() : e.style('display', 'none').style('opacity', 1)
										})
								}
								var Menu = (exports.Menu = (function() {
										function e() {
											var t = this,
												n = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {}
											_classCallCheck(this, e), (this.typename = Math.random().toString())
											var r = (0, _d3Selection.select)(document.body)
											r.on('mousedown.menu' + this.typename, function() {
												t.hide()
											}),
												(this.d = r
													.append('div')
													.attr('class', 'sja_menu_div')
													.style('display', 'none')
													.style('position', 'absolute')
													.style('background-color', 'white')
													.style('font-family', font)
													.on('mousedown.menu' + this.typename, function() {
														_d3Selection.event.stopPropagation()
													})),
												base_zindex && this.d.style('z-index', base_zindex + 1),
												this.d.style('padding', 'padding' in n ? n.padding : '20px'),
												n.border
													? this.d.style('border', n.border)
													: this.d.style('box-shadow', '0px 2px 4px 1px #999'),
												(this.offsetX = Number.isInteger(n.offsetX) ? n.offsetX : 20),
												(this.offsetY = Number.isInteger(n.offsetY) ? n.offsetY : 20),
												(this.hideXmute = Number.isInteger(n.hideXmute) ? n.hideXmute : 0),
												(this.hideYmute = Number.isInteger(n.hideYmute) ? n.hideYmute : 0),
												(this.prevX = -1),
												(this.prevY = -1),
												(this.clearSelector = n.clearSelector)
										}
										return (
											_createClass(e, [
												{
													key: 'clear',
													value: function() {
														return (
															this.clearSelector
																? this.d
																		.select(this.clearSelector)
																		.selectAll('*')
																		.remove()
																: this.d.selectAll('*').remove(),
															this
														)
													}
												},
												{
													key: 'show',
													value: function(e, t) {
														;(this.prevX = e),
															(this.prevY = t),
															document.body.appendChild(this.d.node()),
															this.d.style('display', 'block')
														var n = e + this.offsetX,
															r = t + this.offsetY,
															a = this.d.node().getBoundingClientRect()
														return (
															n + a.width > window.innerWidth
																? e > a.width
																	? this.d
																			.style('left', null)
																			.style('right', window.innerWidth - e - window.scrollX + this.offsetX + 'px')
																	: this.d
																			.style('left', Math.max(0, window.innerWidth - a.width) + window.scrollX + 'px')
																			.style('right', null)
																: this.d.style('left', n + window.scrollX + 'px').style('right', null),
															r + a.height > window.innerHeight
																? t > a.height
																	? this.d
																			.style('top', null)
																			.style('bottom', window.innerHeight - t - window.scrollY + this.offsetY + 'px')
																	: this.d
																			.style('top', Math.max(0, window.innerHeight - a.height) + window.scrollY + 'px')
																			.style('bottom', null)
																: this.d.style('top', r + window.scrollY + 'px').style('bottom', null),
															this.d.transition().style('opacity', 1),
															this
														)
													}
												},
												{
													key: 'showunder',
													value: function(e, t) {
														var n = e.getBoundingClientRect()
														return this.show(n.left - this.offsetX, n.top + n.height + (t || 5) - this.offsetY)
													}
												},
												{
													key: 'showunderoffset',
													value: function(e, t) {
														var n = e.getBoundingClientRect()
														return this.show(n.left, n.top + n.height + (t || 5))
													}
												},
												{
													key: 'hide',
													value: function() {
														if (
															!(
																_d3Selection.event &&
																Math.abs(this.prevX - _d3Selection.event.clientX) < this.hideXmute &&
																Math.abs(this.prevY - _d3Selection.event.clientY) < this.hideYmute
															)
														)
															return this.d.style('display', 'none').style('opacity', 0), this
													}
												},
												{
													key: 'fadeout',
													value: function() {
														var e = this
														return (
															this.d
																.transition()
																.style('opacity', 0)
																.on('end', function() {
																	return e.d.style('display', 'none')
																}),
															this
														)
													}
												},
												{
													key: 'toggle',
													value: function() {
														return (
															this.hidden
																? (this.d.style('opacity', 1).style('display', 'block'), (this.hidden = !1))
																: (this.hide(), (this.hidden = !0)),
															this
														)
													}
												}
											]),
											e
										)
									})()),
									tip = (exports.tip = new Menu({ padding: '' }))
								function menushow(e, t) {
									var n = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {}
									console.log('client.menushow is deprecated'),
										(0, _d3Selection.selectAll)('.sja_menu').remove(),
										(0, _d3Selection.selectAll)('.sja_menu_persist').style('display', 'none')
									var r = e + document.body.scrollLeft,
										a = '',
										o = t + document.body.scrollTop,
										i = ''
									;(e = document.body.clientWidth + document.body.scrollLeft - r) < 200 ? (r = '') : (r += 'px'),
										(t = document.body.clientHeight + document.body.scrollTop - o) < 200
											? ((o = ''), (i = t - document.body.scrollTop + 40 + 'px'))
											: (o += 'px')
									var l = (0, _d3Selection.select)(document.body),
										u = l
											.append('div')
											.attr('class', n.persist ? 'sja_menu_persist' : 'sja_menu')
											.on('mouseover', function() {
												return l.on('mousedown', null)
											})
											.on('mouseout', function() {
												return l.on('mousedown', s)
											})
									function s() {
										n.persist ? u.style('display', 'none') : (u.remove(), l.on('mousedown', null))
									}
									return (
										u
											.style('left', r)
											.style('top', o)
											.style('right', a)
											.style('bottom', i)
											.style('display', 'block'),
										l.on('mousedown', s),
										(u.show = function() {
											;(0, _d3Selection.selectAll)('.sja_menu').remove(),
												(0, _d3Selection.selectAll)('.sja_menu_persist').style('display', 'none'),
												u && u.style('display', 'block')
										}),
										u
									)
								}
								function menuunderdom(e) {
									var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
										n = e.getBoundingClientRect()
									return menushow(n.left, n.top + n.height + 3, t)
								}
								function sayerror(e, t) {
									var n = e.append('div').attr('class', 'sja_errorbar')
									n.append('div').text(t),
										n
											.append('div')
											.html('&#10005;')
											.on('click', function() {
												disappear(n, !0)
											})
								}
								function axisstyle(e) {
									e &&
										e.axis &&
										(e.color || (e.color = '#545454'),
										e.axis
											.selectAll('line')
											.attr('stroke', e.color)
											.attr('shape-rendering', 'crispEdges'),
										e.axis
											.selectAll('path')
											.attr('fill', 'none')
											.attr('stroke', e.showline ? e.color : 'none')
											.attr('stroke-width', e.showline ? 1 : 0)
											.attr('shape-rendering', 'crispEdges'),
										e.axis
											.selectAll('text')
											.style('cursor', 'default')
											.attr('font-family', font)
											.attr('font-size', e.fontsize ? e.fontsize + 'px' : '12px')
											.attr('fill', e.color))
								}
								function newpane(e) {
									if (!e.setzindex) {
										var t = {},
											n = (0, _d3Selection.select)(document.body)
										;(t.pane = n
											.append('div')
											.attr('class', 'sja_pane')
											.style('left', e.x + window.pageXOffset + 'px')
											.style('top', e.y + window.pageYOffset + 'px')
											.style('opacity', 0)),
											e.$id && t.pane.attr('id', e.$id),
											base_zindex && t.pane.style('z-index', base_zindex),
											t.pane
												.transition()
												.duration(300)
												.style('opacity', 1)
										var r = t.pane.append('div').on('mousedown', function() {
												_d3Selection.event.preventDefault(), _d3Selection.event.stopPropagation()
												var e = Number.parseInt(t.pane.style('left')),
													r = Number.parseInt(t.pane.style('top')),
													a = _d3Selection.event.clientX,
													o = _d3Selection.event.clientY
												n.on('mousemove', function() {
													t.pane
														.style('left', e + _d3Selection.event.clientX - a + 'px')
														.style('top', r + _d3Selection.event.clientY - o + 'px')
												}),
													n.on('mouseup', function() {
														n.on('mouseup', null).on('mousemove', null)
													}),
													document.body.appendChild(t.pane.node())
											}),
											a = r
												.append('div')
												.attr('class', 'sja_menuoption')
												.style('display', 'inline-block')
												.style('padding', '4px 10px')
												.style('margin', '0px')
												.style('border-right', 'solid 1px white')
												.style('cursor', 'default')
												.style('font-size', '1.5em')
												.on('mousedown', function() {
													document.body.dispatchEvent(new Event('mousedown')), _d3Selection.event.stopPropagation()
												})
										return (
											e.toshrink
												? ((t.mini = !1),
												  a.html('&#9473;').on('click', function() {
														a.html(t.mini ? '&#9473;' : '&#9725;'),
															t.mini ? appear(t.body) : disappear(t.body),
															(t.mini = !t.mini)
												  }))
												: (a.html('&times;'),
												  e.close
														? a.on('click', e.close)
														: e.closekeep
														? a.on('click', function() {
																t.pane
																	.transition()
																	.duration(300)
																	.style('opacity', 0)
																	.call(function() {
																		return t.pane.style('display', 'none')
																	})
														  })
														: a.on('click', function() {
																t.pane
																	.transition()
																	.duration(300)
																	.style('opacity', 0)
																	.call(function() {
																		return t.pane.remove()
																	})
														  })),
											(t.header = r
												.append('div')
												.style('display', 'inline-block')
												.style('font-family', font)
												.style('padding', e.headpad || '5px 10px')),
											(t.body = t.pane.append('div').style('font-family', font)),
											t
										)
									}
									base_zindex = e.setzindex
								}
								function getdomaintypes(e) {
									if (!e.pdomains) return []
									var t = new Map(),
										n = !0,
										r = !1,
										a = void 0
									try {
										for (var o, i = e.pdomains[Symbol.iterator](); !(n = (o = i.next()).done); n = !0) {
											var l = o.value,
												u = l.name + l.description
											t.has(u)
												? (t.get(u).start = Math.min(t.get(u).start, l.start))
												: t.set(u, {
														name: l.name,
														description: l.description,
														color: l.color,
														start: l.start,
														iscustom: l.iscustom,
														url: l.url,
														pmid: l.pmid,
														CDD: l.CDD,
														Pfam: l.Pfam,
														SMART: l.SMART,
														COG: l.COG,
														PRK: l.PRK,
														Curated_at_NCBI: l.Curated_at_NCBI
												  })
										}
									} catch (e) {
										;(r = !0), (a = e)
									} finally {
										try {
											!n && i.return && i.return()
										} finally {
											if (r) throw a
										}
									}
									var s = [],
										f = !0,
										c = !1,
										d = void 0
									try {
										for (var p, h = t[Symbol.iterator](); !(f = (p = h.next()).done); f = !0) {
											var v = _slicedToArray(p.value, 2),
												m = v[0],
												y = v[1]
											;(y.key = m),
												(y.fill = y.color),
												(y.stroke = (0, _d3Color.rgb)(y.color)
													.darker(1)
													.toString()),
												delete y.color,
												s.push(y)
										}
									} catch (e) {
										;(c = !0), (d = e)
									} finally {
										try {
											!f && h.return && h.return()
										} finally {
											if (c) throw d
										}
									}
									return (
										s.sort(function(e, t) {
											return e.start - t.start
										}),
										s
									)
								}
								function sketchSplicerna(e, t, n, r) {
									var a = 10
									a * (t.exon.length - 1) > 0.3 * n && (a = Math.max(2, (0.3 * n) / (t.exon.length - 1)))
									var o = 0,
										i = !0,
										l = !1,
										u = void 0
									try {
										for (var s, f = t.exon[Symbol.iterator](); !(i = (s = f.next()).done); i = !0) {
											var c = s.value
											o += c[1] - c[0]
										}
									} catch (e) {
										;(l = !0), (u = e)
									} finally {
										try {
											!i && f.return && f.return()
										} finally {
											if (l) throw u
										}
									}
									var d = a * (t.exon.length - 1),
										p = (n - (d > 0.4 * n ? 0 : d)) / o
									n = p * o + d
									var h = e.append('canvas').node()
									;(h.width = n), (h.height = 20)
									var v = h.getContext('2d')
									;(v.strokeStyle = r),
										v.beginPath(),
										v.moveTo(0, Math.floor(10) - 0.5),
										v.lineTo(n, Math.floor(10) - 0.5),
										v.stroke()
									var m = '-' == t.strand,
										y = 0,
										g = !0,
										b = !1,
										_ = void 0
									try {
										for (var x, w = t.exon[Symbol.iterator](); !(g = (x = w.next()).done); g = !0) {
											var j = x.value,
												k = null,
												O = null,
												M = null
											if (m) {
												var P = j[1],
													S = j[0],
													A = t.codingstop,
													C = t.codingstart
												S >= A
													? (k = j)
													: S >= C
													? P >= A
														? ((k = [A, P]), (O = [S, A]))
														: (O = j)
													: P >= A
													? ((k = [A, P]), (M = [S, C]), (O = [C, A]))
													: P >= C
													? ((M = [S, C]), (O = [C, P]))
													: (M = j)
											} else
												j[1] <= t.codingstart
													? (k = j)
													: j[1] <= t.codingstop
													? j[0] <= t.codingstart
														? ((k = [j[0], t.codingstart]), (O = [t.codingstart, j[1]]))
														: (O = j)
													: j[0] <= t.codingstart
													? ((k = [j[0], t.codingstart]),
													  (M = [t.codingstop, j[1]]),
													  (O = [t.codingstart, t.codingstop]))
													: j[0] < t.codingstop
													? ((M = [t.codingstop, j[1]]), (O = [j[0], t.codingstop]))
													: (M = j)
											if (k) {
												v.fillStyle = '#aaa'
												var N = Math.max(1, (k[1] - k[0]) * p)
												v.fillRect(y, 4, N, 12), (y += N)
											}
											if (O) {
												v.fillStyle = r
												var T = Math.max(1, (O[1] - O[0]) * p)
												v.fillRect(y, 0, T, 20), (y += T)
											}
											if (M) {
												v.fillStyle = '#aaa'
												var E = Math.max(1, (M[1] - M[0]) * p)
												v.fillRect(y, 4, E, 12), (y += E)
											}
											y += a
										}
									} catch (e) {
										;(b = !0), (_ = e)
									} finally {
										try {
											!g && w.return && w.return()
										} finally {
											if (b) throw _
										}
									}
								}
								function sketchGmsum(e, t, n, r, a, o, i, l) {
									var u = e.append('canvas').node()
									;(u.width = o), (u.height = i)
									var s = Math.ceil(i / 5),
										f = u.getContext('2d'),
										c = void 0,
										d = 0,
										p = !0,
										h = !1,
										v = void 0
									try {
										for (var m, y = t[Symbol.iterator](); !(p = (m = y.next()).done); p = !0) {
											var g = m.value
											if (g.chr == n.chr) {
												if (n.start >= g.start && n.start <= g.stop) {
													c = d + (g.reverse ? g.stop - n.start : n.start - g.start) * r
													break
												}
												d += g.width + a
											} else d += g.width + a
										}
									} catch (e) {
										;(h = !0), (v = e)
									} finally {
										try {
											!p && y.return && y.return()
										} finally {
											if (h) throw v
										}
									}
									var b = void 0
									d = 0
									var _ = !0,
										x = !1,
										w = void 0
									try {
										for (var j, k = t[Symbol.iterator](); !(_ = (j = k.next()).done); _ = !0) {
											var O = j.value
											if (O.chr == n.chr) {
												if (n.stop >= O.start && n.stop <= O.stop) {
													b = d + (O.reverse ? O.stop - n.stop : n.stop - O.start) * r
													break
												}
												d += O.width + a
											} else d += O.width + a
										}
									} catch (e) {
										;(x = !0), (w = e)
									} finally {
										try {
											!_ && k.return && k.return()
										} finally {
											if (x) throw w
										}
									}
									;(f.strokeStyle = l),
										f.beginPath(),
										f.moveTo(c, Math.floor(i / 2) + 0.5),
										f.lineTo(b, Math.floor(i / 2) + 0.5),
										f.stroke()
									var M = []
									n.utr5 && M.push.apply(M, _toConsumableArray(n.utr5)),
										n.utr3 && M.push.apply(M, _toConsumableArray(n.utr3)),
										n.cdslen || M.push.apply(M, _toConsumableArray(n.exon))
									var P = !0,
										S = !1,
										A = void 0
									try {
										for (var C, N = M[Symbol.iterator](); !(P = (C = N.next()).done); P = !0) {
											var T = C.value,
												E = 0,
												I = !0,
												R = !1,
												L = void 0
											try {
												for (var D, F = t[Symbol.iterator](); !(I = (D = F.next()).done); I = !0) {
													var q = D.value
													if (q.chr == n.chr) {
														var U = Math.max(T[0], q.start),
															G = Math.min(T[1], q.stop)
														U >= G ||
															((f.fillStyle = '#aaa'),
															f.fillRect(
																E + (q.reverse ? (q.stop - G) * r : (U - q.start) * r),
																s,
																Math.max(1, (G - U) * r),
																i - 2 * s
															)),
															(E += q.width + a)
													} else E += q.width + a
												}
											} catch (e) {
												;(R = !0), (L = e)
											} finally {
												try {
													!I && F.return && F.return()
												} finally {
													if (R) throw L
												}
											}
										}
									} catch (e) {
										;(S = !0), (A = e)
									} finally {
										try {
											!P && N.return && N.return()
										} finally {
											if (S) throw A
										}
									}
									if (n.coding) {
										var z = !0,
											B = !1,
											Y = void 0
										try {
											for (var V, H = n.coding[Symbol.iterator](); !(z = (V = H.next()).done); z = !0) {
												var W = V.value,
													X = 0,
													J = !0,
													K = !1,
													Z = void 0
												try {
													for (var $, Q = t[Symbol.iterator](); !(J = ($ = Q.next()).done); J = !0) {
														var ee = $.value
														if (ee.chr == n.chr) {
															var te = Math.max(W[0], ee.start),
																ne = Math.min(W[1], ee.stop)
															te >= ne ||
																((f.fillStyle = l),
																f.fillRect(
																	X + (ee.reverse ? (ee.stop - ne) * r : (te - ee.start) * r),
																	0,
																	Math.max(1, (ne - te) * r),
																	i
																)),
																(X += ee.width + a)
														} else X += ee.width + a
													}
												} catch (e) {
													;(K = !0), (Z = e)
												} finally {
													try {
														!J && Q.return && Q.return()
													} finally {
														if (K) throw Z
													}
												}
											}
										} catch (e) {
											;(B = !0), (Y = e)
										} finally {
											try {
												!z && H.return && H.return()
											} finally {
												if (B) throw Y
											}
										}
									}
								}
								function sketchRna(e, t, n, r) {
									var a = e.append('canvas').node()
									;(a.width = n), (a.height = 20)
									var o = a.getContext('2d')
									if (!t.cdslen) return (o.fillStyle = '#aaa'), void o.fillRect(0, 4, n, 12)
									var i = n / t.rnalen,
										l = 0
									if (t.utr5) {
										var u = 0,
											s = !0,
											f = !1,
											c = void 0
										try {
											for (var d, p = t.utr5[Symbol.iterator](); !(s = (d = p.next()).done); s = !0) {
												var h = d.value
												u += h[1] - h[0]
											}
										} catch (e) {
											;(f = !0), (c = e)
										} finally {
											try {
												!s && p.return && p.return()
											} finally {
												if (f) throw c
											}
										}
										;(o.fillStyle = '#aaa'), o.fillRect(0, 4, i * u, 12), (l = i * u)
									}
									if (t.pdomains && t.pdomains.length) {
										;(o.fillStyle = 'white'),
											o.fillRect(l, 0, t.cdslen * i, 20),
											t.pdomains.sort(function(e, t) {
												return t.stop - t.start - e.stop + e.start
											})
										var v = !0,
											m = !1,
											y = void 0
										try {
											for (var g, b = t.pdomains[Symbol.iterator](); !(v = (g = b.next()).done); v = !0) {
												var _ = g.value
												;(o.fillStyle = _.color), o.fillRect(l + 3 * _.start * i, 0, 3 * (_.stop - _.start + 1) * i, 20)
											}
										} catch (e) {
											;(m = !0), (y = e)
										} finally {
											try {
												!v && b.return && b.return()
											} finally {
												if (m) throw y
											}
										}
										;(o.strokeStyle = 'black'), o.strokeRect(l, 0, t.cdslen * i, 20)
									} else (o.fillStyle = r), o.fillRect(l, 0, t.cdslen * i, 20)
									if (((l += t.cdslen * i), t.utr3)) {
										var x = 0,
											w = !0,
											j = !1,
											k = void 0
										try {
											for (var O, M = t.utr3[Symbol.iterator](); !(w = (O = M.next()).done); w = !0) {
												var P = O.value
												x += P[1] - P[0]
											}
										} catch (e) {
											;(j = !0), (k = e)
										} finally {
											try {
												!w && M.return && M.return()
											} finally {
												if (j) throw k
											}
										}
										;(o.fillStyle = '#aaa'), o.fillRect(l, 4, i * x, 12)
									}
								}
								function sketchProtein2(e, t, n) {
									var r = e.append('canvas').node()
									;(r.width = n), (r.height = 20)
									var a = r.getContext('2d'),
										o = n / (t.cdslen / 3)
									t.pdomains.sort(function(e, t) {
										return t.stop - t.start - e.stop + e.start
									}),
										(a.fillStyle = 'white'),
										a.fillRect(0, 0, n, 20)
									var i = !0,
										l = !1,
										u = void 0
									try {
										for (var s, f = t.pdomains[Symbol.iterator](); !(i = (s = f.next()).done); i = !0) {
											var c = s.value
											;(a.fillStyle = c.color), a.fillRect(c.start * o, 0, (c.stop - c.start + 1) * o, 20)
										}
									} catch (e) {
										;(l = !0), (u = e)
									} finally {
										try {
											!i && f.return && f.return()
										} finally {
											if (l) throw u
										}
									}
									;(a.strokeStyle = 'black'), a.strokeRect(0, 0, n, 20)
								}
								function sketchGene(e, t, n, r, a, o, i, l, u) {
									var s = e.append('canvas').node()
									;(s.width = n), (s.height = r)
									var f = s.getContext('2d'),
										c = (0, _d3Scale.scaleLinear)().range([1, n])
									u ? c.domain([o, a]) : c.domain([a, o]),
										(f.strokeStyle = i),
										(f.fillStyle = i),
										J(f, t.start, t.stop, a, o, r / 2, 1)
									var d = Math.ceil(r / 5)
									if (t.utr3) {
										var p = !0,
											h = !1,
											v = void 0
										try {
											for (var m, y = t.utr3[Symbol.iterator](); !(p = (m = y.next()).done); p = !0) {
												var g = m.value
												J(f, g[0], g[1], a, o, d + 1, r - 2 * d - 1)
											}
										} catch (e) {
											;(h = !0), (v = e)
										} finally {
											try {
												!p && y.return && y.return()
											} finally {
												if (h) throw v
											}
										}
									}
									if (t.utr5) {
										var b = !0,
											_ = !1,
											x = void 0
										try {
											for (var w, j = t.utr5[Symbol.iterator](); !(b = (w = j.next()).done); b = !0) {
												var k = w.value
												J(f, k[0], k[1], a, o, d + 1, r - 2 * d - 1)
											}
										} catch (e) {
											;(_ = !0), (x = e)
										} finally {
											try {
												!b && j.return && j.return()
											} finally {
												if (_) throw x
											}
										}
									}
									if (t.coding) {
										var O = !0,
											M = !1,
											P = void 0
										try {
											for (var S, A = t.coding[Symbol.iterator](); !(O = (S = A.next()).done); O = !0) {
												var C = S.value
												J(f, C[0], C[1], a, o, 1, r)
											}
										} catch (e) {
											;(M = !0), (P = e)
										} finally {
											try {
												!O && A.return && A.return()
											} finally {
												if (M) throw P
											}
										}
									}
									if (t.codingstart == t.codingstop) {
										var N = !0,
											T = !1,
											E = void 0
										try {
											for (var I, R = t.exon[Symbol.iterator](); !(N = (I = R.next()).done); N = !0) {
												var L = I.value
												J(f, L[0], L[1], a, o, d + 1, r - 2 * d - 1)
											}
										} catch (e) {
											;(T = !0), (E = e)
										} finally {
											try {
												!N && R.return && R.return()
											} finally {
												if (T) throw E
											}
										}
									}
									if (!l && t.strand) {
										if (t.coding) {
											var D = !0,
												F = !1,
												q = void 0
											try {
												for (var U, G = t.coding[Symbol.iterator](); !(D = (U = G.next()).done); D = !0) {
													var z = U.value
													K(f, t.strand, z[0], z[1], a, o, 4, r - 6 - 1, 'white')
												}
											} catch (e) {
												;(F = !0), (q = e)
											} finally {
												try {
													!D && G.return && G.return()
												} finally {
													if (F) throw q
												}
											}
										}
										if (t.intron) {
											var B = !0,
												Y = !1,
												V = void 0
											try {
												for (var H, W = t.intron[Symbol.iterator](); !(B = (H = W.next()).done); B = !0) {
													var X = H.value
													K(f, t.strand, X[0], X[1], a, o, 4, r - 6 - 1, i || 'black')
												}
											} catch (e) {
												;(Y = !0), (V = e)
											} finally {
												try {
													!B && W.return && W.return()
												} finally {
													if (Y) throw V
												}
											}
										}
									}
									function J(e, t, n, r, a, o, i) {
										var l = Math.max(t, r),
											s = Math.min(n, a)
										l >= s || e.fillRect(Math.floor(c(u ? s : l)), o, Math.max(1, Math.abs(c(s) - c(l))), i)
									}
									function K(e, t, n, r, a, o, i, l, u) {
										var s = Math.max(n, a),
											f = Math.min(r, o)
										if (!(s >= f)) {
											var d = l / 2,
												p = c(f) - c(s)
											if (!(p <= 4 + l / 2)) {
												e.strokeStyle = u
												var h = Math.floor((p - 4) / (l / 2 + d)),
													v = Math.floor(c(s) + (p - h * (l / 2 + d)) / 2) + 0.5
												e.beginPath()
												for (var m = 0; m < h; m++)
													'+' == t
														? (e.moveTo(v, i), e.lineTo(v + l / 2, i + l / 2), e.lineTo(v, i + l))
														: (e.moveTo(v + l / 2, i), e.lineTo(v, i + l / 2), e.lineTo(v + l / 2, i + l)),
														(v += l / 2 + d)
												e.stroke()
											}
										}
									}
								}
								function sketchProtein(e, t, n) {
									var r = -1
									return (
										t.cdslen && (r = t.cdslen / 3),
										e
											.append('span')
											.html(
												'&nbsp;' +
													(r > 0
														? Math.ceil(r) + ' AA' + (Number.isInteger(r) ? '' : ' (incomplete CDS)')
														: 'noncoding')
											)
									)
								}
								function make_table_2col(e, t, n) {
									var r = e
											.append('table')
											.style('margin', '5px 8px')
											.style('font-size', 'inherit')
											.attr('class', 'sja_simpletable'),
										a = !0,
										o = !1,
										i = void 0
									try {
										for (
											var l,
												u = function() {
													var e = l.value,
														t = r.append('tr')
													if (e.kvlst) {
														t
															.append('td')
															.attr('rowspan', e.kvlst.length)
															.style('padding', '3px')
															.style('color', '#9e9e9e')
															.html(e.k),
															t
																.append('td')
																.style('padding', '3px')
																.style('color', '#9e9e9e')
																.html(e.kvlst[0].k),
															t
																.append('td')
																.style('padding', '3px')
																.html(e.kvlst[0].v)
														for (var a = 1; a < e.kvlst.length; a++) {
															var o = r.append('tr')
															o
																.append('td')
																.style('padding', '3px')
																.style('color', '#9e9e9e')
																.html(e.kvlst[a].k),
																o
																	.append('td')
																	.style('padding', '3px')
																	.html(e.kvlst[a].v)
														}
													} else {
														t.append('td')
															.attr('colspan', 2)
															.style('padding', '3px')
															.style('color', '#9e9e9e')
															.html(e.k)
														var i = t.append('td').style('padding', '3px')
														n && e.v.length > n
															? i
																	.html(e.v.substr(0, n - 3) + ' ...&raquo;')
																	.attr('class', 'sja_clbtext')
																	.on('click', function() {
																		i.html(e.v)
																			.classed('sja_clbtext', !1)
																			.on('click', null)
																	})
															: i.html(e.v)
													}
												},
												s = t[Symbol.iterator]();
											!(a = (l = s.next()).done);
											a = !0
										)
											u()
									} catch (e) {
										;(o = !0), (i = e)
									} finally {
										try {
											!a && s.return && s.return()
										} finally {
											if (o) throw i
										}
									}
									return r
								}
								function newpane3(e, t, n) {
									var r = newpane({ x: e, y: t }),
										a = r.body.append('div').style('margin', '40px 20px 20px 20px'),
										o = a.append('p')
									o.append('span').html('Genome&nbsp;')
									var i = o.append('select')
									for (var l in n) i.append('option').text(l)
									var u = a.append('div').style('margin', '20px 0px'),
										s = r.body.append('div').style('margin', '10px 20px'),
										f = r.body.append('div').style('margin', '20px')
									return [r, a, i.node(), u, s, f]
								}
								function to_svg(e, t) {
									var n = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {}
									if (n.apply_dom_styles) {
										n.svgClone = e.cloneNode(!0)
										var r = (0, _d3Selection.select)(n.svgClone),
											a = window.getComputedStyle(e),
											o = !0,
											i = !1,
											l = void 0
										try {
											for (var u, s = a[Symbol.iterator](); !(o = (u = s.next()).done); o = !0) {
												var f = u.value
												r.style(f, a.getPropertyValue(f))
											}
										} catch (e) {
											;(i = !0), (l = e)
										} finally {
											try {
												!o && s.return && s.return()
											} finally {
												if (i) throw l
											}
										}
									}
									var c = document.createElement('a')
									document.body.appendChild(c),
										c.addEventListener(
											'click',
											function() {
												var r = new XMLSerializer(),
													a = new Blob([r.serializeToString(n.svgClone ? n.svgClone : e)], { type: 'image/svg+xml' })
												;(c.download = t + '.svg'), (c.href = URL.createObjectURL(a)), document.body.removeChild(c)
											},
											!1
										),
										c.click()
								}
								function filetypeselect(e) {
									var t = e.append('select')
									return (
										t.append('option').text('SNV and indel'),
										t.append('option').text('SV (tabular format)'),
										t.append('option').text('Fusion gene (tabular format)'),
										t.append('option').text('ITD'),
										t.append('option').text('Deletion, intragenic'),
										t.append('option').text('Truncation'),
										t.append('option').text('CNV, gene-level'),
										t
									)
								}
								function export_data(e, t) {
									var n = newpane({ x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 150 })
									n.header.text(e)
									var r = !0,
										a = !1,
										o = void 0
									try {
										for (var i, l = t[Symbol.iterator](); !(r = (i = l.next()).done); r = !0) {
											var u = i.value,
												s = n.body.append('div').style('margin-top', '10px')
											u.label &&
												s
													.append('div')
													.text(u.label)
													.style('margin', '5px'),
												n.body
													.append('textarea')
													.text(u.text)
													.attr('readonly', 1)
													.attr('rows', 10)
													.attr('cols', 100)
										}
									} catch (e) {
										;(a = !0), (o = e)
									} finally {
										try {
											!r && l.return && l.return()
										} finally {
											if (a) throw o
										}
									}
									n.body
										.append('p')
										.style('font-size', '.7em')
										.text('Click on the text box above and press Ctrl-A to select all text for copy-pasting.')
								}
								function flyindi(e, t) {
									var n = e.node().getBoundingClientRect(),
										r = t.node().getBoundingClientRect(),
										a = (0, _d3Selection.select)(document.body)
											.append('div')
											.style('position', 'absolute')
											.style('border', 'solid 1px black')
											.style('left', n.left + window.pageXOffset + 'px')
											.style('top', n.top + window.pageYOffset + 'px')
											.style('width', n.width + 'px')
											.style('height', n.height + 'px')
									base_zindex && a.style('z-index', base_zindex + 3),
										a
											.transition()
											.duration(500)
											.style('left', r.left + window.pageXOffset + 'px')
											.style('top', r.top + window.pageYOffset + 'px')
											.style('width', r.width + 'px')
											.style('height', r.height + 'px')
											.on('end', function() {
												return a.remove()
											})
								}
								function labelbox(e) {
									e.color || (e.color = '#ccc')
									var t = e.holder
										.append('div')
										.style('position', 'relative')
										.style('padding-top', '8px')
									e.margin && t.style('margin', e.margin)
									var n = t
										.append('div')
										.style('border', 'solid 1px ' + e.color)
										.style('padding', '16px')
										.style('padding-bottom', '8px')
									return (
										t
											.append('div')
											.text(e.label)
											.style('position', 'absolute')
											.style('left', '15px')
											.style('top', '0px')
											.style('background-color', 'white')
											.style('color', e.color)
											.style('font-family', font)
											.style('font-size', '16px')
											.style('padding', '0px 10px'),
										n
									)
								}
								function category2legend(e, t) {
									for (var n in (t.selectAll('*').remove(), e)) {
										var r = e[n],
											a = t
												.append('div')
												.style('display', 'inline-block')
												.style('white-space', 'nowrap')
												.style('padding', '5px 20px 5px 0px')
										a
											.append('div')
											.style('display', 'inline-block')
											.style('background-color', r.color)
											.style('margin-right', '5px')
											.style('padding', '0px 4px')
											.html('&nbsp;'),
											a
												.append('div')
												.style('display', 'inline-block')
												.style('color', r.color)
												.text(r.label)
									}
								}
								function bulk_badline(e, t) {
									var n = newpane({ x: 400, y: 60 })
									if (
										(n.body.style('margin', '20px 10px 10px 10px'),
										n.header.text(t.length + ' line' + (t.length > 1 ? 's' : '') + ' rejected, click to check'),
										t.length <= 50)
									) {
										var r = !0,
											a = !1,
											o = void 0
										try {
											for (
												var i,
													l = function() {
														var t = _slicedToArray(i.value, 3),
															r = t[0],
															a = t[1],
															o = t[2]
														n.body
															.append('div')
															.classed('sja_clbtext', !0)
															.style('margin', '3px')
															.text('Line ' + r + ': ' + a)
															.on('click', function() {
																var t = newpane({ x: 500, y: 60 })
																t.header.text('Line ' + r), t.body.style('margin', '10px')
																for (
																	var n = t.body
																			.append('table')
																			.style('border-spacing', '1px')
																			.style('border-collapse', 'separate'),
																		a = !0,
																		i = 0;
																	i < e.length;
																	i++
																) {
																	var l = n.append('tr')
																	a && l.style('background-color', '#ededed'),
																		(a = !a),
																		l.append('td').text(e[i]),
																		l.append('td').text(null == o[i] ? '' : o[i])
																}
															})
													},
													u = t[Symbol.iterator]();
												!(r = (i = u.next()).done);
												r = !0
											)
												l()
										} catch (y) {
											;(a = !0), (o = y)
										} finally {
											try {
												!r && u.return && u.return()
											} finally {
												if (a) throw o
											}
										}
									} else {
										var s = new Map(),
											f = !0,
											c = !1,
											d = void 0
										try {
											for (var p, h = t[Symbol.iterator](); !(f = (p = h.next()).done); f = !0) {
												var v = _slicedToArray(p.value, 3),
													m = v[0],
													y = v[1],
													g = v[2]
												s.has(y) || s.set(y, []), s.get(y).push({ number: m, line: g })
											}
										} catch (y) {
											;(c = !0), (d = y)
										} finally {
											try {
												!f && h.return && h.return()
											} finally {
												if (c) throw d
											}
										}
										var b = [].concat(_toConsumableArray(s))
										b.sort(function(e, t) {
											return t[1].length - e[1].length
										})
										var _ = !0,
											x = !1,
											w = void 0
										try {
											for (
												var j,
													k = function() {
														var t = _slicedToArray(j.value, 2),
															r = t[0],
															a = t[1],
															o = a[0]
														n.body
															.append('div')
															.classed('sja_menuoption', !0)
															.style('margin', '5px')
															.text(
																'Line ' + o.number + ': ' + r + (a.length > 1 ? ' (total ' + a.length + ' lines)' : '')
															)
															.on('click', function() {
																var t = newpane({ x: 500, y: 60 })
																t.header.text('Line ' + o.number)
																for (
																	var n = t.body.style('margin', '10px').append('table'), r = !0, a = 0;
																	a < e.length;
																	a++
																) {
																	var i = n.append('tr')
																	r && i.style('background-color', '#ededed'),
																		(r = !r),
																		i.append('td').text(e[a]),
																		i.append('td').text(null == o.line[a] ? '' : o.line[a])
																}
															})
													},
													O = b[Symbol.iterator]();
												!(_ = (j = O.next()).done);
												_ = !0
											)
												k()
										} catch (y) {
											;(x = !0), (w = y)
										} finally {
											try {
												!_ && O.return && O.return()
											} finally {
												if (x) throw w
											}
										}
									}
								}
								function ensureisblock(e) {
									return e
										? 'object' != (void 0 === e ? 'undefined' : _typeof(e))
											? 'Block is not an object'
											: e.error
											? e.genome
												? null
												: 'block.genome missing'
											: 'method block.error() missing'
										: 'No Block{} object given'
								}
								function fillbar(e, t, n) {
									n || (n = {})
									var r = n.width || 40,
										a = n.height || 12,
										o = void 0
									return (
										e
											? (e.attr(
													'title',
													(100 * t.f).toFixed(0) + '%' + (null != t.v1 ? ' (' + t.v1 + '/' + t.v2 + ')' : '')
											  ),
											  (o = e
													.append('svg')
													.attr('width', r)
													.attr('height', a)))
											: (o = (0, _d3Selection.select)(document.body).append('svg')),
										o
											.append('rect')
											.attr('y', 0)
											.attr('width', r)
											.attr('height', a)
											.attr('fill', n.fillbg || '#CBE2F5'),
										o
											.append('rect')
											.attr('y', 0)
											.attr('width', r * t.f)
											.attr('height', a)
											.attr('fill', n.fill || '#69A1D1'),
										n.readcountcredible &&
											t.v2 < n.readcountcredible &&
											o
												.append('rect')
												.attr('y', 0)
												.attr('width', r)
												.attr('height', a)
												.attr('fill', '#545454')
												.attr('fill-opacity', 0.3),
										e ? o : (o.remove(), '<svg width=' + r + ' height=' + a + '>' + o.node().innerHTML + '</svg>')
									)
								}
								function mclasscolorchangeui(e) {
									e.d.append('p').html('<span style="color:#858585;font-size:.7em">EXAMPLE</span> M ; red')
									var t = e.d
											.append('textarea')
											.attr('cols', 25)
											.attr('rows', 5)
											.attr('placeholder', 'One class per line, join color and class code by semicolon.'),
										n = e.d.append('div')
									n
										.append('button')
										.text('Submit')
										.on('click', function() {
											var e = t.property('value').trim()
											if (e) {
												r.text('')
												var n = [],
													o = !0,
													i = !1,
													l = void 0
												try {
													for (var u, s = e.split('\n')[Symbol.iterator](); !(o = (u = s.next()).done); o = !0) {
														var f = u.value,
															c = f.split(';')
														if (2 != c.length) return r.text('no separator in line: ' + f)
														var d = c[0].trim(),
															p = c[1].trim()
														if (!d || !p) return r.text('wrong line: ' + f)
														if (!common.mclass[d]) return r.text('wrong class: ' + d)
														n.push([d, p])
													}
												} catch (e) {
													;(i = !0), (l = e)
												} finally {
													try {
														!o && s.return && s.return()
													} finally {
														if (i) throw l
													}
												}
												if (n.length) {
													var h = !0,
														v = !1,
														m = void 0
													try {
														for (var y, g = n[Symbol.iterator](); !(h = (y = g.next()).done); h = !0) {
															var b = _slicedToArray(y.value, 2)
															;(d = b[0]), (p = b[1]), (common.mclass[d].color = p)
														}
													} catch (e) {
														;(v = !0), (m = e)
													} finally {
														try {
															!h && g.return && g.return()
														} finally {
															if (v) throw m
														}
													}
													mclasscolor2table(a), r.text('New color set!')
												}
											}
										}),
										n
											.append('button')
											.text('Clear')
											.on('click', function() {
												t.property('value', ''), r.text('')
											})
									var r = n.append('span').style('margin-left', '10px'),
										a = e.d.append('div').style('margin-top', '5px')
									mclasscolor2table(a),
										e.d
											.append('p')
											.style('font-size', '.8em')
											.html(
												'<a href=https://en.wikipedia.org/wiki/Web_colors target=_blank>Use color names</a>, or #ff0000 or rgb(255,0,0)'
											)
								}
								function mclasscolor2table(e, t) {
									e.style('border-spacing', '3px')
										.selectAll('*')
										.remove()
									var n = e
										.append('tr')
										.style('color', '#858585')
										.style('font-size', '.7em')
									for (var r in (n.append('td').text('CLASS'),
									n
										.append('td')
										.attr('colspan', 2)
										.text('LABEL, COLOR'),
									common.mclass)) {
										var a = common.mclass[r]
										if (!t || a.dt == common.dtsnvindel) {
											var o = e.append('tr')
											o.append('td').text(r),
												o
													.append('td')
													.append('span')
													.attr('class', 'sja_mcdot')
													.style('background-color', a.color)
													.html('&nbsp;&nbsp;'),
												o
													.append('td')
													.text(a.label)
													.style('color', a.color)
										}
									}
								}
								tip.d.style('z-index', 1e3)
								var bwSetting = (exports.bwSetting = {
									height: 1,
									pcolor: 2,
									ncolor: 3,
									pcolor2: 4,
									ncolor2: 5,
									autoscale: 6,
									fixedscale: 7,
									percentilescale: 8,
									nodotplot: 9,
									usedotplot: 10,
									usedividefactor: 11,
									nodividefactor: 12
								})
								function first_genetrack_tolist(e, t) {
									if (e.tracks) {
										var n = !0,
											r = !1,
											a = void 0
										try {
											for (var o, i = e.tracks[Symbol.iterator](); !(n = (o = i.next()).done); n = !0) {
												var l = o.value
												if (l.__isgene) return void t.push(l)
											}
										} catch (e) {
											;(r = !0), (a = e)
										} finally {
											try {
												!n && i.return && i.return()
											} finally {
												if (r) throw a
											}
										}
									}
								}
								function tkexists(e, t) {
									var n = !0,
										r = !1,
										a = void 0
									try {
										for (var o, i = t[Symbol.iterator](); !(n = (o = i.next()).done); n = !0) {
											var l = o.value
											if (l.type == e.type)
												switch (e.type) {
													case tkt.bigwig:
													case tkt.bedj:
													case tkt.junction:
													case tkt.mdsjunction:
													case tkt.mdscnv:
													case tkt.bampile:
													case tkt.hicstraw:
													case tkt.expressionrank:
														if ((e.file && e.file == l.file) || (e.url && e.url == l.url)) return l
														break
													case tkt.bigwigstranded:
														if (
															e.strand1 &&
															l.strand1 &&
															e.strand1.file == l.strand1.file &&
															e.strand1.url == l.strand1.url &&
															e.strand2 &&
															l.strand2 &&
															e.strand2.file == l.strand2.file &&
															e.strand2.url == l.strand2.url
														)
															return l
												}
										}
									} catch (e) {
										;(r = !0), (a = e)
									} finally {
										try {
											!n && i.return && i.return()
										} finally {
											if (r) throw a
										}
									}
									return null
								}
								function ranksays(e) {
									return e >= 100
										? 'HIGHEST'
										: e >= 90
										? 'HIGH ' + e + '%'
										: e >= 70
										? 'high ' + e + '%'
										: e >= 30
										? e + '%'
										: e >= 10
										? 'low ' + e + '%'
										: e > 0
										? 'LOW ' + e + '%'
										: 'LOWEST'
								}
								function rgb2hex(e) {
									if ('#' == e[0]) return e
									var t = e.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i)
									return t && 4 === t.length
										? '#' +
												('0' + parseInt(t[1], 10).toString(16)).slice(-2) +
												('0' + parseInt(t[2], 10).toString(16)).slice(-2) +
												('0' + parseInt(t[3], 10).toString(16)).slice(-2)
										: ''
								}
								function keyupEnter() {
									return 'Enter' == _d3Selection.event.code || 'NumpadEnter' == _d3Selection.event.code
								}
								function may_findmatchingsnp(e, t, n) {
									if (n && n.hasSNP) {
										var r = { genome: n.name, chr: e, ranges: [] },
											a = !0,
											o = !1,
											i = void 0
										try {
											for (var l, u = t[Symbol.iterator](); !(a = (l = u.next()).done); a = !0) {
												var s = l.value
												Number.isFinite(s)
													? r.ranges.push({ start: s, stop: s + 1 })
													: s.start & s.stop && r.ranges.push(s)
											}
										} catch (e) {
											;(o = !0), (i = e)
										} finally {
											try {
												!a && u.return && u.return()
											} finally {
												if (o) throw i
											}
										}
										return dofetch('snp', r).then(function(e) {
											if (e.error) throw e.error
											return e.results
										})
									}
								}
								function snp_printhtml(e, t) {
									t
										.append('a')
										.text(e.name)
										.attr('href', 'https://www.ncbi.nlm.nih.gov/snp/' + e.name)
										.attr('target', '_blank'),
										t
											.append('div')
											.attr('class', 'sja_tinylogo_body')
											.text(e.class),
										t
											.append('div')
											.attr('class', 'sja_tinylogo_head')
											.text('CLASS'),
										t
											.append('div')
											.attr('class', 'sja_tinylogo_body')
											.text(e.observed),
										t
											.append('div')
											.attr('class', 'sja_tinylogo_head')
											.text('ALLELE')
								}
								async function may_findmatchingclinvar(e, t, n, r, a) {
									if (a && a.hasClinvarVCF) {
										if (!Number.isInteger(t)) throw 'pos is not integer'
										if (a.chrlookup[e.toUpperCase()].len < t) throw 'position out of bound: ' + t
										a.name
										var o = ['genome=' + a.name, 'chr=' + e, 'pos=' + t, 'ref=' + n, 'alt=' + r],
											i = await dofetch2('clinvarVCF?' + o.join('&'))
										if (i.error) throw i.error
										return i.hit
									}
								}
								function clinvar_printhtml(e, t) {
									t.append('div')
										.style('display', 'inline-block')
										.style('background', e.bg)
										.style('padding', '3px')
										.append('a')
										.attr('href', 'https://www.ncbi.nlm.nih.gov/clinvar/variation/' + e.id)
										.attr('target', '_blank')
										.style('color', e.textcolor)
										.text(e.value)
										.style('font-size', '.9em')
										.style('text-decoration', 'none')
								}
								function gmlst2loci(e) {
									var t = [],
										n = !0,
										r = !1,
										a = void 0
									try {
										for (var o, i = e[Symbol.iterator](); !(n = (o = i.next()).done); n = !0) {
											var l = o.value,
												u = !0,
												s = !0,
												f = !1,
												c = void 0
											try {
												for (var d, p = t[Symbol.iterator](); !(s = (d = p.next()).done); s = !0) {
													var h = d.value
													l.chr == h.chr &&
														Math.max(l.start, h.start) < Math.min(l.stop, h.stop) &&
														((h.start = Math.min(h.start, l.start)), (h.stop = Math.max(h.stop, l.stop)), (u = !1))
												}
											} catch (e) {
												;(f = !0), (c = e)
											} finally {
												try {
													!s && p.return && p.return()
												} finally {
													if (f) throw c
												}
											}
											u && t.push({ name: l.isoform, chr: l.chr, start: l.start, stop: l.stop })
										}
									} catch (e) {
										;(r = !0), (a = e)
									} finally {
										try {
											!n && i.return && i.return()
										} finally {
											if (r) throw a
										}
									}
									return t
								}
								function tab2box(e, t, n) {
									for (
										var r = e
												.append('table')
												.style('border-spacing', '0px')
												.style('border-collapse', 'separate')
												.append('tr'),
											a = r
												.append('td')
												.style('vertical-align', 'top')
												.style('padding', '10px 0px 10px 10px'),
											o = r
												.append('td')
												.style('vertical-align', 'top')
												.style('border-left', 'solid 1px #aaa')
												.style('padding', '10px'),
											i = function(e) {
												var r = t[e]
												;(r.tab = a
													.append('div')
													.style('padding', '5px 10px')
													.style('margin', '0px')
													.style('border-top', 'solid 1px #ddd')
													.classed('sja_menuoption', 0 != e)
													.html(r.label)),
													(r.box = o
														.append('div')
														.style('padding', '3px')
														.style('display', 0 == e ? 'block' : 'none')),
													((n && r.callback) || (0 == e && r.callback)) && (r.callback(r.box), delete r.callback),
													r.tab.on('click', function() {
														if ('none' != r.box.style('display'))
															r.tab.classed('sja_menuoption', !0), r.box.style('display', 'none')
														else {
															r.tab.classed('sja_menuoption', !1), appear(r.box)
															for (var n = 0; n < t.length; n++)
																e != n && (t[n].tab.classed('sja_menuoption', !0), t[n].box.style('display', 'none'))
														}
														r.callback && (r.callback(r.box), delete r.callback)
													})
											},
											l = 0;
										l < t.length;
										l++
									)
										i(l)
								}
								function tab_wait(e) {
									return e
										.append('div')
										.style('margin', '30px')
										.text('Loading...')
								}
								function add_scriptTag(e) {
									return new Promise(function(t, n) {
										var r = document.createElement('script')
										r.setAttribute('src', sessionStorage.getItem('hostURL') + e),
											document.head.appendChild(r),
											(r.onload = t)
									})
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = n(74)
								Object.defineProperty(t, 'bisect', {
									enumerable: !0,
									get: function() {
										return C(r).default
									}
								}),
									Object.defineProperty(t, 'bisectRight', {
										enumerable: !0,
										get: function() {
											return r.bisectRight
										}
									}),
									Object.defineProperty(t, 'bisectLeft', {
										enumerable: !0,
										get: function() {
											return r.bisectLeft
										}
									})
								var a = n(14)
								Object.defineProperty(t, 'ascending', {
									enumerable: !0,
									get: function() {
										return C(a).default
									}
								})
								var o = n(75)
								Object.defineProperty(t, 'bisector', {
									enumerable: !0,
									get: function() {
										return C(o).default
									}
								})
								var i = n(162)
								Object.defineProperty(t, 'cross', {
									enumerable: !0,
									get: function() {
										return C(i).default
									}
								})
								var l = n(163)
								Object.defineProperty(t, 'descending', {
									enumerable: !0,
									get: function() {
										return C(l).default
									}
								})
								var u = n(77)
								Object.defineProperty(t, 'deviation', {
									enumerable: !0,
									get: function() {
										return C(u).default
									}
								})
								var s = n(79)
								Object.defineProperty(t, 'extent', {
									enumerable: !0,
									get: function() {
										return C(s).default
									}
								})
								var f = n(164)
								Object.defineProperty(t, 'histogram', {
									enumerable: !0,
									get: function() {
										return C(f).default
									}
								})
								var c = n(167)
								Object.defineProperty(t, 'thresholdFreedmanDiaconis', {
									enumerable: !0,
									get: function() {
										return C(c).default
									}
								})
								var d = n(168)
								Object.defineProperty(t, 'thresholdScott', {
									enumerable: !0,
									get: function() {
										return C(d).default
									}
								})
								var p = n(83)
								Object.defineProperty(t, 'thresholdSturges', {
									enumerable: !0,
									get: function() {
										return C(p).default
									}
								})
								var h = n(169)
								Object.defineProperty(t, 'max', {
									enumerable: !0,
									get: function() {
										return C(h).default
									}
								})
								var v = n(170)
								Object.defineProperty(t, 'mean', {
									enumerable: !0,
									get: function() {
										return C(v).default
									}
								})
								var m = n(171)
								Object.defineProperty(t, 'median', {
									enumerable: !0,
									get: function() {
										return C(m).default
									}
								})
								var y = n(172)
								Object.defineProperty(t, 'merge', {
									enumerable: !0,
									get: function() {
										return C(y).default
									}
								})
								var g = n(84)
								Object.defineProperty(t, 'min', {
									enumerable: !0,
									get: function() {
										return C(g).default
									}
								})
								var b = n(76)
								Object.defineProperty(t, 'pairs', {
									enumerable: !0,
									get: function() {
										return C(b).default
									}
								})
								var _ = n(173)
								Object.defineProperty(t, 'permute', {
									enumerable: !0,
									get: function() {
										return C(_).default
									}
								})
								var x = n(38)
								Object.defineProperty(t, 'quantile', {
									enumerable: !0,
									get: function() {
										return C(x).default
									}
								})
								var w = n(81)
								Object.defineProperty(t, 'range', {
									enumerable: !0,
									get: function() {
										return C(w).default
									}
								})
								var j = n(174)
								Object.defineProperty(t, 'scan', {
									enumerable: !0,
									get: function() {
										return C(j).default
									}
								})
								var k = n(175)
								Object.defineProperty(t, 'shuffle', {
									enumerable: !0,
									get: function() {
										return C(k).default
									}
								})
								var O = n(176)
								Object.defineProperty(t, 'sum', {
									enumerable: !0,
									get: function() {
										return C(O).default
									}
								})
								var M = n(82)
								Object.defineProperty(t, 'ticks', {
									enumerable: !0,
									get: function() {
										return C(M).default
									}
								}),
									Object.defineProperty(t, 'tickIncrement', {
										enumerable: !0,
										get: function() {
											return M.tickIncrement
										}
									}),
									Object.defineProperty(t, 'tickStep', {
										enumerable: !0,
										get: function() {
											return M.tickStep
										}
									})
								var P = n(85)
								Object.defineProperty(t, 'transpose', {
									enumerable: !0,
									get: function() {
										return C(P).default
									}
								})
								var S = n(78)
								Object.defineProperty(t, 'variance', {
									enumerable: !0,
									get: function() {
										return C(S).default
									}
								})
								var A = n(177)
								function C(e) {
									return e && e.__esModule ? e : { default: e }
								}
								Object.defineProperty(t, 'zip', {
									enumerable: !0,
									get: function() {
										return C(A).default
									}
								})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.durationSecond = 1e3),
									(t.durationMinute = 6e4),
									(t.durationHour = 36e5),
									(t.durationDay = 864e5),
									(t.durationWeek = 6048e5)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = n(40)
								Object.defineProperty(t, 'interpolate', {
									enumerable: !0,
									get: function() {
										return _(r).default
									}
								})
								var a = n(91)
								Object.defineProperty(t, 'interpolateArray', {
									enumerable: !0,
									get: function() {
										return _(a).default
									}
								})
								var o = n(43)
								Object.defineProperty(t, 'interpolateBasis', {
									enumerable: !0,
									get: function() {
										return _(o).default
									}
								})
								var i = n(89)
								Object.defineProperty(t, 'interpolateBasisClosed', {
									enumerable: !0,
									get: function() {
										return _(i).default
									}
								})
								var l = n(92)
								Object.defineProperty(t, 'interpolateDate', {
									enumerable: !0,
									get: function() {
										return _(l).default
									}
								})
								var u = n(23)
								Object.defineProperty(t, 'interpolateNumber', {
									enumerable: !0,
									get: function() {
										return _(u).default
									}
								})
								var s = n(93)
								Object.defineProperty(t, 'interpolateObject', {
									enumerable: !0,
									get: function() {
										return _(s).default
									}
								})
								var f = n(186)
								Object.defineProperty(t, 'interpolateRound', {
									enumerable: !0,
									get: function() {
										return _(f).default
									}
								})
								var c = n(94)
								Object.defineProperty(t, 'interpolateString', {
									enumerable: !0,
									get: function() {
										return _(c).default
									}
								})
								var d = n(187)
								Object.defineProperty(t, 'interpolateTransformCss', {
									enumerable: !0,
									get: function() {
										return d.interpolateTransformCss
									}
								}),
									Object.defineProperty(t, 'interpolateTransformSvg', {
										enumerable: !0,
										get: function() {
											return d.interpolateTransformSvg
										}
									})
								var p = n(190)
								Object.defineProperty(t, 'interpolateZoom', {
									enumerable: !0,
									get: function() {
										return _(p).default
									}
								})
								var h = n(88)
								Object.defineProperty(t, 'interpolateRgb', {
									enumerable: !0,
									get: function() {
										return _(h).default
									}
								}),
									Object.defineProperty(t, 'interpolateRgbBasis', {
										enumerable: !0,
										get: function() {
											return h.rgbBasis
										}
									}),
									Object.defineProperty(t, 'interpolateRgbBasisClosed', {
										enumerable: !0,
										get: function() {
											return h.rgbBasisClosed
										}
									})
								var v = n(191)
								Object.defineProperty(t, 'interpolateHsl', {
									enumerable: !0,
									get: function() {
										return _(v).default
									}
								}),
									Object.defineProperty(t, 'interpolateHslLong', {
										enumerable: !0,
										get: function() {
											return v.hslLong
										}
									})
								var m = n(192)
								Object.defineProperty(t, 'interpolateLab', {
									enumerable: !0,
									get: function() {
										return _(m).default
									}
								})
								var y = n(193)
								Object.defineProperty(t, 'interpolateHcl', {
									enumerable: !0,
									get: function() {
										return _(y).default
									}
								}),
									Object.defineProperty(t, 'interpolateHclLong', {
										enumerable: !0,
										get: function() {
											return y.hclLong
										}
									})
								var g = n(194)
								Object.defineProperty(t, 'interpolateCubehelix', {
									enumerable: !0,
									get: function() {
										return _(g).default
									}
								}),
									Object.defineProperty(t, 'interpolateCubehelixLong', {
										enumerable: !0,
										get: function() {
											return g.cubehelixLong
										}
									})
								var b = n(195)
								function _(e) {
									return e && e.__esModule ? e : { default: e }
								}
								Object.defineProperty(t, 'quantize', {
									enumerable: !0,
									get: function() {
										return _(b).default
									}
								})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.init_bulk_flag = function(e) {
										if (!e) return null
										var t = {}
										for (var n in r.mclass) t[r.mclass[n].label.toUpperCase()] = n
										return {
											genome: e,
											mclasslabel2key: t,
											data: {},
											sample2disease: {},
											patient2st: {},
											good: 0,
											geneToUpper: !0,
											snv: { loaded: !1, header: null, badlines: [], missense: 0, silent: 0 },
											svjson: { loaded: !1, header: null, badlines: [] },
											fusion: { loaded: !1, header: null, badlines: [], original: [] },
											sv: { loaded: !1, header: null, badlines: [], original: [] },
											cnv: { loaded: !1, header: null, badlines: [] },
											itd: { loaded: !1, header: null, badlines: [] },
											del: { loaded: !1, header: null, badlines: [] },
											truncation: { loaded: !1, header: null, badlines: [] }
										}
									}),
									(t.parsesample = function(e, t, n, a, o) {
										var i = r.moriginsomatic
										if (e.sampletype) {
											switch (e.sampletype.toLowerCase()) {
												case 'relapse':
													i = r.moriginrelapse
													break
												case 'germline':
													i = r.morigingermline
											}
											e.sample
												? e.patient || (e.patient = e.sample + ' ' + e.sampletype)
												: e.patient && (e.sample = e.patient + ' ' + e.sampletype)
										} else
											e.patient
												? e.sample
													? (e.sampletype = e.sample)
													: (e.sample = e.sampletype = e.patient)
												: e.sample && (e.sampletype = e.sample)
										if (e.origin)
											switch (e.origin.toLowerCase()) {
												case 'r':
												case 'relapse':
													;(i = r.moriginrelapse), (e.isrim2 = !0)
													break
												case 'g':
												case 'germline':
													;(i = r.morigingermline), (e.isrim1 = !0)
													break
												case 'gp':
												case 'germline pathogenic':
													;(i = r.morigingermlinepathogenic), (e.isrim1 = !0)
													break
												case 'gnp':
												case 'germline nonpathogenic':
												case 'germline non-pathogenic':
													;(i = r.morigingermlinenonpathogenic), (e.isrim1 = !0)
													break
												case 's':
												case 'somatic':
												case 'diagnosis':
													i = r.moriginsomatic
											}
										if (((e.origin = i), e.sample || e.patient)) {
											var l = 'no patient/individual name'
											if (
												(e.patient
													? (t.patient2st[e.patient] || (t.patient2st[e.patient] = {}),
													  (t.patient2st[e.patient][e.sampletype] = e.sample))
													: (t.patient2st[l] || (t.patient2st[l] = {}), (t.patient2st[l][e.sampletype] = e.sample)),
												e.sample && e.disease)
											)
												if (e.sample in t.sample2disease) {
													if (e.disease != t.sample2disease[e.sample])
														return (
															t.snv.badlines.push([
																n,
																'conflict of disease types for sample "' +
																	e.sample +
																	'": ' +
																	e.disease +
																	', ' +
																	t.sample2disease[e.sample],
																a
															]),
															!0
														)
												} else t.sample2disease[e.sample] = e.disease
											return !1
										}
									})
								var r = (function(e) {
									if (e && e.__esModule) return e
									var t = {}
									if (null != e) for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (t[n] = e[n])
									return (t.default = e), t
								})(n(2))
								t.default = {}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.Transition = j),
									(t.default = k),
									(t.newId = function() {
										return ++w
									})
								var r = n(0),
									a = x(n(235)),
									o = x(n(239)),
									i = x(n(240)),
									l = x(n(241)),
									u = x(n(242)),
									s = x(n(243)),
									f = x(n(244)),
									c = x(n(245)),
									d = x(n(246)),
									p = x(n(247)),
									h = x(n(248)),
									v = x(n(249)),
									m = x(n(250)),
									y = x(n(251)),
									g = x(n(252)),
									b = x(n(253)),
									_ = x(n(26))
								function x(e) {
									return e && e.__esModule ? e : { default: e }
								}
								var w = 0
								function j(e, t, n, r) {
									;(this._groups = e), (this._parents = t), (this._name = n), (this._id = r)
								}
								function k(e) {
									return (0, r.selection)().transition(e)
								}
								var O = r.selection.prototype
								j.prototype = k.prototype = {
									constructor: j,
									select: p.default,
									selectAll: h.default,
									filter: s.default,
									merge: f.default,
									selection: v.default,
									transition: b.default,
									call: O.call,
									nodes: O.nodes,
									node: O.node,
									size: O.size,
									empty: O.empty,
									each: O.each,
									on: c.default,
									attr: a.default,
									attrTween: o.default,
									style: m.default,
									styleTween: y.default,
									text: g.default,
									remove: d.default,
									tween: _.default,
									delay: i.default,
									duration: l.default,
									ease: u.default
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = Array.prototype
								;(t.map = r.map), (t.slice = r.slice)
							},
							,
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										return e < t ? -1 : e > t ? 1 : e >= t ? 0 : NaN
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return null === e ? NaN : +e
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.linearish = s),
									(t.default = function e() {
										var t = (0, i.default)(o.deinterpolateLinear, a.interpolateNumber)
										return (
											(t.copy = function() {
												return (0, o.copy)(t, e())
											}),
											s(t)
										)
									})
								var r = n(7),
									a = n(9),
									o = n(24),
									i = u(o),
									l = u(n(196))
								function u(e) {
									return e && e.__esModule ? e : { default: e }
								}
								function s(e) {
									var t = e.domain
									return (
										(e.ticks = function(e) {
											var n = t()
											return (0, r.ticks)(n[0], n[n.length - 1], null == e ? 10 : e)
										}),
										(e.tickFormat = function(e, n) {
											return (0, l.default)(t(), e, n)
										}),
										(e.nice = function(n) {
											null == n && (n = 10)
											var a,
												o = t(),
												i = 0,
												l = o.length - 1,
												u = o[i],
												s = o[l]
											return (
												s < u && ((a = u), (u = s), (s = a), (a = i), (i = l), (l = a)),
												(a = (0, r.tickIncrement)(u, s, n)) > 0
													? ((u = Math.floor(u / a) * a),
													  (s = Math.ceil(s / a) * a),
													  (a = (0, r.tickIncrement)(u, s, n)))
													: a < 0 &&
													  ((u = Math.ceil(u * a) / a),
													  (s = Math.floor(s * a) / a),
													  (a = (0, r.tickIncrement)(u, s, n))),
												a > 0
													? ((o[i] = Math.floor(u / a) * a), (o[l] = Math.ceil(s / a) * a), t(o))
													: a < 0 && ((o[i] = Math.ceil(u * a) / a), (o[l] = Math.floor(s * a) / a), t(o)),
												e
											)
										}),
										e
									)
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.hue = function(e, t) {
										var n = t - e
										return n
											? o(e, n > 180 || n < -180 ? n - 360 * Math.round(n / 360) : n)
											: (0, a.default)(isNaN(e) ? t : e)
									}),
									(t.gamma = function(e) {
										return 1 == (e = +e)
											? i
											: function(t, n) {
													return n - t
														? (function(e, t, n) {
																return (
																	(e = Math.pow(e, n)),
																	(t = Math.pow(t, n) - e),
																	(n = 1 / n),
																	function(r) {
																		return Math.pow(e + r * t, n)
																	}
																)
														  })(t, n, e)
														: (0, a.default)(isNaN(t) ? n : t)
											  }
									}),
									(t.default = i)
								var r,
									a = (r = n(90)) && r.__esModule ? r : { default: r }
								function o(e, t) {
									return function(n) {
										return e + n * t
									}
								}
								function i(e, t) {
									var n = t - e
									return n ? o(e, n) : (0, a.default)(isNaN(e) ? t : e)
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return e.match(/.{6}/g).map(function(e) {
											return '#' + e
										})
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n, r, a) {
										for (var o, i = e.children, l = -1, u = i.length, s = e.value && (r - t) / e.value; ++l < u; )
											((o = i[l]).y0 = n), (o.y1 = a), (o.x0 = t), (o.x1 = t += o.value * s)
									})
							},
							function(e, t, n) {
								function r(e, t, n, r) {
									if (!e) return 'no genome'
									if (!t) return 'no chr name'
									var a = e.chrlookup[t.toUpperCase()]
									return a
										? Number.isInteger(n)
											? n < 0 || n >= a.len
												? 'Position out of range: ' + n
												: Number.isInteger(r)
												? r < 0 || r > a.len
													? 'Position out of range: ' + r
													: n > r && 'Start position is greater than stop'
												: 'Non-numerical position: ' + r
											: 'Non-numerical position: ' + n
										: 'Invalid chromosome name: ' + a
								}
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.invalidcoord = r),
									(t.string2pos = function(e, t, n) {
										e = e.replace(/,/g, '')
										var a = t.chrlookup[e.toUpperCase()]
										if (a)
											return {
												chr: a.name,
												chrlen: a.len,
												start: Math.max(0, Math.ceil(a.len / 2) - 1e4),
												stop: Math.min(a.len, Math.ceil(a.len / 2) + 1e4)
											}
										var o = e.split('.')
										if (o.length >= 2) {
											var i = t.chrlookup[o[0].toUpperCase()],
												l = Number.parseInt(o[1])
											if (!r(t, o[0], l, l + 1))
												return {
													chr: i.name,
													chrlen: i.len,
													start: Math.max(0, l - Math.ceil(200)),
													stop: Math.min(i.len, l + Math.ceil(200)),
													actualposition: { position: l, len: 1 }
												}
										}
										var u = e.split(/[-:\s]+/)
										if (2 == u.length) {
											var s = Number.parseInt(u[1])
											if (r(t, u[0], s, s + 1)) return null
											var f = t.chrlookup[u[0].toUpperCase()]
											return {
												chr: f.name,
												chrlen: f.len,
												start: Math.max(0, s - Math.ceil(200)),
												stop: Math.min(f.len, s + Math.ceil(200)),
												actualposition: { position: s, len: 1 }
											}
										}
										if (3 == u.length) {
											var c = Number.parseInt(u[1]),
												d = Number.parseInt(u[2])
											if (r(t, u[0], c, d)) return null
											var p = { position: c, len: d - c },
												h = t.chrlookup[u[0].toUpperCase()]
											if (!n && d - c < 400) {
												var v = Math.ceil((c + d) / 2)
												v + 200 >= h.len && (v = h.len - Math.ceil(200)),
													(d = (c = Math.max(0, v - Math.ceil(200))) + 400)
											}
											return { chr: h.name, chrlen: h.len, start: c, stop: d, actualposition: p }
										}
										return null
									}),
									(t.string2snp = function(e, t, n, r) {
										return fetch(
											new Request(n + '/snpbyname', {
												method: 'POST',
												body: JSON.stringify({ genome: e, lst: [t], jwt: r })
											})
										)
											.then(function(e) {
												return e.json()
											})
											.then(function(e) {
												if (e.error) throw { message: e.error }
												if (!e.lst || 0 == e.lst.length) throw { message: t + ': not a SNP' }
												var n = e.lst[0]
												return { chr: n.chrom, start: n.chromStart, stop: n.chromEnd }
											})
									}),
									(t.genomic2gm = function(e, t) {
										var n = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : 0
										n && console.log(e, t)
										var r = '-' == t.strand,
											a = {}
										if (e < t.start)
											return (
												r
													? ((a.atdownstream = { off: t.start - e }),
													  (a.rnapos = t.rnalen),
													  t.cdslen && (a.aapos = t.cdslen / 3))
													: ((a.atupstream = { off: t.start - e }), (a.rnapos = 0), t.cdslen && (a.aapos = 0)),
												a
											)
										if (e >= t.stop)
											return (
												r
													? ((a.atupstream = { off: e - t.stop + 1 }), (a.rnapos = 0), t.cdslen && (a.aapos = 0))
													: ((a.atdownstream = { off: e - t.stop + 1 }),
													  (a.rnapos = t.rnalen),
													  t.cdslen && (a.aapos = t.cdslen / 3)),
												a
											)
										if (e >= t.start && e < t.stop)
											for (var o = 0; o < t.exon.length; o++) {
												var i = t.exon[o]
												if (r) {
													if (i[1] + n <= e) {
														;(a.atexon = o + 1), (a.atintron = o)
														break
													}
													if (i[0] - n <= e) {
														a.atexon = o + 1
														break
													}
												} else {
													if (i[0] - n > e) {
														;(a.atexon = o + 1), (a.atintron = o)
														break
													}
													if (i[1] + n > e) {
														a.atexon = o + 1
														break
													}
												}
											}
										var l = 0,
											u = !0,
											s = !1,
											f = void 0
										try {
											for (var c, d = t.exon[Symbol.iterator](); !(u = (c = d.next()).done); u = !0) {
												var p = c.value
												if (r) {
													if (e >= p[1]) {
														l += 0.5
														break
													}
													if (e < p[0]) {
														l += p[1] - p[0]
														continue
													}
													l += p[1] - e
													break
												}
												if (e < p[0]) {
													l += 0.5
													break
												}
												if (!(e >= p[1])) {
													l += e - p[0] + 1
													break
												}
												l += p[1] - p[0]
											}
										} catch (e) {
											;(s = !0), (f = e)
										} finally {
											try {
												!u && d.return && d.return()
											} finally {
												if (s) throw f
											}
										}
										if (((a.rnapos = l), t.coding)) {
											var h = 0
											t.utr5 &&
												(h = t.utr5.reduce(function(e, t) {
													return e + t[1] - t[0]
												}, 0))
											var v = 0
											if (
												(t.utr3 &&
													(v = t.utr3.reduce(function(e, t) {
														return e + t[1] - t[0]
													}, 0)),
												l <= h
													? (a.aapos = 0)
													: l > h + t.cdslen
													? (a.aapos = t.cdslen / 3)
													: (a.aapos = Math.ceil((l - h) / 3)),
												e < t.codingstart)
											) {
												var m = 0
												if (r) {
													if (t.utr3) {
														var y = !0,
															g = !1,
															b = void 0
														try {
															for (var _, x = t.utr3[Symbol.iterator](); !(y = (_ = x.next()).done); y = !0) {
																var w = _.value
																m += Math.max(w[1], e) - Math.max(w[0], e)
															}
														} catch (e) {
															;(g = !0), (b = e)
														} finally {
															try {
																!y && x.return && x.return()
															} finally {
																if (g) throw b
															}
														}
														a.atutr3 = { total: v, off: m }
													}
												} else if (t.utr5) {
													var j = !0,
														k = !1,
														O = void 0
													try {
														for (var M, P = t.utr5[Symbol.iterator](); !(j = (M = P.next()).done); j = !0) {
															var S = M.value
															m += Math.min(S[1], e) - Math.min(S[0], e)
														}
													} catch (e) {
														;(k = !0), (O = e)
													} finally {
														try {
															!j && P.return && P.return()
														} finally {
															if (k) throw O
														}
													}
													a.atutr5 = { total: h, off: m }
												}
											} else if (e > t.codingstop) {
												var A = 0
												if (r) {
													if (t.utr5) {
														var C = !0,
															N = !1,
															T = void 0
														try {
															for (var E, I = t.utr5[Symbol.iterator](); !(C = (E = I.next()).done); C = !0) {
																var R = E.value
																A += Math.max(R[1], e) - Math.max(R[0], e)
															}
														} catch (e) {
															;(N = !0), (T = e)
														} finally {
															try {
																!C && I.return && I.return()
															} finally {
																if (N) throw T
															}
														}
														a.atutr5 = { total: h, off: A }
													}
												} else if (t.utr3) {
													var L = !0,
														D = !1,
														F = void 0
													try {
														for (var q, U = t.utr3[Symbol.iterator](); !(L = (q = U.next()).done); L = !0) {
															var G = q.value
															A += Math.min(G[1], e) - Math.min(G[0], e)
														}
													} catch (e) {
														;(D = !0), (F = e)
													} finally {
														try {
															!L && U.return && U.return()
														} finally {
															if (D) throw F
														}
													}
													a.atutr3 = { total: v, off: A }
												}
											}
										}
										return a
									}),
									(t.aa2gmcoord = function(e, t) {
										if (!Number.isInteger(e)) return null
										if (!t.coding) return null
										var n = 0,
											r = !0,
											a = !1,
											o = void 0
										try {
											for (var i, l = t.coding[Symbol.iterator](); !(r = (i = l.next()).done); r = !0) {
												var u = i.value
												if (n + u[1] - u[0] >= 3 * (e - 1))
													return '+' == t.strand ? u[0] + 3 * (e - 1) - n : u[1] - 1 - (3 * (e - 1) - n)
												n += u[1] - u[0]
											}
										} catch (e) {
											;(a = !0), (o = e)
										} finally {
											try {
												!r && l.return && l.return()
											} finally {
												if (a) throw o
											}
										}
										return '+' == t.strand ? t.codingstop : t.codingstart
									}),
									(t.rna2gmcoord = function(e, t) {
										if (!Number.isFinite(e)) return null
										if (!t.exon) return null
										var n = 0,
											r = !0,
											a = !1,
											o = void 0
										try {
											for (var i, l = t.exon[Symbol.iterator](); !(r = (i = l.next()).done); r = !0) {
												var u = i.value
												if (n + u[1] - u[0] >= e) return '+' == t.strand ? u[0] + e - n : u[1] - 1 - e + n
												n += u[1] - u[0]
											}
										} catch (e) {
											;(a = !0), (o = e)
										} finally {
											try {
												!r && l.return && l.return()
											} finally {
												if (a) throw o
											}
										}
										return '+' == t.strand ? t.stop : t.start
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t = (0, a.default)(e)
										return (t.local ? l : i)(t)
									})
								var r,
									a = (r = n(32)) && r.__esModule ? r : { default: r },
									o = n(33)
								function i(e) {
									return function() {
										var t = this.ownerDocument,
											n = this.namespaceURI
										return n === o.xhtml && t.documentElement.namespaceURI === o.xhtml
											? t.createElement(e)
											: t.createElementNS(n, e)
									}
								}
								function l(e) {
									return function() {
										return this.ownerDocument.createElementNS(e.space, e.local)
									}
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n = e.ownerSVGElement || e
										if (n.createSVGPoint) {
											var r = n.createSVGPoint()
											return (
												(r.x = t.clientX),
												(r.y = t.clientY),
												[(r = r.matrixTransform(e.getScreenCTM().inverse())).x, r.y]
											)
										}
										var a = e.getBoundingClientRect()
										return [t.clientX - a.left - e.clientLeft, t.clientY - a.top - e.clientTop]
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										return (
											(t -= e = +e),
											function(n) {
												return e + t * n
											}
										)
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.deinterpolateLinear = f),
									(t.copy = function(e, t) {
										return t
											.domain(e.domain())
											.range(e.range())
											.interpolate(e.interpolate())
											.clamp(e.clamp())
									}),
									(t.default = function(e, t) {
										var n,
											r,
											i,
											u = s,
											p = s,
											h = a.interpolate,
											v = !1
										function m() {
											return (n = Math.min(u.length, p.length) > 2 ? d : c), (r = i = null), y
										}
										function y(t) {
											return (r ||
												(r = n(
													u,
													p,
													v
														? (function(e) {
																return function(t, n) {
																	var r = e((t = +t), (n = +n))
																	return function(e) {
																		return e <= t ? 0 : e >= n ? 1 : r(e)
																	}
																}
														  })(e)
														: e,
													h
												)))(+t)
										}
										return (
											(y.invert = function(e) {
												return (i ||
													(i = n(
														p,
														u,
														f,
														v
															? (function(e) {
																	return function(t, n) {
																		var r = e((t = +t), (n = +n))
																		return function(e) {
																			return e <= 0 ? t : e >= 1 ? n : r(e)
																		}
																	}
															  })(t)
															: t
													)))(+e)
											}),
											(y.domain = function(e) {
												return arguments.length ? ((u = o.map.call(e, l.default)), m()) : u.slice()
											}),
											(y.range = function(e) {
												return arguments.length ? ((p = o.slice.call(e)), m()) : p.slice()
											}),
											(y.rangeRound = function(e) {
												return (p = o.slice.call(e)), (h = a.interpolateRound), m()
											}),
											(y.clamp = function(e) {
												return arguments.length ? ((v = !!e), m()) : v
											}),
											(y.interpolate = function(e) {
												return arguments.length ? ((h = e), m()) : h
											}),
											m()
										)
									})
								var r = n(7),
									a = n(9),
									o = n(12),
									i = u(n(44)),
									l = u(n(95))
								function u(e) {
									return e && e.__esModule ? e : { default: e }
								}
								var s = [0, 1]
								function f(e, t) {
									return (t -= e = +e)
										? function(n) {
												return (n - e) / t
										  }
										: (0, i.default)(t)
								}
								function c(e, t, n, r) {
									var a = e[0],
										o = e[1],
										i = t[0],
										l = t[1]
									return (
										o < a ? ((a = n(o, a)), (i = r(l, i))) : ((a = n(a, o)), (i = r(i, l))),
										function(e) {
											return i(a(e))
										}
									)
								}
								function d(e, t, n, a) {
									var o = Math.min(e.length, t.length) - 1,
										i = new Array(o),
										l = new Array(o),
										u = -1
									for (e[o] < e[0] && ((e = e.slice().reverse()), (t = t.slice().reverse())); ++u < o; )
										(i[u] = n(e[u], e[u + 1])), (l[u] = a(t[u], t[u + 1]))
									return function(t) {
										var n = (0, r.bisect)(e, t, 1, o) - 1
										return l[n](i[n](t))
									}
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return (e = (0, a.default)(Math.abs(e))) ? e[1] : NaN
									})
								var r,
									a = (r = n(45)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n = this._id
										if (((e += ''), arguments.length < 2)) {
											for (var i, l = (0, r.get)(this.node(), n).tween, u = 0, s = l.length; u < s; ++u)
												if ((i = l[u]).name === e) return i.value
											return null
										}
										return this.each((null == t ? a : o)(n, e, t))
									}),
									(t.tweenValue = function(e, t, n) {
										var a = e._id
										return (
											e.each(function() {
												var e = (0, r.set)(this, a)
												;(e.value || (e.value = {}))[t] = n.apply(this, arguments)
											}),
											function(e) {
												return (0, r.get)(e, a).value[t]
											}
										)
									})
								var r = n(5)
								function a(e, t) {
									var n, a
									return function() {
										var o = (0, r.set)(this, e),
											i = o.tween
										if (i !== n)
											for (var l = 0, u = (a = n = i).length; l < u; ++l)
												if (a[l].name === t) {
													;(a = a.slice()).splice(l, 1)
													break
												}
										o.tween = a
									}
								}
								function o(e, t, n) {
									var a, o
									if ('function' != typeof n) throw new Error()
									return function() {
										var i = (0, r.set)(this, e),
											l = i.tween
										if (l !== a) {
											o = (a = l).slice()
											for (var u = { name: t, value: n }, s = 0, f = o.length; s < f; ++s)
												if (o[s].name === t) {
													o[s] = u
													break
												}
											s === f && o.push(u)
										}
										i.tween = o
									}
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n, r, a) {
										for (var o, i = e.children, l = -1, u = i.length, s = e.value && (a - n) / e.value; ++l < u; )
											((o = i[l]).x0 = t), (o.x1 = r), (o.y0 = n), (o.y1 = n += o.value * s)
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										return function(n, r) {
											var o = (0, a.default)(n)
												.mimeType(e)
												.response(t)
											if (null != r) {
												if ('function' != typeof r) throw new Error('invalid callback: ' + r)
												return o.get(r)
											}
											return o
										}
									})
								var r,
									a = (r = n(52)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = n(161)
								Object.defineProperty(t, 'scaleBand', {
									enumerable: !0,
									get: function() {
										return w(r).default
									}
								}),
									Object.defineProperty(t, 'scalePoint', {
										enumerable: !0,
										get: function() {
											return r.point
										}
									})
								var a = n(183)
								Object.defineProperty(t, 'scaleIdentity', {
									enumerable: !0,
									get: function() {
										return w(a).default
									}
								})
								var o = n(16)
								Object.defineProperty(t, 'scaleLinear', {
									enumerable: !0,
									get: function() {
										return w(o).default
									}
								})
								var i = n(206)
								Object.defineProperty(t, 'scaleLog', {
									enumerable: !0,
									get: function() {
										return w(i).default
									}
								})
								var l = n(86)
								Object.defineProperty(t, 'scaleOrdinal', {
									enumerable: !0,
									get: function() {
										return w(l).default
									}
								}),
									Object.defineProperty(t, 'scaleImplicit', {
										enumerable: !0,
										get: function() {
											return l.implicit
										}
									})
								var u = n(207)
								Object.defineProperty(t, 'scalePow', {
									enumerable: !0,
									get: function() {
										return w(u).default
									}
								}),
									Object.defineProperty(t, 'scaleSqrt', {
										enumerable: !0,
										get: function() {
											return u.sqrt
										}
									})
								var s = n(208)
								Object.defineProperty(t, 'scaleQuantile', {
									enumerable: !0,
									get: function() {
										return w(s).default
									}
								})
								var f = n(209)
								Object.defineProperty(t, 'scaleQuantize', {
									enumerable: !0,
									get: function() {
										return w(f).default
									}
								})
								var c = n(210)
								Object.defineProperty(t, 'scaleThreshold', {
									enumerable: !0,
									get: function() {
										return w(c).default
									}
								})
								var d = n(101)
								Object.defineProperty(t, 'scaleTime', {
									enumerable: !0,
									get: function() {
										return w(d).default
									}
								})
								var p = n(226)
								Object.defineProperty(t, 'scaleUtc', {
									enumerable: !0,
									get: function() {
										return w(p).default
									}
								})
								var h = n(227)
								Object.defineProperty(t, 'schemeCategory10', {
									enumerable: !0,
									get: function() {
										return w(h).default
									}
								})
								var v = n(228)
								Object.defineProperty(t, 'schemeCategory20b', {
									enumerable: !0,
									get: function() {
										return w(v).default
									}
								})
								var m = n(229)
								Object.defineProperty(t, 'schemeCategory20c', {
									enumerable: !0,
									get: function() {
										return w(m).default
									}
								})
								var y = n(230)
								Object.defineProperty(t, 'schemeCategory20', {
									enumerable: !0,
									get: function() {
										return w(y).default
									}
								})
								var g = n(231)
								Object.defineProperty(t, 'interpolateCubehelixDefault', {
									enumerable: !0,
									get: function() {
										return w(g).default
									}
								})
								var b = n(232)
								Object.defineProperty(t, 'interpolateRainbow', {
									enumerable: !0,
									get: function() {
										return w(b).default
									}
								}),
									Object.defineProperty(t, 'interpolateWarm', {
										enumerable: !0,
										get: function() {
											return b.warm
										}
									}),
									Object.defineProperty(t, 'interpolateCool', {
										enumerable: !0,
										get: function() {
											return b.cool
										}
									})
								var _ = n(233)
								Object.defineProperty(t, 'interpolateViridis', {
									enumerable: !0,
									get: function() {
										return w(_).default
									}
								}),
									Object.defineProperty(t, 'interpolateMagma', {
										enumerable: !0,
										get: function() {
											return _.magma
										}
									}),
									Object.defineProperty(t, 'interpolateInferno', {
										enumerable: !0,
										get: function() {
											return _.inferno
										}
									}),
									Object.defineProperty(t, 'interpolatePlasma', {
										enumerable: !0,
										get: function() {
											return _.plasma
										}
									})
								var x = n(234)
								function w(e) {
									return e && e.__esModule ? e : { default: e }
								}
								Object.defineProperty(t, 'scaleSequential', {
									enumerable: !0,
									get: function() {
										return w(x).default
									}
								})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = n(1)
								Object.defineProperty(t, 'timeInterval', {
									enumerable: !0,
									get: function() {
										return g(r).default
									}
								})
								var a = n(211)
								Object.defineProperty(t, 'timeMillisecond', {
									enumerable: !0,
									get: function() {
										return g(a).default
									}
								}),
									Object.defineProperty(t, 'timeMilliseconds', {
										enumerable: !0,
										get: function() {
											return a.milliseconds
										}
									}),
									Object.defineProperty(t, 'utcMillisecond', {
										enumerable: !0,
										get: function() {
											return g(a).default
										}
									}),
									Object.defineProperty(t, 'utcMilliseconds', {
										enumerable: !0,
										get: function() {
											return a.milliseconds
										}
									})
								var o = n(212)
								Object.defineProperty(t, 'timeSecond', {
									enumerable: !0,
									get: function() {
										return g(o).default
									}
								}),
									Object.defineProperty(t, 'timeSeconds', {
										enumerable: !0,
										get: function() {
											return o.seconds
										}
									}),
									Object.defineProperty(t, 'utcSecond', {
										enumerable: !0,
										get: function() {
											return g(o).default
										}
									}),
									Object.defineProperty(t, 'utcSeconds', {
										enumerable: !0,
										get: function() {
											return o.seconds
										}
									})
								var i = n(213)
								Object.defineProperty(t, 'timeMinute', {
									enumerable: !0,
									get: function() {
										return g(i).default
									}
								}),
									Object.defineProperty(t, 'timeMinutes', {
										enumerable: !0,
										get: function() {
											return i.minutes
										}
									})
								var l = n(214)
								Object.defineProperty(t, 'timeHour', {
									enumerable: !0,
									get: function() {
										return g(l).default
									}
								}),
									Object.defineProperty(t, 'timeHours', {
										enumerable: !0,
										get: function() {
											return l.hours
										}
									})
								var u = n(215)
								Object.defineProperty(t, 'timeDay', {
									enumerable: !0,
									get: function() {
										return g(u).default
									}
								}),
									Object.defineProperty(t, 'timeDays', {
										enumerable: !0,
										get: function() {
											return u.days
										}
									})
								var s = n(216)
								Object.defineProperty(t, 'timeWeek', {
									enumerable: !0,
									get: function() {
										return s.sunday
									}
								}),
									Object.defineProperty(t, 'timeWeeks', {
										enumerable: !0,
										get: function() {
											return s.sundays
										}
									}),
									Object.defineProperty(t, 'timeSunday', {
										enumerable: !0,
										get: function() {
											return s.sunday
										}
									}),
									Object.defineProperty(t, 'timeSundays', {
										enumerable: !0,
										get: function() {
											return s.sundays
										}
									}),
									Object.defineProperty(t, 'timeMonday', {
										enumerable: !0,
										get: function() {
											return s.monday
										}
									}),
									Object.defineProperty(t, 'timeMondays', {
										enumerable: !0,
										get: function() {
											return s.mondays
										}
									}),
									Object.defineProperty(t, 'timeTuesday', {
										enumerable: !0,
										get: function() {
											return s.tuesday
										}
									}),
									Object.defineProperty(t, 'timeTuesdays', {
										enumerable: !0,
										get: function() {
											return s.tuesdays
										}
									}),
									Object.defineProperty(t, 'timeWednesday', {
										enumerable: !0,
										get: function() {
											return s.wednesday
										}
									}),
									Object.defineProperty(t, 'timeWednesdays', {
										enumerable: !0,
										get: function() {
											return s.wednesdays
										}
									}),
									Object.defineProperty(t, 'timeThursday', {
										enumerable: !0,
										get: function() {
											return s.thursday
										}
									}),
									Object.defineProperty(t, 'timeThursdays', {
										enumerable: !0,
										get: function() {
											return s.thursdays
										}
									}),
									Object.defineProperty(t, 'timeFriday', {
										enumerable: !0,
										get: function() {
											return s.friday
										}
									}),
									Object.defineProperty(t, 'timeFridays', {
										enumerable: !0,
										get: function() {
											return s.fridays
										}
									}),
									Object.defineProperty(t, 'timeSaturday', {
										enumerable: !0,
										get: function() {
											return s.saturday
										}
									}),
									Object.defineProperty(t, 'timeSaturdays', {
										enumerable: !0,
										get: function() {
											return s.saturdays
										}
									})
								var f = n(217)
								Object.defineProperty(t, 'timeMonth', {
									enumerable: !0,
									get: function() {
										return g(f).default
									}
								}),
									Object.defineProperty(t, 'timeMonths', {
										enumerable: !0,
										get: function() {
											return f.months
										}
									})
								var c = n(218)
								Object.defineProperty(t, 'timeYear', {
									enumerable: !0,
									get: function() {
										return g(c).default
									}
								}),
									Object.defineProperty(t, 'timeYears', {
										enumerable: !0,
										get: function() {
											return c.years
										}
									})
								var d = n(219)
								Object.defineProperty(t, 'utcMinute', {
									enumerable: !0,
									get: function() {
										return g(d).default
									}
								}),
									Object.defineProperty(t, 'utcMinutes', {
										enumerable: !0,
										get: function() {
											return d.utcMinutes
										}
									})
								var p = n(220)
								Object.defineProperty(t, 'utcHour', {
									enumerable: !0,
									get: function() {
										return g(p).default
									}
								}),
									Object.defineProperty(t, 'utcHours', {
										enumerable: !0,
										get: function() {
											return p.utcHours
										}
									})
								var h = n(221)
								Object.defineProperty(t, 'utcDay', {
									enumerable: !0,
									get: function() {
										return g(h).default
									}
								}),
									Object.defineProperty(t, 'utcDays', {
										enumerable: !0,
										get: function() {
											return h.utcDays
										}
									})
								var v = n(222)
								Object.defineProperty(t, 'utcWeek', {
									enumerable: !0,
									get: function() {
										return v.utcSunday
									}
								}),
									Object.defineProperty(t, 'utcWeeks', {
										enumerable: !0,
										get: function() {
											return v.utcSundays
										}
									}),
									Object.defineProperty(t, 'utcSunday', {
										enumerable: !0,
										get: function() {
											return v.utcSunday
										}
									}),
									Object.defineProperty(t, 'utcSundays', {
										enumerable: !0,
										get: function() {
											return v.utcSundays
										}
									}),
									Object.defineProperty(t, 'utcMonday', {
										enumerable: !0,
										get: function() {
											return v.utcMonday
										}
									}),
									Object.defineProperty(t, 'utcMondays', {
										enumerable: !0,
										get: function() {
											return v.utcMondays
										}
									}),
									Object.defineProperty(t, 'utcTuesday', {
										enumerable: !0,
										get: function() {
											return v.utcTuesday
										}
									}),
									Object.defineProperty(t, 'utcTuesdays', {
										enumerable: !0,
										get: function() {
											return v.utcTuesdays
										}
									}),
									Object.defineProperty(t, 'utcWednesday', {
										enumerable: !0,
										get: function() {
											return v.utcWednesday
										}
									}),
									Object.defineProperty(t, 'utcWednesdays', {
										enumerable: !0,
										get: function() {
											return v.utcWednesdays
										}
									}),
									Object.defineProperty(t, 'utcThursday', {
										enumerable: !0,
										get: function() {
											return v.utcThursday
										}
									}),
									Object.defineProperty(t, 'utcThursdays', {
										enumerable: !0,
										get: function() {
											return v.utcThursdays
										}
									}),
									Object.defineProperty(t, 'utcFriday', {
										enumerable: !0,
										get: function() {
											return v.utcFriday
										}
									}),
									Object.defineProperty(t, 'utcFridays', {
										enumerable: !0,
										get: function() {
											return v.utcFridays
										}
									}),
									Object.defineProperty(t, 'utcSaturday', {
										enumerable: !0,
										get: function() {
											return v.utcSaturday
										}
									}),
									Object.defineProperty(t, 'utcSaturdays', {
										enumerable: !0,
										get: function() {
											return v.utcSaturdays
										}
									})
								var m = n(223)
								Object.defineProperty(t, 'utcMonth', {
									enumerable: !0,
									get: function() {
										return g(m).default
									}
								}),
									Object.defineProperty(t, 'utcMonths', {
										enumerable: !0,
										get: function() {
											return m.utcMonths
										}
									})
								var y = n(224)
								function g(e) {
									return e && e.__esModule ? e : { default: e }
								}
								Object.defineProperty(t, 'utcYear', {
									enumerable: !0,
									get: function() {
										return g(y).default
									}
								}),
									Object.defineProperty(t, 'utcYears', {
										enumerable: !0,
										get: function() {
											return y.utcYears
										}
									})
							},
							,
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t = (e += ''),
											n = t.indexOf(':')
										return (
											n >= 0 && 'xmlns' !== (t = e.slice(0, n)) && (e = e.slice(n + 1)),
											a.default.hasOwnProperty(t) ? { space: a.default[t], local: e } : e
										)
									})
								var r,
									a = (r = n(33)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = (t.xhtml = 'http://www.w3.org/1999/xhtml')
								t.default = {
									svg: 'http://www.w3.org/2000/svg',
									xhtml: r,
									xlink: 'http://www.w3.org/1999/xlink',
									xml: 'http://www.w3.org/XML/1998/namespace',
									xmlns: 'http://www.w3.org/2000/xmlns/'
								}
							},
							function(e, t, n) {
								function r() {}
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return null == e
											? r
											: function() {
													return this.querySelector(e)
											  }
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return (e.ownerDocument && e.ownerDocument.defaultView) || (e.document && e) || e.defaultView
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n) {
										var r,
											a,
											o = l(e + ''),
											i = o.length
										if (!(arguments.length < 2)) {
											for (f = t ? s : u, null == n && (n = !1), r = 0; r < i; ++r) this.each(f(o[r], t, n))
											return this
										}
										var f = this.node().__on
										if (f)
											for (var c, d = 0, p = f.length; d < p; ++d)
												for (r = 0, c = f[d]; r < i; ++r)
													if ((a = o[r]).type === c.type && a.name === c.name) return c.value
									}),
									(t.customEvent = function(e, n, r, o) {
										var i = a
										;(e.sourceEvent = a), (t.event = a = e)
										try {
											return n.apply(r, o)
										} finally {
											t.event = a = i
										}
									})
								var r = {},
									a = (t.event = null)
								function o(e, t, n) {
									return (
										(e = i(e, t, n)),
										function(t) {
											var n = t.relatedTarget
											;(n && (n === this || 8 & n.compareDocumentPosition(this))) || e.call(this, t)
										}
									)
								}
								function i(e, n, r) {
									return function(o) {
										var i = a
										t.event = a = o
										try {
											e.call(this, this.__data__, n, r)
										} finally {
											t.event = a = i
										}
									}
								}
								function l(e) {
									return e
										.trim()
										.split(/^|\s+/)
										.map(function(e) {
											var t = '',
												n = e.indexOf('.')
											return n >= 0 && ((t = e.slice(n + 1)), (e = e.slice(0, n))), { type: e, name: t }
										})
								}
								function u(e) {
									return function() {
										var t = this.__on
										if (t) {
											for (var n, r = 0, a = -1, o = t.length; r < o; ++r)
												(n = t[r]),
													(e.type && n.type !== e.type) || n.name !== e.name
														? (t[++a] = n)
														: this.removeEventListener(n.type, n.listener, n.capture)
											++a ? (t.length = a) : delete this.__on
										}
									}
								}
								function s(e, t, n) {
									var a = r.hasOwnProperty(e.type) ? o : i
									return function(r, o, i) {
										var l,
											u = this.__on,
											s = a(t, o, i)
										if (u)
											for (var f = 0, c = u.length; f < c; ++f)
												if ((l = u[f]).type === e.type && l.name === e.name)
													return (
														this.removeEventListener(l.type, l.listener, l.capture),
														this.addEventListener(l.type, (l.listener = s), (l.capture = n)),
														void (l.value = t)
													)
										this.addEventListener(e.type, s, n),
											(l = { type: e.type, name: e.name, value: t, listener: s, capture: n }),
											u ? u.push(l) : (this.__on = [l])
									}
								}
								'undefined' != typeof document &&
									('onmouseenter' in document.documentElement ||
										(r = { mouseenter: 'mouseover', mouseleave: 'mouseout' }))
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										for (var e, t = r.event; (e = t.sourceEvent); ) t = e
										return t
									})
								var r = n(36)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n) {
										if ((null == n && (n = a.default), (r = e.length))) {
											if ((t = +t) <= 0 || r < 2) return +n(e[0], 0, e)
											if (t >= 1) return +n(e[r - 1], r - 1, e)
											var r,
												o = (r - 1) * t,
												i = Math.floor(o),
												l = +n(e[i], i, e)
											return l + (+n(e[i + 1], i + 1, e) - l) * (o - i)
										}
									})
								var r,
									a = (r = n(15)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = (t.prefix = '$')
								function a() {}
								function o(e, t) {
									var n = new a()
									if (e instanceof a)
										e.each(function(e, t) {
											n.set(t, e)
										})
									else if (Array.isArray(e)) {
										var r,
											o = -1,
											i = e.length
										if (null == t) for (; ++o < i; ) n.set(o, e[o])
										else for (; ++o < i; ) n.set(t((r = e[o]), o, e), r)
									} else if (e) for (var l in e) n.set(l, e[l])
									return n
								}
								;(a.prototype = o.prototype = {
									constructor: a,
									has: function(e) {
										return r + e in this
									},
									get: function(e) {
										return this[r + e]
									},
									set: function(e, t) {
										return (this[r + e] = t), this
									},
									remove: function(e) {
										var t = r + e
										return t in this && delete this[t]
									},
									clear: function() {
										for (var e in this) e[0] === r && delete this[e]
									},
									keys: function() {
										var e = []
										for (var t in this) t[0] === r && e.push(t.slice(1))
										return e
									},
									values: function() {
										var e = []
										for (var t in this) t[0] === r && e.push(this[t])
										return e
									},
									entries: function() {
										var e = []
										for (var t in this) t[0] === r && e.push({ key: t.slice(1), value: this[t] })
										return e
									},
									size: function() {
										var e = 0
										for (var t in this) t[0] === r && ++e
										return e
									},
									empty: function() {
										for (var e in this) if (e[0] === r) return !1
										return !0
									},
									each: function(e) {
										for (var t in this) t[0] === r && e(this[t], t.slice(1), this)
									}
								}),
									(t.default = o)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r =
									'function' == typeof Symbol && 'symbol' == _typeof2(Symbol.iterator)
										? function(e) {
												return void 0 === e ? 'undefined' : _typeof2(e)
										  }
										: function(e) {
												return e && 'function' == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype
													? 'symbol'
													: void 0 === e
													? 'undefined'
													: _typeof2(e)
										  }
								t.default = function(e, t) {
									var n,
										d = void 0 === t ? 'undefined' : r(t)
									return null == t || 'boolean' === d
										? (0, c.default)(t)
										: ('number' === d
												? u.default
												: 'string' === d
												? (n = (0, a.color)(t))
													? ((t = n), o.default)
													: f.default
												: t instanceof a.color
												? o.default
												: t instanceof Date
												? l.default
												: Array.isArray(t)
												? i.default
												: ('function' != typeof t.valueOf && 'function' != typeof t.toString) || isNaN(t)
												? s.default
												: u.default)(e, t)
								}
								var a = n(3),
									o = d(n(88)),
									i = d(n(91)),
									l = d(n(92)),
									u = d(n(23)),
									s = d(n(93)),
									f = d(n(94)),
									c = d(n(90))
								function d(e) {
									return e && e.__esModule ? e : { default: e }
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.brighter = t.darker = void 0),
									(t.Color = i),
									(t.default = b),
									(t.rgbConvert = w),
									(t.rgb = j),
									(t.Rgb = k),
									(t.hslConvert = M),
									(t.hsl = P)
								var r,
									a = n(42),
									o = (r = a) && r.__esModule ? r : { default: r }
								function i() {}
								;(t.darker = 0.7), (t.brighter = 1 / 0.7)
								var l = '\\s*([+-]?\\d+)\\s*',
									u = '\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)\\s*',
									s = '\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)%\\s*',
									f = /^#([0-9a-f]{3})$/,
									c = /^#([0-9a-f]{6})$/,
									d = new RegExp('^rgb\\(' + [l, l, l] + '\\)$'),
									p = new RegExp('^rgb\\(' + [s, s, s] + '\\)$'),
									h = new RegExp('^rgba\\(' + [l, l, l, u] + '\\)$'),
									v = new RegExp('^rgba\\(' + [s, s, s, u] + '\\)$'),
									m = new RegExp('^hsl\\(' + [u, s, s] + '\\)$'),
									y = new RegExp('^hsla\\(' + [u, s, s, u] + '\\)$'),
									g = {
										aliceblue: 15792383,
										antiquewhite: 16444375,
										aqua: 65535,
										aquamarine: 8388564,
										azure: 15794175,
										beige: 16119260,
										bisque: 16770244,
										black: 0,
										blanchedalmond: 16772045,
										blue: 255,
										blueviolet: 9055202,
										brown: 10824234,
										burlywood: 14596231,
										cadetblue: 6266528,
										chartreuse: 8388352,
										chocolate: 13789470,
										coral: 16744272,
										cornflowerblue: 6591981,
										cornsilk: 16775388,
										crimson: 14423100,
										cyan: 65535,
										darkblue: 139,
										darkcyan: 35723,
										darkgoldenrod: 12092939,
										darkgray: 11119017,
										darkgreen: 25600,
										darkgrey: 11119017,
										darkkhaki: 12433259,
										darkmagenta: 9109643,
										darkolivegreen: 5597999,
										darkorange: 16747520,
										darkorchid: 10040012,
										darkred: 9109504,
										darksalmon: 15308410,
										darkseagreen: 9419919,
										darkslateblue: 4734347,
										darkslategray: 3100495,
										darkslategrey: 3100495,
										darkturquoise: 52945,
										darkviolet: 9699539,
										deeppink: 16716947,
										deepskyblue: 49151,
										dimgray: 6908265,
										dimgrey: 6908265,
										dodgerblue: 2003199,
										firebrick: 11674146,
										floralwhite: 16775920,
										forestgreen: 2263842,
										fuchsia: 16711935,
										gainsboro: 14474460,
										ghostwhite: 16316671,
										gold: 16766720,
										goldenrod: 14329120,
										gray: 8421504,
										green: 32768,
										greenyellow: 11403055,
										grey: 8421504,
										honeydew: 15794160,
										hotpink: 16738740,
										indianred: 13458524,
										indigo: 4915330,
										ivory: 16777200,
										khaki: 15787660,
										lavender: 15132410,
										lavenderblush: 16773365,
										lawngreen: 8190976,
										lemonchiffon: 16775885,
										lightblue: 11393254,
										lightcoral: 15761536,
										lightcyan: 14745599,
										lightgoldenrodyellow: 16448210,
										lightgray: 13882323,
										lightgreen: 9498256,
										lightgrey: 13882323,
										lightpink: 16758465,
										lightsalmon: 16752762,
										lightseagreen: 2142890,
										lightskyblue: 8900346,
										lightslategray: 7833753,
										lightslategrey: 7833753,
										lightsteelblue: 11584734,
										lightyellow: 16777184,
										lime: 65280,
										limegreen: 3329330,
										linen: 16445670,
										magenta: 16711935,
										maroon: 8388608,
										mediumaquamarine: 6737322,
										mediumblue: 205,
										mediumorchid: 12211667,
										mediumpurple: 9662683,
										mediumseagreen: 3978097,
										mediumslateblue: 8087790,
										mediumspringgreen: 64154,
										mediumturquoise: 4772300,
										mediumvioletred: 13047173,
										midnightblue: 1644912,
										mintcream: 16121850,
										mistyrose: 16770273,
										moccasin: 16770229,
										navajowhite: 16768685,
										navy: 128,
										oldlace: 16643558,
										olive: 8421376,
										olivedrab: 7048739,
										orange: 16753920,
										orangered: 16729344,
										orchid: 14315734,
										palegoldenrod: 15657130,
										palegreen: 10025880,
										paleturquoise: 11529966,
										palevioletred: 14381203,
										papayawhip: 16773077,
										peachpuff: 16767673,
										peru: 13468991,
										pink: 16761035,
										plum: 14524637,
										powderblue: 11591910,
										purple: 8388736,
										rebeccapurple: 6697881,
										red: 16711680,
										rosybrown: 12357519,
										royalblue: 4286945,
										saddlebrown: 9127187,
										salmon: 16416882,
										sandybrown: 16032864,
										seagreen: 3050327,
										seashell: 16774638,
										sienna: 10506797,
										silver: 12632256,
										skyblue: 8900331,
										slateblue: 6970061,
										slategray: 7372944,
										slategrey: 7372944,
										snow: 16775930,
										springgreen: 65407,
										steelblue: 4620980,
										tan: 13808780,
										teal: 32896,
										thistle: 14204888,
										tomato: 16737095,
										turquoise: 4251856,
										violet: 15631086,
										wheat: 16113331,
										white: 16777215,
										whitesmoke: 16119285,
										yellow: 16776960,
										yellowgreen: 10145074
									}
								function b(e) {
									var t
									return (
										(e = (e + '').trim().toLowerCase()),
										(t = f.exec(e))
											? new k(
													(((t = parseInt(t[1], 16)) >> 8) & 15) | ((t >> 4) & 240),
													((t >> 4) & 15) | (240 & t),
													((15 & t) << 4) | (15 & t),
													1
											  )
											: (t = c.exec(e))
											? _(parseInt(t[1], 16))
											: (t = d.exec(e))
											? new k(t[1], t[2], t[3], 1)
											: (t = p.exec(e))
											? new k((255 * t[1]) / 100, (255 * t[2]) / 100, (255 * t[3]) / 100, 1)
											: (t = h.exec(e))
											? x(t[1], t[2], t[3], t[4])
											: (t = v.exec(e))
											? x((255 * t[1]) / 100, (255 * t[2]) / 100, (255 * t[3]) / 100, t[4])
											: (t = m.exec(e))
											? O(t[1], t[2] / 100, t[3] / 100, 1)
											: (t = y.exec(e))
											? O(t[1], t[2] / 100, t[3] / 100, t[4])
											: g.hasOwnProperty(e)
											? _(g[e])
											: 'transparent' === e
											? new k(NaN, NaN, NaN, 0)
											: null
									)
								}
								function _(e) {
									return new k((e >> 16) & 255, (e >> 8) & 255, 255 & e, 1)
								}
								function x(e, t, n, r) {
									return r <= 0 && (e = t = n = NaN), new k(e, t, n, r)
								}
								function w(e) {
									return e instanceof i || (e = b(e)), e ? new k((e = e.rgb()).r, e.g, e.b, e.opacity) : new k()
								}
								function j(e, t, n, r) {
									return 1 === arguments.length ? w(e) : new k(e, t, n, null == r ? 1 : r)
								}
								function k(e, t, n, r) {
									;(this.r = +e), (this.g = +t), (this.b = +n), (this.opacity = +r)
								}
								function O(e, t, n, r) {
									return (
										r <= 0 ? (e = t = n = NaN) : n <= 0 || n >= 1 ? (e = t = NaN) : t <= 0 && (e = NaN),
										new S(e, t, n, r)
									)
								}
								function M(e) {
									if (e instanceof S) return new S(e.h, e.s, e.l, e.opacity)
									if ((e instanceof i || (e = b(e)), !e)) return new S()
									if (e instanceof S) return e
									var t = (e = e.rgb()).r / 255,
										n = e.g / 255,
										r = e.b / 255,
										a = Math.min(t, n, r),
										o = Math.max(t, n, r),
										l = NaN,
										u = o - a,
										s = (o + a) / 2
									return (
										u
											? ((l = t === o ? (n - r) / u + 6 * (n < r) : n === o ? (r - t) / u + 2 : (t - n) / u + 4),
											  (u /= s < 0.5 ? o + a : 2 - o - a),
											  (l *= 60))
											: (u = s > 0 && s < 1 ? 0 : l),
										new S(l, u, s, e.opacity)
									)
								}
								function P(e, t, n, r) {
									return 1 === arguments.length ? M(e) : new S(e, t, n, null == r ? 1 : r)
								}
								function S(e, t, n, r) {
									;(this.h = +e), (this.s = +t), (this.l = +n), (this.opacity = +r)
								}
								function A(e, t, n) {
									return (
										255 * (e < 60 ? t + ((n - t) * e) / 60 : e < 180 ? n : e < 240 ? t + ((n - t) * (240 - e)) / 60 : t)
									)
								}
								;(0, o.default)(i, b, {
									displayable: function() {
										return this.rgb().displayable()
									},
									toString: function() {
										return this.rgb() + ''
									}
								}),
									(0, o.default)(
										k,
										j,
										(0, a.extend)(i, {
											brighter: function(e) {
												return (
													(e = null == e ? 1 / 0.7 : Math.pow(1 / 0.7, e)),
													new k(this.r * e, this.g * e, this.b * e, this.opacity)
												)
											},
											darker: function(e) {
												return (
													(e = null == e ? 0.7 : Math.pow(0.7, e)),
													new k(this.r * e, this.g * e, this.b * e, this.opacity)
												)
											},
											rgb: function() {
												return this
											},
											displayable: function() {
												return (
													0 <= this.r &&
													this.r <= 255 &&
													0 <= this.g &&
													this.g <= 255 &&
													0 <= this.b &&
													this.b <= 255 &&
													0 <= this.opacity &&
													this.opacity <= 1
												)
											},
											toString: function() {
												var e = this.opacity
												return (
													(1 === (e = isNaN(e) ? 1 : Math.max(0, Math.min(1, e))) ? 'rgb(' : 'rgba(') +
													Math.max(0, Math.min(255, Math.round(this.r) || 0)) +
													', ' +
													Math.max(0, Math.min(255, Math.round(this.g) || 0)) +
													', ' +
													Math.max(0, Math.min(255, Math.round(this.b) || 0)) +
													(1 === e ? ')' : ', ' + e + ')')
												)
											}
										})
									),
									(0, o.default)(
										S,
										P,
										(0, a.extend)(i, {
											brighter: function(e) {
												return (
													(e = null == e ? 1 / 0.7 : Math.pow(1 / 0.7, e)),
													new S(this.h, this.s, this.l * e, this.opacity)
												)
											},
											darker: function(e) {
												return (e = null == e ? 0.7 : Math.pow(0.7, e)), new S(this.h, this.s, this.l * e, this.opacity)
											},
											rgb: function() {
												var e = (this.h % 360) + 360 * (this.h < 0),
													t = isNaN(e) || isNaN(this.s) ? 0 : this.s,
													n = this.l,
													r = n + (n < 0.5 ? n : 1 - n) * t,
													a = 2 * n - r
												return new k(
													A(e >= 240 ? e - 240 : e + 120, a, r),
													A(e, a, r),
													A(e < 120 ? e + 240 : e - 120, a, r),
													this.opacity
												)
											},
											displayable: function() {
												return (
													((0 <= this.s && this.s <= 1) || isNaN(this.s)) &&
													0 <= this.l &&
													this.l <= 1 &&
													0 <= this.opacity &&
													this.opacity <= 1
												)
											}
										})
									)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n) {
										;(e.prototype = t.prototype = n), (n.constructor = e)
									}),
									(t.extend = function(e, t) {
										var n = Object.create(e.prototype)
										for (var r in t) n[r] = t[r]
										return n
									})
							},
							function(e, t, n) {
								function r(e, t, n, r, a) {
									var o = e * e,
										i = o * e
									return (
										((1 - 3 * e + 3 * o - i) * t + (4 - 6 * o + 3 * i) * n + (1 + 3 * e + 3 * o - 3 * i) * r + i * a) /
										6
									)
								}
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.basis = r),
									(t.default = function(e) {
										var t = e.length - 1
										return function(n) {
											var a = n <= 0 ? (n = 0) : n >= 1 ? ((n = 1), t - 1) : Math.floor(n * t),
												o = e[a],
												i = e[a + 1],
												l = a > 0 ? e[a - 1] : 2 * o - i,
												u = a < t - 1 ? e[a + 2] : 2 * i - o
											return r((n - a / t) * t, l, o, i, u)
										}
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return function() {
											return e
										}
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										if ((n = (e = t ? e.toExponential(t - 1) : e.toExponential()).indexOf('e')) < 0) return null
										var n,
											r = e.slice(0, n)
										return [r.length > 1 ? r[0] + r.slice(2) : r, +e.slice(n + 1)]
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.utcParse = t.utcFormat = t.timeParse = t.timeFormat = void 0),
									(t.default = i)
								var r,
									a,
									o = (r = n(102)) && r.__esModule ? r : { default: r }
								function i(e) {
									return (
										(a = (0, o.default)(e)),
										(t.timeFormat = a.format),
										(t.timeParse = a.parse),
										(t.utcFormat = a.utcFormat),
										(t.utcParse = a.utcParse),
										a
									)
								}
								;(t.timeFormat = void 0),
									(t.timeParse = void 0),
									(t.utcFormat = void 0),
									(t.utcParse = void 0),
									i({
										dateTime: '%x, %X',
										date: '%-m/%-d/%Y',
										time: '%-I:%M:%S %p',
										periods: ['AM', 'PM'],
										days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
										shortDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
										months: [
											'January',
											'February',
											'March',
											'April',
											'May',
											'June',
											'July',
											'August',
											'September',
											'October',
											'November',
											'December'
										],
										shortMonths: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r =
									'function' == typeof Symbol && 'symbol' == _typeof2(Symbol.iterator)
										? function(e) {
												return void 0 === e ? 'undefined' : _typeof2(e)
										  }
										: function(e) {
												return e && 'function' == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype
													? 'symbol'
													: void 0 === e
													? 'undefined'
													: _typeof2(e)
										  }
								;(t.now = h), (t.Timer = m), (t.timer = y), (t.timerFlush = g)
								var a,
									o,
									i = 0,
									l = 0,
									u = 0,
									s = 0,
									f = 0,
									c = 0,
									d =
										'object' === ('undefined' == typeof performance ? 'undefined' : r(performance)) && performance.now
											? performance
											: Date,
									p =
										'object' === ('undefined' == typeof window ? 'undefined' : r(window)) &&
										window.requestAnimationFrame
											? window.requestAnimationFrame.bind(window)
											: function(e) {
													setTimeout(e, 17)
											  }
								function h() {
									return f || (p(v), (f = d.now() + c))
								}
								function v() {
									f = 0
								}
								function m() {
									this._call = this._time = this._next = null
								}
								function y(e, t, n) {
									var r = new m()
									return r.restart(e, t, n), r
								}
								function g() {
									h(), ++i
									for (var e, t = a; t; ) (e = f - t._time) >= 0 && t._call.call(null, e), (t = t._next)
									--i
								}
								function b() {
									;(f = (s = d.now()) + c), (i = l = 0)
									try {
										g()
									} finally {
										;(i = 0),
											(function() {
												for (var e, t, n = a, r = 1 / 0; n; )
													n._call
														? (r > n._time && (r = n._time), (e = n), (n = n._next))
														: ((t = n._next), (n._next = null), (n = e ? (e._next = t) : (a = t)))
												;(o = e), x(r)
											})(),
											(f = 0)
									}
								}
								function _() {
									var e = d.now(),
										t = e - s
									t > 1e3 && ((c -= t), (s = e))
								}
								function x(e) {
									i ||
										(l && (l = clearTimeout(l)),
										e - f > 24
											? (e < 1 / 0 && (l = setTimeout(b, e - d.now() - c)), u && (u = clearInterval(u)))
											: (u || ((s = d.now()), (u = setInterval(_, 1e3))), (i = 1), p(b)))
								}
								m.prototype = y.prototype = {
									constructor: m,
									restart: function(e, t, n) {
										if ('function' != typeof e) throw new TypeError('callback is not a function')
										;(n = (null == n ? h() : +n) + (null == t ? 0 : +t)),
											this._next || o === this || (o ? (o._next = this) : (a = this), (o = this)),
											(this._call = e),
											(this._time = n),
											x()
									},
									stop: function() {
										this._call && ((this._call = null), (this._time = 1 / 0), x())
									}
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = v),
									(t.computeHeight = g),
									(t.Node = b)
								var r = h(n(269)),
									a = h(n(270)),
									o = h(n(271)),
									i = h(n(272)),
									l = h(n(273)),
									u = h(n(274)),
									s = h(n(275)),
									f = h(n(276)),
									c = h(n(277)),
									d = h(n(278)),
									p = h(n(279))
								function h(e) {
									return e && e.__esModule ? e : { default: e }
								}
								function v(e, t) {
									var n,
										r,
										a,
										o,
										i,
										l = new b(e),
										u = +e.value && (l.value = e.value),
										s = [l]
									for (null == t && (t = m); (n = s.pop()); )
										if ((u && (n.value = +n.data.value), (a = t(n.data)) && (i = a.length)))
											for (n.children = new Array(i), o = i - 1; o >= 0; --o)
												s.push((r = n.children[o] = new b(a[o]))), (r.parent = n), (r.depth = n.depth + 1)
									return l.eachBefore(g)
								}
								function m(e) {
									return e.children
								}
								function y(e) {
									e.data = e.data.data
								}
								function g(e) {
									var t = 0
									do {
										e.height = t
									} while ((e = e.parent) && e.height < ++t)
								}
								function b(e) {
									;(this.data = e), (this.depth = this.height = 0), (this.parent = null)
								}
								b.prototype = v.prototype = {
									constructor: b,
									count: r.default,
									each: a.default,
									eachAfter: i.default,
									eachBefore: o.default,
									sum: l.default,
									sort: u.default,
									path: s.default,
									ancestors: f.default,
									descendants: c.default,
									leaves: d.default,
									links: p.default,
									copy: function() {
										return v(this).eachBefore(y)
									}
								}
							},
							function(e, t, n) {
								function r(e) {
									if ('function' != typeof e) throw new Error()
									return e
								}
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.optional = function(e) {
										return null == e ? null : r(e)
									}),
									(t.required = r)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.phi = void 0), (t.squarifyRatio = l)
								var r = o(n(19)),
									a = o(n(27))
								function o(e) {
									return e && e.__esModule ? e : { default: e }
								}
								var i = (t.phi = (1 + Math.sqrt(5)) / 2)
								function l(e, t, n, o, i, l) {
									for (
										var u,
											s,
											f,
											c,
											d,
											p,
											h,
											v,
											m,
											y,
											g,
											b = [],
											_ = t.children,
											x = 0,
											w = 0,
											j = _.length,
											k = t.value;
										x < j;

									) {
										;(f = i - n), (c = l - o)
										do {
											d = _[w++].value
										} while (!d && w < j)
										for (
											p = h = d, g = d * d * (y = Math.max(c / f, f / c) / (k * e)), m = Math.max(h / g, g / p);
											w < j;
											++w
										) {
											if (
												((d += s = _[w].value),
												s < p && (p = s),
												s > h && (h = s),
												(g = d * d * y),
												(v = Math.max(h / g, g / p)) > m)
											) {
												d -= s
												break
											}
											m = v
										}
										b.push((u = { value: d, dice: f < c, children: _.slice(x, w) })),
											u.dice
												? (0, r.default)(u, n, o, i, k ? (o += (c * d) / k) : l)
												: (0, a.default)(u, n, o, k ? (n += (f * d) / k) : i, l),
											(k -= d),
											(x = w)
									}
									return b
								}
								t.default = (function e(t) {
									function n(e, n, r, a, o) {
										l(t, e, n, r, a, o)
									}
									return (
										(n.ratio = function(t) {
											return e((t = +t) > 1 ? t : 1)
										}),
										n
									)
								})(i)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r =
										'function' == typeof Symbol && 'symbol' == _typeof2(Symbol.iterator)
											? function(e) {
													return void 0 === e ? 'undefined' : _typeof2(e)
											  }
											: function(e) {
													return e && 'function' == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype
														? 'symbol'
														: void 0 === e
														? 'undefined'
														: _typeof2(e)
											  },
									a = function(e, t) {
										if (Array.isArray(e)) return e
										if (Symbol.iterator in Object(e))
											return (function(e, t) {
												var n = [],
													r = !0,
													a = !1,
													o = void 0
												try {
													for (
														var i, l = e[Symbol.iterator]();
														!(r = (i = l.next()).done) && (n.push(i.value), !t || n.length !== t);
														r = !0
													);
												} catch (e) {
													;(a = !0), (o = e)
												} finally {
													try {
														!r && l.return && l.return()
													} finally {
														if (a) throw o
													}
												}
												return n
											})(e, t)
										throw new TypeError('Invalid attempt to destructure non-iterable instance')
									}
								;(t.tpinit = h),
									(t.loadstudycohort = function(e, t, r, a, o, l, f) {
										var c = r.append('div').style('color', '#858585')
										c.text('Loading ' + t + ' ...'),
											(0, u.json)(a + '/study').post(JSON.stringify({ file: t, jwt: o }), function(u) {
												if (u)
													if (u.error) c.text('Error loading study: ' + u.error)
													else {
														var d = u.cohort
														if (d)
															if (d.genome) {
																var p = e[d.genome]
																if (p)
																	if (((d.genome = p), (d.jwt = o), u.flagset)) {
																		for (var v in (c.text(''), (d.dsset = {}), u.flagset)) {
																			var m = u.flagset[v]
																			;(m.genome = p),
																				(0, s.bulkin)({
																					flag: m,
																					filename: t,
																					cohort: d,
																					err: function(e) {
																						return i.sayerror(c, e)
																					}
																				})
																		}
																		var y = h(d)
																		y && i.sayerror(c, y),
																			l ||
																				Promise.all([n.e(0), n.e(1), n.e(5)])
																					.then(n.t.bind(null, 65, 7))
																					.then(function(e) {
																						e.default(d, r, a, f)
																					})
																	} else c.text('.flagset missing')
																else c.text('Invalid genome from cohort: ' + d.genome)
															} else c.text('No genome specified in the cohort JSON content')
														else c.text('.cohort missing')
													}
												else c.text('Server error!')
											})
									})
								var o,
									i = p(n(6)),
									l = (o = n(121)) && o.__esModule ? o : { default: o },
									u = n(57),
									s = n(64),
									f = n(20),
									c = n(29),
									d = p(n(2))
								function p(e) {
									if (e && e.__esModule) return e
									var t = {}
									if (null != e) for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (t[n] = e[n])
									return (t.default = e), t
								}
								function h(e) {
									if ((e.p2st || (e.p2st = {}), e.assays || (e.assays = []), !Array.isArray(e.assays)))
										return '.assays should be an array'
									e.assaylst = []
									var t = 0,
										n = !0,
										o = !1,
										u = void 0
									try {
										for (var s, p = e.assays[Symbol.iterator](); !(n = (s = p.next()).done); n = !0) {
											var h = s.value,
												m = e[h]
											if (!m) return 'Assay "' + h + '" not found in cohort'
											var y = m.config
											if (!y) return '.config object missing for assay "' + h + '"'
											if ((delete m.config, !y.type)) return '.config.type missing for assay "' + h + '"'
											if ('vcf' == y.type.toLowerCase()) (y.type = i.tkt.ds), (y.isvcf = !0)
											else if (!d.validtkt(y.type)) return 'unknown .config.type "' + y.type + '" for assay "' + h + '"'
											if (
												((y.id = (++t).toString()),
												y.name || (y.name = h),
												y.type == i.tkt.junction &&
													y.readcountcutoff &&
													(!Number.isInteger(y.readcountcutoff) || y.readcountcutoff < 0))
											)
												return 'invalid .config.readcountcutoff for assay "' + h + '"'
											for (var g in (e.assaylst.push(y), m))
												for (var b in (e.p2st[g] || (e.p2st[g] = {}), m[g]))
													if ((e.p2st[g][b] || (e.p2st[g][b] = { tktemplate: [] }), y.type != i.tkt.vafs1)) {
														var _ = []
														Array.isArray(m[g][b]) ? (_ = m[g][b]) : _.push(m[g][b])
														var x = !0,
															w = !1,
															j = void 0
														try {
															for (var k, O = _[Symbol.iterator](); !(x = (k = O.next()).done); x = !0) {
																var M = k.value
																if (!M.file && !M.url)
																	return 'track has no file or url (sample: ' + g + ', assay: ' + h + ')'
																if (
																	(M.name ||
																		(M.partname
																			? (M.name = g + (b == g ? '' : ' ' + b) + ' ' + h + ' ' + M.partname)
																			: (M.name = g + (b == g ? '' : ' ' + b) + ' ' + h)),
																	y.isvcf)
																) {
																	var P = (0, l.default)({ name: M.name, file: M.file, url: M.url }),
																		S = a(P, 2),
																		A = S[0],
																		C = S[1]
																	if (A) return 'VCF track error: ' + A
																	M = C
																} else if (M.type) {
																	if (!d.validtkt(M.type))
																		return 'invalid track type "' + M.type + '" (sample: ' + g + ', assay: ' + h + ')'
																} else M.type = y.type
																switch (
																	((M.patient = g),
																	(M.sampletype = b),
																	(M.assayname = h),
																	(M.id = y.id),
																	(M.tkid = Math.random().toString()),
																	e.p2st[g][b].tktemplate.push(M),
																	y.type)
																) {
																	case i.tkt.bigwig:
																		var N = v(M, y)
																		if (N) return 'Assay ' + h + ': ' + y.type + ' track error: ' + N
																		break
																	case i.tkt.junction:
																		;(M.categories = y.categories), (M.readcountcutoff = y.readcountcutoff)
																}
															}
														} catch (I) {
															;(w = !0), (j = I)
														} finally {
															try {
																!x && O.return && O.return()
															} finally {
																if (w) throw j
															}
														}
													} else
														for (var T in m[g][b]) {
															var E = m[g][b][T]
															if (!E.file && !E.url) return 'no file or URL for ' + T + ' vafs1 of ' + g + ', ' + b
															;(E.type = i.tkt.vafs1),
																(E.patient = g),
																(E.sampletype = b),
																(E.assayname = h),
																(E.id = y.id),
																(E.tkid = Math.random().toString()),
																E.name || (E.name = T + ' vaf'),
																e.p2st[g][b].tktemplate.push(E)
														}
										}
									} catch (I) {
										;(o = !0), (u = I)
									} finally {
										try {
											!n && p.return && p.return()
										} finally {
											if (o) throw u
										}
									}
									delete e.assays
									var I = (function(e) {
										var t = []
										for (var n in e.p2st)
											for (var r in e.p2st[n]) {
												var a = e.p2st[n][r].tktemplate
												if (a) {
													var o = !0,
														i = !1,
														l = void 0
													try {
														for (var u, s = a[Symbol.iterator](); !(o = (u = s.next()).done); o = !0) {
															var f = u.value
															t.push(f)
														}
													} catch (e) {
														;(i = !0), (l = e)
													} finally {
														try {
															!o && s.return && s.return()
														} finally {
															if (i) throw l
														}
													}
												}
											}
										if (e.browserview && e.browserview.assays)
											for (var c in e.browserview.assays) {
												var d = e.browserview.assays[c]
												d.combined && d.combinetk && t.push(d.combinetk)
											}
										e.genome.tkset || (e.genome.tkset = [])
										var p = { name: e.name, tklst: t }
										if (e.trackfacets) {
											if (!Array.isArray(e.trackfacets)) return '.trackfacets is not an array'
											var h = [],
												v = !0,
												m = !1,
												y = void 0
											try {
												for (var g, b = e.trackfacets[Symbol.iterator](); !(v = (g = b.next()).done); v = !0) {
													var _ = g.value
													if (!_.samples) return 'trackfacets: .samples missing from facet ' + _.name
													if (!Array.isArray(_.samples))
														return 'trackfacets: .samples is not array from facet ' + _.name
													if (!_.assays) return 'trackfacets: .assays missing from a facet ' + _.name
													if (!Array.isArray(_.assays))
														return 'trackfacets: .assays is not array from a facet ' + _.name
													h.push(_)
												}
											} catch (e) {
												;(m = !0), (y = e)
											} finally {
												try {
													!v && b.return && b.return()
												} finally {
													if (m) throw y
												}
											}
											h.length && (p.facetlst = h)
										}
										return e.genome.tkset.push(p), null
									})(e)
									if (I) return 'Error: ' + I
									if (e.patientannotation) {
										var R = (function(e) {
											if (!e.patientannotation.annotation) return '.patientannotation.annotation missing'
											if (!e.patientannotation.metadata) return '.patientannotation.metadata missing'
											if (!Array.isArray(e.patientannotation.metadata))
												return '.patientannotation.metadata should be an array'
											var t = {},
												n = !0,
												r = !1,
												a = void 0
											try {
												for (
													var o, i = e.patientannotation.metadata[Symbol.iterator]();
													!(n = (o = i.next()).done);
													n = !0
												) {
													var l = o.value
													if (null == l.key) return 'patientannotation: key missing for a metadata term'
													if (!l.values) return 'patientannotation: values missing for metadata term ' + l.key
													if (!Array.isArray(l.values))
														return 'patientannotation: .values not an array for metadata term ' + l.key
													l.label || (l.label = l.key), (t[l.key] = { label: l.label, values: {} })
													var u = (0, c.scaleOrdinal)(c.schemeCategory10),
														s = !0,
														f = !1,
														d = void 0
													try {
														for (var p, h = l.values[Symbol.iterator](); !(s = (p = h.next()).done); s = !0) {
															var v = p.value
															if (null == v.key) return 'key missing for an attribute of term ' + l.key
															v.label || (v.label = v.key),
																v.color || (v.color = u(v.key)),
																(t[l.key].values[v.key] = v)
														}
													} catch (e) {
														;(f = !0), (d = e)
													} finally {
														try {
															!s && h.return && h.return()
														} finally {
															if (f) throw d
														}
													}
												}
											} catch (e) {
												;(r = !0), (a = e)
											} finally {
												try {
													!n && i.return && i.return()
												} finally {
													if (r) throw a
												}
											}
											return (e.patientannotation.mdh = t), null
										})(e)
										if (R) return R
									}
									if (e.browserview) {
										var L = (function(e) {
											if (e.browserview.position) {
												var t = void 0
												if ('string' == typeof e.browserview.position) {
													if (!(t = (0, f.string2pos)(e.browserview.position, e.genome)))
														return '.browserview.position invalid value'
												} else t = e.browserview.position
												var n = (0, f.invalidcoord)(e.genome, t.chr, t.start, t.stop)
												if (n) return '.browserview.position error: ' + n
												e.browserview.position = t
											} else
												e.browserview.position = {
													chr: e.genome.defaultcoord.chr,
													start: e.genome.defaultcoord.start,
													stop: e.genome.defaultcoord.stop
												}
											if (e.browserview.assays)
												for (var a in e.browserview.assays) {
													'object' != r(e.browserview.assays[a]) && (e.browserview.assays[a] = {})
													var o = e.browserview.assays[a],
														i = !0,
														l = !1,
														u = void 0
													try {
														for (var s, c = e.assaylst[Symbol.iterator](); !(i = (s = c.next()).done); i = !0) {
															var d = s.value
															if (d.name == a) {
																o.assayobj = d
																break
															}
														}
													} catch (e) {
														;(l = !0), (u = e)
													} finally {
														try {
															!i && c.return && c.return()
														} finally {
															if (l) throw u
														}
													}
													if (o.assayobj) {
														if ((o.sum_view && (delete o.sum_view, (o.combined = !0)), o.combined)) {
															var p = {}
															for (var h in o.assayobj) p[h] = o.assayobj[h]
															for (var v in o) 'assayobj' != v && (p[v] = o[v])
															for (var m in (p.name || (p.name = a), (p.tracks = []), e.p2st))
																for (var y in e.p2st[m]) {
																	var g = !0,
																		b = !1,
																		_ = void 0
																	try {
																		for (
																			var x, w = e.p2st[m][y].tktemplate[Symbol.iterator]();
																			!(g = (x = w.next()).done);
																			g = !0
																		) {
																			var j = x.value
																			j.id == o.assayobj.id && ((j.patient = m), (j.sampletype = y), p.tracks.push(j))
																		}
																	} catch (e) {
																		;(b = !0), (_ = e)
																	} finally {
																		try {
																			!g && w.return && w.return()
																		} finally {
																			if (b) throw _
																		}
																	}
																}
															if (p.isvcf) {
																p.ds = { id2vcf: {}, label: p.name }
																var k = !0,
																	O = !1,
																	M = void 0
																try {
																	for (var P, S = p.tracks[Symbol.iterator](); !(k = (P = S.next()).done); k = !0) {
																		var A = P.value
																		for (var C in A.ds.id2vcf) A.__vcfobj = A.ds.id2vcf[C]
																		p.ds.id2vcf[A.__vcfobj.vcfid] = A.__vcfobj
																	}
																} catch (e) {
																	;(O = !0), (M = e)
																} finally {
																	try {
																		!k && S.return && S.return()
																	} finally {
																		if (O) throw M
																	}
																}
															}
															o.combinetk = p
														}
													} else console.log('missing assayobj for assayview of ' + a)
												}
											if (e.browserview.defaultassaytracks) {
												if (!Array.isArray(e.browserview.defaultassaytracks))
													return '.browserview.defaultassaytracks must be array'
												for (var N = 0; N < e.browserview.defaultassaytracks.length; N++) {
													var T = e.browserview.defaultassaytracks[N]
													if (!T.assay) return '.assay missing from .defaultassaytracks #' + (N + 1)
													if (!e[T.assay])
														return 'unknown assay name from .defaultassaytracks #' + (N + 1) + ': ' + T.assay
													if (!T.level1) return '.level1 missing from .defaultassaytracks #' + (N + 1)
													if (!e[T.assay][T.level1])
														return 'level1 not exist in assay from .defaultassaytracks #' + (N + 1) + ': ' + T.level1
													if (T.level2 && !e[T.assay][T.level1][T.level2])
														return 'level2 not exist in assay from .defaultassaytracks #' + (N + 1) + ': ' + T.level2
												}
											}
											return null
										})(e)
										if (L) return L
									}
									if (e.e2pca) {
										if (!e.e2pca.list) return '.list missing from e2pca'
										if (!Array.isArray(e.e2pca.list)) return 'e2pca.list should be an array'
										if (0 == e.e2pca.list.length) return 'e2pca.list[] length 0'
										e.e2pca.label || (e.e2pca.label = 'Expression - PCA')
										var D = !0,
											F = !1,
											q = void 0
										try {
											for (var U, G = e.e2pca.list[Symbol.iterator](); !(D = (U = G.next()).done); D = !0) {
												var z = U.value
												if (!z.vectorfile) return 'vectorfile missing from e2pca'
												if (!z.dbfile) return 'dbfile missing from e2pca'
											}
										} catch (I) {
											;(F = !0), (q = I)
										} finally {
											try {
												!D && G.return && G.return()
											} finally {
												if (F) throw q
											}
										}
									}
								}
								function v(e, t) {
									if ((t || (t = {}), !e.file && !e.url)) return 'no file or url'
									e.pcolor || (e.pcolor = t.pcolor || '#0066CC'),
										e.pcolor2 || (e.pcolor2 = t.pcolor2 || '#CC0000'),
										e.ncolor || (e.ncolor = t.ncolor || '#FF850A'),
										e.ncolor2 || (e.ncolor2 = t.ncolor2 || '#0A85FF'),
										e.height || (e.height = t.height || 50)
									var n = {}
									if (t.scale) for (var r in t.scale) n[r] = t.scale[r]
									if (e.scale) for (var a in e.scale) n[a] = e.scale[a]
									;(n.auto = !0),
										((Number.isFinite(n.min) && Number.isFinite(n.max)) || Number.isFinite(n.percentile)) &&
											delete n.auto,
										(e.scale = n)
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n,
											o,
											i,
											l,
											u = (0, a.dispatch)('beforesend', 'progress', 'load', 'error'),
											s = (0, r.map)(),
											f = new XMLHttpRequest(),
											c = null,
											d = null,
											p = 0
										function h(e) {
											var t,
												r = f.status
											if (
												(!r &&
													(function(e) {
														var t = e.responseType
														return t && 'text' !== t ? e.response : e.responseText
													})(f)) ||
												(r >= 200 && r < 300) ||
												304 === r
											) {
												if (i)
													try {
														t = i.call(n, f)
													} catch (e) {
														return void u.call('error', n, e)
													}
												else t = f
												u.call('load', n, t)
											} else u.call('error', n, e)
										}
										if (
											('undefined' != typeof XDomainRequest &&
												!('withCredentials' in f) &&
												/^(http(s)?:)?\/\//.test(e) &&
												(f = new XDomainRequest()),
											'onload' in f
												? (f.onload = f.onerror = f.ontimeout = h)
												: (f.onreadystatechange = function(e) {
														f.readyState > 3 && h(e)
												  }),
											(f.onprogress = function(e) {
												u.call('progress', n, e)
											}),
											(n = {
												header: function(e, t) {
													return (
														(e = (e + '').toLowerCase()),
														arguments.length < 2 ? s.get(e) : (null == t ? s.remove(e) : s.set(e, t + ''), n)
													)
												},
												mimeType: function(e) {
													return arguments.length ? ((o = null == e ? null : e + ''), n) : o
												},
												responseType: function(e) {
													return arguments.length ? ((l = e), n) : l
												},
												timeout: function(e) {
													return arguments.length ? ((p = +e), n) : p
												},
												user: function(e) {
													return arguments.length < 1 ? c : ((c = null == e ? null : e + ''), n)
												},
												password: function(e) {
													return arguments.length < 1 ? d : ((d = null == e ? null : e + ''), n)
												},
												response: function(e) {
													return (i = e), n
												},
												get: function(e, t) {
													return n.send('GET', e, t)
												},
												post: function(e, t) {
													return n.send('POST', e, t)
												},
												send: function(t, r, a) {
													return (
														f.open(t, e, !0, c, d),
														null == o || s.has('accept') || s.set('accept', o + ',*/*'),
														f.setRequestHeader &&
															s.each(function(e, t) {
																f.setRequestHeader(t, e)
															}),
														null != o && f.overrideMimeType && f.overrideMimeType(o),
														null != l && (f.responseType = l),
														p > 0 && (f.timeout = p),
														null == a && 'function' == typeof r && ((a = r), (r = null)),
														null != a &&
															1 === a.length &&
															(a = (function(e) {
																return function(t, n) {
																	e(null == t ? n : null)
																}
															})(a)),
														null != a &&
															n.on('error', a).on('load', function(e) {
																a(null, e)
															}),
														u.call('beforesend', n, f),
														f.send(null == r ? null : r),
														n
													)
												},
												abort: function() {
													return f.abort(), n
												},
												on: function() {
													var e = u.on.apply(u, arguments)
													return e === u ? n : e
												}
											}),
											null != t)
										) {
											if ('function' != typeof t) throw new Error('invalid callback: ' + t)
											return n.get(t)
										}
										return n
									})
								var r = n(60),
									a = n(56)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t = new RegExp('["' + e + '\n\r]'),
											n = e.charCodeAt(0)
										function s(e, t) {
											var u,
												s = [],
												f = e.length,
												c = 0,
												d = 0,
												p = f <= 0,
												h = !1
											function v() {
												if (p) return a
												if (h) return (h = !1), r
												var t,
													u,
													s = c
												if (e.charCodeAt(s) === o) {
													for (; (c++ < f && e.charCodeAt(c) !== o) || e.charCodeAt(++c) === o; );
													return (
														(t = c) >= f
															? (p = !0)
															: (u = e.charCodeAt(c++)) === i
															? (h = !0)
															: u === l && ((h = !0), e.charCodeAt(c) === i && ++c),
														e.slice(s + 1, t - 1).replace(/""/g, '"')
													)
												}
												for (; c < f; ) {
													if ((u = e.charCodeAt((t = c++))) === i) h = !0
													else if (u === l) (h = !0), e.charCodeAt(c) === i && ++c
													else if (u !== n) continue
													return e.slice(s, t)
												}
												return (p = !0), e.slice(s, f)
											}
											for (e.charCodeAt(f - 1) === i && --f, e.charCodeAt(f - 1) === l && --f; (u = v()) !== a; ) {
												for (var m = []; u !== r && u !== a; ) m.push(u), (u = v())
												;(t && null == (m = t(m, d++))) || s.push(m)
											}
											return s
										}
										function f(t) {
											return t.map(c).join(e)
										}
										function c(e) {
											return null == e ? '' : t.test((e += '')) ? '"' + e.replace(/"/g, '""') + '"' : e
										}
										return {
											parse: function(e, t) {
												var n,
													r,
													a = s(e, function(e, a) {
														if (n) return n(e, a - 1)
														;(r = e),
															(n = t
																? (function(e, t) {
																		var n = u(e)
																		return function(r, a) {
																			return t(n(r), a, e)
																		}
																  })(e, t)
																: u(e))
													})
												return (a.columns = r || []), a
											},
											parseRows: s,
											format: function(t, n) {
												return (
													null == n &&
														(n = (function(e) {
															var t = Object.create(null),
																n = []
															return (
																e.forEach(function(e) {
																	for (var r in e) r in t || n.push((t[r] = r))
																}),
																n
															)
														})(t)),
													[n.map(c).join(e)]
														.concat(
															t.map(function(t) {
																return n
																	.map(function(e) {
																		return c(t[e])
																	})
																	.join(e)
															})
														)
														.join('\n')
												)
											},
											formatRows: function(e) {
												return e.map(f).join('\n')
											}
										}
									})
								var r = {},
									a = {},
									o = 34,
									i = 10,
									l = 13
								function u(e) {
									return new Function(
										'd',
										'return {' +
											e
												.map(function(e, t) {
													return JSON.stringify(e) + ': d[' + t + ']'
												})
												.join(',') +
											'}'
									)
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = n(197)
								Object.defineProperty(t, 'formatDefaultLocale', {
									enumerable: !0,
									get: function() {
										return s(r).default
									}
								}),
									Object.defineProperty(t, 'format', {
										enumerable: !0,
										get: function() {
											return r.format
										}
									}),
									Object.defineProperty(t, 'formatPrefix', {
										enumerable: !0,
										get: function() {
											return r.formatPrefix
										}
									})
								var a = n(96)
								Object.defineProperty(t, 'formatLocale', {
									enumerable: !0,
									get: function() {
										return s(a).default
									}
								})
								var o = n(97)
								Object.defineProperty(t, 'formatSpecifier', {
									enumerable: !0,
									get: function() {
										return s(o).default
									}
								})
								var i = n(203)
								Object.defineProperty(t, 'precisionFixed', {
									enumerable: !0,
									get: function() {
										return s(i).default
									}
								})
								var l = n(204)
								Object.defineProperty(t, 'precisionPrefix', {
									enumerable: !0,
									get: function() {
										return s(l).default
									}
								})
								var u = n(205)
								function s(e) {
									return e && e.__esModule ? e : { default: e }
								}
								Object.defineProperty(t, 'precisionRound', {
									enumerable: !0,
									get: function() {
										return s(u).default
									}
								})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = n(268)
								Object.defineProperty(t, 'cluster', {
									enumerable: !0,
									get: function() {
										return g(r).default
									}
								})
								var a = n(48)
								Object.defineProperty(t, 'hierarchy', {
									enumerable: !0,
									get: function() {
										return g(a).default
									}
								})
								var o = n(280)
								Object.defineProperty(t, 'pack', {
									enumerable: !0,
									get: function() {
										return g(o).default
									}
								})
								var i = n(106)
								Object.defineProperty(t, 'packSiblings', {
									enumerable: !0,
									get: function() {
										return g(i).default
									}
								})
								var l = n(107)
								Object.defineProperty(t, 'packEnclose', {
									enumerable: !0,
									get: function() {
										return g(l).default
									}
								})
								var u = n(282)
								Object.defineProperty(t, 'partition', {
									enumerable: !0,
									get: function() {
										return g(u).default
									}
								})
								var s = n(283)
								Object.defineProperty(t, 'stratify', {
									enumerable: !0,
									get: function() {
										return g(s).default
									}
								})
								var f = n(284)
								Object.defineProperty(t, 'tree', {
									enumerable: !0,
									get: function() {
										return g(f).default
									}
								})
								var c = n(285)
								Object.defineProperty(t, 'treemap', {
									enumerable: !0,
									get: function() {
										return g(c).default
									}
								})
								var d = n(286)
								Object.defineProperty(t, 'treemapBinary', {
									enumerable: !0,
									get: function() {
										return g(d).default
									}
								})
								var p = n(19)
								Object.defineProperty(t, 'treemapDice', {
									enumerable: !0,
									get: function() {
										return g(p).default
									}
								})
								var h = n(27)
								Object.defineProperty(t, 'treemapSlice', {
									enumerable: !0,
									get: function() {
										return g(h).default
									}
								})
								var v = n(287)
								Object.defineProperty(t, 'treemapSliceDice', {
									enumerable: !0,
									get: function() {
										return g(v).default
									}
								})
								var m = n(50)
								Object.defineProperty(t, 'treemapSquarify', {
									enumerable: !0,
									get: function() {
										return g(m).default
									}
								})
								var y = n(288)
								function g(e) {
									return e && e.__esModule ? e : { default: e }
								}
								Object.defineProperty(t, 'treemapResquarify', {
									enumerable: !0,
									get: function() {
										return g(y).default
									}
								})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = n(236)
								Object.defineProperty(t, 'dispatch', {
									enumerable: !0,
									get: function() {
										return ((e = r), e && e.__esModule ? e : { default: e }).default
										var e
									}
								})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = n(52)
								Object.defineProperty(t, 'request', {
									enumerable: !0,
									get: function() {
										return f(r).default
									}
								})
								var a = n(300)
								Object.defineProperty(t, 'html', {
									enumerable: !0,
									get: function() {
										return f(a).default
									}
								})
								var o = n(301)
								Object.defineProperty(t, 'json', {
									enumerable: !0,
									get: function() {
										return f(o).default
									}
								})
								var i = n(302)
								Object.defineProperty(t, 'text', {
									enumerable: !0,
									get: function() {
										return f(i).default
									}
								})
								var l = n(303)
								Object.defineProperty(t, 'xml', {
									enumerable: !0,
									get: function() {
										return f(l).default
									}
								})
								var u = n(304)
								Object.defineProperty(t, 'csv', {
									enumerable: !0,
									get: function() {
										return f(u).default
									}
								})
								var s = n(307)
								function f(e) {
									return e && e.__esModule ? e : { default: e }
								}
								Object.defineProperty(t, 'tsv', {
									enumerable: !0,
									get: function() {
										return f(s).default
									}
								})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = function(e, t) {
									if (Array.isArray(e)) return e
									if (Symbol.iterator in Object(e))
										return (function(e, t) {
											var n = [],
												r = !0,
												a = !1,
												o = void 0
											try {
												for (
													var i, l = e[Symbol.iterator]();
													!(r = (i = l.next()).done) && (n.push(i.value), !t || n.length !== t);
													r = !0
												);
											} catch (e) {
												;(a = !0), (o = e)
											} finally {
												try {
													!r && l.return && l.return()
												} finally {
													if (a) throw o
												}
											}
											return n
										})(e, t)
									throw new TypeError('Invalid attempt to destructure non-iterable instance')
								}
								function a(e, t, n) {
									for (var r = ['root'], a = 0; a < t; a++) r.push(e[n[a].k])
									return t >= 0 && r.push(e[n[t].k]), r.join('...')
								}
								t.stratinput = function(e, t) {
									var n = Object.create(null),
										o = Object.create(null),
										i = Object.create(null),
										l = !0,
										u = !1,
										s = void 0
									try {
										for (var f, c = e[Symbol.iterator](); !(l = (f = c.next()).done); l = !0) {
											var d = f.value,
												p = !0,
												h = !1,
												v = void 0
											try {
												for (var m, y = t.entries()[Symbol.iterator](); !(p = (m = y.next()).done); p = !0) {
													var g = r(m.value, 2),
														b = g[0],
														_ = g[1],
														x = a(d, b, t),
														w = a(d, b - 1, t)
													if (!d[_.k]) {
														b > 0 && (i[w] += 1)
														break
													}
													if (((n[x] = w), x in i || (i[x] = 0), !(x in o))) {
														var j = { lst: [] }
														_.full && (j.full = d[_.full]), (o[x] = j)
													}
													o[x].lst.push(d), b == t.length - 1 && (i[x] += 1)
												}
											} catch (e) {
												;(h = !0), (v = e)
											} finally {
												try {
													!p && y.return && y.return()
												} finally {
													if (h) throw v
												}
											}
										}
									} catch (e) {
										;(u = !0), (s = e)
									} finally {
										try {
											!l && c.return && c.return()
										} finally {
											if (u) throw s
										}
									}
									var k = [{ id: 'root', name: 'root' }]
									for (var O in n) {
										var M = n[O],
											P = o[O],
											S = O.split('...')
										k.push({ id: O, parentId: M, lst: P.lst, value: i[O], name: S[S.length - 1], full: P.full })
									}
									return k
								}
							},
							function(e, t, n) {
								function r(e, t, n) {
									var r, a, o, i, l
									function u() {
										var s = Date.now() - i
										s < t && s >= 0
											? (r = setTimeout(u, t - s))
											: ((r = null), n || ((l = e.apply(o, a)), (o = a = null)))
									}
									null == t && (t = 100)
									var s = function() {
										;(o = this), (a = arguments), (i = Date.now())
										var s = n && !r
										return r || (r = setTimeout(u, t)), s && ((l = e.apply(o, a)), (o = a = null)), l
									}
									return (
										(s.clear = function() {
											r && (clearTimeout(r), (r = null))
										}),
										(s.flush = function() {
											r && ((l = e.apply(o, a)), (o = a = null), clearTimeout(r), (r = null))
										}),
										s
									)
								}
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.debounce = r), (r.debounce = r)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = n(178)
								Object.defineProperty(t, 'nest', {
									enumerable: !0,
									get: function() {
										return s(r).default
									}
								})
								var a = n(179)
								Object.defineProperty(t, 'set', {
									enumerable: !0,
									get: function() {
										return s(a).default
									}
								})
								var o = n(39)
								Object.defineProperty(t, 'map', {
									enumerable: !0,
									get: function() {
										return s(o).default
									}
								})
								var i = n(180)
								Object.defineProperty(t, 'keys', {
									enumerable: !0,
									get: function() {
										return s(i).default
									}
								})
								var l = n(181)
								Object.defineProperty(t, 'values', {
									enumerable: !0,
									get: function() {
										return s(l).default
									}
								})
								var u = n(182)
								function s(e) {
									return e && e.__esModule ? e : { default: e }
								}
								Object.defineProperty(t, 'entries', {
									enumerable: !0,
									get: function() {
										return s(u).default
									}
								})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										if (e.holder) {
											e.hostURL && (f = e.hostURL)
											var t = { jwt: e.jwt }
											;(t.holder = e.holder instanceof Element ? (0, u.select)(e.holder) : e.holder),
												(t.dataset = e.dataset),
												(t.mset = e.mset),
												(t.gmmode = e.gmmode),
												(t.hidedatasetexpression = e.hidedatasetexpression),
												(t.hidegenecontrol = e.hidegenecontrol),
												(t.hidegenelegend = e.hidegenelegend),
												(t.hlaachange = e.hlaachange),
												(t.hlvariants = e.hlvariants),
												(t.nopopup = e.nopopup),
												(t.variantPageCall_snv = e.variantPageCall_snv),
												(t.samplecart = e.samplecart),
												(t.debugmode = e.debugmode),
												(t.tklst = e.tklst || []),
												(t.datasetqueries = e.datasetqueries),
												(t.error = function(e) {
													return o.sayerror(t.holder, e)
												}),
												e.genome
													? ((t.genome = e.genome),
													  e.query
															? (function(e, t) {
																	var r = e.holder
																		.append('p')
																		.style('font-size', '2em')
																		.style('color', '#858585')
																		.text('Searching for ' + t + ' ...')
																	;(0, a.json)(f + '/genelookup').post(
																		JSON.stringify({ deep: 1, input: t, genome: e.genome.name, jwt: e.jwt }),
																		function(a) {
																			if (a)
																				if (a.error) e.error('querying genes: ' + a.error)
																				else {
																					if (!a.gmlst || 0 == a.gmlst.length)
																						return e.genome.hasSNP
																							? void (0, l.string2snp)(e.genome.name, t, f, e.jwt)
																									.then(function(t) {
																										r.remove()
																										var a = {
																											jwt: e.jwt,
																											hostURL: f,
																											genome: e.genome,
																											holder: e.holder,
																											dogtag: e.genome.name,
																											chr: t.chr,
																											start: Math.max(0, t.start - 300),
																											stop: t.start + 300,
																											nobox: !0,
																											allowpopup: !e.nopopup,
																											tklst: e.tklst,
																											debugmode: e.debugmode
																										}
																										return (
																											o.first_genetrack_tolist(e.genome, a.tklst),
																											Promise.all([n.e(0), n.e(2), n.e(3)])
																												.then(n.t.bind(null, 13, 7))
																												.then(function(e) {
																													new e.Block(a).addhlregion(t.chr, t.start, t.stop - 1)
																												})
																										)
																									})
																									.catch(function(e) {
																										r.text(e.message), e.stack && console.log(e.stack)
																									})
																							: void r.text('No hits found for ' + t)
																					r.remove(), (e.allmodels = a.gmlst)
																					var i = [],
																						u = !0,
																						s = !1,
																						d = void 0
																					try {
																						for (
																							var p, h = e.allmodels[Symbol.iterator]();
																							!(u = (p = h.next()).done);
																							u = !0
																						) {
																							var v = p.value
																							if (!v.isoform)
																								return void e.error(
																									'isoform missing from one gene model: ' + JSON.stringify(v)
																								)
																							var m = v.isoform.toUpperCase()
																							if (e.genome.isoformcache.has(m)) {
																								var y = !0,
																									g = !0,
																									b = !1,
																									_ = void 0
																								try {
																									for (
																										var x, w = e.genome.isoformcache.get(m)[Symbol.iterator]();
																										!(g = (x = w.next()).done);
																										g = !0
																									) {
																										var j = x.value
																										if (
																											j.chr == v.chr &&
																											j.start == v.start &&
																											j.stop == v.stop &&
																											j.strand == v.strand
																										) {
																											y = !1
																											break
																										}
																									}
																								} catch (e) {
																									;(b = !0), (_ = e)
																								} finally {
																									try {
																										!g && w.return && w.return()
																									} finally {
																										if (b) throw _
																									}
																								}
																								y && e.genome.isoformcache.get(m).push(v)
																							} else e.genome.isoformcache.set(m, [v])
																							if (v.isoform.toUpperCase() == t.toUpperCase()) {
																								i.push(v)
																								break
																							}
																							v.isdefault && i.push(v)
																						}
																					} catch (e) {
																						;(s = !0), (d = e)
																					} finally {
																						try {
																							!u && h.return && h.return()
																						} finally {
																							if (s) throw d
																						}
																					}
																					if (1 == i.length) e.model = i[0]
																					else if (i.length > 1) {
																						var k = !0,
																							O = !1,
																							M = void 0
																						try {
																							for (
																								var P, S = i[Symbol.iterator]();
																								!(k = (P = S.next()).done);
																								k = !0
																							) {
																								var A = P.value
																								if ('chrY' != A.chr) {
																									var C = e.genome.chrlookup[A.chr.toUpperCase()]
																									C && C.major && (e.model = A)
																								}
																							}
																						} catch (e) {
																							;(O = !0), (M = e)
																						} finally {
																							try {
																								!k && S.return && S.return()
																							} finally {
																								if (O) throw M
																							}
																						}
																						e.model || (e.model = i[0])
																					}
																					e.model || (e.model = e.allmodels[0]), c(e)
																				}
																			else e.error('querying genes: server error')
																		}
																	)
															  })(t, e.query)
															: e.model && e.allmodels && ((t.model = e.model), (t.allmodels = e.allmodels), c(t)))
													: t.error('no genome')
										} else alert('No holder for block.init')
									})
								var r = n(29),
									a = n(57),
									o = (function(e) {
										if (e && e.__esModule) return e
										var t = {}
										if (null != e) for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (t[n] = e[n])
										return (t.default = e), t
									})(n(6)),
									i = n(2),
									l = n(20),
									u = n(0)
								function s(e) {
									if (Array.isArray(e)) {
										for (var t = 0, n = Array(e.length); t < e.length; t++) n[t] = e[t]
										return n
									}
									return Array.from(e)
								}
								var f = ''
								function c(e) {
									if (e.model.genomicseq) return t(), void d(e)
									function t() {
										if (
											(e.model.cdseq &&
												e.model.cdseq.length % 3 != 0 &&
												e.error('Dubious CDS of ' + e.model.isoform + ': AA count ' + e.model.aacount),
											e.model.aaseq)
										) {
											var t = e.model.aaseq.indexOf(i.codon_stop)
											;-1 != t &&
												t < e.model.cdslen / 3 - 1 &&
												e.error(
													'Translating ' + e.model.isoform + ' ends at ' + t + ' AA, expecting ' + e.model.cdslen / 3
												),
												'M' != e.model.aaseq[0] &&
													e.error('Translated protein does not start with "M" in ' + e.model.isoform)
										}
									}
									;(0, a.json)(f + '/ntseq').post(
										JSON.stringify({
											genome: e.genome.name,
											coord: e.model.chr + ':' + (e.model.start + 1) + '-' + e.model.stop,
											jwt: e.jwt
										}),
										function(n) {
											n
												? n.error
													? e.error('getting sequence: ' + n.error)
													: n.seq
													? ((e.model.genomicseq = n.seq.toUpperCase()),
													  (e.model.aaseq = (0, i.nt2aa)(e.model)),
													  t(),
													  d(e))
													: e.error('no nt seq???')
												: e.error('getting sequence: server error')
										}
									)
								}
								function d(e) {
									var t = new Map(),
										n = !0,
										a = !1,
										i = void 0
									try {
										for (var l, u = e.allmodels[Symbol.iterator](); !(n = (l = u.next()).done); n = !0) {
											var c = l.value
											c.pdomains ||
												((c.pdomains = []),
												(c.domain_hidden = {}),
												t.has(c.isoform) || t.set(c.isoform, []),
												t.get(c.isoform).push(c))
										}
									} catch (e) {
										;(a = !0), (i = e)
									} finally {
										try {
											!n && u.return && u.return()
										} finally {
											if (a) throw i
										}
									}
									if (0 != t.size) {
										var d = new Request(f + '/pdomain', {
											method: 'POST',
											body: JSON.stringify({ genome: e.genome.name, isoforms: [].concat(s(t.keys())), jwt: e.jwt })
										})
										fetch(d)
											.then(function(e) {
												return e.json()
											})
											.then(function(n) {
												if (n.error) throw { message: 'error getting protein domain: ' + n.error }
												if (n.lst) {
													var a = (0, r.scaleOrdinal)().range(o.domaincolorlst),
														i = !0,
														l = !1,
														u = void 0
													try {
														for (var s, f = n.lst[Symbol.iterator](); !(i = (s = f.next()).done); i = !0) {
															var c = s.value,
																d = !0,
																h = !1,
																v = void 0
															try {
																for (var m, y = t.get(c.name)[Symbol.iterator](); !(d = (m = y.next()).done); d = !0)
																	m.value.pdomains = c.pdomains
															} catch (e) {
																;(h = !0), (v = e)
															} finally {
																try {
																	!d && y.return && y.return()
																} finally {
																	if (h) throw v
																}
															}
															var g = !0,
																b = !1,
																_ = void 0
															try {
																for (var x, w = c.pdomains[Symbol.iterator](); !(g = (x = w.next()).done); g = !0) {
																	var j = x.value
																	j.color || (j.color = a(j.name + j.description))
																}
															} catch (e) {
																;(b = !0), (_ = e)
															} finally {
																try {
																	!g && w.return && w.return()
																} finally {
																	if (b) throw _
																}
															}
														}
													} catch (e) {
														;(l = !0), (u = e)
													} finally {
														try {
															!i && f.return && f.return()
														} finally {
															if (l) throw u
														}
													}
												}
												p(e)
											})
											.catch(function(t) {
												e.error(t.message)
											})
									} else p(e)
								}
								function p(e) {
									var t = e.gmmode
									t || (t = e.model.cdslen ? o.gmmode.protein : o.gmmode.exononly),
										Promise.all([n.e(0), n.e(2), n.e(3)])
											.then(n.t.bind(null, 13, 7))
											.then(function(n) {
												return new n.Block({
													jwt: e.jwt,
													hostURL: f,
													genome: e.genome,
													holder: e.holder,
													nobox: !0,
													usegm: e.model,
													gmstackheight: 37,
													allgm: e.allmodels,
													datasetlst: e.dataset,
													mset: e.mset,
													hlaachange: e.hlaachange,
													hlvariants: e.hlvariants,
													gmmode: t,
													allowpopup: !e.nopopup,
													hidedatasetexpression: e.hidedatasetexpression,
													hidegenecontrol: e.hidegenecontrol,
													hidegenelegend: e.hidegenelegend,
													variantPageCall_snv: e.variantPageCall_snv,
													datasetqueries: e.datasetqueries,
													samplecart: e.samplecart,
													debugmode: e.debugmode,
													tklst: e.tklst
												})
											})
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = n(46)
								Object.defineProperty(t, 'timeFormatDefaultLocale', {
									enumerable: !0,
									get: function() {
										return l(r).default
									}
								}),
									Object.defineProperty(t, 'timeFormat', {
										enumerable: !0,
										get: function() {
											return r.timeFormat
										}
									}),
									Object.defineProperty(t, 'timeParse', {
										enumerable: !0,
										get: function() {
											return r.timeParse
										}
									}),
									Object.defineProperty(t, 'utcFormat', {
										enumerable: !0,
										get: function() {
											return r.utcFormat
										}
									}),
									Object.defineProperty(t, 'utcParse', {
										enumerable: !0,
										get: function() {
											return r.utcParse
										}
									})
								var a = n(102)
								Object.defineProperty(t, 'timeFormatLocale', {
									enumerable: !0,
									get: function() {
										return l(a).default
									}
								})
								var o = n(103)
								Object.defineProperty(t, 'isoFormat', {
									enumerable: !0,
									get: function() {
										return l(o).default
									}
								})
								var i = n(225)
								function l(e) {
									return e && e.__esModule ? e : { default: e }
								}
								Object.defineProperty(t, 'isoParse', {
									enumerable: !0,
									get: function() {
										return l(i).default
									}
								})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = n(47)
								Object.defineProperty(t, 'now', {
									enumerable: !0,
									get: function() {
										return r.now
									}
								}),
									Object.defineProperty(t, 'timer', {
										enumerable: !0,
										get: function() {
											return r.timer
										}
									}),
									Object.defineProperty(t, 'timerFlush', {
										enumerable: !0,
										get: function() {
											return r.timerFlush
										}
									})
								var a = n(237)
								Object.defineProperty(t, 'timeout', {
									enumerable: !0,
									get: function() {
										return i(a).default
									}
								})
								var o = n(238)
								function i(e) {
									return e && e.__esModule ? e : { default: e }
								}
								Object.defineProperty(t, 'interval', {
									enumerable: !0,
									get: function() {
										return i(o).default
									}
								})
							},
							function(module, exports, __webpack_require__) {
								Object.defineProperty(exports, '__esModule', { value: !0 })
								var _slicedToArray = function(e, t) {
									if (Array.isArray(e)) return e
									if (Symbol.iterator in Object(e))
										return (function(e, t) {
											var n = [],
												r = !0,
												a = !1,
												o = void 0
											try {
												for (
													var i, l = e[Symbol.iterator]();
													!(r = (i = l.next()).done) && (n.push(i.value), !t || n.length !== t);
													r = !0
												);
											} catch (e) {
												;(a = !0), (o = e)
											} finally {
												try {
													!r && l.return && l.return()
												} finally {
													if (a) throw o
												}
											}
											return n
										})(e, t)
									throw new TypeError('Invalid attempt to destructure non-iterable instance')
								}
								;(exports.bulkui = bulkui),
									(exports.content2flag = content2flag),
									(exports.bulkin = bulkin),
									(exports.bulkembed = bulkembed)
								var _d3Selection = __webpack_require__(0),
									_client = __webpack_require__(6),
									client = _interopRequireWildcard(_client),
									_bulk = __webpack_require__(10),
									bulk = _interopRequireWildcard(_bulk),
									_bulk2 = __webpack_require__(293),
									bulksnv = _interopRequireWildcard(_bulk2),
									_bulkSv = __webpack_require__(117),
									bulksv = _interopRequireWildcard(_bulkSv),
									_bulk3 = __webpack_require__(294),
									bulksvjson = _interopRequireWildcard(_bulk3),
									_bulk4 = __webpack_require__(295),
									bulkcnv = _interopRequireWildcard(_bulk4),
									_bulk5 = __webpack_require__(296),
									bulkitd = _interopRequireWildcard(_bulk5),
									_bulk6 = __webpack_require__(297),
									bulkdel = _interopRequireWildcard(_bulk6),
									_bulk7 = __webpack_require__(298),
									bulktrunc = _interopRequireWildcard(_bulk7),
									_bulk8 = __webpack_require__(299),
									_common = __webpack_require__(2),
									common = _interopRequireWildcard(_common),
									_tp = __webpack_require__(51)
								function _interopRequireWildcard(e) {
									if (e && e.__esModule) return e
									var t = {}
									if (null != e) for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (t[n] = e[n])
									return (t.default = e), t
								}
								function bulkui(e, t, n, r) {
									var a = client.newpane3(e, t, n),
										o = _slicedToArray(a, 6),
										i = o[0],
										l = o[1],
										u = o[2],
										s = o[3],
										f = o[4]
									o[5],
										i.header.text('Load mutation from text files'),
										l
											.append('div')
											.style('margin', '20px 0px')
											.style('color', '#858585')
											.html(
												'\n\t<p>Choose one file and upload to initiate the display panel.<br>From there you can add additional files.</p>\n\t<div>Supported data types:</div>\n\t<ul>\n\t  <li>SNV and indel</li>\n\t  <ul>\n\t    <li><a href=https://drive.google.com/open?id=1OJ9aXq2_-a3BfIQdKLYCYzrJRTpu4_9i3gephTY-Z38 target=_blank>Format</a>,\n\t        <a href=https://pecan.stjude.cloud/static/pp-support/example.files/example.snvindel.txt target=_blank>example file</a></li>\n\t  </ul>\n\t  <li>SV or fusion transcript</li>\n\t  <ul>\n\t    <li><a href=https://drive.google.com/open?id=1klDZ0MHVkQTW2-lCu_AvpRE4_FcbhdB-yI17wNdPaOM target=_blank>Tabular format</a>,\n\t        <a href=https://pecan.stjude.cloud/static/pp-support/example.files/example.svfusion.txt target=_blank>example file</a>\n\t\t</li>\n\t\t<li>JSON-format, to come</li>\n\t  </ul>\n\t  <li>CNV, gene-level</li>\n\t  <ul>\n\t    <li><a href=https://drive.google.com/open?id=1WHptqOWNf96V0bYEDpj-EsKZGYnbBNc9aQIrhzdEJaU target=_blank>Format</a>, \n\t        <a href=https://pecan.stjude.cloud/static/pp-support/example.files/example.cnv.txt target=_blank>example file</a>\n\t\t</li>\n\t  </ul>\n\t  <li>ITD</li>\n\t  <ul>\n\t  \t<li>Internal tandem duplication, in-frame</li>\n\t    <li><a href=https://drive.google.com/open?id=1Bh9awBsraoHbV8iWXv_3oDeXMsjIAHaOKHr973IJyZc target=_blank>Format</a>, \n\t        <a href=https://pecan.stjude.cloud/static/pp-support/example.files/example.itd.txt target=_blank>example file</a>\n\t\t</li>\n\t  </ul>\n\t  <li>Intragenic deletion, in-frame</li>\n\t  <ul>\n\t    <li><a href=https://drive.google.com/open?id=1tWbf3rg3BmVIZPGGPk023P0aBkDw_ry5XuZLGyGodyg target=_blank>Format</a>, \n\t        <a href=https://pecan.stjude.cloud/static/pp-support/example.files/example.deletion.txt target=_blank>example file</a>\n\t\t</li>\n\t  </ul>\n\t  <li>Truncation</li>\n\t  <ul>\n\t  \t<li>Either N-terminus loss or C-terminus loss</li>\n\t    <li><a href=https://drive.google.com/open?id=1P1g-Y8r30pSKfan1BhYZcsUtSk7wRb4plaO1S-JCJr4 target=_blank>Format</a>, \n\t        <a href=https://pecan.stjude.cloud/static/pp-support/example.files/example.truncation.txt target=_blank>example file</a>\n\t\t</li>\n\t  </ul>\n\t</ul>'
											)
									var c = function e() {
										s.selectAll('*').remove(),
											new _bulk8.ProjectHandler({
												bulkin: bulkin,
												genomes: n,
												gselect: u,
												content2flag: content2flag,
												flag2tp: p,
												filediv: s,
												init_bulk_flag: bulk.init_bulk_flag
											}),
											s.append('span').html('Select data type&nbsp;')
										var t = client.filetypeselect(s).style('margin-right', '20px')
										s.append('input')
											.attr('type', 'file')
											.on('change', function() {
												var r = bulk.init_bulk_flag(n[u.options[u.selectedIndex].innerHTML])
												;(r.geneToUpper = d.property('checked')), f.text('')
												var a = _d3Selection.event.target.files[0]
												if (a) {
													if (0 == a.size) return f.text('Wrong file: ' + a.name), void e()
													var o = new FileReader()
													;(o.onload = function(n) {
														var o = content2flag(n.target.result, t.node().selectedIndex, r)
														if (o) return f.text('Error: ' + o), void e()
														p(r, a)
													}),
														(o.onerror = function() {
															f.text('Error reading file ' + a.name), e()
														}),
														f.text('Parsing file ' + a.name + ' ...'),
														o.readAsText(a, 'utf8')
												} else e()
											})
											.node()
											.focus()
									}
									c(), s.append('span').html('<br/>Convert gene name to uppercase &nbsp;')
									var d = s
										.append('span')
										.append('input')
										.attr('type', 'checkbox')
										.property('checked', !0)
									function p(n, a) {
										var o = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : null,
											l = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : null
										if ('string' == typeof n) return f.text(n), void c()
										f.text(''), c()
										var u = o || Object.assign({ genome: n.genome, name: a.name }),
											s = bulkin({ flag: n, filename: a.name, cohort: u, flag2thisds: l })
										if (s) f.text('Error with ' + a.name + ': ' + s)
										else {
											if (0 != n.good) {
												client.disappear(i.pane)
												var d = client.newpane({ x: e + 100, y: t + 100, toshrink: !0 })
												return (
													d.header.html('<span style="opacity:.5">FILE</span> ' + a.name),
													Promise.all([__webpack_require__.e(0), __webpack_require__.e(1), __webpack_require__.e(5)])
														.then(__webpack_require__.t.bind(null, 65, 7))
														.then(function(e) {
															e.default(u, d.body, r)
														}),
													u
												)
											}
											f.text('No mutations can be loaded')
										}
									}
									return function(e, t) {
										var n = content2flag(e.content, t, flag)
										if (n) return f.text('Error: ' + n), void c()
										p(flag, e)
									}
								}
								function content2flag(e, t, n) {
									if (!n) return 'should not happen!'
									var r = void 0
									switch (t) {
										case 0:
											if ((r = parse_snvindel(e, n))) return r
											break
										case 1:
											if ((r = parse_sv(e, n, !0))) return r
											break
										case 2:
											if ((r = parse_sv(e, n, !1))) return r
											break
										case 3:
											if ((r = parse_itd(e, n))) return r
											break
										case 4:
											if ((r = parse_del(e, n))) return r
											break
										case 5:
											if ((r = parse_trunc(e, n))) return r
											break
										case 6:
											if ((r = parse_cnv(e, n))) return r
											break
										default:
											return 'unknown option array index from file type <select>: ' + t
									}
								}
								function bulkin(p) {
									var callback = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null,
										flag = p.flag,
										cohort = p.cohort
									if (
										(cohort.p2st || (cohort.p2st = {}),
										cohort.dsset || (cohort.dsset = {}),
										cohort.assaylst || (cohort.assaylst = []),
										flag.variantgene)
									) {
										if (cohort.variantgene) return 'variantgene already set for this cohort'
										cohort.variantgene = flag.variantgene
									}
									if (
										(flag.snv.badlines.length > 0 && client.bulk_badline(flag.snv.header, flag.snv.badlines),
										flag.fusion.badlines.length > 0 && client.bulk_badline(flag.fusion.header, flag.fusion.badlines),
										flag.sv.badlines.length > 0 && client.bulk_badline(flag.sv.header, flag.sv.badlines),
										flag.cnv.badlines.length > 0 && client.bulk_badline(flag.cnv.header, flag.cnv.badlines),
										flag.itd.badlines.length > 0 && client.bulk_badline(flag.itd.header, flag.itd.badlines),
										flag.del.badlines.length > 0 && client.bulk_badline(flag.del.header, flag.del.badlines),
										flag.truncation.badlines.length > 0 &&
											client.bulk_badline(flag.truncation.header, flag.truncation.badlines),
										0 == flag.good)
									)
										return !1
									var tmp = {},
										hastumormaf = !1
									if (flag.snv.loaded) {
										var _iteratorNormalCompletion = !0,
											_didIteratorError = !1,
											_iteratorError = void 0
										try {
											for (
												var _iterator = flag.snv.header[Symbol.iterator](), _step;
												!(_iteratorNormalCompletion = (_step = _iterator.next()).done);
												_iteratorNormalCompletion = !0
											) {
												var i = _step.value
												tmp[i] = 1
											}
										} catch (e) {
											;(_didIteratorError = !0), (_iteratorError = e)
										} finally {
											try {
												!_iteratorNormalCompletion && _iterator.return && _iterator.return()
											} finally {
												if (_didIteratorError) throw _iteratorError
											}
										}
										'maf_tumor_v1' in tmp && 'maf_tumor_v2' in tmp && (hastumormaf = !0)
									}
									if (flag.cnv.loaded) {
										var _iteratorNormalCompletion2 = !0,
											_didIteratorError2 = !1,
											_iteratorError2 = void 0
										try {
											for (
												var _iterator2 = flag.cnv.header[Symbol.iterator](), _step2;
												!(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done);
												_iteratorNormalCompletion2 = !0
											) {
												var _i = _step2.value
												tmp[_i] = 1
											}
										} catch (e) {
											;(_didIteratorError2 = !0), (_iteratorError2 = e)
										} finally {
											try {
												!_iteratorNormalCompletion2 && _iterator2.return && _iterator2.return()
											} finally {
												if (_didIteratorError2) throw _iteratorError2
											}
										}
									}
									if (flag.fusion.loaded) {
										var _iteratorNormalCompletion3 = !0,
											_didIteratorError3 = !1,
											_iteratorError3 = void 0
										try {
											for (
												var _iterator3 = flag.fusion.header[Symbol.iterator](), _step3;
												!(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done);
												_iteratorNormalCompletion3 = !0
											) {
												var _i2 = _step3.value
												tmp[_i2] = 1
											}
										} catch (e) {
											;(_didIteratorError3 = !0), (_iteratorError3 = e)
										} finally {
											try {
												!_iteratorNormalCompletion3 && _iterator3.return && _iterator3.return()
											} finally {
												if (_didIteratorError3) throw _iteratorError3
											}
										}
									}
									if (flag.sv.loaded) {
										var _iteratorNormalCompletion4 = !0,
											_didIteratorError4 = !1,
											_iteratorError4 = void 0
										try {
											for (
												var _iterator4 = flag.sv.header[Symbol.iterator](), _step4;
												!(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done);
												_iteratorNormalCompletion4 = !0
											) {
												var _i3 = _step4.value
												tmp[_i3] = 1
											}
										} catch (e) {
											;(_didIteratorError4 = !0), (_iteratorError4 = e)
										} finally {
											try {
												!_iteratorNormalCompletion4 && _iterator4.return && _iterator4.return()
											} finally {
												if (_didIteratorError4) throw _iteratorError4
											}
										}
									}
									if (flag.itd.loaded) {
										var _iteratorNormalCompletion5 = !0,
											_didIteratorError5 = !1,
											_iteratorError5 = void 0
										try {
											for (
												var _iterator5 = flag.itd.header[Symbol.iterator](), _step5;
												!(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done);
												_iteratorNormalCompletion5 = !0
											) {
												var _i4 = _step5.value
												tmp[_i4] = 1
											}
										} catch (e) {
											;(_didIteratorError5 = !0), (_iteratorError5 = e)
										} finally {
											try {
												!_iteratorNormalCompletion5 && _iterator5.return && _iterator5.return()
											} finally {
												if (_didIteratorError5) throw _iteratorError5
											}
										}
									}
									if (flag.del.loaded) {
										var _iteratorNormalCompletion6 = !0,
											_didIteratorError6 = !1,
											_iteratorError6 = void 0
										try {
											for (
												var _iterator6 = flag.del.header[Symbol.iterator](), _step6;
												!(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done);
												_iteratorNormalCompletion6 = !0
											) {
												var _i5 = _step6.value
												tmp[_i5] = 1
											}
										} catch (e) {
											;(_didIteratorError6 = !0), (_iteratorError6 = e)
										} finally {
											try {
												!_iteratorNormalCompletion6 && _iterator6.return && _iterator6.return()
											} finally {
												if (_didIteratorError6) throw _iteratorError6
											}
										}
									}
									if (flag.truncation.loaded) {
										var _iteratorNormalCompletion7 = !0,
											_didIteratorError7 = !1,
											_iteratorError7 = void 0
										try {
											for (
												var _iterator7 = flag.truncation.header[Symbol.iterator](), _step7;
												!(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done);
												_iteratorNormalCompletion7 = !0
											) {
												var _i6 = _step7.value
												tmp[_i6] = 1
											}
										} catch (e) {
											;(_didIteratorError7 = !0), (_iteratorError7 = e)
										} finally {
											try {
												!_iteratorNormalCompletion7 && _iterator7.return && _iterator7.return()
											} finally {
												if (_didIteratorError7) throw _iteratorError7
											}
										}
									}
									var hassample = 'sample' in tmp || 'patient' in tmp,
										hasdisease = 'disease' in tmp,
										hasst = 'sampletype' in tmp,
										dsc = void 0
									if (p.flag2thisds) {
										if (((dsc = p.flag2thisds), hassample && !dsc.hassample))
											return '"sample" column found in new data but not in existing data'
										if (!hassample && dsc.hassample) return '"sample" column found in existing data but not in new data'
										if (hasdisease && !dsc.hasdisease)
											return '"disease" column found in new data but not in existing data'
										if (!hasdisease && dsc.hasdisease)
											return '"disease" column found in existing data but not in new data'
										if (hasst && !dsc.hasst) return '"sampletype" column found in new data but not in existing data'
										if (!hasst && dsc.hasst) return '"sampletype" column found in existing data but not in new data'
										for (var genename in flag.data) {
											var lst = dsc.bulkdata[genename]
											dsc.bulkdata[genename] = lst ? lst.concat(flag.data[genename]) : flag.data[genename]
										}
									} else {
										var dsname = p.filename + (flag.tpsetname ? '_' + flag.tpsetname : '')
										if (dsname in flag.genome.datasets) {
											for (var j = 1, n2 = dsname + ' ' + j; n2 in flag.genome.datasets; ) j++, (n2 = dsname + ' ' + j)
											dsname = n2
										}
										if (
											((dsc = {
												label: dsname,
												bulkdata: flag.data,
												hassample: hassample,
												hasdisease: hasdisease,
												hastumormaf: hastumormaf,
												hasst: hasst,
												genome: cohort.genome,
												import: {},
												imported: {},
												importsilent: 0 != flag.snv.silent && !(flag.snv.missense / flag.snv.silent >= 5)
											}),
											(flag.genome.datasets[dsname] = dsc),
											(cohort.dsset[dsname] = dsc),
											cohort.dbexpression)
										) {
											if (cohort.dbexpression.tidy)
												try {
													cohort.dbexpression.tidy = eval('(' + cohort.dbexpression.tidy + ')')
												} catch (e) {
													err('invalid JavaScript for dbexpression.tidy'), delete cohort.dbexpression
												}
											dsc.dbexpression = cohort.dbexpression
										}
										hasdisease && (dsc.stratify = [{ label: 'disease', attr1: { k: 'disease', label: 'disease' } }])
									}
									if (hassample)
										for (var gene in flag.data) {
											var _iteratorNormalCompletion8 = !0,
												_didIteratorError8 = !1,
												_iteratorError8 = void 0
											try {
												for (
													var _iterator8 = flag.data[gene][Symbol.iterator](), _step8;
													!(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done);
													_iteratorNormalCompletion8 = !0
												) {
													var m = _step8.value,
														pn = m.patient
													if (pn || ((pn = m.sample), pn)) {
														cohort.p2st[pn] || (cohort.p2st[pn] = {})
														var st = m.sampletype
														st || (st = pn),
															cohort.p2st[pn][st] || (cohort.p2st[pn][st] = { dsset: {}, tktemplate: [] }),
															cohort.p2st[pn][st].dsset[dsc.label] || (cohort.p2st[pn][st].dsset[dsc.label] = []),
															cohort.p2st[pn][st].dsset[dsc.label].push(m)
													}
												}
											} catch (e) {
												;(_didIteratorError8 = !0), (_iteratorError8 = e)
											} finally {
												try {
													!_iteratorNormalCompletion8 && _iterator8.return && _iterator8.return()
												} finally {
													if (_didIteratorError8) throw _iteratorError8
												}
											}
										}
									return callback && callback(), !1
								}
								function bulkembed(e) {
									e.name || (e.name = 'Unamed dataset')
									var t = e.holder
									if (!t) {
										var n = client.newpane({ x: 100, y: 100 })
										t = n.body
									}
									var r = t.append('div')
									new Promise(function(t, n) {
										var r = { dsset: {} }
										for (var a in e)
											'snvindel' != a && 'svjson' != a && 'cnv' != a && 'sv' != a && 'mutationset' != a && (r[a] = e[a])
										t(r)
									})
										.then(function(t) {
											if (!(e.snvindel || e.svjson || e.cnv || e.sv)) return t
											var n = bulk.init_bulk_flag(t.genome)
											if (e.snvindel) {
												var r = parse_snvindel(e.snvindel, n)
												if (r) throw { message: 'error in snvindel data: ' + r }
												delete e.snvindel
											}
											if (e.svjson) {
												var a = parse_svjson(e.svjson, n)
												if (a) throw { message: 'error in svjson data: ' + a }
												delete e.svjson
											}
											if (e.sv) {
												var o = parse_sv(e.sv, n)
												if (o) throw { message: 'error in svjson data: ' + o }
												delete e.sv
											}
											if (e.cnv) {
												var i = parse_cnv(e.cnv, n)
												if (i) throw { message: 'error in cnv data: ' + i }
												delete e.cnv
											}
											var l = bulkin({ flag: n, filename: e.name, cohort: t })
											if (l) throw { message: 'Error parsing data: ' + l }
											return t
										})
										.then(function(t) {
											if (!e.mutationset) return t
											if (!Array.isArray(e.mutationset)) throw { message: 'mutationset is not an array' }
											var n = [],
												r = !0,
												a = !1,
												o = void 0
											try {
												for (
													var i,
														l = function() {
															var r = i.value,
																a = bulk.init_bulk_flag(t.genome),
																o = []
															if (r.snvindel) {
																var l = new Request(e.hostURL + '/textfile', {
																		method: 'POST',
																		body: '{"file":"' + r.snvindel + '"}'
																	}),
																	u = fetch(l)
																		.then(function(e) {
																			return e.json()
																		})
																		.then(function(e) {
																			if (e.error) throw { message: 'error with snvindel file: ' + e.error }
																			var t = parse_snvindel(e.text, a)
																			if (t) throw { message: 'error with snvindel file: ' + t }
																		})
																o.push(u)
															}
															if (r.cnv) {
																var s = new Request(e.hostURL + '/textfile', {
																		method: 'POST',
																		body: '{"file":"' + r.cnv + '"}'
																	}),
																	f = fetch(s)
																		.then(function(e) {
																			return e.json()
																		})
																		.then(function(e) {
																			if (e.error) throw { message: 'error with cnv file: ' + e.error }
																			var t = parse_cnv(e.text, a)
																			if (t) throw { message: 'error with cnv file: ' + t }
																		})
																o.push(f)
															}
															if (r.sv) {
																var c = new Request(e.hostURL + '/textfile', {
																		method: 'POST',
																		body: '{"file":"' + r.sv + '"}'
																	}),
																	d = fetch(c)
																		.then(function(e) {
																			return e.json()
																		})
																		.then(function(e) {
																			if (e.error) throw { message: 'error with sv file: ' + e.error }
																			var t = parse_sv(e.text, a, !0)
																			if (t) throw { message: 'error with sv file: ' + t }
																		})
																o.push(d)
															}
															if (r.fusion) {
																var p = new Request(e.hostURL + '/textfile', {
																		method: 'POST',
																		body: '{"file":"' + r.fusion + '"}'
																	}),
																	h = fetch(p)
																		.then(function(e) {
																			return e.json()
																		})
																		.then(function(e) {
																			if (e.error) throw { message: 'error with fusion file: ' + e.error }
																			var t = parse_sv(e.text, a, !1)
																			if (t) throw { message: 'error with fusion file: ' + t }
																		})
																o.push(h)
															}
															if (r.svjson) {
																var v = new Request(e.hostURL + '/textfile', {
																		method: 'POST',
																		body: '{"file":"' + r.svjson + '"}'
																	}),
																	m = fetch(v)
																		.then(function(e) {
																			return e.json()
																		})
																		.then(function(e) {
																			if (e.error) throw { message: 'error with svjson file: ' + e.error }
																			var t = parse_svjson(e.text, a, !1)
																			if (t) throw { message: 'error with svjson file: ' + t }
																		})
																o.push(m)
															}
															if (r.deletion) {
																var y = new Request(e.hostURL + '/textfile', {
																		method: 'POST',
																		body: '{"file":"' + r.deletion + '"}'
																	}),
																	g = fetch(y)
																		.then(function(e) {
																			return e.json()
																		})
																		.then(function(e) {
																			if (e.error) throw { message: 'error with deletion file: ' + e.error }
																			var t = parse_del(e.text, a, !1)
																			if (t) throw { message: 'error with deletion file: ' + t }
																		})
																o.push(g)
															}
															if (r.truncation) {
																var b = new Request(e.hostURL + '/textfile', {
																		method: 'POST',
																		body: '{"file":"' + r.truncation + '"}'
																	}),
																	_ = fetch(b)
																		.then(function(e) {
																			return e.json()
																		})
																		.then(function(e) {
																			if (e.error) throw { message: 'error with truncation file: ' + e.error }
																			var t = parse_trunc(e.text, a, !1)
																			if (t) throw { message: 'error with truncation file: ' + t }
																		})
																o.push(_)
															}
															if (r.itd) {
																var x = new Request(e.hostURL + '/textfile', {
																		method: 'POST',
																		body: '{"file":"' + r.itd + '"}'
																	}),
																	w = fetch(x)
																		.then(function(e) {
																			return e.json()
																		})
																		.then(function(e) {
																			if (e.error) throw { message: 'error with itd file: ' + e.error }
																			var t = parse_itd(e.text, a, !1)
																			if (t) throw { message: 'error with itd file: ' + t }
																		})
																o.push(w)
															}
															var j = Promise.all(o).then(function(n) {
																var o = bulkin({ flag: a, filename: e.name, cohort: t })
																if (o) throw { message: 'Error parsing data from ' + r.name + ': ' + o }
															})
															n.push(j)
														},
														u = e.mutationset[Symbol.iterator]();
													!(r = (i = u.next()).done);
													r = !0
												)
													l()
											} catch (e) {
												;(a = !0), (o = e)
											} finally {
												try {
													!r && u.return && u.return()
												} finally {
													if (a) throw o
												}
											}
											return Promise.all(n).then(function(e) {
												return t
											})
										})
										.then(function(n) {
											var a = (0, _tp.tpinit)(n)
											if (a) throw { message: 'Error parsing study: ' + a }
											r.text(''),
												Promise.all([__webpack_require__.e(0), __webpack_require__.e(1), __webpack_require__.e(5)])
													.then(__webpack_require__.t.bind(null, 65, 7))
													.then(function(r) {
														r.default(n, t, e.hostURL)
													})
										})
										.catch(function(e) {
											r.text(e.message), e.stack && console.log(e.stack)
										})
								}
								function parse_snvindel(e, t) {
									for (var n = e.trim().split(/\r?\n/), r = n[0], a = 0; '#' == r[0]; ) r = n[++a]
									if (!r) return 'no header line'
									var o = bulksnv.parseheader(r, t)
									if (o) return 'header error: ' + o
									for (var i = a + 1; i < n.length; i++) '' != n[i] && '#' != n[i][0] && bulksnv.parseline(i, n[i], t)
								}
								function parse_svjson(e, t) {
									for (var n = e.split(/\r?\n/), r = n[0], a = 0; '#' == r[0]; ) r = n[++a]
									if (!r) return 'no header line'
									var o = bulksvjson.parseheader(r, t),
										i = _slicedToArray(o, 2),
										l = i[0],
										u = i[1]
									if (l) return 'header error: ' + l
									for (var s = a + 1; s < n.length; s++)
										'' != n[s] && '#' != n[s][0] && bulksvjson.parseline(s, n[s], t, u)
								}
								function parse_cnv(e, t) {
									for (var n = e.split(/\r?\n/), r = n[0], a = 0; '#' == r[0]; ) r = n[++a]
									if (!r) return 'no header line'
									var o = bulkcnv.parseheader(r, t)
									if (o) return 'header error: ' + o
									for (var i = a + 1; i < n.length; i++) '' != n[i] && '#' != n[i][0] && bulkcnv.parseline(i, n[i], t)
								}
								function parse_itd(e, t) {
									for (var n = e.split(/\r?\n/), r = n[0], a = 0; '#' == r[0]; ) r = n[++a]
									if (!r) return 'no header line'
									var o = bulkitd.parseheader(r, t)
									if (o) return 'header error: ' + o
									for (var i = a + 1; i < n.length; i++) '' != n[i] && '#' != n[i][0] && bulkitd.parseline(i, n[i], t)
								}
								function parse_del(e, t) {
									for (var n = e.split(/\r?\n/), r = n[0], a = 0; '#' == r[0]; ) r = n[++a]
									if (!r) return 'no header line'
									var o = bulkdel.parseheader(r, t)
									if (o) return 'header error: ' + o
									for (var i = a + 1; i < n.length; i++) '' != n[i] && '#' != n[i][0] && bulkdel.parseline(i, n[i], t)
								}
								function parse_trunc(e, t) {
									for (var n = e.split(/\r?\n/), r = n[0], a = 0; '#' == r[0]; ) r = n[++a]
									if (!r) return 'no header line'
									var o = bulktrunc.parseheader(r, t)
									if (o) return 'header error: ' + o
									for (var i = a + 1; i < n.length; i++) '' != n[i] && '#' != n[i][0] && bulktrunc.parseline(i, n[i], t)
								}
								function parse_sv(e, t, n) {
									for (var r = e.split(/\r?\n/), a = r[0], o = 0; '#' == a[0]; ) a = r[++o]
									if (!a) return 'no header line'
									var i = bulksv.parseheader(a, t, n)
									if (i) return 'header error: ' + i
									for (var l = o + 1; l < r.length; l++) '' != r[l] && '#' != r[l][0] && bulksv.parseline(l, r[l], t, n)
								}
							},
							,
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = n(53)
								Object.defineProperty(t, 'dsvFormat', {
									enumerable: !0,
									get: function() {
										return ((e = r), e && e.__esModule ? e : { default: e }).default
										var e
									}
								})
								var a = n(305)
								Object.defineProperty(t, 'csvParse', {
									enumerable: !0,
									get: function() {
										return a.csvParse
									}
								}),
									Object.defineProperty(t, 'csvParseRows', {
										enumerable: !0,
										get: function() {
											return a.csvParseRows
										}
									}),
									Object.defineProperty(t, 'csvFormat', {
										enumerable: !0,
										get: function() {
											return a.csvFormat
										}
									}),
									Object.defineProperty(t, 'csvFormatRows', {
										enumerable: !0,
										get: function() {
											return a.csvFormatRows
										}
									})
								var o = n(306)
								Object.defineProperty(t, 'tsvParse', {
									enumerable: !0,
									get: function() {
										return o.tsvParse
									}
								}),
									Object.defineProperty(t, 'tsvParseRows', {
										enumerable: !0,
										get: function() {
											return o.tsvParseRows
										}
									}),
									Object.defineProperty(t, 'tsvFormat', {
										enumerable: !0,
										get: function() {
											return o.tsvFormat
										}
									}),
									Object.defineProperty(t, 'tsvFormatRows', {
										enumerable: !0,
										get: function() {
											return o.tsvFormatRows
										}
									})
							},
							,
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return 'string' == typeof e
											? new r.Selection([[document.querySelector(e)]], [document.documentElement])
											: new r.Selection([[e]], r.root)
									})
								var r = n(4)
							},
							function(e, t, n) {
								function r() {
									return []
								}
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return null == e
											? r
											: function() {
													return this.querySelectorAll(e)
											  }
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = function(e) {
									return function() {
										return this.matches(e)
									}
								}
								if ('undefined' != typeof document) {
									var a = document.documentElement
									if (!a.matches) {
										var o = a.webkitMatchesSelector || a.msMatchesSelector || a.mozMatchesSelector || a.oMatchesSelector
										r = function(e) {
											return function() {
												return o.call(this, e)
											}
										}
									}
								}
								t.default = r
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										return new o.Selection(this._enter || this._groups.map(a.default), this._parents)
									}),
									(t.EnterNode = i)
								var r,
									a = (r = n(72)) && r.__esModule ? r : { default: r },
									o = n(4)
								function i(e, t) {
									;(this.ownerDocument = e.ownerDocument),
										(this.namespaceURI = e.namespaceURI),
										(this._next = null),
										(this._parent = e),
										(this.__data__ = t)
								}
								i.prototype = {
									constructor: i,
									appendChild: function(e) {
										return this._parent.insertBefore(e, this._next)
									},
									insertBefore: function(e, t) {
										return this._parent.insertBefore(e, t)
									},
									querySelector: function(e) {
										return this._parent.querySelector(e)
									},
									querySelectorAll: function(e) {
										return this._parent.querySelectorAll(e)
									}
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return new Array(e.length)
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n) {
										return arguments.length > 1
											? this.each((null == t ? o : 'function' == typeof t ? l : i)(e, t, null == n ? '' : n))
											: u(this.node(), e)
									}),
									(t.styleValue = u)
								var r,
									a = (r = n(35)) && r.__esModule ? r : { default: r }
								function o(e) {
									return function() {
										this.style.removeProperty(e)
									}
								}
								function i(e, t, n) {
									return function() {
										this.style.setProperty(e, t, n)
									}
								}
								function l(e, t, n) {
									return function() {
										var r = t.apply(this, arguments)
										null == r ? this.style.removeProperty(e) : this.style.setProperty(e, r, n)
									}
								}
								function u(e, t) {
									return (
										e.style.getPropertyValue(t) ||
										(0, a.default)(e)
											.getComputedStyle(e, null)
											.getPropertyValue(t)
									)
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.bisectLeft = t.bisectRight = void 0)
								var r = a(n(14))
								function a(e) {
									return e && e.__esModule ? e : { default: e }
								}
								var o = (0, a(n(75)).default)(r.default),
									i = (t.bisectRight = o.right)
								;(t.bisectLeft = o.left), (t.default = i)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t
										return (
											1 === e.length &&
												((t = e),
												(e = function(e, n) {
													return (0, a.default)(t(e), n)
												})),
											{
												left: function(t, n, r, a) {
													for (null == r && (r = 0), null == a && (a = t.length); r < a; ) {
														var o = (r + a) >>> 1
														e(t[o], n) < 0 ? (r = o + 1) : (a = o)
													}
													return r
												},
												right: function(t, n, r, a) {
													for (null == r && (r = 0), null == a && (a = t.length); r < a; ) {
														var o = (r + a) >>> 1
														e(t[o], n) > 0 ? (a = o) : (r = o + 1)
													}
													return r
												}
											}
										)
									})
								var r,
									a = (r = n(14)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								function r(e, t) {
									return [e, t]
								}
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										null == t && (t = r)
										for (var n = 0, a = e.length - 1, o = e[0], i = new Array(a < 0 ? 0 : a); n < a; )
											i[n] = t(o, (o = e[++n]))
										return i
									}),
									(t.pair = r)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n = (0, a.default)(e, t)
										return n ? Math.sqrt(n) : n
									})
								var r,
									a = (r = n(78)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n,
											r,
											o = e.length,
											i = 0,
											l = -1,
											u = 0,
											s = 0
										if (null == t)
											for (; ++l < o; ) isNaN((n = (0, a.default)(e[l]))) || (s += (r = n - u) * (n - (u += r / ++i)))
										else
											for (; ++l < o; )
												isNaN((n = (0, a.default)(t(e[l], l, e)))) || (s += (r = n - u) * (n - (u += r / ++i)))
										if (i > 1) return s / (i - 1)
									})
								var r,
									a = (r = n(15)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n,
											r,
											a,
											o = e.length,
											i = -1
										if (null == t) {
											for (; ++i < o; )
												if (null != (n = e[i]) && n >= n)
													for (r = a = n; ++i < o; ) null != (n = e[i]) && (r > n && (r = n), a < n && (a = n))
										} else
											for (; ++i < o; )
												if (null != (n = t(e[i], i, e)) && n >= n)
													for (r = a = n; ++i < o; ) null != (n = t(e[i], i, e)) && (r > n && (r = n), a < n && (a = n))
										return [r, a]
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = Array.prototype
								;(t.slice = r.slice), (t.map = r.map)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n) {
										;(e = +e), (t = +t), (n = (a = arguments.length) < 2 ? ((t = e), (e = 0), 1) : a < 3 ? 1 : +n)
										for (var r = -1, a = 0 | Math.max(0, Math.ceil((t - e) / n)), o = new Array(a); ++r < a; )
											o[r] = e + r * n
										return o
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n) {
										var r,
											a,
											o,
											l,
											u = -1
										if (((n = +n), (e = +e) == (t = +t) && n > 0)) return [e]
										if (((r = t < e) && ((a = e), (e = t), (t = a)), 0 === (l = i(e, t, n)) || !isFinite(l))) return []
										if (l > 0)
											for (
												e = Math.ceil(e / l), t = Math.floor(t / l), o = new Array((a = Math.ceil(t - e + 1)));
												++u < a;

											)
												o[u] = (e + u) * l
										else
											for (
												e = Math.floor(e * l), t = Math.ceil(t * l), o = new Array((a = Math.ceil(e - t + 1)));
												++u < a;

											)
												o[u] = (e - u) / l
										return r && o.reverse(), o
									}),
									(t.tickIncrement = i),
									(t.tickStep = function(e, t, n) {
										var i = Math.abs(t - e) / Math.max(0, n),
											l = Math.pow(10, Math.floor(Math.log(i) / Math.LN10)),
											u = i / l
										return u >= r ? (l *= 10) : u >= a ? (l *= 5) : u >= o && (l *= 2), t < e ? -l : l
									})
								var r = Math.sqrt(50),
									a = Math.sqrt(10),
									o = Math.sqrt(2)
								function i(e, t, n) {
									var i = (t - e) / Math.max(0, n),
										l = Math.floor(Math.log(i) / Math.LN10),
										u = i / Math.pow(10, l)
									return l >= 0
										? (u >= r ? 10 : u >= a ? 5 : u >= o ? 2 : 1) * Math.pow(10, l)
										: -Math.pow(10, -l) / (u >= r ? 10 : u >= a ? 5 : u >= o ? 2 : 1)
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return Math.ceil(Math.log(e.length) / Math.LN2) + 1
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n,
											r,
											a = e.length,
											o = -1
										if (null == t) {
											for (; ++o < a; )
												if (null != (n = e[o]) && n >= n) for (r = n; ++o < a; ) null != (n = e[o]) && r > n && (r = n)
										} else
											for (; ++o < a; )
												if (null != (n = t(e[o], o, e)) && n >= n)
													for (r = n; ++o < a; ) null != (n = t(e[o], o, e)) && r > n && (r = n)
										return r
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										if (!(i = e.length)) return []
										for (var t = -1, n = (0, a.default)(e, o), r = new Array(n); ++t < n; )
											for (var i, l = -1, u = (r[t] = new Array(i)); ++l < i; ) u[l] = e[l][t]
										return r
									})
								var r,
									a = (r = n(84)) && r.__esModule ? r : { default: r }
								function o(e) {
									return e.length
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.implicit = void 0),
									(t.default = function e(t) {
										var n = (0, r.map)(),
											i = [],
											l = o
										function u(e) {
											var r = e + '',
												a = n.get(r)
											if (!a) {
												if (l !== o) return l
												n.set(r, (a = i.push(e)))
											}
											return t[(a - 1) % t.length]
										}
										return (
											(t = null == t ? [] : a.slice.call(t)),
											(u.domain = function(e) {
												if (!arguments.length) return i.slice()
												;(i = []), (n = (0, r.map)())
												for (var t, a, o = -1, l = e.length; ++o < l; )
													n.has((a = (t = e[o]) + '')) || n.set(a, i.push(t))
												return u
											}),
											(u.range = function(e) {
												return arguments.length ? ((t = a.slice.call(e)), u) : t.slice()
											}),
											(u.unknown = function(e) {
												return arguments.length ? ((l = e), u) : l
											}),
											(u.copy = function() {
												return e()
													.domain(i)
													.range(t)
													.unknown(l)
											}),
											u
										)
									})
								var r = n(60),
									a = n(12),
									o = (t.implicit = { name: 'implicit' })
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.deg2rad = Math.PI / 180),
									(t.rad2deg = 180 / Math.PI)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.rgbBasisClosed = t.rgbBasis = void 0)
								var r = n(3),
									a = u(n(43)),
									o = u(n(89)),
									i = n(17),
									l = u(i)
								function u(e) {
									return e && e.__esModule ? e : { default: e }
								}
								function s(e) {
									return function(t) {
										var n,
											a,
											o = t.length,
											i = new Array(o),
											l = new Array(o),
											u = new Array(o)
										for (n = 0; n < o; ++n)
											(a = (0, r.rgb)(t[n])), (i[n] = a.r || 0), (l[n] = a.g || 0), (u[n] = a.b || 0)
										return (
											(i = e(i)),
											(l = e(l)),
											(u = e(u)),
											(a.opacity = 1),
											function(e) {
												return (a.r = i(e)), (a.g = l(e)), (a.b = u(e)), a + ''
											}
										)
									}
								}
								;(t.default = (function e(t) {
									var n = (0, i.gamma)(t)
									function a(e, t) {
										var a = n((e = (0, r.rgb)(e)).r, (t = (0, r.rgb)(t)).r),
											o = n(e.g, t.g),
											i = n(e.b, t.b),
											u = (0, l.default)(e.opacity, t.opacity)
										return function(t) {
											return (e.r = a(t)), (e.g = o(t)), (e.b = i(t)), (e.opacity = u(t)), e + ''
										}
									}
									return (a.gamma = e), a
								})(1)),
									(t.rgbBasis = s(a.default)),
									(t.rgbBasisClosed = s(o.default))
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t = e.length
										return function(n) {
											var a = Math.floor(((n %= 1) < 0 ? ++n : n) * t),
												o = e[(a + t - 1) % t],
												i = e[a % t],
												l = e[(a + 1) % t],
												u = e[(a + 2) % t]
											return (0, r.basis)((n - a / t) * t, o, i, l, u)
										}
									})
								var r = n(43)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return function() {
											return e
										}
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n,
											r = t ? t.length : 0,
											o = e ? Math.min(r, e.length) : 0,
											i = new Array(o),
											l = new Array(r)
										for (n = 0; n < o; ++n) i[n] = (0, a.default)(e[n], t[n])
										for (; n < r; ++n) l[n] = t[n]
										return function(e) {
											for (n = 0; n < o; ++n) l[n] = i[n](e)
											return l
										}
									})
								var r,
									a = (r = n(40)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n = new Date()
										return (
											(t -= e = +e),
											function(r) {
												return n.setTime(e + t * r), n
											}
										)
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r =
									'function' == typeof Symbol && 'symbol' == _typeof2(Symbol.iterator)
										? function(e) {
												return void 0 === e ? 'undefined' : _typeof2(e)
										  }
										: function(e) {
												return e && 'function' == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype
													? 'symbol'
													: void 0 === e
													? 'undefined'
													: _typeof2(e)
										  }
								t.default = function(e, t) {
									var n,
										a = {},
										i = {}
									for (n in ((null !== e && 'object' === (void 0 === e ? 'undefined' : r(e))) || (e = {}),
									(null !== t && 'object' === (void 0 === t ? 'undefined' : r(t))) || (t = {}),
									t))
										n in e ? (a[n] = (0, o.default)(e[n], t[n])) : (i[n] = t[n])
									return function(e) {
										for (n in a) i[n] = a[n](e)
										return i
									}
								}
								var a,
									o = (a = n(40)) && a.__esModule ? a : { default: a }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n,
											r,
											l,
											u = (o.lastIndex = i.lastIndex = 0),
											s = -1,
											f = [],
											c = []
										for (e += '', t += ''; (n = o.exec(e)) && (r = i.exec(t)); )
											(l = r.index) > u && ((l = t.slice(u, l)), f[s] ? (f[s] += l) : (f[++s] = l)),
												(n = n[0]) === (r = r[0])
													? f[s]
														? (f[s] += r)
														: (f[++s] = r)
													: ((f[++s] = null), c.push({ i: s, x: (0, a.default)(n, r) })),
												(u = i.lastIndex)
										return (
											u < t.length && ((l = t.slice(u)), f[s] ? (f[s] += l) : (f[++s] = l)),
											f.length < 2
												? c[0]
													? (function(e) {
															return function(t) {
																return e(t) + ''
															}
													  })(c[0].x)
													: (function(e) {
															return function() {
																return e
															}
													  })(t)
												: ((t = c.length),
												  function(e) {
														for (var n, r = 0; r < t; ++r) f[(n = c[r]).i] = n.x(e)
														return f.join('')
												  })
										)
									})
								var r,
									a = (r = n(23)) && r.__esModule ? r : { default: r },
									o = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,
									i = new RegExp(o.source, 'g')
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return +e
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t = e.grouping && e.thousands ? (0, a.default)(e.grouping, e.thousands) : s.default,
											n = e.currency,
											f = e.decimal,
											d = e.numerals ? (0, o.default)(e.numerals) : s.default,
											p = e.percent || '%'
										function h(e) {
											var r = (e = (0, i.default)(e)).fill,
												a = e.align,
												o = e.sign,
												s = e.symbol,
												h = e.zero,
												v = e.width,
												m = e.comma,
												y = e.precision,
												g = e.type,
												b = '$' === s ? n[0] : '#' === s && /[boxX]/.test(g) ? '0' + g.toLowerCase() : '',
												_ = '$' === s ? n[1] : /[%p]/.test(g) ? p : '',
												x = l.default[g],
												w = !g || /[defgprs%]/.test(g)
											function j(e) {
												var n,
													i,
													l,
													s = b,
													p = _
												if ('c' === g) (p = x(e) + p), (e = '')
												else {
													var j = (e = +e) < 0
													if (
														((e = x(Math.abs(e), y)),
														j && 0 == +e && (j = !1),
														(s = (j ? ('(' === o ? o : '-') : '-' === o || '(' === o ? '' : o) + s),
														(p = ('s' === g ? c[8 + u.prefixExponent / 3] : '') + p + (j && '(' === o ? ')' : '')),
														w)
													)
														for (n = -1, i = e.length; ++n < i; )
															if (48 > (l = e.charCodeAt(n)) || l > 57) {
																;(p = (46 === l ? f + e.slice(n + 1) : e.slice(n)) + p), (e = e.slice(0, n))
																break
															}
												}
												m && !h && (e = t(e, 1 / 0))
												var k = s.length + e.length + p.length,
													O = k < v ? new Array(v - k + 1).join(r) : ''
												switch ((m && h && ((e = t(O + e, O.length ? v - p.length : 1 / 0)), (O = '')), a)) {
													case '<':
														e = s + e + p + O
														break
													case '=':
														e = s + O + e + p
														break
													case '^':
														e = O.slice(0, (k = O.length >> 1)) + s + e + p + O.slice(k)
														break
													default:
														e = O + s + e + p
												}
												return d(e)
											}
											return (
												(y =
													null == y
														? g
															? 6
															: 12
														: /[gprs]/.test(g)
														? Math.max(1, Math.min(21, y))
														: Math.max(0, Math.min(20, y))),
												(j.toString = function() {
													return e + ''
												}),
												j
											)
										}
										return {
											format: h,
											formatPrefix: function(e, t) {
												var n = h((((e = (0, i.default)(e)).type = 'f'), e)),
													a = 3 * Math.max(-8, Math.min(8, Math.floor((0, r.default)(t) / 3))),
													o = Math.pow(10, -a),
													l = c[8 + a / 3]
												return function(e) {
													return n(o * e) + l
												}
											}
										}
									})
								var r = f(n(25)),
									a = f(n(198)),
									o = f(n(199)),
									i = f(n(97)),
									l = f(n(98)),
									u = n(99),
									s = f(n(202))
								function f(e) {
									return e && e.__esModule ? e : { default: e }
								}
								var c = ['y', 'z', 'a', 'f', 'p', 'n', 'µ', 'm', '', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.default = i)
								var r,
									a = (r = n(98)) && r.__esModule ? r : { default: r },
									o = /^(?:(.)?([<>=^]))?([+\-\( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?([a-z%])?$/i
								function i(e) {
									return new l(e)
								}
								function l(e) {
									if (!(t = o.exec(e))) throw new Error('invalid format: ' + e)
									var t,
										n = t[1] || ' ',
										r = t[2] || '>',
										i = t[3] || '-',
										l = t[4] || '',
										u = !!t[5],
										s = t[6] && +t[6],
										f = !!t[7],
										c = t[8] && +t[8].slice(1),
										d = t[9] || ''
									'n' === d ? ((f = !0), (d = 'g')) : a.default[d] || (d = ''),
										(u || ('0' === n && '=' === r)) && ((u = !0), (n = '0'), (r = '=')),
										(this.fill = n),
										(this.align = r),
										(this.sign = i),
										(this.symbol = l),
										(this.zero = u),
										(this.width = s),
										(this.comma = f),
										(this.precision = c),
										(this.type = d)
								}
								;(i.prototype = l.prototype),
									(l.prototype.toString = function() {
										return (
											this.fill +
											this.align +
											this.sign +
											this.symbol +
											(this.zero ? '0' : '') +
											(null == this.width ? '' : Math.max(1, 0 | this.width)) +
											(this.comma ? ',' : '') +
											(null == this.precision ? '' : '.' + Math.max(0, 0 | this.precision)) +
											this.type
										)
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = i(n(200)),
									a = i(n(99)),
									o = i(n(201))
								function i(e) {
									return e && e.__esModule ? e : { default: e }
								}
								t.default = {
									'': r.default,
									'%': function(e, t) {
										return (100 * e).toFixed(t)
									},
									b: function(e) {
										return Math.round(e).toString(2)
									},
									c: function(e) {
										return e + ''
									},
									d: function(e) {
										return Math.round(e).toString(10)
									},
									e: function(e, t) {
										return e.toExponential(t)
									},
									f: function(e, t) {
										return e.toFixed(t)
									},
									g: function(e, t) {
										return e.toPrecision(t)
									},
									o: function(e) {
										return Math.round(e).toString(8)
									},
									p: function(e, t) {
										return (0, o.default)(100 * e, t)
									},
									r: o.default,
									s: a.default,
									X: function(e) {
										return Math.round(e)
											.toString(16)
											.toUpperCase()
									},
									x: function(e) {
										return Math.round(e).toString(16)
									}
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.prefixExponent = void 0),
									(t.default = function(e, n) {
										var r = (0, a.default)(e, n)
										if (!r) return e + ''
										var o = r[0],
											i = r[1],
											l = i - (t.prefixExponent = 3 * Math.max(-8, Math.min(8, Math.floor(i / 3)))) + 1,
											u = o.length
										return l === u
											? o
											: l > u
											? o + new Array(l - u + 1).join('0')
											: l > 0
											? o.slice(0, l) + '.' + o.slice(l)
											: '0.' + new Array(1 - l).join('0') + (0, a.default)(e, Math.max(0, n + l - 1))[0]
									})
								var r,
									a = (r = n(45)) && r.__esModule ? r : { default: r }
								t.prefixExponent = void 0
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n,
											r = 0,
											a = (e = e.slice()).length - 1,
											o = e[r],
											i = e[a]
										return (
											i < o && ((n = r), (r = a), (a = n), (n = o), (o = i), (i = n)),
											(e[r] = t.floor(o)),
											(e[a] = t.ceil(i)),
											e
										)
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.calendar = h),
									(t.default = function() {
										return h(
											o.timeYear,
											o.timeMonth,
											o.timeWeek,
											o.timeDay,
											o.timeHour,
											o.timeMinute,
											o.timeSecond,
											o.timeMillisecond,
											i.timeFormat
										).domain([new Date(2e3, 0, 1), new Date(2e3, 0, 2)])
									})
								var r = n(7),
									a = n(9),
									o = n(30),
									i = n(62),
									l = n(12),
									u = n(24),
									s = c(u),
									f = c(n(100))
								function c(e) {
									return e && e.__esModule ? e : { default: e }
								}
								function d(e) {
									return new Date(e)
								}
								function p(e) {
									return e instanceof Date ? +e : +new Date(+e)
								}
								function h(e, t, n, o, i, c, v, m, y) {
									var g = (0, s.default)(u.deinterpolateLinear, a.interpolateNumber),
										b = g.invert,
										_ = g.domain,
										x = y('.%L'),
										w = y(':%S'),
										j = y('%I:%M'),
										k = y('%I %p'),
										O = y('%a %d'),
										M = y('%b %d'),
										P = y('%B'),
										S = y('%Y'),
										A = [
											[v, 1, 1e3],
											[v, 5, 5e3],
											[v, 15, 15e3],
											[v, 30, 3e4],
											[c, 1, 6e4],
											[c, 5, 3e5],
											[c, 15, 9e5],
											[c, 30, 18e5],
											[i, 1, 36e5],
											[i, 3, 108e5],
											[i, 6, 216e5],
											[i, 12, 432e5],
											[o, 1, 864e5],
											[o, 2, 1728e5],
											[n, 1, 6048e5],
											[t, 1, 2592e6],
											[t, 3, 7776e6],
											[e, 1, 31536e6]
										]
									function C(r) {
										return (v(r) < r
											? x
											: c(r) < r
											? w
											: i(r) < r
											? j
											: o(r) < r
											? k
											: t(r) < r
											? n(r) < r
												? O
												: M
											: e(r) < r
											? P
											: S)(r)
									}
									function N(t, n, a, o) {
										if ((null == t && (t = 10), 'number' == typeof t)) {
											var i = Math.abs(a - n) / t,
												l = (0, r.bisector)(function(e) {
													return e[2]
												}).right(A, i)
											l === A.length
												? ((o = (0, r.tickStep)(n / 31536e6, a / 31536e6, t)), (t = e))
												: l
												? ((o = (l = A[i / A[l - 1][2] < A[l][2] / i ? l - 1 : l])[1]), (t = l[0]))
												: ((o = Math.max((0, r.tickStep)(n, a, t), 1)), (t = m))
										}
										return null == o ? t : t.every(o)
									}
									return (
										(g.invert = function(e) {
											return new Date(b(e))
										}),
										(g.domain = function(e) {
											return arguments.length ? _(l.map.call(e, p)) : _().map(d)
										}),
										(g.ticks = function(e, t) {
											var n,
												r = _(),
												a = r[0],
												o = r[r.length - 1],
												i = o < a
											return (
												i && ((n = a), (a = o), (o = n)),
												(n = (n = N(e, a, o, t)) ? n.range(a, o + 1) : []),
												i ? n.reverse() : n
											)
										}),
										(g.tickFormat = function(e, t) {
											return null == t ? C : y(t)
										}),
										(g.nice = function(e, t) {
											var n = _()
											return (e = N(e, n[0], n[n.length - 1], t)) ? _((0, f.default)(n, e)) : g
										}),
										(g.copy = function() {
											return (0, u.copy)(g, h(e, t, n, o, i, c, v, m, y))
										}),
										g
									)
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t = e.dateTime,
											n = e.date,
											u = e.time,
											s = e.periods,
											f = e.days,
											c = e.shortDays,
											d = e.months,
											ye = e.shortMonths,
											ge = p(s),
											be = h(s),
											_e = p(f),
											xe = h(f),
											we = p(c),
											je = h(c),
											ke = p(d),
											Oe = h(d),
											Me = p(ye),
											Pe = h(ye),
											Se = {
												a: function(e) {
													return c[e.getDay()]
												},
												A: function(e) {
													return f[e.getDay()]
												},
												b: function(e) {
													return ye[e.getMonth()]
												},
												B: function(e) {
													return d[e.getMonth()]
												},
												c: null,
												d: I,
												e: I,
												f: q,
												H: R,
												I: L,
												j: D,
												L: F,
												m: U,
												M: G,
												p: function(e) {
													return s[+(e.getHours() >= 12)]
												},
												Q: ve,
												s: me,
												S: z,
												u: B,
												U: Y,
												V: V,
												w: H,
												W: W,
												x: null,
												X: null,
												y: X,
												Y: J,
												Z: K,
												'%': he
											},
											Ae = {
												a: function(e) {
													return c[e.getUTCDay()]
												},
												A: function(e) {
													return f[e.getUTCDay()]
												},
												b: function(e) {
													return ye[e.getUTCMonth()]
												},
												B: function(e) {
													return d[e.getUTCMonth()]
												},
												c: null,
												d: Z,
												e: Z,
												f: ne,
												H: $,
												I: Q,
												j: ee,
												L: te,
												m: re,
												M: ae,
												p: function(e) {
													return s[+(e.getUTCHours() >= 12)]
												},
												Q: ve,
												s: me,
												S: oe,
												u: ie,
												U: le,
												V: ue,
												w: se,
												W: fe,
												x: null,
												X: null,
												y: ce,
												Y: de,
												Z: pe,
												'%': he
											},
											Ce = {
												a: function(e, t, n) {
													var r = we.exec(t.slice(n))
													return r ? ((e.w = je[r[0].toLowerCase()]), n + r[0].length) : -1
												},
												A: function(e, t, n) {
													var r = _e.exec(t.slice(n))
													return r ? ((e.w = xe[r[0].toLowerCase()]), n + r[0].length) : -1
												},
												b: function(e, t, n) {
													var r = Me.exec(t.slice(n))
													return r ? ((e.m = Pe[r[0].toLowerCase()]), n + r[0].length) : -1
												},
												B: function(e, t, n) {
													var r = ke.exec(t.slice(n))
													return r ? ((e.m = Oe[r[0].toLowerCase()]), n + r[0].length) : -1
												},
												c: function(e, n, r) {
													return Ee(e, t, n, r)
												},
												d: k,
												e: k,
												f: C,
												H: M,
												I: M,
												j: O,
												L: A,
												m: j,
												M: P,
												p: function(e, t, n) {
													var r = ge.exec(t.slice(n))
													return r ? ((e.p = be[r[0].toLowerCase()]), n + r[0].length) : -1
												},
												Q: T,
												s: E,
												S: S,
												u: m,
												U: y,
												V: g,
												w: v,
												W: b,
												x: function(e, t, r) {
													return Ee(e, n, t, r)
												},
												X: function(e, t, n) {
													return Ee(e, u, t, n)
												},
												y: x,
												Y: _,
												Z: w,
												'%': N
											}
										function Ne(e, t) {
											return function(n) {
												var r,
													a,
													o,
													i = [],
													u = -1,
													s = 0,
													f = e.length
												for (n instanceof Date || (n = new Date(+n)); ++u < f; )
													37 === e.charCodeAt(u) &&
														(i.push(e.slice(s, u)),
														null != (a = l[(r = e.charAt(++u))]) ? (r = e.charAt(++u)) : (a = 'e' === r ? ' ' : '0'),
														(o = t[r]) && (r = o(n, a)),
														i.push(r),
														(s = u + 1))
												return i.push(e.slice(s, u)), i.join('')
											}
										}
										function Te(e, t) {
											return function(n) {
												var a,
													l,
													u = i(1900)
												if (Ee(u, e, (n += ''), 0) != n.length) return null
												if ('Q' in u) return new Date(u.Q)
												if (('p' in u && (u.H = (u.H % 12) + 12 * u.p), 'V' in u)) {
													if (u.V < 1 || u.V > 53) return null
													'w' in u || (u.w = 1),
														'Z' in u
															? ((l = (a = o(i(u.y))).getUTCDay()),
															  (a = l > 4 || 0 === l ? r.utcMonday.ceil(a) : (0, r.utcMonday)(a)),
															  (a = r.utcDay.offset(a, 7 * (u.V - 1))),
															  (u.y = a.getUTCFullYear()),
															  (u.m = a.getUTCMonth()),
															  (u.d = a.getUTCDate() + ((u.w + 6) % 7)))
															: ((l = (a = t(i(u.y))).getDay()),
															  (a = l > 4 || 0 === l ? r.timeMonday.ceil(a) : (0, r.timeMonday)(a)),
															  (a = r.timeDay.offset(a, 7 * (u.V - 1))),
															  (u.y = a.getFullYear()),
															  (u.m = a.getMonth()),
															  (u.d = a.getDate() + ((u.w + 6) % 7)))
												} else
													('W' in u || 'U' in u) &&
														('w' in u || (u.w = 'u' in u ? u.u % 7 : 'W' in u ? 1 : 0),
														(l = 'Z' in u ? o(i(u.y)).getUTCDay() : t(i(u.y)).getDay()),
														(u.m = 0),
														(u.d =
															'W' in u ? ((u.w + 6) % 7) + 7 * u.W - ((l + 5) % 7) : u.w + 7 * u.U - ((l + 6) % 7)))
												return 'Z' in u ? ((u.H += (u.Z / 100) | 0), (u.M += u.Z % 100), o(u)) : t(u)
											}
										}
										function Ee(e, t, n, r) {
											for (var a, o, i = 0, u = t.length, s = n.length; i < u; ) {
												if (r >= s) return -1
												if (37 === (a = t.charCodeAt(i++))) {
													if (((a = t.charAt(i++)), !(o = Ce[a in l ? t.charAt(i++) : a]) || (r = o(e, n, r)) < 0))
														return -1
												} else if (a != n.charCodeAt(r++)) return -1
											}
											return r
										}
										return (
											(Se.x = Ne(n, Se)),
											(Se.X = Ne(u, Se)),
											(Se.c = Ne(t, Se)),
											(Ae.x = Ne(n, Ae)),
											(Ae.X = Ne(u, Ae)),
											(Ae.c = Ne(t, Ae)),
											{
												format: function(e) {
													var t = Ne((e += ''), Se)
													return (
														(t.toString = function() {
															return e
														}),
														t
													)
												},
												parse: function(e) {
													var t = Te((e += ''), a)
													return (
														(t.toString = function() {
															return e
														}),
														t
													)
												},
												utcFormat: function(e) {
													var t = Ne((e += ''), Ae)
													return (
														(t.toString = function() {
															return e
														}),
														t
													)
												},
												utcParse: function(e) {
													var t = Te(e, o)
													return (
														(t.toString = function() {
															return e
														}),
														t
													)
												}
											}
										)
									})
								var r = n(30)
								function a(e) {
									if (0 <= e.y && e.y < 100) {
										var t = new Date(-1, e.m, e.d, e.H, e.M, e.S, e.L)
										return t.setFullYear(e.y), t
									}
									return new Date(e.y, e.m, e.d, e.H, e.M, e.S, e.L)
								}
								function o(e) {
									if (0 <= e.y && e.y < 100) {
										var t = new Date(Date.UTC(-1, e.m, e.d, e.H, e.M, e.S, e.L))
										return t.setUTCFullYear(e.y), t
									}
									return new Date(Date.UTC(e.y, e.m, e.d, e.H, e.M, e.S, e.L))
								}
								function i(e) {
									return { y: e, m: 0, d: 1, H: 0, M: 0, S: 0, L: 0 }
								}
								var l = { '-': '', _: ' ', 0: '0' },
									u = /^\s*\d+/,
									s = /^%/,
									f = /[\\^$*+?|[\]().{}]/g
								function c(e, t, n) {
									var r = e < 0 ? '-' : '',
										a = (r ? -e : e) + '',
										o = a.length
									return r + (o < n ? new Array(n - o + 1).join(t) + a : a)
								}
								function d(e) {
									return e.replace(f, '\\$&')
								}
								function p(e) {
									return new RegExp('^(?:' + e.map(d).join('|') + ')', 'i')
								}
								function h(e) {
									for (var t = {}, n = -1, r = e.length; ++n < r; ) t[e[n].toLowerCase()] = n
									return t
								}
								function v(e, t, n) {
									var r = u.exec(t.slice(n, n + 1))
									return r ? ((e.w = +r[0]), n + r[0].length) : -1
								}
								function m(e, t, n) {
									var r = u.exec(t.slice(n, n + 1))
									return r ? ((e.u = +r[0]), n + r[0].length) : -1
								}
								function y(e, t, n) {
									var r = u.exec(t.slice(n, n + 2))
									return r ? ((e.U = +r[0]), n + r[0].length) : -1
								}
								function g(e, t, n) {
									var r = u.exec(t.slice(n, n + 2))
									return r ? ((e.V = +r[0]), n + r[0].length) : -1
								}
								function b(e, t, n) {
									var r = u.exec(t.slice(n, n + 2))
									return r ? ((e.W = +r[0]), n + r[0].length) : -1
								}
								function _(e, t, n) {
									var r = u.exec(t.slice(n, n + 4))
									return r ? ((e.y = +r[0]), n + r[0].length) : -1
								}
								function x(e, t, n) {
									var r = u.exec(t.slice(n, n + 2))
									return r ? ((e.y = +r[0] + (+r[0] > 68 ? 1900 : 2e3)), n + r[0].length) : -1
								}
								function w(e, t, n) {
									var r = /^(Z)|([+-]\d\d)(?::?(\d\d))?/.exec(t.slice(n, n + 6))
									return r ? ((e.Z = r[1] ? 0 : -(r[2] + (r[3] || '00'))), n + r[0].length) : -1
								}
								function j(e, t, n) {
									var r = u.exec(t.slice(n, n + 2))
									return r ? ((e.m = r[0] - 1), n + r[0].length) : -1
								}
								function k(e, t, n) {
									var r = u.exec(t.slice(n, n + 2))
									return r ? ((e.d = +r[0]), n + r[0].length) : -1
								}
								function O(e, t, n) {
									var r = u.exec(t.slice(n, n + 3))
									return r ? ((e.m = 0), (e.d = +r[0]), n + r[0].length) : -1
								}
								function M(e, t, n) {
									var r = u.exec(t.slice(n, n + 2))
									return r ? ((e.H = +r[0]), n + r[0].length) : -1
								}
								function P(e, t, n) {
									var r = u.exec(t.slice(n, n + 2))
									return r ? ((e.M = +r[0]), n + r[0].length) : -1
								}
								function S(e, t, n) {
									var r = u.exec(t.slice(n, n + 2))
									return r ? ((e.S = +r[0]), n + r[0].length) : -1
								}
								function A(e, t, n) {
									var r = u.exec(t.slice(n, n + 3))
									return r ? ((e.L = +r[0]), n + r[0].length) : -1
								}
								function C(e, t, n) {
									var r = u.exec(t.slice(n, n + 6))
									return r ? ((e.L = Math.floor(r[0] / 1e3)), n + r[0].length) : -1
								}
								function N(e, t, n) {
									var r = s.exec(t.slice(n, n + 1))
									return r ? n + r[0].length : -1
								}
								function T(e, t, n) {
									var r = u.exec(t.slice(n))
									return r ? ((e.Q = +r[0]), n + r[0].length) : -1
								}
								function E(e, t, n) {
									var r = u.exec(t.slice(n))
									return r ? ((e.Q = 1e3 * +r[0]), n + r[0].length) : -1
								}
								function I(e, t) {
									return c(e.getDate(), t, 2)
								}
								function R(e, t) {
									return c(e.getHours(), t, 2)
								}
								function L(e, t) {
									return c(e.getHours() % 12 || 12, t, 2)
								}
								function D(e, t) {
									return c(1 + r.timeDay.count((0, r.timeYear)(e), e), t, 3)
								}
								function F(e, t) {
									return c(e.getMilliseconds(), t, 3)
								}
								function q(e, t) {
									return F(e, t) + '000'
								}
								function U(e, t) {
									return c(e.getMonth() + 1, t, 2)
								}
								function G(e, t) {
									return c(e.getMinutes(), t, 2)
								}
								function z(e, t) {
									return c(e.getSeconds(), t, 2)
								}
								function B(e) {
									var t = e.getDay()
									return 0 === t ? 7 : t
								}
								function Y(e, t) {
									return c(r.timeSunday.count((0, r.timeYear)(e), e), t, 2)
								}
								function V(e, t) {
									var n = e.getDay()
									return (
										(e = n >= 4 || 0 === n ? (0, r.timeThursday)(e) : r.timeThursday.ceil(e)),
										c(r.timeThursday.count((0, r.timeYear)(e), e) + (4 === (0, r.timeYear)(e).getDay()), t, 2)
									)
								}
								function H(e) {
									return e.getDay()
								}
								function W(e, t) {
									return c(r.timeMonday.count((0, r.timeYear)(e), e), t, 2)
								}
								function X(e, t) {
									return c(e.getFullYear() % 100, t, 2)
								}
								function J(e, t) {
									return c(e.getFullYear() % 1e4, t, 4)
								}
								function K(e) {
									var t = e.getTimezoneOffset()
									return (t > 0 ? '-' : ((t *= -1), '+')) + c((t / 60) | 0, '0', 2) + c(t % 60, '0', 2)
								}
								function Z(e, t) {
									return c(e.getUTCDate(), t, 2)
								}
								function $(e, t) {
									return c(e.getUTCHours(), t, 2)
								}
								function Q(e, t) {
									return c(e.getUTCHours() % 12 || 12, t, 2)
								}
								function ee(e, t) {
									return c(1 + r.utcDay.count((0, r.utcYear)(e), e), t, 3)
								}
								function te(e, t) {
									return c(e.getUTCMilliseconds(), t, 3)
								}
								function ne(e, t) {
									return te(e, t) + '000'
								}
								function re(e, t) {
									return c(e.getUTCMonth() + 1, t, 2)
								}
								function ae(e, t) {
									return c(e.getUTCMinutes(), t, 2)
								}
								function oe(e, t) {
									return c(e.getUTCSeconds(), t, 2)
								}
								function ie(e) {
									var t = e.getUTCDay()
									return 0 === t ? 7 : t
								}
								function le(e, t) {
									return c(r.utcSunday.count((0, r.utcYear)(e), e), t, 2)
								}
								function ue(e, t) {
									var n = e.getUTCDay()
									return (
										(e = n >= 4 || 0 === n ? (0, r.utcThursday)(e) : r.utcThursday.ceil(e)),
										c(r.utcThursday.count((0, r.utcYear)(e), e) + (4 === (0, r.utcYear)(e).getUTCDay()), t, 2)
									)
								}
								function se(e) {
									return e.getUTCDay()
								}
								function fe(e, t) {
									return c(r.utcMonday.count((0, r.utcYear)(e), e), t, 2)
								}
								function ce(e, t) {
									return c(e.getUTCFullYear() % 100, t, 2)
								}
								function de(e, t) {
									return c(e.getUTCFullYear() % 1e4, t, 4)
								}
								function pe() {
									return '+0000'
								}
								function he() {
									return '%'
								}
								function ve(e) {
									return +e
								}
								function me(e) {
									return Math.floor(+e / 1e3)
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.isoSpecifier = void 0)
								var r = n(46),
									a = (t.isoSpecifier = '%Y-%m-%dT%H:%M:%S.%LZ'),
									o = Date.prototype.toISOString
										? function(e) {
												return e.toISOString()
										  }
										: (0, r.utcFormat)(a)
								t.default = o
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n
										return ('number' == typeof t
											? a.interpolateNumber
											: t instanceof r.color
											? a.interpolateRgb
											: (n = (0, r.color)(t))
											? ((t = n), a.interpolateRgb)
											: a.interpolateString)(e, t)
									})
								var r = n(3),
									a = n(9)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n,
											a,
											o,
											i = e.__transition,
											l = !0
										if (i) {
											for (o in ((t = null == t ? null : t + ''), i))
												(n = i[o]).name === t
													? ((a = n.state > r.STARTING && n.state < r.ENDING),
													  (n.state = r.ENDED),
													  n.timer.stop(),
													  a && n.on.call('interrupt', e, e.__data__, n.index, n.group),
													  delete i[o])
													: (l = !1)
											l && delete e.__transition
										}
									})
								var r = n(5)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.packEnclose = s),
									(t.default = function(e) {
										return s(e), e
									})
								var r,
									a = (r = n(107)) && r.__esModule ? r : { default: r }
								function o(e, t, n) {
									var r = e.x,
										a = e.y,
										o = t.r + n.r,
										i = e.r + n.r,
										l = t.x - r,
										u = t.y - a,
										s = l * l + u * u
									if (s) {
										var f = 0.5 + ((i *= i) - (o *= o)) / (2 * s),
											c = Math.sqrt(Math.max(0, 2 * o * (i + s) - (i -= s) * i - o * o)) / (2 * s)
										;(n.x = r + f * l + c * u), (n.y = a + f * u - c * l)
									} else (n.x = r + i), (n.y = a)
								}
								function i(e, t) {
									var n = t.x - e.x,
										r = t.y - e.y,
										a = e.r + t.r
									return a * a - 1e-6 > n * n + r * r
								}
								function l(e) {
									var t = e._,
										n = e.next._,
										r = t.r + n.r,
										a = (t.x * n.r + n.x * t.r) / r,
										o = (t.y * n.r + n.y * t.r) / r
									return a * a + o * o
								}
								function u(e) {
									;(this._ = e), (this.next = null), (this.previous = null)
								}
								function s(e) {
									if (!(s = e.length)) return 0
									var t, n, r, s, f, c, d, p, h, v, m
									if ((((t = e[0]).x = 0), (t.y = 0), !(s > 1))) return t.r
									if (((n = e[1]), (t.x = -n.r), (n.x = t.r), (n.y = 0), !(s > 2))) return t.r + n.r
									o(n, t, (r = e[2])),
										(t = new u(t)),
										(n = new u(n)),
										(r = new u(r)),
										(t.next = r.previous = n),
										(n.next = t.previous = r),
										(r.next = n.previous = t)
									e: for (d = 3; d < s; ++d) {
										o(t._, n._, (r = e[d])), (r = new u(r)), (p = n.next), (h = t.previous), (v = n._.r), (m = t._.r)
										do {
											if (v <= m) {
												if (i(p._, r._)) {
													;(n = p), (t.next = n), (n.previous = t), --d
													continue e
												}
												;(v += p._.r), (p = p.next)
											} else {
												if (i(h._, r._)) {
													;((t = h).next = n), (n.previous = t), --d
													continue e
												}
												;(m += h._.r), (h = h.previous)
											}
										} while (p !== h.next)
										for (r.previous = t, r.next = n, t.next = n.previous = n = r, f = l(t); (r = r.next) !== n; )
											(c = l(r)) < f && ((t = r), (f = c))
										n = t.next
									}
									for (t = [n._], r = n; (r = r.next) !== n; ) t.push(r._)
									for (r = (0, a.default)(t), d = 0; d < s; ++d) ((t = e[d]).x -= r.x), (t.y -= r.y)
									return r.r
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										for (var t, n, o = 0, l = (e = (0, r.shuffle)(r.slice.call(e))).length, s = []; o < l; )
											(t = e[o]), n && i(n, t) ? ++o : ((n = u((s = a(s, t)))), (o = 0))
										return n
									})
								var r = n(281)
								function a(e, t) {
									var n, r
									if (l(t, e)) return [t]
									for (n = 0; n < e.length; ++n) if (o(t, e[n]) && l(s(e[n], t), e)) return [e[n], t]
									for (n = 0; n < e.length - 1; ++n)
										for (r = n + 1; r < e.length; ++r)
											if (o(s(e[n], e[r]), t) && o(s(e[n], t), e[r]) && o(s(e[r], t), e[n]) && l(f(e[n], e[r], t), e))
												return [e[n], e[r], t]
									throw new Error()
								}
								function o(e, t) {
									var n = e.r - t.r,
										r = t.x - e.x,
										a = t.y - e.y
									return n < 0 || n * n < r * r + a * a
								}
								function i(e, t) {
									var n = e.r - t.r + 1e-6,
										r = t.x - e.x,
										a = t.y - e.y
									return n > 0 && n * n > r * r + a * a
								}
								function l(e, t) {
									for (var n = 0; n < t.length; ++n) if (!i(e, t[n])) return !1
									return !0
								}
								function u(e) {
									switch (e.length) {
										case 1:
											return { x: (t = e[0]).x, y: t.y, r: t.r }
										case 2:
											return s(e[0], e[1])
										case 3:
											return f(e[0], e[1], e[2])
									}
									var t
								}
								function s(e, t) {
									var n = e.x,
										r = e.y,
										a = e.r,
										o = t.x,
										i = t.y,
										l = t.r,
										u = o - n,
										s = i - r,
										f = l - a,
										c = Math.sqrt(u * u + s * s)
									return { x: (n + o + (u / c) * f) / 2, y: (r + i + (s / c) * f) / 2, r: (c + a + l) / 2 }
								}
								function f(e, t, n) {
									var r = e.x,
										a = e.y,
										o = e.r,
										i = t.x,
										l = t.y,
										u = t.r,
										s = n.x,
										f = n.y,
										c = n.r,
										d = r - i,
										p = r - s,
										h = a - l,
										v = a - f,
										m = u - o,
										y = c - o,
										g = r * r + a * a - o * o,
										b = g - i * i - l * l + u * u,
										_ = g - s * s - f * f + c * c,
										x = p * h - d * v,
										w = (h * _ - v * b) / (2 * x) - r,
										j = (v * m - h * y) / x,
										k = (p * b - d * _) / (2 * x) - a,
										O = (d * y - p * m) / x,
										M = j * j + O * O - 1,
										P = 2 * (o + w * j + k * O),
										S = w * w + k * k - o * o,
										A = -(M ? (P + Math.sqrt(P * P - 4 * M * S)) / (2 * M) : S / P)
									return { x: r + w + j * A, y: a + k + O * A, r: A }
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.constantZero = function() {
										return 0
									}),
									(t.default = function(e) {
										return function() {
											return e
										}
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										;(e.x0 = Math.round(e.x0)),
											(e.y0 = Math.round(e.y0)),
											(e.x1 = Math.round(e.x1)),
											(e.y1 = Math.round(e.y1))
									})
							},
							function(e, t, n) {
								e.exports = function() {
									var e = []
									return (
										(e.toString = function() {
											for (var e = [], t = 0; t < this.length; t++) {
												var n = this[t]
												n[2] ? e.push('@media ' + n[2] + '{' + n[1] + '}') : e.push(n[1])
											}
											return e.join('')
										}),
										(e.i = function(t, n) {
											'string' == typeof t && (t = [[null, t, '']])
											for (var r = {}, a = 0; a < this.length; a++) {
												var o = this[a][0]
												'number' == typeof o && (r[o] = !0)
											}
											for (a = 0; a < t.length; a++) {
												var i = t[a]
												;('number' == typeof i[0] && r[i[0]]) ||
													(n && !i[2] ? (i[2] = n) : n && (i[2] = '(' + i[2] + ') and (' + n + ')'), e.push(i))
											}
										}),
										e
									)
								}
							},
							function(e, t) {
								var n = {},
									r = function(e) {
										var t
										return function() {
											return void 0 === t && (t = e.apply(this, arguments)), t
										}
									},
									a = r(function() {
										return /msie [6-9]\b/.test(self.navigator.userAgent.toLowerCase())
									}),
									o = r(function() {
										return document.head || document.getElementsByTagName('head')[0]
									}),
									i = null,
									l = 0,
									u = []
								function s(e, t) {
									for (var r = 0; r < e.length; r++) {
										var a = e[r],
											o = n[a.id]
										if (o) {
											o.refs++
											for (var i = 0; i < o.parts.length; i++) o.parts[i](a.parts[i])
											for (; i < a.parts.length; i++) o.parts.push(h(a.parts[i], t))
										} else {
											var l = []
											for (i = 0; i < a.parts.length; i++) l.push(h(a.parts[i], t))
											n[a.id] = { id: a.id, refs: 1, parts: l }
										}
									}
								}
								function f(e) {
									for (var t = [], n = {}, r = 0; r < e.length; r++) {
										var a = e[r],
											o = a[0],
											i = { css: a[1], media: a[2], sourceMap: a[3] }
										n[o] ? n[o].parts.push(i) : t.push((n[o] = { id: o, parts: [i] }))
									}
									return t
								}
								function c(e, t) {
									var n = o(),
										r = u[u.length - 1]
									if ('top' === e.insertAt)
										r
											? r.nextSibling
												? n.insertBefore(t, r.nextSibling)
												: n.appendChild(t)
											: n.insertBefore(t, n.firstChild),
											u.push(t)
									else {
										if ('bottom' !== e.insertAt)
											throw new Error("Invalid value for parameter 'insertAt'. Must be 'top' or 'bottom'.")
										n.appendChild(t)
									}
								}
								function d(e) {
									e.parentNode.removeChild(e)
									var t = u.indexOf(e)
									t >= 0 && u.splice(t, 1)
								}
								function p(e) {
									var t = document.createElement('style')
									return (t.type = 'text/css'), c(e, t), t
								}
								function h(e, t) {
									var n, r, a
									if (t.singleton) {
										var o = l++
										;(n = i || (i = p(t))), (r = y.bind(null, n, o, !1)), (a = y.bind(null, n, o, !0))
									} else
										e.sourceMap &&
										'function' == typeof URL &&
										'function' == typeof URL.createObjectURL &&
										'function' == typeof URL.revokeObjectURL &&
										'function' == typeof Blob &&
										'function' == typeof btoa
											? ((n = (function(e) {
													var t = document.createElement('link')
													return (t.rel = 'stylesheet'), c(e, t), t
											  })(t)),
											  (r = b.bind(null, n)),
											  (a = function() {
													d(n), n.href && URL.revokeObjectURL(n.href)
											  }))
											: ((n = p(t)),
											  (r = g.bind(null, n)),
											  (a = function() {
													d(n)
											  }))
									return (
										r(e),
										function(t) {
											if (t) {
												if (t.css === e.css && t.media === e.media && t.sourceMap === e.sourceMap) return
												r((e = t))
											} else a()
										}
									)
								}
								e.exports = function(e, t) {
									if (
										'undefined' != typeof DEBUG &&
										DEBUG &&
										'object' != ('undefined' == typeof document ? 'undefined' : _typeof2(document))
									)
										throw new Error('The style-loader cannot be used in a non-browser environment')
									void 0 === (t = t || {}).singleton && (t.singleton = a()),
										void 0 === t.insertAt && (t.insertAt = 'bottom')
									var r = f(e)
									return (
										s(r, t),
										function(e) {
											for (var a = [], o = 0; o < r.length; o++) {
												var i = r[o]
												;(l = n[i.id]).refs--, a.push(l)
											}
											for (e && s(f(e), t), o = 0; o < a.length; o++) {
												var l
												if (0 === (l = a[o]).refs) {
													for (var u = 0; u < l.parts.length; u++) l.parts[u]()
													delete n[l.id]
												}
											}
										}
									)
								}
								var v,
									m =
										((v = []),
										function(e, t) {
											return (v[e] = t), v.filter(Boolean).join('\n')
										})
								function y(e, t, n, r) {
									var a = n ? '' : r.css
									if (e.styleSheet) e.styleSheet.cssText = m(t, a)
									else {
										var o = document.createTextNode(a),
											i = e.childNodes
										i[t] && e.removeChild(i[t]), i.length ? e.insertBefore(o, i[t]) : e.appendChild(o)
									}
								}
								function g(e, t) {
									var n = t.css,
										r = t.media
									if ((r && e.setAttribute('media', r), e.styleSheet)) e.styleSheet.cssText = n
									else {
										for (; e.firstChild; ) e.removeChild(e.firstChild)
										e.appendChild(document.createTextNode(n))
									}
								}
								function b(e, t) {
									var n = t.css,
										r = t.sourceMap
									r &&
										(n +=
											'\n/*# sourceMappingURL=data:application/json;base64,' +
											btoa(unescape(encodeURIComponent(JSON.stringify(r)))) +
											' */')
									var a = new Blob([n], { type: 'text/css' }),
										o = e.href
									;(e.href = URL.createObjectURL(a)), o && URL.revokeObjectURL(o)
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										return function(n, r, i) {
											arguments.length < 3 && ((i = r), (r = null))
											var l = (0, a.default)(n).mimeType(e)
											return (
												(l.row = function(e) {
													return arguments.length ? l.response(o(t, (r = e))) : r
												}),
												l.row(r),
												i ? l.get(i) : l
											)
										}
									})
								var r,
									a = (r = n(52)) && r.__esModule ? r : { default: r }
								function o(e, t) {
									return function(n) {
										return e(n.responseText, t)
									}
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = function(e, t) {
									if (Array.isArray(e)) return e
									if (Symbol.iterator in Object(e))
										return (function(e, t) {
											var n = [],
												r = !0,
												a = !1,
												o = void 0
											try {
												for (
													var i, l = e[Symbol.iterator]();
													!(r = (i = l.next()).done) && (n.push(i.value), !t || n.length !== t);
													r = !0
												);
											} catch (e) {
												;(a = !0), (o = e)
											} finally {
												try {
													!r && l.return && l.return()
												} finally {
													if (a) throw o
												}
											}
											return n
										})(e, t)
									throw new TypeError('Invalid attempt to destructure non-iterable instance')
								}
								;(t.init_mdsjson = async function(e, t, n) {
									var r = [],
										i = []
									e && e.includes(',')
										? (r = e.split(','))
										: e
										? r.push(e)
										: t && t.includes(',')
										? (i = t.split(','))
										: t && i.push(t)
									var l = []
									if (r.length) {
										var u = !0,
											s = !1,
											f = void 0
										try {
											for (var c, d = r[Symbol.iterator](); !(u = (c = d.next()).done); u = !0) {
												var p = c.value
												try {
													l.push(await o(p, void 0))
												} catch (e) {
													a.sayerror(n, e)
												}
											}
										} catch (e) {
											;(s = !0), (f = e)
										} finally {
											try {
												!u && d.return && d.return()
											} finally {
												if (s) throw f
											}
										}
									} else if (i.length) {
										var h = !0,
											v = !1,
											m = void 0
										try {
											for (var y, g = i[Symbol.iterator](); !(h = (y = g.next()).done); h = !0) {
												var b = y.value
												try {
													l.push(await o(void 0, b))
												} catch (e) {
													a.sayerror(n, e)
												}
											}
										} catch (e) {
											;(v = !0), (m = e)
										} finally {
											try {
												!h && g.return && g.return()
											} finally {
												if (v) throw m
											}
										}
									}
									return l
								}),
									(t.validate_mdsjson = l),
									(t.get_json_tk = u),
									(t.get_scatterplot_data = async function(e, t) {
										var n = {},
											r = await i(e, t)
										return (n.mdssamplescatterplot = r), n
									})
								var a = (function(e) {
									if (e && e.__esModule) return e
									var t = {}
									if (null != e) for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (t[n] = e[n])
									return (t.default = e), t
								})(n(6))
								async function o(e, t) {
									var n = await i(e, t)
									return l(n), u(n)
								}
								async function i(e, t) {
									if (void 0 !== e && '' == e) throw '.jsonfile missing'
									if (void 0 !== t && '' == t) throw '.jsonurl missing'
									var n = void 0
									if (
										(void 0 !== e
											? (n = await a.dofetch('textfile', { file: e }))
											: void 0 !== t && (n = await a.dofetch('urltextfile', { url: t })),
										n.error)
									)
										throw n.error
									return JSON.parse(n.text)
								}
								function l(e) {
									if (!e) throw 'file is missing'
									if (!e.type) throw 'dataset type is missing'
									var t = e.svcnvfile || e.svcnvurl,
										n = e.vcffile || e.vcfurl
									if (!t && !n) throw 'vcf or cnv file/url is required'
									if (
										Object.keys(e).filter(function(e) {
											return e.includes('expression')
										}).length &&
										!e.expressionfile &&
										!e.expressionurl
									)
										throw 'expression file/url is missing'
									if (
										Object.keys(e).filter(function(e) {
											return e.includes('rnabam')
										}).length &&
										!e.rnabamfile &&
										!e.rnabamurl
									)
										throw 'rnabam file/url is missing'
									if (e.sampleset) {
										var a = !0,
											o = !1,
											i = void 0
										try {
											for (var l, u = e.sampleset[Symbol.iterator](); !(a = (l = u.next()).done); a = !0) {
												var s = l.value
												if (1 != e.sampleset.length && !s.name) throw 'sampleset name is missing'
												if (!s.samples) throw 'sampleset samples[] is missing'
											}
										} catch (e) {
											;(o = !0), (i = e)
										} finally {
											try {
												!a && u.return && u.return()
											} finally {
												if (o) throw i
											}
										}
									}
									if (e.sample2assaytrack) {
										var f = !0,
											c = !1,
											d = void 0
										try {
											for (
												var p, h = Object.entries(e.sample2assaytrack)[Symbol.iterator]();
												!(f = (p = h.next()).done);
												f = !0
											) {
												var v = r(p.value, 2),
													m = v[0],
													y = v[1]
												if (!y.length) throw 'assay[] missing for ' + m
												var g = !0,
													b = !1,
													_ = void 0
												try {
													for (var x, w = y[Symbol.iterator](); !(g = (x = w.next()).done); g = !0) {
														var j = x.value
														if (!j.name) throw 'assay name is missing for ' + m
														if (!j.type) throw 'assay type is missing for ' + m
													}
												} catch (e) {
													;(b = !0), (_ = e)
												} finally {
													try {
														!g && w.return && w.return()
													} finally {
														if (b) throw _
													}
												}
											}
										} catch (e) {
											;(c = !0), (d = e)
										} finally {
											try {
												!f && h.return && h.return()
											} finally {
												if (c) throw d
											}
										}
									}
									if (e.groupsamplebyattr) {
										if (!e.groupsamplebyattr.attrlst) return '.attrlst[] missing from groupsamplebyattr'
										if (0 == e.groupsamplebyattr.attrlst.length) return 'groupsamplebyattr.attrlst[] empty array'
										var k = !0,
											O = !1,
											M = void 0
										try {
											for (
												var P, S = e.groupsamplebyattr.attrlst[Symbol.iterator]();
												!(k = (P = S.next()).done);
												k = !0
											)
												if (!P.value.k) return 'k missing from one of groupsamplebyattr.attrlst[]'
										} catch (e) {
											;(O = !0), (M = e)
										} finally {
											try {
												!k && S.return && S.return()
											} finally {
												if (O) throw M
											}
										}
										if (e.groupsamplebyattr.sortgroupby) {
											if (!e.groupsamplebyattr.sortgroupby.key) return '.key missing from .sortgroupby'
											if (!e.groupsamplebyattr.sortgroupby.order) return '.order[] missing from .sortgroupby'
											if (!Array.isArray(e.groupsamplebyattr.sortgroupby.order)) return '.order must be an array'
										}
										e.groupsamplebyattr.attrnamespacer || (e.groupsamplebyattr.attrnamespacer = ', ')
									}
									if (e.fixedgeneexpression) {
										var A = !0,
											C = !1,
											N = void 0
										try {
											for (var T, E = e.fixedgeneexpression[Symbol.iterator](); !(A = (T = E.next()).done); A = !0)
												if (!T.value.gene) throw 'gene missing in fixedgeneexpression array'
										} catch (e) {
											;(C = !0), (N = e)
										} finally {
											try {
												!A && E.return && E.return()
											} finally {
												if (C) throw N
											}
										}
									}
									if (e.vcf && !e.vcf.hiddenclass) throw 'hiddenclasses[] missing from .vcf'
								}
								function u(e) {
									var t = { type: e.type, name: e.name }
									return (
										'true' == e.isdense || 1 == e.isdense || !1 === e.isfull
											? (t.isdense = !0)
											: e.isfull && (t.isfull = !0),
										e.svcnvfile ? (t.file = e.svcnvfile) : e.svcnvurl && (t.url = e.svcnvurl),
										Object.keys(e).filter(function(e) {
											return e.includes('expression')
										}).length && (t.checkexpressionrank = { file: e.expressionfile, url: e.expressionurl }),
										Object.keys(e).filter(function(e) {
											return e.includes('vcf')
										}).length && (t.checkvcf = { file: e.vcffile, url: e.vcfurl }),
										e.vcf && e.vcf.hiddenclass && ((t.vcf = []), (t.vcf.hiddenclass = e.vcf.hiddenclass)),
										Object.keys(e).filter(function(e) {
											return e.includes('rnabam')
										}).length && (t.checkrnabam = { file: e.rnabamfile, url: e.rnabamurl }),
										e.sampleset && (t.sampleset = e.sampleset),
										e.sample2assaytrack && (t.sample2assaytrack = e.sample2assaytrack),
										e.groupsamplebyattr && (t.groupsamplebyattr = e.groupsamplebyattr),
										(t.fixedgeneexpression = e.fixedgeneexpression),
										(t.getallsamples = e.getallsamples),
										(t.valueCutoff = void 0 !== e.cnvValueCutoff ? e.cnvValueCutoff : void 0),
										(t.bplengthUpperLimit = void 0 !== e.cnvLengthUpperLimit ? e.cnvLengthUpperLimit : void 0),
										(t.segmeanValueCutoff = void 0 !== e.segmeanValueCutoff ? e.segmeanValueCutoff : void 0),
										(t.lohLengthUpperLimit = void 0 !== e.lohLengthUpperLimit ? e.lohLengthUpperLimit : void 0),
										(t.multihidelabel_vcf = void 0 !== e.multihidelabel_vcf ? e.multihidelabel_vcf : void 0),
										(t.multihidelabel_fusion = void 0 !== e.multihidelabel_fusion ? e.multihidelabel_fusion : void 0),
										(t.multihidelabel_sv = void 0 !== e.multihidelabel_sv ? e.multihidelabel_sv : void 0),
										(t.legend_vorigin = e.legend_vorigin),
										t
									)
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.interrupt = t.active = t.transition = void 0)
								var r = n(11)
								Object.defineProperty(t, 'transition', {
									enumerable: !0,
									get: function() {
										return i(r).default
									}
								})
								var a = n(254)
								Object.defineProperty(t, 'active', {
									enumerable: !0,
									get: function() {
										return i(a).default
									}
								})
								var o = n(105)
								function i(e) {
									return e && e.__esModule ? e : { default: e }
								}
								Object.defineProperty(t, 'interrupt', {
									enumerable: !0,
									get: function() {
										return i(o).default
									}
								}),
									n(255)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.gene_searchbox = function(e) {
										var t = e.div
												.append('input')
												.attr('placeholder', 'Search gene')
												.style('width', e.width || '100px'),
											n = e.resultdiv || (e.tip ? e.tip.d : r.tip.d)
										function i() {
											e.resultdiv ? e.resultdiv.selectAll('*').remove() : e.tip ? e.tip.hide() : r.tip.hide()
										}
										t.on('keyup', function() {
											if (a.event.target.value.length <= 1) i()
											else if (r.keyupEnter()) {
												var t = n.select('.sja_menuoption')
												t.size() > 0 && (e.callback(t.text()), i())
											} else l()
										}),
											t.node().focus()
										var l = (0, o.debounce)(function() {
											r.dofetch('genelookup', { genome: e.genome, input: t.property('value') })
												.then(function(a) {
													if (a.error) throw a.error
													if (!a.hits) throw '.hits[] missing'
													e.resultdiv
														? e.resultdiv.selectAll('*').remove()
														: e.tip
														? e.tip.clear().showunder(t.node())
														: r.tip.clear().showunder(t.node())
													var o = !0,
														l = !1,
														u = void 0
													try {
														for (
															var s,
																f = function() {
																	var t = s.value
																	n.append('div')
																		.attr('class', 'sja_menuoption')
																		.text(t)
																		.on('click', function() {
																			e.callback(t), i()
																		})
																},
																c = a.hits[Symbol.iterator]();
															!(o = (s = c.next()).done);
															o = !0
														)
															f()
													} catch (e) {
														;(l = !0), (u = e)
													} finally {
														try {
															!o && c.return && c.return()
														} finally {
															if (l) throw u
														}
													}
												})
												.catch(function(e) {
													n.append('div').text(e.message || e), e.stack && console.log(e.stack)
												})
										}, 300)
									}),
									(t.findgenemodel_bysymbol = function(e, t) {
										return r.dofetch('genelookup', { deep: 1, input: t, genome: e }).then(function(e) {
											if (e.error) throw e.error
											return e.gmlst && 0 != e.gmlst.length ? e.gmlst : null
										})
									})
								var r = (function(e) {
										if (e && e.__esModule) return e
										var t = {}
										if (null != e) for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (t[n] = e[n])
										return (t.default = e), t
									})(n(6)),
									a = n(0),
									o = n(59)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.getsjcharts = function() {
										return window.sjcharts
											? Promise.resolve(window.sjcharts)
											: r ||
													(r = new Promise(function(e, t) {
														var n = window.location.hostname.split('.')[0],
															r =
																'https://' +
																(['pp-test', 'pecan-test', 'ppr'].includes(n)
																	? n + '.stjude.org'
																	: 'proteinpaint.stjude.org') +
																'/sjcharts/bin/sjcharts.js',
															a = document.createElement('script')
														a.setAttribute('type', 'text/javascript'),
															a.setAttribute('src', r),
															document.getElementsByTagName('head')[0].appendChild(a),
															(a.onload = function() {
																e(window.sjcharts)
															}),
															(a.onerror = function() {
																var e = 'Unable to load SJCharts from ' + r
																alert(e), t(e)
															})
													}))
									})
								var r = void 0
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r =
									'function' == typeof Symbol && 'symbol' == _typeof2(Symbol.iterator)
										? function(e) {
												return void 0 === e ? 'undefined' : _typeof2(e)
										  }
										: function(e) {
												return e && 'function' == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype
													? 'symbol'
													: void 0 === e
													? 'undefined'
													: _typeof2(e)
										  }
								;(t.parseheader = function(e, t, n) {
									var r = e.toLowerCase().split('\t')
									if (r.length <= 1) return 'invalid file header for fusions'
									var a = function() {
											for (var e = arguments.length, t = Array(e), n = 0; n < e; n++) t[n] = arguments[n]
											var a = !0,
												o = !1,
												i = void 0
											try {
												for (var l, u = t[Symbol.iterator](); !(a = (l = u.next()).done); a = !0) {
													var s = l.value,
														f = r.indexOf(s)
													if (-1 != f) return f
												}
											} catch (e) {
												;(o = !0), (i = e)
											} finally {
												try {
													!a && u.return && u.return()
												} finally {
													if (o) throw i
												}
											}
											return -1
										},
										o = a('gene_a', 'gene1', 'genea')
									return -1 == o
										? 'gene_a missing from header'
										: ((r[o] = 'gene1'),
										  -1 == (o = a('gene_b', 'gene2', 'geneb'))
												? 'gene_b missing from header'
												: ((r[o] = 'gene2'),
												  -1 == (o = a('chr_a', 'chr1', 'chra'))
														? 'chr_a missing from header'
														: ((r[o] = 'chr1'),
														  -1 == (o = a('chr_b', 'chr2', 'chrb'))
																? 'chr_b missing from header'
																: ((r[o] = 'chr2'),
																  -1 == (o = a('pos_a', 'position_a', 'position1', 'posa'))
																		? 'pos_a missing from header'
																		: ((r[o] = 'position1'),
																		  -1 == (o = a('pos_b', 'position_b', 'position2', 'posb'))
																				? 'pos_b missing from header'
																				: ((r[o] = 'position2'),
																				  -1 == (o = a('isoform_a', 'refseq_a', 'refseq1', 'isoform1', 'sv_refseqa'))
																						? 'isoform_a missing from header'
																						: ((r[o] = 'isoform1'),
																						  -1 ==
																						  (o = a('isoform_b', 'refseq_b', 'refseq2', 'isoform2', 'sv_refseqb'))
																								? 'isoform_b missing from header'
																								: ((r[o] = 'isoform2'),
																								  -1 == (o = a('strand_a', 'orta'))
																										? 'strand_a missing from header'
																										: ((r[o] = 'strand1'),
																										  -1 == (o = a('strand_b', 'ortb'))
																												? 'strand_b missing from header'
																												: ((r[o] = 'strand2'),
																												  -1 !=
																														(o = a('sample', 'sample_name', 'tumor_sample_barcode')) &&
																														(r[o] = 'sample'),
																												  -1 != (o = a('patient', 'donor', 'target_case_id')) &&
																														(r[o] = 'patient'),
																												  -1 != (o = a('sampletype', 'sample type', 'sample_type')) &&
																														(r[o] = 'sampletype'),
																												  -1 != (o = a('disease')) && (r[o] = 'disease'),
																												  -1 != (o = a('origin')) && (r[o] = 'origin'),
																												  n
																														? ((t.sv.loaded = !0), (t.sv.header = r))
																														: ((t.fusion.loaded = !0), (t.fusion.header = r)),
																												  !1))))))))))
								}),
									(t.parseline = function(e, t, n, r) {
										if ('' != t && '#' != t[0]) {
											for (
												var i = t.split('\t'),
													l = {},
													u = r ? n.sv.header : n.fusion.header,
													s = r ? n.sv.badlines : n.fusion.badlines,
													f = 0;
												f < u.length;
												f++
											)
												l[u[f]] = i[f]
											if (l.chr1)
												if ((0 != l.chr1.toLowerCase().indexOf('chr') && (l.chr1 = 'chr' + l.chr1), l.chr2)) {
													0 != l.chr2.toLowerCase().indexOf('chr') && (l.chr2 = 'chr' + l.chr2)
													var c = l.position1
													if (c) {
														var d = Number.parseInt(c)
														if (Number.isNaN(d) || d <= 0) s.push([e, 'invalid value for position1', i])
														else if (((l.position1 = d), (c = l.position2))) {
															if (((d = Number.parseInt(c)), Number.isNaN(d) || d <= 0))
																s.push([e, 'invalid value for position2', i])
															else if (((l.position2 = d), !a.parsesample(l, n, e, i, s))) {
																if (l.isoform1 && -1 != l.isoform1.indexOf(',')) {
																	var p = l.isoform1.split(',')
																	l.isoform1 = void 0
																	var h = !0,
																		v = !1,
																		m = void 0
																	try {
																		for (var y, g = p[Symbol.iterator](); !(h = (y = g.next()).done); h = !0) {
																			var b = y.value
																			'' != b && (l.isoform1 = b)
																		}
																	} catch (e) {
																		;(v = !0), (m = e)
																	} finally {
																		try {
																			!h && g.return && g.return()
																		} finally {
																			if (v) throw m
																		}
																	}
																}
																if (l.isoform2 && -1 != l.isoform2.indexOf(',')) {
																	var _ = l.isoform2.split(',')
																	l.isoform2 = void 0
																	var x = !0,
																		w = !1,
																		j = void 0
																	try {
																		for (var k, O = _[Symbol.iterator](); !(x = (k = O.next()).done); x = !0) {
																			var M = k.value
																			'' != M && (l.isoform2 = M)
																		}
																	} catch (e) {
																		;(w = !0), (j = e)
																	} finally {
																		try {
																			!x && O.return && O.return()
																		} finally {
																			if (w) throw j
																		}
																	}
																}
																if ((l.gene1 || (l.isoform1 = void 0), l.gene2 || (l.isoform2 = void 0), l.gene1)) {
																	n.good++
																	var P = {
																			dt: r ? o.dtsv : o.dtfusionrna,
																			class: r ? o.mclasssv : o.mclassfusionrna,
																			isoform: l.isoform1,
																			mname: l.gene2 || l.chr2,
																			sample: l.sample,
																			patient: l.patient,
																			sampletype: l.sampletype,
																			origin: l.origin,
																			disease: l.disease,
																			pairlst: [
																				{
																					a: {
																						name: l.gene1,
																						isoform: l.isoform1,
																						strand: l.strand1,
																						chr: l.chr1,
																						position: l.position1
																					},
																					b: {
																						name: l.gene2,
																						isoform: l.isoform2,
																						strand: l.strand2,
																						chr: l.chr2,
																						position: l.position2
																					}
																				}
																			]
																		},
																		S = n.geneToUpper ? l.gene1.toUpperCase() : l.gene1
																	n.data[S] || (n.data[S] = []), n.data[S].push(P)
																}
																if (l.gene2 && l.gene2 != l.gene1) {
																	n.good++
																	var A = {
																			dt: r ? o.dtsv : o.dtfusionrna,
																			class: r ? o.mclasssv : o.mclassfusionrna,
																			isoform: l.isoform2,
																			mname: l.gene1 || l.chr1,
																			sample: l.sample,
																			patient: l.patient,
																			sampletype: l.sampletype,
																			origin: l.origin,
																			disease: l.disease,
																			pairlst: [
																				{
																					a: {
																						name: l.gene1,
																						isoform: l.isoform1,
																						strand: l.strand1,
																						chr: l.chr1,
																						position: l.position1
																					},
																					b: {
																						name: l.gene2,
																						isoform: l.isoform2,
																						strand: l.strand2,
																						chr: l.chr2,
																						position: l.position2
																					}
																				}
																			]
																		},
																		C = n.geneToUpper ? l.gene2.toUpperCase() : l.gene2
																	n.data[C] || (n.data[C] = []), n.data[C].push(A)
																}
															}
														} else s.push([e, 'missing position2', i])
													} else s.push([e, 'missing position1', i])
												} else s.push([e, 'missing chr2', i])
											else s.push([e, 'missing chr1', i])
										}
									}),
									(t.duplicate = function(e) {
										var t = {}
										for (var n in e)
											if ('pairlst' != n) {
												var a = e[n]
												'object' != (void 0 === a ? 'undefined' : r(a)) && (t[n] = a)
											}
										if (e.pairlst) {
											t.pairlst = []
											var o = !0,
												i = !1,
												l = void 0
											try {
												for (var u, s = e.pairlst[Symbol.iterator](); !(o = (u = s.next()).done); o = !0) {
													var f = u.value,
														c = {}
													for (var d in f) 'a' != d && 'b' != d && 'interstitial' != d && (c[d] = f[d])
													if (f.a)
														for (var p in ((c.a = {}), f.a)) {
															var h = f.a[p]
															'object' != (void 0 === h ? 'undefined' : r(h)) && (c.a[p] = h)
														}
													if (f.b)
														for (var v in ((c.b = {}), f.b)) {
															var m = f.b[v]
															'object' != (void 0 === m ? 'undefined' : r(m)) && (c.b[v] = m)
														}
													if (f.interstitial)
														for (var y in ((c.interstitial = {}), f.interstitial)) {
															var g = f.interstitial[y]
															'object' != (void 0 === g ? 'undefined' : r(g)) && (c.interstitial[y] = g)
														}
													t.pairlst.push(c)
												}
											} catch (e) {
												;(i = !0), (l = e)
											} finally {
												try {
													!o && s.return && s.return()
												} finally {
													if (i) throw l
												}
											}
										}
										return t
									})
								var a = i(n(10)),
									o = i(n(2))
								function i(e) {
									if (e && e.__esModule) return e
									var t = {}
									if (null != e) for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (t[n] = e[n])
									return (t.default = e), t
								}
							},
							function(e, t, n) {
								var r,
									a,
									o = (e.exports = {})
								function i() {
									throw new Error('setTimeout has not been defined')
								}
								function l() {
									throw new Error('clearTimeout has not been defined')
								}
								function u(e) {
									if (r === setTimeout) return setTimeout(e, 0)
									if ((r === i || !r) && setTimeout) return (r = setTimeout), setTimeout(e, 0)
									try {
										return r(e, 0)
									} catch (t) {
										try {
											return r.call(null, e, 0)
										} catch (t) {
											return r.call(this, e, 0)
										}
									}
								}
								!(function() {
									try {
										r = 'function' == typeof setTimeout ? setTimeout : i
									} catch (e) {
										r = i
									}
									try {
										a = 'function' == typeof clearTimeout ? clearTimeout : l
									} catch (e) {
										a = l
									}
								})()
								var s,
									f = [],
									c = !1,
									d = -1
								function p() {
									c && s && ((c = !1), s.length ? (f = s.concat(f)) : (d = -1), f.length && h())
								}
								function h() {
									if (!c) {
										var e = u(p)
										c = !0
										for (var t = f.length; t; ) {
											for (s = f, f = []; ++d < t; ) s && s[d].run()
											;(d = -1), (t = f.length)
										}
										;(s = null),
											(c = !1),
											(function(e) {
												if (a === clearTimeout) return clearTimeout(e)
												if ((a === l || !a) && clearTimeout) return (a = clearTimeout), clearTimeout(e)
												try {
													a(e)
												} catch (t) {
													try {
														return a.call(null, e)
													} catch (t) {
														return a.call(this, e)
													}
												}
											})(e)
									}
								}
								function v(e, t) {
									;(this.fun = e), (this.array = t)
								}
								function m() {}
								;(o.nextTick = function(e) {
									var t = new Array(arguments.length - 1)
									if (arguments.length > 1) for (var n = 1; n < arguments.length; n++) t[n - 1] = arguments[n]
									f.push(new v(e, t)), 1 !== f.length || c || u(h)
								}),
									(v.prototype.run = function() {
										this.fun.apply(null, this.array)
									}),
									(o.title = 'browser'),
									(o.browser = !0),
									(o.env = {}),
									(o.argv = []),
									(o.version = ''),
									(o.versions = {}),
									(o.on = m),
									(o.addListener = m),
									(o.once = m),
									(o.off = m),
									(o.removeListener = m),
									(o.removeAllListeners = m),
									(o.emit = m),
									(o.prependListener = m),
									(o.prependOnceListener = m),
									(o.listeners = function(e) {
										return []
									}),
									(o.binding = function(e) {
										throw new Error('process.binding is not supported')
									}),
									(o.cwd = function() {
										return '/'
									}),
									(o.chdir = function(e) {
										throw new Error('process.chdir is not supported')
									}),
									(o.umask = function() {
										return 0
									})
							},
							,
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = n(258)
								Object.defineProperty(t, 'easeLinear', {
									enumerable: !0,
									get: function() {
										return r.linear
									}
								})
								var a = n(259)
								Object.defineProperty(t, 'easeQuad', {
									enumerable: !0,
									get: function() {
										return a.quadInOut
									}
								}),
									Object.defineProperty(t, 'easeQuadIn', {
										enumerable: !0,
										get: function() {
											return a.quadIn
										}
									}),
									Object.defineProperty(t, 'easeQuadOut', {
										enumerable: !0,
										get: function() {
											return a.quadOut
										}
									}),
									Object.defineProperty(t, 'easeQuadInOut', {
										enumerable: !0,
										get: function() {
											return a.quadInOut
										}
									})
								var o = n(260)
								Object.defineProperty(t, 'easeCubic', {
									enumerable: !0,
									get: function() {
										return o.cubicInOut
									}
								}),
									Object.defineProperty(t, 'easeCubicIn', {
										enumerable: !0,
										get: function() {
											return o.cubicIn
										}
									}),
									Object.defineProperty(t, 'easeCubicOut', {
										enumerable: !0,
										get: function() {
											return o.cubicOut
										}
									}),
									Object.defineProperty(t, 'easeCubicInOut', {
										enumerable: !0,
										get: function() {
											return o.cubicInOut
										}
									})
								var i = n(261)
								Object.defineProperty(t, 'easePoly', {
									enumerable: !0,
									get: function() {
										return i.polyInOut
									}
								}),
									Object.defineProperty(t, 'easePolyIn', {
										enumerable: !0,
										get: function() {
											return i.polyIn
										}
									}),
									Object.defineProperty(t, 'easePolyOut', {
										enumerable: !0,
										get: function() {
											return i.polyOut
										}
									}),
									Object.defineProperty(t, 'easePolyInOut', {
										enumerable: !0,
										get: function() {
											return i.polyInOut
										}
									})
								var l = n(262)
								Object.defineProperty(t, 'easeSin', {
									enumerable: !0,
									get: function() {
										return l.sinInOut
									}
								}),
									Object.defineProperty(t, 'easeSinIn', {
										enumerable: !0,
										get: function() {
											return l.sinIn
										}
									}),
									Object.defineProperty(t, 'easeSinOut', {
										enumerable: !0,
										get: function() {
											return l.sinOut
										}
									}),
									Object.defineProperty(t, 'easeSinInOut', {
										enumerable: !0,
										get: function() {
											return l.sinInOut
										}
									})
								var u = n(263)
								Object.defineProperty(t, 'easeExp', {
									enumerable: !0,
									get: function() {
										return u.expInOut
									}
								}),
									Object.defineProperty(t, 'easeExpIn', {
										enumerable: !0,
										get: function() {
											return u.expIn
										}
									}),
									Object.defineProperty(t, 'easeExpOut', {
										enumerable: !0,
										get: function() {
											return u.expOut
										}
									}),
									Object.defineProperty(t, 'easeExpInOut', {
										enumerable: !0,
										get: function() {
											return u.expInOut
										}
									})
								var s = n(264)
								Object.defineProperty(t, 'easeCircle', {
									enumerable: !0,
									get: function() {
										return s.circleInOut
									}
								}),
									Object.defineProperty(t, 'easeCircleIn', {
										enumerable: !0,
										get: function() {
											return s.circleIn
										}
									}),
									Object.defineProperty(t, 'easeCircleOut', {
										enumerable: !0,
										get: function() {
											return s.circleOut
										}
									}),
									Object.defineProperty(t, 'easeCircleInOut', {
										enumerable: !0,
										get: function() {
											return s.circleInOut
										}
									})
								var f = n(265)
								Object.defineProperty(t, 'easeBounce', {
									enumerable: !0,
									get: function() {
										return f.bounceOut
									}
								}),
									Object.defineProperty(t, 'easeBounceIn', {
										enumerable: !0,
										get: function() {
											return f.bounceIn
										}
									}),
									Object.defineProperty(t, 'easeBounceOut', {
										enumerable: !0,
										get: function() {
											return f.bounceOut
										}
									}),
									Object.defineProperty(t, 'easeBounceInOut', {
										enumerable: !0,
										get: function() {
											return f.bounceInOut
										}
									})
								var c = n(266)
								Object.defineProperty(t, 'easeBack', {
									enumerable: !0,
									get: function() {
										return c.backInOut
									}
								}),
									Object.defineProperty(t, 'easeBackIn', {
										enumerable: !0,
										get: function() {
											return c.backIn
										}
									}),
									Object.defineProperty(t, 'easeBackOut', {
										enumerable: !0,
										get: function() {
											return c.backOut
										}
									}),
									Object.defineProperty(t, 'easeBackInOut', {
										enumerable: !0,
										get: function() {
											return c.backInOut
										}
									})
								var d = n(267)
								Object.defineProperty(t, 'easeElastic', {
									enumerable: !0,
									get: function() {
										return d.elasticOut
									}
								}),
									Object.defineProperty(t, 'easeElasticIn', {
										enumerable: !0,
										get: function() {
											return d.elasticIn
										}
									}),
									Object.defineProperty(t, 'easeElasticOut', {
										enumerable: !0,
										get: function() {
											return d.elasticOut
										}
									}),
									Object.defineProperty(t, 'easeElasticInOut', {
										enumerable: !0,
										get: function() {
											return d.elasticInOut
										}
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t = { id2vcf: {}, label: e.name || 'Unnamed VCF file' },
											n = void 0
										if (e.file) {
											var i = Math.random().toString()
											;(n = { file: e.file, indexURL: e.indexURL, vcfid: i }), (t.id2vcf[i] = n)
										} else {
											if (!e.url) return ['no .file or .url']
											var l = Math.random().toString()
											;(n = { url: e.url, indexURL: e.indexURL, vcfid: l }), (t.id2vcf[l] = n)
										}
										if (
											((n.headernotloaded = !0),
											e.samplenamemap && (n.samplenamemap = e.samplenamemap),
											e.variant2img && !e.variant2img.path)
										)
											return ['.path missing from .variant2img{}']
										var u = {
											type: r.tkt.ds,
											isvcf: !0,
											name: t.label,
											ds: t,
											populationfrequencyfilter: e.populationfrequencyfilter,
											vcfinfofilter: e.vcfinfofilter,
											itemlabelname: e.itemlabelname,
											viewrangeupperlimit: e.viewrangeupperlimit,
											variant2img: e.variant2img,
											axisheight: e.axisheight
										}
										if (e.url4variant) {
											var s = (function(e) {
												if (!Array.isArray(e)) return 'value is not an array'
												var t = !0,
													n = !1,
													r = void 0
												try {
													for (var a, o = e[Symbol.iterator](); !(t = (a = o.next()).done); t = !0) {
														var i = a.value
														if (!i.makeurl) return '.makeurl missing'
														if ('function' != typeof i.makeurl) return '.makeurl must be a function'
													}
												} catch (e) {
													;(n = !0), (r = e)
												} finally {
													try {
														!t && o.return && o.return()
													} finally {
														if (n) throw r
													}
												}
												return !1
											})(e.url4variant)
											if (s) return ['.url4variant error: ' + s]
											u.url4variant = e.url4variant
										}
										if (e.button4variant) {
											var f = (function(e) {
												if (!Array.isArray(e)) return 'value is not an array'
												var t = !0,
													n = !1,
													r = void 0
												try {
													for (var a, o = e[Symbol.iterator](); !(t = (a = o.next()).done); t = !0) {
														var i = a.value
														if (!i.makebutton) return '.makebutton missing'
														if ('function' != typeof i.makebutton) return '.makebutton must be a function'
													}
												} catch (e) {
													;(n = !0), (r = e)
												} finally {
													try {
														!t && o.return && o.return()
													} finally {
														if (n) throw r
													}
												}
												return !1
											})(e.button4variant)
											if (f) return ['.button4variant error: ' + f]
											u.button4variant = e.button4variant
										}
										if (e.sampleannotation) {
											var c = e.sampleannotation
											if (!c.annotation) return ['.annotation{} missing from .sampleannotation']
											if (c.levels) {
												if (!Array.isArray(c.levels)) return ['.sampleannotation.levels should be array']
												var d = []
												for (var p in c.annotation) {
													var h = { sample_name: p }
													for (var v in c.annotation[p]) h[v] = c.annotation[p][v]
													d.push(h)
												}
												var m = (0, a.stratinput)(d, c.levels)
												;(c.root = (0, o.stratify)()(m)),
													c.root.sum(function(e) {
														return e.value
													})
											}
											if (c.variantsunburst && !c.levels)
												return ['.levels missing when .variantsunburst is on from .sampleannotation']
											u.ds.cohort = c
										}
										if (e.vcfcohorttrack) {
											if (!e.vcfcohorttrack.file && !e.vcfcohorttrack.url)
												return ['no .file or .url provided from .vcfcohorttrack']
											u.ds.vcfcohorttrack = e.vcfcohorttrack
										}
										if (e.germline2dvafplot) {
											if (!e.germline2dvafplot.individualkey) return ['.individualkey missing from germline2dvafplot']
											if (!e.germline2dvafplot.sampletypekey) return ['.sampletypekey missing from germline2dvafplot']
											if (!e.germline2dvafplot.xsampletype) return ['.xsampletype missing from germline2dvafplot']
											if (!e.germline2dvafplot.yleftsampletype)
												return ['.yleftsampletype missing from germline2dvafplot']
											if (
												e.germline2dvafplot.yrightsampletype &&
												e.germline2dvafplot.yrightsampletype == e.germline2dvafplot.yleftsampletype
											)
												return ['.yrightsampletype should not be same as yleftsampletype']
											u.ds.germline2dvafplot = e.germline2dvafplot
										}
										if (e.vaf2coverageplot) {
											if (e.vaf2coverageplot.categorykey && !e.vaf2coverageplot.categories)
												return ['.categories missing when .categorykey is in use for .vaf2coverageplot']
											u.ds.vaf2coverageplot = e.vaf2coverageplot
										}
										if (e.genotype2boxplot) {
											if (e.genotype2boxplot.boxplotvaluekey);
											else {
												if (!e.genotype2boxplot.sampleannotationkey)
													return ['incomplete instruction for genotype2boxplot']
												if (!u.ds.cohort)
													return ['sampleannotation missing when using genotype2boxplot.sampleannotationkey']
												if (!u.ds.cohort.annotation)
													return ['sampleannotation.annotation missing when using genotype2boxplot.sampleannotationkey']
												var y = !1
												for (var g in u.ds.cohort.annotation)
													if (e.genotype2boxplot.sampleannotationkey in u.ds.cohort.annotation[g]) {
														y = !0
														break
													}
												if (!y) return [e.genotype2boxplot.sampleannotationkey + ' not found in any sample annotation']
											}
											u.ds.genotype2boxplot = e.genotype2boxplot
										}
										if ((e.discardsymbolicallele && (u.ds.discardsymbolicallele = !0), e.samplebynumericvalue)) {
											if (!e.samplebynumericvalue.attrkey) return ['attrkey missing from samplebynumericvalue']
											if (!u.ds.cohort) return ['sampleannotation missing when using samplebynumericvalue']
											if (!u.ds.cohort.annotation)
												return ['sampleannotation.annotation missing when using samplebynumericvalue']
											var b = !1
											for (var _ in u.ds.cohort.annotation)
												if (Number.isFinite(u.ds.cohort.annotation[_][e.samplebynumericvalue.attrkey])) {
													b = !0
													break
												}
											if (!b) return ['samplebynumericvalue.attrkey not found in any sample annotation']
											u.ds.samplebynumericvalue = e.samplebynumericvalue
										}
										var x = e.genotypebynumericvalue
										if (x) {
											if (!x.refref) return [u.name + ': refref missing from genotypebynumericvalue']
											if (!x.refalt) return [u.name + ': refalt missing from genotypebynumericvalue']
											if (!x.altalt) return [u.name + ': altalt missing from genotypebynumericvalue']
											if (!x.refref.infokey) return [u.name + ': refref.infokey missing from genotypebynumericvalue']
											if (!x.refalt.infokey) return [u.name + ': refalt.infokey missing from genotypebynumericvalue']
											if (!x.altalt.infokey) return [u.name + ': altalt.infokey missing from genotypebynumericvalue']
											if (
												x.refref.genotypeCountInfokey ||
												x.refalt.genotypeCountInfokey ||
												x.altalt.genotypeCountInfokey
											) {
												if (!x.refref.genotypeCountInfokey)
													return [u.name + ': genotypeCountInfokey missing from genotypebynumericvalue.refref{}']
												if (!x.refalt.genotypeCountInfokey)
													return [u.name + ': genotypeCountInfokey missing from genotypebynumericvalue.refalt{}']
												if (!x.altalt.genotypeCountInfokey)
													return [u.name + ': genotypeCountInfokey missing from genotypebynumericvalue.altalt{}']
											}
											u.ds.genotypebynumericvalue = x
										}
										return (
											e.pointdown && (u.aboveprotein = !1), e.dstk_novcferror && (u.dstk_novcferror = !0), [null, u]
										)
									})
								var r = (function(e) {
										if (e && e.__esModule) return e
										var t = {}
										if (null != e) for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (t[n] = e[n])
										return (t.default = e), t
									})(n(6)),
									a = n(58),
									o = n(55)
							},
							function(e, t, n) {
								;(function(e) {
									function n(e, t) {
										for (var n = 0, r = e.length - 1; r >= 0; r--) {
											var a = e[r]
											'.' === a ? e.splice(r, 1) : '..' === a ? (e.splice(r, 1), n++) : n && (e.splice(r, 1), n--)
										}
										if (t) for (; n--; n) e.unshift('..')
										return e
									}
									function r(e, t) {
										if (e.filter) return e.filter(t)
										for (var n = [], r = 0; r < e.length; r++) t(e[r], r, e) && n.push(e[r])
										return n
									}
									;(t.resolve = function() {
										for (var t = '', a = !1, o = arguments.length - 1; o >= -1 && !a; o--) {
											var i = o >= 0 ? arguments[o] : e.cwd()
											if ('string' != typeof i) throw new TypeError('Arguments to path.resolve must be strings')
											i && ((t = i + '/' + t), (a = '/' === i.charAt(0)))
										}
										return (
											(a ? '/' : '') +
												(t = n(
													r(t.split('/'), function(e) {
														return !!e
													}),
													!a
												).join('/')) || '.'
										)
									}),
										(t.normalize = function(e) {
											var o = t.isAbsolute(e),
												i = '/' === a(e, -1)
											return (
												(e = n(
													r(e.split('/'), function(e) {
														return !!e
													}),
													!o
												).join('/')) ||
													o ||
													(e = '.'),
												e && i && (e += '/'),
												(o ? '/' : '') + e
											)
										}),
										(t.isAbsolute = function(e) {
											return '/' === e.charAt(0)
										}),
										(t.join = function() {
											var e = Array.prototype.slice.call(arguments, 0)
											return t.normalize(
												r(e, function(e, t) {
													if ('string' != typeof e) throw new TypeError('Arguments to path.join must be strings')
													return e
												}).join('/')
											)
										}),
										(t.relative = function(e, n) {
											function r(e) {
												for (var t = 0; t < e.length && '' === e[t]; t++);
												for (var n = e.length - 1; n >= 0 && '' === e[n]; n--);
												return t > n ? [] : e.slice(t, n - t + 1)
											}
											;(e = t.resolve(e).substr(1)), (n = t.resolve(n).substr(1))
											for (
												var a = r(e.split('/')), o = r(n.split('/')), i = Math.min(a.length, o.length), l = i, u = 0;
												u < i;
												u++
											)
												if (a[u] !== o[u]) {
													l = u
													break
												}
											var s = []
											for (u = l; u < a.length; u++) s.push('..')
											return (s = s.concat(o.slice(l))).join('/')
										}),
										(t.sep = '/'),
										(t.delimiter = ':'),
										(t.dirname = function(e) {
											if (('string' != typeof e && (e += ''), 0 === e.length)) return '.'
											for (var t = e.charCodeAt(0), n = 47 === t, r = -1, a = !0, o = e.length - 1; o >= 1; --o)
												if (47 === (t = e.charCodeAt(o))) {
													if (!a) {
														r = o
														break
													}
												} else a = !1
											return -1 === r ? (n ? '/' : '.') : n && 1 === r ? '/' : e.slice(0, r)
										}),
										(t.basename = function(e, t) {
											var n = (function(e) {
												'string' != typeof e && (e += '')
												var t,
													n = 0,
													r = -1,
													a = !0
												for (t = e.length - 1; t >= 0; --t)
													if (47 === e.charCodeAt(t)) {
														if (!a) {
															n = t + 1
															break
														}
													} else -1 === r && ((a = !1), (r = t + 1))
												return -1 === r ? '' : e.slice(n, r)
											})(e)
											return t && n.substr(-1 * t.length) === t && (n = n.substr(0, n.length - t.length)), n
										}),
										(t.extname = function(e) {
											'string' != typeof e && (e += '')
											for (var t = -1, n = 0, r = -1, a = !0, o = 0, i = e.length - 1; i >= 0; --i) {
												var l = e.charCodeAt(i)
												if (47 !== l)
													-1 === r && ((a = !1), (r = i + 1)),
														46 === l ? (-1 === t ? (t = i) : 1 !== o && (o = 1)) : -1 !== t && (o = -1)
												else if (!a) {
													n = i + 1
													break
												}
											}
											return -1 === t || -1 === r || 0 === o || (1 === o && t === r - 1 && t === n + 1)
												? ''
												: e.slice(t, r)
										})
									var a =
										'b' === 'ab'.substr(-1)
											? function(e, t, n) {
													return e.substr(t, n)
											  }
											: function(e, t, n) {
													return t < 0 && (t = e.length + t), e.substr(t, n)
											  }
								}.call(this, n(118)))
							},
							,
							,
							,
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.runproteinpaint = P)
								var r = n(0),
									a = y(n(6)),
									o = n(115)
								n(289), n(291)
								var i,
									l = y(n(2)),
									u = n(64),
									s = n(20),
									f = n(51),
									c = n(3),
									d = (i = n(61)) && i.__esModule ? i : { default: i },
									p = n(116),
									h = y(n(59)),
									v = y(n(308)),
									m = n(113)
								function y(e) {
									if (e && e.__esModule) return e
									var t = {}
									if (null != e) for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (t[n] = e[n])
									return (t.default = e), t
								}
								var g = document.currentScript.src,
									b = void 0,
									_ = g.includes('://') ? g.split('://')[0] + '://' + g.split('://')[1].split('/')[0] : '',
									x = void 0,
									w = void 0,
									j = void 0,
									k = !1,
									O = function(e) {
										a.sayerror(b, e)
									},
									M = new a.Menu({ padding: '0px', offsetX: 0, offsetY: 0 })
								function P(e) {
									if (e.clear)
										return (0, r.selectAll)('.sja_menu').remove(), void (0, r.selectAll)('.sja_pane').remove()
									var t = (0, r.select)(e.holder ? e.holder : document.body).append('div')
									t
										.attr('class', 'sja_root_holder')
										.style('font', '1em Arial, sans-serif')
										.style('color', 'black'),
										e.host && (_ = e.host),
										sessionStorage.setItem('hostURL', _),
										e.jwt && sessionStorage.setItem('jwt', e.jwt),
										e.variantPageCall_snv && (w = e.variantPageCall_snv),
										e.samplecart && (j = e.samplecart),
										e.base_zindex && a.newpane({ setzindex: e.base_zindex })
									var i = e.serverData || (e.termdb && e.termdb.serverData) || (e.toy && e.toy.serverData)
									return a
										.dofetch2('genomes', {}, { serverData: i })
										.then(function(i) {
											if (i.error) throw { message: 'Cannot get genomes: ' + i.error }
											if (!i.genomes) throw { message: 'no genome data!?' }
											for (var y in (i.base_zindex && a.newpane({ setzindex: i.base_zindex }),
											(x = i.genomes),
											i.debugmode && (k = !0),
											x)) {
												var g = a.initgenome(x[y])
												if (g) throw { message: 'Error with ' + y + ' genome: ' + g }
											}
											var P = void 0
											return (
												e.noheader ||
													(P = (function(e, t, o) {
														var i = (0, c.rgb)(l.defaultcolor),
															s = e.append('div'),
															d = s
																.append('div')
																.style('margin', '10px')
																.style('padding-right', '10px')
																.style('display', 'inline-block')
																.style('border', 'solid 1px rgba(' + i.r + ',' + i.g + ',' + i.b + ',.3)')
																.style('border-radius', '5px')
																.style('background-color', 'rgba(' + i.r + ',' + i.g + ',' + i.b + ',.1)'),
															p = s
																.append('div')
																.style('display', 'inline-block')
																.style('padding', '13px')
																.style('font-size', '.8em')
																.style('color', l.defaultcolor),
															v = p.append('div')
														v
															.append('span')
															.text(
																'Code updated: ' +
																	(t.codedate || '??') +
																	', server launched: ' +
																	(t.launchdate || '??') +
																	'.'
															),
															t.hasblat &&
																v
																	.append('a')
																	.style('margin-left', '10px')
																	.text('Running BLAT')
																	.on('click', async function() {
																		M.clear().showunder(r.event.target)
																		var e = M.d.append('div').style('margin', '10px'),
																			t = e.append('div').text('Loading...')
																		try {
																			var n = await a.dofetch2('blat?serverstat=1')
																			if (n.error) throw n.error
																			if (!n.lst) throw 'invalid response'
																			t.remove()
																			var o = !0,
																				i = !1,
																				l = void 0
																			try {
																				for (var u, s = n.lst[Symbol.iterator](); !(o = (u = s.next()).done); o = !0) {
																					var f = u.value
																					e.append('div').text(f)
																				}
																			} catch (e) {
																				;(i = !0), (l = e)
																			} finally {
																				try {
																					!o && s.return && s.return()
																				} finally {
																					if (i) throw l
																				}
																			}
																		} catch (e) {
																			t.text(e.message || e), e.stack && console.log(e.stack)
																		}
																	}),
															t.headermessage && p.append('div').html(t.headermessage),
															d
																.append('div')
																.text('ProteinPaint')
																.style('display', 'inline-block')
																.style('padding', '13px')
																.style('color', l.defaultcolor)
																.style('font-weight', 'bold')
														var m = new a.Menu({ border: '', padding: '0px' }),
															y = h(function() {
																m.clear().showunder(g.node()),
																	(function(e, t, n, r) {
																		if (e.length <= 1) n.d.selectAll('*').remove()
																		else {
																			var a = new Request(_ + '/genelookup', {
																				method: 'POST',
																				body: JSON.stringify({ input: e, genome: t, jwt: r })
																			})
																			fetch(a)
																				.then(function(e) {
																					return e.json()
																				})
																				.then(function(e) {
																					if (e.error) throw e.error
																					if (!e.hits) throw '.hits[] missing'
																					var r = !0,
																						a = !1,
																						o = void 0
																					try {
																						for (
																							var i,
																								l = function() {
																									var e = i.value
																									n.d
																										.append('div')
																										.attr('class', 'sja_menuoption')
																										.attr('isgene', '1')
																										.text(e)
																										.on('click', function() {
																											n.hide(), S(e, t)
																										})
																								},
																								u = e.hits[Symbol.iterator]();
																							!(r = (i = u.next()).done);
																							r = !0
																						)
																							l()
																					} catch (e) {
																						;(a = !0), (o = e)
																					} finally {
																						try {
																							!r && u.return && u.return()
																						} finally {
																							if (a) throw o
																						}
																					}
																				})
																				.catch(function(e) {
																					n.d
																						.append('div')
																						.style('border', 'solid 1px red')
																						.style('padding', '10px')
																						.text(e)
																				})
																		}
																	})(g.property('value'), b.property('value'), m, o)
															}, 300),
															g = d
																.append('div')
																.style('display', 'inline-block')
																.style('padding', '13px')
																.style('padding-right', '5px')
																.append('input')
																.style('border', 'solid 1px ' + l.defaultcolor)
																.style('padding', '3px')
																.attr('size', 20)
																.attr('placeholder', 'Gene, position, or SNP')
																.attr('title', 'Search by gene, SNP, or position')
																.on('keyup', function() {
																	a.keyupEnter()
																		? (function() {
																				;(0, r.selectAll)('.sja_ep_pane').remove()
																				var e = g.property('value').trim()
																				if (e) {
																					var t = m.d.select('.sja_menuoption')
																					t.size() > 0 && t.attr('isgene') && (e = t.text()),
																						S(e, b.property('value'), o),
																						g.property('value', ''),
																						m.hide()
																				}
																		  })()
																		: y()
																})
														g.node().focus()
														var b = d
															.append('div')
															.style('display', 'inline-block')
															.style('padding', '13px')
															.style('padding-left', '5px')
															.append('select')
															.attr('title', 'Select a genome')
															.style('margin', '1px 20px 1px 10px')
														for (var w in x)
															b.append('option')
																.attr('n', w)
																.text(x[w].species + ' ' + w)
																.property('value', w)
														return (
															d
																.append('span')
																.attr('class', 'sja_menuoption')
																.style('padding', '13px')
																.style('border-radius', '5px')
																.text('Apps')
																.on('click', function() {
																	!(function(e, t, o) {
																		var i = r.event.target.getBoundingClientRect()
																		M.clear().show(i.left - 50, i.top + i.height + 5)
																		var l = t.node(),
																			s = l.options[l.selectedIndex].value,
																			c = x[s]
																		c
																			? (M.d
																					.append('div')
																					.attr('class', 'sja_menuoption')
																					.text(s + ' genome browser')
																					.style('padding', '20px')
																					.on('click', function() {
																						M.hide()
																						var t = e.node().getBoundingClientRect(),
																							r = a.newpane({ x: t.left, y: t.top + t.height + 10 })
																						r.header.text(s + ' genome browser')
																						var i = {
																							hostURL: _,
																							jwt: o,
																							holder: r.body,
																							genome: c,
																							chr: c.defaultcoord.chr,
																							start: c.defaultcoord.start,
																							stop: c.defaultcoord.stop,
																							nobox: !0,
																							tklst: [],
																							debugmode: k
																						}
																						a.first_genetrack_tolist(c, i.tklst),
																							Promise.all([n.e(0), n.e(2), n.e(3)])
																								.then(n.t.bind(null, 13, 7))
																								.then(function(e) {
																									return new e.Block(i)
																								})
																					}),
																			  M.d
																					.append('div')
																					.attr('class', 'sja_menuoption')
																					.text('Load mutations from text files')
																					.style('padding', '20px')
																					.on('click', function() {
																						M.hide(), (0, u.bulkui)(i.left - 100, i.top + i.height + 5, x, _, o)
																					}),
																			  M.d
																					.append('div')
																					.attr('class', 'sja_menuoption')
																					.text('View a study')
																					.style('padding', '20px')
																					.on('click', function() {
																						M.hide(),
																							(function(e, t) {
																								var n = a.newpane({ x: e, y: t })
																								n.header.text('View a study'),
																									n.body.style('padding', '20px'),
																									n.body
																										.append('div')
																										.style('color', '#858585')
																										.html(
																											"A study can organize various data for a cohort, and is hosted on this server.<br>To view, enter the path to the study's JSON config file.<br><a href=https://drive.google.com/open?id=121SsSYiCb3NCU8jz0bF7UujFSN-1Y20b674dqa30iXE target=_blank>Learn how to organize data in a study</a>."
																										)
																								var o = n.body.append('div').style('margin-top', '20px'),
																									i = o
																										.append('input')
																										.style('margin-right', '5px')
																										.attr('size', 15)
																										.attr('placeholder', 'Study name')
																								function l() {
																									var e = i.property('value')
																									if ('' != e) {
																										i.property('value', ''), i.node().blur()
																										var t = a.newpane({ x: 100, y: 100 })
																										t.header.html('<span style="font-size:.7em">STUDY</span> ' + e),
																											t.body.style('padding', '0px 20px 20px 20px'),
																											(0, f.loadstudycohort)(x, e, t.body, _, null, !1, k)
																									}
																								}
																								i
																									.on('keyup', function() {
																										'Enter' == r.event.code && l()
																									})
																									.node()
																									.focus(),
																									o
																										.append('button')
																										.text('Submit')
																										.on('click', l),
																									o
																										.append('button')
																										.text('Clear')
																										.on('click', function() {
																											i.property('value', '')
																												.node()
																												.focus()
																										}),
																									n.body
																										.append('p')
																										.html(
																											'<a href=https://www.dropbox.com/s/psfzwkbg7v022ef/example_study.json?dl=0 target=_blank>Example study</a>'
																										)
																							})(i.left - 100, i.top + i.height + 5)
																					}),
																			  M.d
																					.append('div')
																					.attr('class', 'sja_menuoption')
																					.text('Fusion editor')
																					.style('padding-left', '20px')
																					.on('click', function() {
																						M.hide()
																						var e = a.newpane3(100, 100, x)
																						e[0].header.text('Fusion Editor'), e[0].body.style('margin', '10px')
																						var t = e[0].body
																							.append('div')
																							.text('Loading...')
																							.style('margin', '10px')
																						n.e(8)
																							.then(n.t.bind(null, 67, 7))
																							.then(function(n) {
																								t.remove(), n.svmrui(e, x, _, o)
																							})
																					}),
																			  M.d
																					.append('div')
																					.attr('class', 'sja_menuoption')
																					.text('Junction-by-sample matrix display')
																					.style('padding-left', '20px')
																					.on('click', function() {
																						M.hide(),
																							n
																								.e(53)
																								.then(n.t.bind(null, 314, 7))
																								.then(function(e) {
																									e.default(x, _, o)
																								})
																					}),
																			  M.d
																					.append('div')
																					.attr('class', 'sja_menuoption')
																					.text('Differential gene expression viewer')
																					.style('padding-left', '20px')
																					.on('click', function() {
																						M.hide(),
																							n
																								.e(6)
																								.then(n.t.bind(null, 31, 7))
																								.then(function(e) {
																									e.mavbui(x, _, o)
																								})
																					}),
																			  M.d
																					.append('div')
																					.attr('class', 'sja_menuoption')
																					.text('MAF timeline plot')
																					.style('padding-left', '20px')
																					.on('click', function() {
																						M.hide(),
																							n
																								.e(35)
																								.then(n.t.bind(null, 315, 7))
																								.then(function(e) {
																									e.default(x)
																								})
																					}),
																			  M.d
																					.append('div')
																					.attr('class', 'sja_menuoption')
																					.text('2DMAF plot')
																					.style('padding-left', '20px')
																					.on('click', function() {
																						M.hide(),
																							Promise.all([n.e(0), n.e(16)])
																								.then(n.t.bind(null, 123, 7))
																								.then(function(e) {
																									e.d2mafui(x)
																								})
																					}),
																			  M.d
																					.append('div')
																					.attr('class', 'sja_menuoption')
																					.text('Mutation burden & spectrum')
																					.style('padding-left', '20px')
																					.on('click', function() {
																						M.hide(),
																							n
																								.e(37)
																								.then(n.t.bind(null, 316, 7))
																								.then(function(e) {
																									e.default(x)
																								})
																					}),
																			  M.d
																					.append('div')
																					.attr('class', 'sja_menuoption')
																					.text('Expression to PCA map')
																					.style('padding-left', '20px')
																					.on('click', function() {
																						M.hide(),
																							n
																								.e(18)
																								.then(n.t.bind(null, 313, 7))
																								.then(function(e) {
																									e.e2pca_inputui(_, o)
																								})
																					}))
																			: alert('Invalid genome name: ' + s)
																	})(d, b, o)
																}),
															d
																.append('span')
																.classed('sja_menuoption', !0)
																.style('padding', '13px')
																.style('border-radius', '5px')
																.text('Help')
																.on('click', function() {
																	var e = r.event.target.getBoundingClientRect(),
																		t = M.clear()
																			.show(e.left - 50, e.top + e.height + 5)
																			.d.append('div')
																			.style('padding', '5px 20px')
																	t
																		.append('p')
																		.html(
																			'<a href=https://docs.google.com/document/d/1KNx4pVCKd4wgoHI4pjknBRTLrzYp6AL_D-j6MjcQSvQ/edit?usp=sharing target=_blank>Embed in your website</a>'
																		),
																		t
																			.append('p')
																			.html(
																				'<a href=https://drive.google.com/open?id=121SsSYiCb3NCU8jz0bF7UujFSN-1Y20b674dqa30iXE target=_blank>Make a Study View</a>'
																			),
																		t
																			.append('p')
																			.html(
																				'<a href=https://docs.google.com/document/d/1e0JVdcf1yQDZst3j77Xeoj_hDN72B6XZ1bo_cAd2rss/edit?usp=sharing target=_blank>URL parameters</a>'
																			),
																		t
																			.append('p')
																			.html(
																				'<a href=https://docs.google.com/document/d/1JWKq3ScW62GISFGuJvAajXchcRenZ3HAvpaxILeGaw0/edit?usp=sharing target=_blank>All tutorials</a>'
																			),
																		t
																			.append('p')
																			.html(
																				'<a href=https://groups.google.com/forum/#!forum/genomepaint target=_blank>User community</a>'
																			)
																}),
															b
														)
													})(t, i, e.jwt)),
												e.headerhtml && t.append('div').html(e.headerhtml),
												(b = t.append('div').style('margin', '20px')),
												(async function(e, t, r) {
													if (e.genome && r)
														for (var i = 0; i < r.node().childNodes.length; i++)
															if (r.node().childNodes[i].value == e.genome) {
																r.property('selectedIndex', i)
																break
															}
													if (e.xintest)
														!(function(e, t) {
															;(e.holder = t),
																n
																	.e(46)
																	.then(n.t.bind(null, 318, 7))
																	.then(function(t) {
																		return t.appInit(null, e)
																	})
														})(e.xintest, t)
													else if (e.singlecell)
														!(async function(e, t) {
															try {
																var r = x[e.genome]
																if (!r) throw 'Invalid genome: ' + e.genome
																;(e.genome = r),
																	await a.add_scriptTag('/static/js/three.js'),
																	await a.add_scriptTag('/static/js/loaders/PCDLoader.js'),
																	await a.add_scriptTag('/static/js/controls/TrackballControls.js'),
																	await a.add_scriptTag('/static/js/WebGL.js'),
																	await a.add_scriptTag('/static/js/libs/stats.min.js')
																var o = await Promise.all([n.e(0), n.e(1), n.e(4), n.e(21)]).then(
																	n.t.bind(null, 125, 7)
																)
																await o.init(e, t)
															} catch (e) {
																O('Error launching single cell viewer: ' + e), e.stack && console.log(e.stack)
															}
														})(e.singlecell, t)
													else if (e.fimo)
														!(function(e, t) {
															if (e.genome) {
																var r = x[e.genome]
																r
																	? ((e.genome = r),
																	  (e.div = t),
																	  Promise.all([n.e(13), n.e(40)])
																			.then(n.t.bind(null, 311, 7))
																			.then(function(t) {
																				t.init(e)
																			}))
																	: O('invalid genome for fimo')
															} else O('missing genome for fimo')
														})(e.fimo, t)
													else {
														if (e.mdssurvivalplot)
															return (
																e.genome && (e.mdssurvivalplot.genome = e.genome),
																void (function(e, t) {
																	if (e.genome) {
																		var r = x[e.genome]
																		if (r)
																			if (((e.genome = r), e.dataset))
																				if (((e.mds = r.datasets[e.dataset]), e.mds)) {
																					if ((delete e.dataset, e.plotlist)) {
																						var a = !0,
																							o = !1,
																							i = void 0
																						try {
																							for (
																								var l, u = e.plotlist[Symbol.iterator]();
																								!(a = (l = u.next()).done);
																								a = !0
																							)
																								l.value.renderplot = 1
																						} catch (e) {
																							;(o = !0), (i = e)
																						} finally {
																							try {
																								!a && u.return && u.return()
																							} finally {
																								if (o) throw i
																							}
																						}
																					}
																					n.e(19)
																						.then(n.t.bind(null, 310, 7))
																						.then(function(n) {
																							n.init(e, t, k)
																						})
																				} else O('invalid dataset for mdssurvivalplot')
																			else O('missing dataset for mdssurvivalplot')
																		else O('invalid genome for mdssurvivalplot')
																	} else O('missing genome for mdssurvivalplot')
																})(e.mdssurvivalplot, t)
															)
														if (e.mdssamplescatterplot)
															return (
																e.genome && (e.mdssamplescatterplot.genome = e.genome),
																void (function(e, t) {
																	if (e.genome) {
																		var r = x[e.genome]
																		if (r) {
																			if (((e.genome = r), e.dataset)) {
																				if (((e.mds = r.datasets[e.dataset]), !e.mds))
																					return void O('invalid dataset for mdssamplescatterplot')
																				;(e.dslabel = e.dataset), delete e.dataset
																			} else if (!e.analysisdata)
																				return void O('neither .dataset or .analysisdata is given')
																			Promise.all([n.e(0), n.e(1), n.e(4), n.e(17)])
																				.then(n.t.bind(null, 124, 7))
																				.then(function(n) {
																					n.init(e, t, k)
																				})
																		} else O('invalid genome for mdssamplescatterplot')
																	} else O('missing genome for mdssamplescatterplot')
																})(e.mdssamplescatterplot, t)
															)
														if (e.samplematrix)
															return (
																(e.samplematrix.jwt = e.jwt),
																void (function(e, t) {
																	e.genome
																		? ((e.genome = x[e.genome]),
																		  e.genome
																				? ((e.hostURL = _),
																				  (e.holder = t),
																				  (e.debugmode = k),
																				  window.location.search.includes('smx=3')
																						? ((e.client = a),
																						  (e.common = l),
																						  (e.string2pos = s.string2pos),
																						  (e.invalidcoord = s.invalidcoord),
																						  (e.block = Promise.all([n.e(0), n.e(2), n.e(3)]).then(
																								n.t.bind(null, 13, 7)
																						  )),
																						  (0, p.getsjcharts)(function(t) {
																								t.dthm(e)
																						  }))
																						: Promise.all([n.e(10), n.e(61)])
																								.then(n.t.bind(null, 312, 7))
																								.then(function(t) {
																									new t.Samplematrix(e)
																								}))
																				: O('invalid genome for samplematrix'))
																		: O('missing genome for launching samplematrix')
																})(e.samplematrix, t)
															)
														if (e.hic)
															return (
																(e.hic.jwt = e.jwt),
																void (function(e, t) {
																	e.genome
																		? ((e.genome = x[e.genome]),
																		  e.genome
																				? e.file
																					? ((e.hostURL = _),
																					  (e.holder = t),
																					  Promise.all([n.e(11), n.e(22)])
																							.then(n.t.bind(null, 119, 7))
																							.then(function(t) {
																								t.hicparsefile(e, k)
																							}))
																					: O('missing file for hic')
																				: O('invalid genome for hic'))
																		: O('missing genome for hic')
																})(e.hic, t)
															)
														if (e.block)
															return (async function(e, t) {
																if (e.genome) {
																	var r = x[e.genome]
																	if (r) {
																		if (
																			(e.study && (0, f.loadstudycohort)(x, e.study, t, _, e.jwt, !0, k),
																			e.studyview,
																			e.tracks)
																		) {
																			var i = !0,
																				l = !1,
																				u = void 0
																			try {
																				for (
																					var c,
																						d = async function() {
																							var n = c.value
																							if (n.type == a.tkt.mds2 && n.dslabel) return 'continue'
																							if (n.mdsjsonfile || n.mdsjsonurl) {
																								var r,
																									o = await (0, m.init_mdsjson)(n.mdsjsonfile, n.mdsjsonurl, t)
																								;(e.tracks = e.tracks.filter(function(e) {
																									return e != n
																								})),
																									(r = e.tracks).push.apply(
																										r,
																										(function(e) {
																											if (Array.isArray(e)) {
																												for (var t = 0, n = Array(e.length); t < e.length; t++)
																													n[t] = e[t]
																												return n
																											}
																											return Array.from(e)
																										})(o)
																									)
																							}
																							n.iscustom = !0
																						},
																						p = e.tracks[Symbol.iterator]();
																					!(i = (c = p.next()).done);
																					i = !0
																				)
																					await d()
																			} catch (e) {
																				;(l = !0), (u = e)
																			} finally {
																				try {
																					!i && p.return && p.return()
																				} finally {
																					if (l) throw u
																				}
																			}
																		}
																		var h = {
																			genome: r,
																			hostURL: _,
																			jwt: e.jwt,
																			holder: t,
																			nativetracks: e.nativetracks,
																			tklst: e.tracks,
																			debugmode: k
																		}
																		if (e.width) {
																			var v = Number.parseInt(e.width)
																			if (Number.isNaN(v)) return O('browser width must be integer')
																			h.width = v
																		}
																		if (e.subpanels) {
																			if (!Array.isArray(e.subpanels)) return O('subpanels is not array')
																			var y = [],
																				g = !0,
																				b = !1,
																				w = void 0
																			try {
																				for (
																					var j, M = e.subpanels[Symbol.iterator]();
																					!(g = (j = M.next()).done);
																					g = !0
																				) {
																					var P = j.value
																					P.chr
																						? P.start && P.stop
																							? (P.width || (P.width = 400), P.leftpad || (P.leftpad = 5), y.push(P))
																							: O('missing start or stop in one subpanel')
																						: O('missing chr in one subpanel')
																				}
																			} catch (e) {
																				;(b = !0), (w = e)
																			} finally {
																				try {
																					!g && M.return && M.return()
																				} finally {
																					if (b) throw w
																				}
																			}
																			y.length && (h.subpanels = y)
																		}
																		if (
																			(e.nobox ? (h.nobox = !0) : (h.dogtag = e.dogtag || e.genome),
																			e.chr && Number.isInteger(e.start))
																		)
																			(h.chr = e.chr),
																				(h.start = e.start),
																				(h.stop = Number.isInteger(e.stop) ? e.stop : e.start + 1)
																		else if (e.position) {
																			var S = (0, s.string2pos)(e.position, r)
																			S && ((h.chr = S.chr), (h.start = S.start), (h.stop = S.stop))
																		} else if (e.positionbygene)
																			try {
																				var A = await (0, o.findgenemodel_bysymbol)(e.genome, e.positionbygene)
																				if (A && A[0]) {
																					var C = A[0]
																					;(h.chr = C.chr), (h.start = C.start), (h.stop = C.stop)
																				}
																			} catch (e) {
																				O(e)
																			}
																		h.chr ||
																			((h.chr = r.defaultcoord.chr),
																			(h.start = r.defaultcoord.start),
																			(h.stop = r.defaultcoord.stop)),
																			e.datasetqueries && (h.datasetqueries = e.datasetqueries)
																		var N = a.may_get_locationsearch()
																		if (N) {
																			if (N.has('position')) {
																				var T = (0, s.string2pos)(N.get('position'), r)
																				T && ((h.chr = T.chr), (h.start = T.start), (h.stop = T.stop))
																			}
																			if (N.has('hlregion')) {
																				var E = [],
																					I = !0,
																					R = !1,
																					L = void 0
																				try {
																					for (
																						var D,
																							F = N.get('hlregion')
																								.split(',')
																								[Symbol.iterator]();
																						!(I = (D = F.next()).done);
																						I = !0
																					) {
																						var q = D.value,
																							U = (0, s.string2pos)(q, r, !0)
																						U && E.push(U)
																					}
																				} catch (e) {
																					;(R = !0), (L = e)
																				} finally {
																					try {
																						!I && F.return && F.return()
																					} finally {
																						if (R) throw L
																					}
																				}
																				E.length && (h.hlregions = E)
																			}
																			if (N.has('bedgraphdotfile')) {
																				h.tklst || (h.tklst = [])
																				for (var G = N.get('bedgraphdotfile').split(','), z = 0; z < G.length; z += 2)
																					G[z] &&
																						G[z + 1] &&
																						h.tklst.push({ type: a.tkt.bedgraphdot, name: G[z], file: G[z + 1] })
																			}
																		}
																		return Promise.all([n.e(0), n.e(2), n.e(3)])
																			.then(n.t.bind(null, 13, 7))
																			.then(function(e) {
																				return { block: new e.Block(h) }
																			})
																	}
																	O('Invalid genome: ' + e.genome)
																} else O('Cannot embed: must specify reference genome')
															})(e, t)
														if (e.study) (0, f.loadstudycohort)(x, e.study, t, _, e.jwt, !1, k)
														else {
															if (e.studyview) {
																var c = e.studyview
																c.hostURL = e.host
																var h = c.genome || e.genome
																return (
																	(c.genome = x[h]),
																	(c.hostURL = _),
																	(c.jwt = e.jwt),
																	(c.holder = t),
																	void (0, u.bulkembed)(c)
																)
															}
															if ((e.p && ((e.gene = e.p), delete e.p), e.gene))
																!(function(e, t) {
																	if (e.genome) {
																		if (e.tracks) {
																			var n = !0,
																				r = !1,
																				a = void 0
																			try {
																				for (var o, i = e.tracks[Symbol.iterator](); !(n = (o = i.next()).done); n = !0)
																					o.value.iscustom = !0
																			} catch (e) {
																				;(r = !0), (a = e)
																			} finally {
																				try {
																					!n && i.return && i.return()
																				} finally {
																					if (r) throw a
																				}
																			}
																		}
																		var l = {
																			jwt: e.jwt,
																			hostURL: _,
																			query: e.gene,
																			genome: x[e.genome],
																			holder: t,
																			variantPageCall_snv: w,
																			samplecart: j,
																			debugmode: k,
																			datasetqueries: e.datasetqueries,
																			mset: e.mset,
																			tklst: e.tracks,
																			gmmode: e.gmmode
																		}
																		e.dataset &&
																			((l.dataset = e.dataset.split(',')),
																			e.hidedatasetexpression && (l.hidedatasetexpression = !0)),
																			e.hidegenecontrol && (l.hidegenecontrol = !0),
																			e.hidegenelegend && (l.hidegenelegend = !0)
																		var u = null
																		if (e.hlaachange) {
																			if (((u = new Map()), Array.isArray(e.hlaachange))) {
																				var s = !0,
																					f = !1,
																					c = void 0
																				try {
																					for (
																						var p, h = e.hlaachange[Symbol.iterator]();
																						!(s = (p = h.next()).done);
																						s = !0
																					) {
																						var v = p.value
																						v.name && u.set(v.name, v)
																					}
																				} catch (e) {
																					;(f = !0), (c = e)
																				} finally {
																					try {
																						!s && h.return && h.return()
																					} finally {
																						if (f) throw c
																					}
																				}
																			} else {
																				var m = !0,
																					y = !1,
																					g = void 0
																				try {
																					for (
																						var b, M = e.hlaachange.split(',')[Symbol.iterator]();
																						!(m = (b = M.next()).done);
																						m = !0
																					) {
																						var P = b.value
																						u.set(P, !1)
																					}
																				} catch (e) {
																					;(y = !0), (g = e)
																				} finally {
																					try {
																						!m && M.return && M.return()
																					} finally {
																						if (y) throw g
																					}
																				}
																			}
																			u.size && (l.hlaachange = u)
																		}
																		e.hlvariants && (l.hlvariants = e.hlvariants), (0, d.default)(l)
																	} else O('Cannot embed: must specify reference genome')
																})(e, t)
															else if (e.fusioneditor)
																!(function(e, t) {
																	if (e.fusioneditor.uionly) {
																		var r = t.append('div').style('margin', '40px 20px 20px 20px'),
																			a = r.append('p')
																		a.append('span').html('Genome&nbsp;')
																		var o = a.append('select').attr('title', 'Select a genome')
																		for (var i in x) o.append('option').text(i)
																		var l = r.append('div').style('margin', '20px 0px'),
																			u = t.append('div').style('margin', '10px 20px'),
																			s = t.append('div').style('margin', '20px')
																		n.e(8)
																			.then(n.t.bind(null, 67, 7))
																			.then(function(t) {
																				t.svmrui([null, r, o.node(), l, u, s], x, _, e.jwt)
																			})
																	} else {
																		var f = x[e.genome]
																		f
																			? n
																					.e(8)
																					.then(n.t.bind(null, 67, 7))
																					.then(function(n) {
																						n.svmrparseinput(e.fusioneditor, O, f, t, _, e.jwt)
																					})
																			: O('Invalid genome: ' + e.genome)
																	}
																})(e, t)
															else if (e.mavolcanoplot)
																!(function(e, t) {
																	var r = x[e.genome]
																	r
																		? ((e.mavolcanoplot.hostURL = _),
																		  (e.mavolcanoplot.genome = r),
																		  n
																				.e(6)
																				.then(n.t.bind(null, 31, 7))
																				.then(function(n) {
																					n.mavbparseinput(e.mavolcanoplot, O, t, e.jwt)
																				}))
																		: O('Invalid genome: ' + e.genome)
																})(e, t)
															else if (e.twodmaf)
																!(function(e, t) {
																	var r = x[e.genome]
																	r
																		? ((e.twodmaf.hostURL = _),
																		  (e.twodmaf.genome = r),
																		  Promise.all([n.e(0), n.e(16)])
																				.then(n.t.bind(null, 123, 7))
																				.then(function(n) {
																					n.d2mafparseinput(e.twodmaf, t)
																				}))
																		: O('Invalid genome: ' + e.genome)
																})(e, t)
															else {
																if (e.parseurl && location.search.length) {
																	var y = await v.parse({
																		genomes: x,
																		hostURL: _,
																		variantPageCall_snv: w,
																		samplecart: j,
																		holder: t,
																		selectgenome: r,
																		debugmode: k
																	})
																	y && O(y)
																}
																e.project && (0, u.bulkui)(0, 0, x, _),
																	e.toy &&
																		(function(e, t) {
																			e.holder || (e.holder = t),
																				n
																					.e(33)
																					.then(n.t.bind(null, 317, 7))
																					.then(function(t) {
																						t.appInit(null, e)
																					})
																		})(e.toy, t),
																	e.termdb &&
																		(function(e, t) {
																			e.holder || (e.holder = t),
																				e.callbacks || (e.callbacks = {}),
																				Promise.all([n.e(0), n.e(1), n.e(4), n.e(12), n.e(29)])
																					.then(n.t.bind(null, 309, 7))
																					.then(function(t) {
																						t.appInit(null, e)
																					})
																		})(e.termdb, t)
															}
														}
													}
												})(e, b, P)
											)
										})
										.catch(function(e) {
											t.text(e.message), e.stack && console.log(e.stack)
										})
								}
								async function S(e, t, r) {
									var o = x[t]
									if (o) {
										b.selectAll('*').remove()
										var i = v.url2map(),
											l = await v.get_tklst(i),
											u = (0, s.string2pos)(e, o)
										if (u) {
											var f = {
												hostURL: _,
												jwt: r,
												holder: b,
												genome: o,
												chr: u.chr,
												start: u.start,
												stop: u.stop,
												dogtag: t,
												allowpopup: !0,
												tklst: l,
												debugmode: k
											}
											return (
												a.first_genetrack_tolist(o, f.tklst),
												void Promise.all([n.e(0), n.e(2), n.e(3)])
													.then(n.t.bind(null, 13, 7))
													.then(function(e) {
														return new e.Block(f)
													})
													.catch(function(e) {
														O(e.message), console.log(e)
													})
											)
										}
										var c = {
												hostURL: _,
												jwt: r,
												query: e,
												genome: o,
												holder: b,
												variantPageCall_snv: w,
												samplecart: j,
												tklst: l,
												debugmode: k
											},
											p = sessionStorage.getItem('urlp_mds')
										if (p) {
											var h = p.split(',')
											2 == h.length && (c.datasetqueries = [{ dataset: h[0], querykey: h[1] }])
										}
										;(0, d.default)(c)
									} else console.error('unknown genome ' + t)
								}
								M.d.style('z-index', 5555), (window.runproteinpaint = P)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return (0, a.default)((0, r.default)(e).call(document.documentElement))
									})
								var r = o(n(21)),
									a = o(n(68))
								function o(e) {
									return e && e.__esModule ? e : { default: e }
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										'function' != typeof e && (e = (0, o.default)(e))
										for (var t = this._groups, n = t.length, r = new Array(n), i = 0; i < n; ++i)
											for (var l, u, s = t[i], f = s.length, c = (r[i] = new Array(f)), d = 0; d < f; ++d)
												(l = s[d]) &&
													(u = e.call(l, l.__data__, d, s)) &&
													('__data__' in l && (u.__data__ = l.__data__), (c[d] = u))
										return new a.Selection(r, this._parents)
									})
								var r,
									a = n(4),
									o = (r = n(34)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										'function' != typeof e && (e = (0, o.default)(e))
										for (var t = this._groups, n = t.length, r = [], i = [], l = 0; l < n; ++l)
											for (var u, s = t[l], f = s.length, c = 0; c < f; ++c)
												(u = s[c]) && (r.push(e.call(u, u.__data__, c, s)), i.push(u))
										return new a.Selection(r, i)
									})
								var r,
									a = n(4),
									o = (r = n(69)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										'function' != typeof e && (e = (0, o.default)(e))
										for (var t = this._groups, n = t.length, r = new Array(n), i = 0; i < n; ++i)
											for (var l, u = t[i], s = u.length, f = (r[i] = []), c = 0; c < s; ++c)
												(l = u[c]) && e.call(l, l.__data__, c, u) && f.push(l)
										return new a.Selection(r, this._parents)
									})
								var r,
									a = n(4),
									o = (r = n(70)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										if (!e)
											return (
												(y = new Array(this.size())),
												(p = -1),
												this.each(function(e) {
													y[++p] = e
												}),
												y
											)
										var n = t ? u : l,
											r = this._parents,
											o = this._groups
										'function' != typeof e && (e = (0, i.default)(e))
										for (var s = o.length, f = new Array(s), c = new Array(s), d = new Array(s), p = 0; p < s; ++p) {
											var h = r[p],
												v = o[p],
												m = v.length,
												y = e.call(h, h && h.__data__, p, r),
												g = y.length,
												b = (c[p] = new Array(g)),
												_ = (f[p] = new Array(g))
											n(h, v, b, _, (d[p] = new Array(m)), y, t)
											for (var x, w, j = 0, k = 0; j < g; ++j)
												if ((x = b[j])) {
													for (j >= k && (k = j + 1); !(w = _[k]) && ++k < g; );
													x._next = w || null
												}
										}
										return ((f = new a.Selection(f, r))._enter = c), (f._exit = d), f
									})
								var r,
									a = n(4),
									o = n(71),
									i = (r = n(132)) && r.__esModule ? r : { default: r }
								function l(e, t, n, r, a, i) {
									for (var l, u = 0, s = t.length, f = i.length; u < f; ++u)
										(l = t[u]) ? ((l.__data__ = i[u]), (r[u] = l)) : (n[u] = new o.EnterNode(e, i[u]))
									for (; u < s; ++u) (l = t[u]) && (a[u] = l)
								}
								function u(e, t, n, r, a, i, l) {
									var u,
										s,
										f,
										c = {},
										d = t.length,
										p = i.length,
										h = new Array(d)
									for (u = 0; u < d; ++u)
										(s = t[u]) && ((h[u] = f = '$' + l.call(s, s.__data__, u, t)), f in c ? (a[u] = s) : (c[f] = s))
									for (u = 0; u < p; ++u)
										(s = c[(f = '$' + l.call(e, i[u], u, i))])
											? ((r[u] = s), (s.__data__ = i[u]), (c[f] = null))
											: (n[u] = new o.EnterNode(e, i[u]))
									for (u = 0; u < d; ++u) (s = t[u]) && c[h[u]] === s && (a[u] = s)
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return function() {
											return e
										}
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										return new o.Selection(this._exit || this._groups.map(a.default), this._parents)
									})
								var r,
									a = (r = n(72)) && r.__esModule ? r : { default: r },
									o = n(4)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										for (
											var t = this._groups,
												n = e._groups,
												a = t.length,
												o = n.length,
												i = Math.min(a, o),
												l = new Array(a),
												u = 0;
											u < i;
											++u
										)
											for (var s, f = t[u], c = n[u], d = f.length, p = (l[u] = new Array(d)), h = 0; h < d; ++h)
												(s = f[h] || c[h]) && (p[h] = s)
										for (; u < a; ++u) l[u] = t[u]
										return new r.Selection(l, this._parents)
									})
								var r = n(4)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										for (var e = this._groups, t = -1, n = e.length; ++t < n; )
											for (var r, a = e[t], o = a.length - 1, i = a[o]; --o >= 0; )
												(r = a[o]) && (i && i !== r.nextSibling && i.parentNode.insertBefore(r, i), (i = r))
										return this
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										function t(t, n) {
											return t && n ? e(t.__data__, n.__data__) : !t - !n
										}
										e || (e = a)
										for (var n = this._groups, o = n.length, i = new Array(o), l = 0; l < o; ++l) {
											for (var u, s = n[l], f = s.length, c = (i[l] = new Array(f)), d = 0; d < f; ++d)
												(u = s[d]) && (c[d] = u)
											c.sort(t)
										}
										return new r.Selection(i, this._parents).order()
									})
								var r = n(4)
								function a(e, t) {
									return e < t ? -1 : e > t ? 1 : e >= t ? 0 : NaN
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										var e = arguments[0]
										return (arguments[0] = this), e.apply(null, arguments), this
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										var e = new Array(this.size()),
											t = -1
										return (
											this.each(function() {
												e[++t] = this
											}),
											e
										)
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										for (var e = this._groups, t = 0, n = e.length; t < n; ++t)
											for (var r = e[t], a = 0, o = r.length; a < o; ++a) {
												var i = r[a]
												if (i) return i
											}
										return null
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										var e = 0
										return (
											this.each(function() {
												++e
											}),
											e
										)
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										return !this.node()
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										for (var t = this._groups, n = 0, r = t.length; n < r; ++n)
											for (var a, o = t[n], i = 0, l = o.length; i < l; ++i) (a = o[i]) && e.call(a, a.__data__, i, o)
										return this
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n = (0, a.default)(e)
										if (arguments.length < 2) {
											var r = this.node()
											return n.local ? r.getAttributeNS(n.space, n.local) : r.getAttribute(n)
										}
										return this.each(
											(null == t ? (n.local ? i : o) : 'function' == typeof t ? (n.local ? f : s) : n.local ? u : l)(
												n,
												t
											)
										)
									})
								var r,
									a = (r = n(32)) && r.__esModule ? r : { default: r }
								function o(e) {
									return function() {
										this.removeAttribute(e)
									}
								}
								function i(e) {
									return function() {
										this.removeAttributeNS(e.space, e.local)
									}
								}
								function l(e, t) {
									return function() {
										this.setAttribute(e, t)
									}
								}
								function u(e, t) {
									return function() {
										this.setAttributeNS(e.space, e.local, t)
									}
								}
								function s(e, t) {
									return function() {
										var n = t.apply(this, arguments)
										null == n ? this.removeAttribute(e) : this.setAttribute(e, n)
									}
								}
								function f(e, t) {
									return function() {
										var n = t.apply(this, arguments)
										null == n ? this.removeAttributeNS(e.space, e.local) : this.setAttributeNS(e.space, e.local, n)
									}
								}
							},
							function(e, t, n) {
								function r(e) {
									return function() {
										delete this[e]
									}
								}
								function a(e, t) {
									return function() {
										this[e] = t
									}
								}
								function o(e, t) {
									return function() {
										var n = t.apply(this, arguments)
										null == n ? delete this[e] : (this[e] = n)
									}
								}
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										return arguments.length > 1
											? this.each((null == t ? r : 'function' == typeof t ? o : a)(e, t))
											: this.node()[e]
									})
							},
							function(e, t, n) {
								function r(e) {
									return e.trim().split(/^|\s+/)
								}
								function a(e) {
									return e.classList || new o(e)
								}
								function o(e) {
									;(this._node = e), (this._names = r(e.getAttribute('class') || ''))
								}
								function i(e, t) {
									for (var n = a(e), r = -1, o = t.length; ++r < o; ) n.add(t[r])
								}
								function l(e, t) {
									for (var n = a(e), r = -1, o = t.length; ++r < o; ) n.remove(t[r])
								}
								function u(e) {
									return function() {
										i(this, e)
									}
								}
								function s(e) {
									return function() {
										l(this, e)
									}
								}
								function f(e, t) {
									return function() {
										;(t.apply(this, arguments) ? i : l)(this, e)
									}
								}
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n = r(e + '')
										if (arguments.length < 2) {
											for (var o = a(this.node()), i = -1, l = n.length; ++i < l; ) if (!o.contains(n[i])) return !1
											return !0
										}
										return this.each(('function' == typeof t ? f : t ? u : s)(n, t))
									}),
									(o.prototype = {
										add: function(e) {
											this._names.indexOf(e) < 0 &&
												(this._names.push(e), this._node.setAttribute('class', this._names.join(' ')))
										},
										remove: function(e) {
											var t = this._names.indexOf(e)
											t >= 0 && (this._names.splice(t, 1), this._node.setAttribute('class', this._names.join(' ')))
										},
										contains: function(e) {
											return this._names.indexOf(e) >= 0
										}
									})
							},
							function(e, t, n) {
								function r() {
									this.textContent = ''
								}
								function a(e) {
									return function() {
										this.textContent = e
									}
								}
								function o(e) {
									return function() {
										var t = e.apply(this, arguments)
										this.textContent = null == t ? '' : t
									}
								}
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return arguments.length
											? this.each(null == e ? r : ('function' == typeof e ? o : a)(e))
											: this.node().textContent
									})
							},
							function(e, t, n) {
								function r() {
									this.innerHTML = ''
								}
								function a(e) {
									return function() {
										this.innerHTML = e
									}
								}
								function o(e) {
									return function() {
										var t = e.apply(this, arguments)
										this.innerHTML = null == t ? '' : t
									}
								}
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return arguments.length
											? this.each(null == e ? r : ('function' == typeof e ? o : a)(e))
											: this.node().innerHTML
									})
							},
							function(e, t, n) {
								function r() {
									this.nextSibling && this.parentNode.appendChild(this)
								}
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										return this.each(r)
									})
							},
							function(e, t, n) {
								function r() {
									this.previousSibling && this.parentNode.insertBefore(this, this.parentNode.firstChild)
								}
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										return this.each(r)
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t = 'function' == typeof e ? e : (0, a.default)(e)
										return this.select(function() {
											return this.appendChild(t.apply(this, arguments))
										})
									})
								var r,
									a = (r = n(21)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n = 'function' == typeof e ? e : (0, r.default)(e),
											o = null == t ? i : 'function' == typeof t ? t : (0, a.default)(t)
										return this.select(function() {
											return this.insertBefore(n.apply(this, arguments), o.apply(this, arguments) || null)
										})
									})
								var r = o(n(21)),
									a = o(n(34))
								function o(e) {
									return e && e.__esModule ? e : { default: e }
								}
								function i() {
									return null
								}
							},
							function(e, t, n) {
								function r() {
									var e = this.parentNode
									e && e.removeChild(this)
								}
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										return this.each(r)
									})
							},
							function(e, t, n) {
								function r() {
									return this.parentNode.insertBefore(this.cloneNode(!1), this.nextSibling)
								}
								function a() {
									return this.parentNode.insertBefore(this.cloneNode(!0), this.nextSibling)
								}
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return this.select(e ? a : r)
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return arguments.length ? this.property('__data__', e) : this.node().__data__
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										return this.each(('function' == typeof t ? l : i)(e, t))
									})
								var r,
									a = (r = n(35)) && r.__esModule ? r : { default: r }
								function o(e, t, n) {
									var r = (0, a.default)(e),
										o = r.CustomEvent
									'function' == typeof o
										? (o = new o(t, n))
										: ((o = r.document.createEvent('Event')),
										  n ? (o.initEvent(t, n.bubbles, n.cancelable), (o.detail = n.detail)) : o.initEvent(t, !1, !1)),
										e.dispatchEvent(o)
								}
								function i(e, t) {
									return function() {
										return o(this, e, t)
									}
								}
								function l(e, t) {
									return function() {
										return o(this, e, t.apply(this, arguments))
									}
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.default = a)
								var r = 0
								function a() {
									return new o()
								}
								function o() {
									this._ = '@' + (++r).toString(36)
								}
								o.prototype = a.prototype = {
									constructor: o,
									get: function(e) {
										for (var t = this._; !(t in e); ) if (!(e = e.parentNode)) return
										return e[t]
									},
									set: function(e, t) {
										return (e[this._] = t)
									},
									remove: function(e) {
										return this._ in e && delete e[this._]
									},
									toString: function() {
										return this._
									}
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t = (0, r.default)()
										return t.changedTouches && (t = t.changedTouches[0]), (0, a.default)(e, t)
									})
								var r = o(n(37)),
									a = o(n(22))
								function o(e) {
									return e && e.__esModule ? e : { default: e }
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return 'string' == typeof e
											? new r.Selection([document.querySelectorAll(e)], [document.documentElement])
											: new r.Selection([null == e ? [] : e], r.root)
									})
								var r = n(4)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n) {
										arguments.length < 3 && ((n = t), (t = (0, r.default)().changedTouches))
										for (var o, i = 0, l = t ? t.length : 0; i < l; ++i)
											if ((o = t[i]).identifier === n) return (0, a.default)(e, o)
										return null
									})
								var r = o(n(37)),
									a = o(n(22))
								function o(e) {
									return e && e.__esModule ? e : { default: e }
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										null == t && (t = (0, r.default)().touches)
										for (var n = 0, o = t ? t.length : 0, i = new Array(o); n < o; ++n) i[n] = (0, a.default)(e, t[n])
										return i
									})
								var r = o(n(37)),
									a = o(n(22))
								function o(e) {
									return e && e.__esModule ? e : { default: e }
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = i),
									(t.point = function() {
										return (function e(t) {
											var n = t.copy
											return (
												(t.padding = t.paddingOuter),
												delete t.paddingInner,
												delete t.paddingOuter,
												(t.copy = function() {
													return e(n())
												}),
												t
											)
										})(i().paddingInner(1))
									})
								var r,
									a = n(7),
									o = (r = n(86)) && r.__esModule ? r : { default: r }
								function i() {
									var e,
										t,
										n = (0, o.default)().unknown(void 0),
										r = n.domain,
										l = n.range,
										u = [0, 1],
										s = !1,
										f = 0,
										c = 0,
										d = 0.5
									function p() {
										var n = r().length,
											o = u[1] < u[0],
											i = u[o - 0],
											p = u[1 - o]
										;(e = (p - i) / Math.max(1, n - f + 2 * c)),
											s && (e = Math.floor(e)),
											(i += (p - i - e * (n - f)) * d),
											(t = e * (1 - f)),
											s && ((i = Math.round(i)), (t = Math.round(t)))
										var h = (0, a.range)(n).map(function(t) {
											return i + e * t
										})
										return l(o ? h.reverse() : h)
									}
									return (
										delete n.unknown,
										(n.domain = function(e) {
											return arguments.length ? (r(e), p()) : r()
										}),
										(n.range = function(e) {
											return arguments.length ? ((u = [+e[0], +e[1]]), p()) : u.slice()
										}),
										(n.rangeRound = function(e) {
											return (u = [+e[0], +e[1]]), (s = !0), p()
										}),
										(n.bandwidth = function() {
											return t
										}),
										(n.step = function() {
											return e
										}),
										(n.round = function(e) {
											return arguments.length ? ((s = !!e), p()) : s
										}),
										(n.padding = function(e) {
											return arguments.length ? ((f = c = Math.max(0, Math.min(1, e))), p()) : f
										}),
										(n.paddingInner = function(e) {
											return arguments.length ? ((f = Math.max(0, Math.min(1, e))), p()) : f
										}),
										(n.paddingOuter = function(e) {
											return arguments.length ? ((c = Math.max(0, Math.min(1, e))), p()) : c
										}),
										(n.align = function(e) {
											return arguments.length ? ((d = Math.max(0, Math.min(1, e))), p()) : d
										}),
										(n.copy = function() {
											return i()
												.domain(r())
												.range(u)
												.round(s)
												.paddingInner(f)
												.paddingOuter(c)
												.align(d)
										}),
										p()
									)
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n) {
										var a,
											o,
											i,
											l,
											u = e.length,
											s = t.length,
											f = new Array(u * s)
										for (null == n && (n = r.pair), a = i = 0; a < u; ++a)
											for (l = e[a], o = 0; o < s; ++o, ++i) f[i] = n(l, t[o])
										return f
									})
								var r = n(76)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										return t < e ? -1 : t > e ? 1 : t >= e ? 0 : NaN
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										var e = l.default,
											t = i.default,
											n = f.default
										function c(r) {
											var o,
												i,
												l = r.length,
												f = new Array(l)
											for (o = 0; o < l; ++o) f[o] = e(r[o], o, r)
											var c = t(f),
												d = c[0],
												p = c[1],
												h = n(f, d, p)
											Array.isArray(h) ||
												((h = (0, s.tickStep)(d, p, h)),
												(h = (0, u.default)(Math.ceil(d / h) * h, Math.floor(p / h) * h, h)))
											for (var v = h.length; h[0] <= d; ) h.shift(), --v
											for (; h[v - 1] > p; ) h.pop(), --v
											var m,
												y = new Array(v + 1)
											for (o = 0; o <= v; ++o) ((m = y[o] = []).x0 = o > 0 ? h[o - 1] : d), (m.x1 = o < v ? h[o] : p)
											for (o = 0; o < l; ++o) d <= (i = f[o]) && i <= p && y[(0, a.default)(h, i, 0, v)].push(r[o])
											return y
										}
										return (
											(c.value = function(t) {
												return arguments.length ? ((e = 'function' == typeof t ? t : (0, o.default)(t)), c) : e
											}),
											(c.domain = function(e) {
												return arguments.length
													? ((t = 'function' == typeof e ? e : (0, o.default)([e[0], e[1]])), c)
													: t
											}),
											(c.thresholds = function(e) {
												return arguments.length
													? ((n =
															'function' == typeof e
																? e
																: Array.isArray(e)
																? (0, o.default)(r.slice.call(e))
																: (0, o.default)(e)),
													  c)
													: n
											}),
											c
										)
									})
								var r = n(80),
									a = c(n(74)),
									o = c(n(165)),
									i = c(n(79)),
									l = c(n(166)),
									u = c(n(81)),
									s = n(82),
									f = c(n(83))
								function c(e) {
									return e && e.__esModule ? e : { default: e }
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return function() {
											return e
										}
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return e
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n) {
										return (
											(e = r.map.call(e, o.default).sort(a.default)),
											Math.ceil(
												(n - t) / (2 * ((0, i.default)(e, 0.75) - (0, i.default)(e, 0.25)) * Math.pow(e.length, -1 / 3))
											)
										)
									})
								var r = n(80),
									a = l(n(14)),
									o = l(n(15)),
									i = l(n(38))
								function l(e) {
									return e && e.__esModule ? e : { default: e }
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n) {
										return Math.ceil((n - t) / (3.5 * (0, a.default)(e) * Math.pow(e.length, -1 / 3)))
									})
								var r,
									a = (r = n(77)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n,
											r,
											a = e.length,
											o = -1
										if (null == t) {
											for (; ++o < a; )
												if (null != (n = e[o]) && n >= n) for (r = n; ++o < a; ) null != (n = e[o]) && n > r && (r = n)
										} else
											for (; ++o < a; )
												if (null != (n = t(e[o], o, e)) && n >= n)
													for (r = n; ++o < a; ) null != (n = t(e[o], o, e)) && n > r && (r = n)
										return r
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n,
											r = e.length,
											o = r,
											i = -1,
											l = 0
										if (null == t) for (; ++i < r; ) isNaN((n = (0, a.default)(e[i]))) ? --o : (l += n)
										else for (; ++i < r; ) isNaN((n = (0, a.default)(t(e[i], i, e)))) ? --o : (l += n)
										if (o) return l / o
									})
								var r,
									a = (r = n(15)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n,
											i = e.length,
											l = -1,
											u = []
										if (null == t) for (; ++l < i; ) isNaN((n = (0, a.default)(e[l]))) || u.push(n)
										else for (; ++l < i; ) isNaN((n = (0, a.default)(t(e[l], l, e)))) || u.push(n)
										return (0, o.default)(u.sort(r.default), 0.5)
									})
								var r = i(n(14)),
									a = i(n(15)),
									o = i(n(38))
								function i(e) {
									return e && e.__esModule ? e : { default: e }
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										for (var t, n, r, a = e.length, o = -1, i = 0; ++o < a; ) i += e[o].length
										for (n = new Array(i); --a >= 0; ) for (t = (r = e[a]).length; --t >= 0; ) n[--i] = r[t]
										return n
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										for (var n = t.length, r = new Array(n); n--; ) r[n] = e[t[n]]
										return r
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										if ((n = e.length)) {
											var n,
												r,
												o = 0,
												i = 0,
												l = e[i]
											for (null == t && (t = a.default); ++o < n; )
												(t((r = e[o]), l) < 0 || 0 !== t(l, l)) && ((l = r), (i = o))
											return 0 === t(l, l) ? i : void 0
										}
									})
								var r,
									a = (r = n(14)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n) {
										for (var r, a, o = (null == n ? e.length : n) - (t = null == t ? 0 : +t); o; )
											(a = (Math.random() * o--) | 0), (r = e[o + t]), (e[o + t] = e[a + t]), (e[a + t] = r)
										return e
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n,
											r = e.length,
											a = -1,
											o = 0
										if (null == t) for (; ++a < r; ) (n = +e[a]) && (o += n)
										else for (; ++a < r; ) (n = +t(e[a], a, e)) && (o += n)
										return o
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										return (0, a.default)(arguments)
									})
								var r,
									a = (r = n(85)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										var e,
											t,
											n,
											r = [],
											s = []
										function f(n, o, i, l) {
											if (o >= r.length) return null != e && n.sort(e), null != t ? t(n) : n
											for (var u, s, c, d = -1, p = n.length, h = r[o++], v = (0, a.default)(), m = i(); ++d < p; )
												(c = v.get((u = h((s = n[d])) + ''))) ? c.push(s) : v.set(u, [s])
											return (
												v.each(function(e, t) {
													l(m, t, f(e, o, i, l))
												}),
												m
											)
										}
										return (n = {
											object: function(e) {
												return f(e, 0, o, i)
											},
											map: function(e) {
												return f(e, 0, l, u)
											},
											entries: function(e) {
												return (function e(n, a) {
													if (++a > r.length) return n
													var o,
														i = s[a - 1]
													return (
														null != t && a >= r.length
															? (o = n.entries())
															: ((o = []),
															  n.each(function(t, n) {
																	o.push({ key: n, values: e(t, a) })
															  })),
														null != i
															? o.sort(function(e, t) {
																	return i(e.key, t.key)
															  })
															: o
													)
												})(f(e, 0, l, u), 0)
											},
											key: function(e) {
												return r.push(e), n
											},
											sortKeys: function(e) {
												return (s[r.length - 1] = e), n
											},
											sortValues: function(t) {
												return (e = t), n
											},
											rollup: function(e) {
												return (t = e), n
											}
										})
									})
								var r,
									a = (r = n(39)) && r.__esModule ? r : { default: r }
								function o() {
									return {}
								}
								function i(e, t, n) {
									e[t] = n
								}
								function l() {
									return (0, a.default)()
								}
								function u(e, t, n) {
									e.set(t, n)
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r,
									a = n(39)
								function o() {}
								var i = ((r = a) && r.__esModule ? r : { default: r }).default.prototype
								function l(e, t) {
									var n = new o()
									if (e instanceof o)
										e.each(function(e) {
											n.add(e)
										})
									else if (e) {
										var r = -1,
											a = e.length
										if (null == t) for (; ++r < a; ) n.add(e[r])
										else for (; ++r < a; ) n.add(t(e[r], r, e))
									}
									return n
								}
								;(o.prototype = l.prototype = {
									constructor: o,
									has: i.has,
									add: function(e) {
										return (e += ''), (this[a.prefix + e] = e), this
									},
									remove: i.remove,
									clear: i.clear,
									values: i.keys,
									size: i.size,
									empty: i.empty,
									each: i.each
								}),
									(t.default = l)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t = []
										for (var n in e) t.push(n)
										return t
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t = []
										for (var n in e) t.push(e[n])
										return t
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t = []
										for (var n in e) t.push({ key: n, value: e[n] })
										return t
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function e() {
										var t = [0, 1]
										function n(e) {
											return +e
										}
										return (
											(n.invert = n),
											(n.domain = n.range = function(e) {
												return arguments.length ? ((t = a.map.call(e, i.default)), n) : t.slice()
											}),
											(n.copy = function() {
												return e().domain(t)
											}),
											(0, o.linearish)(n)
										)
									})
								var r,
									a = n(12),
									o = n(16),
									i = (r = n(95)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = c),
									(t.Lab = d),
									(t.hcl = g),
									(t.Hcl = b)
								var r,
									a = n(42),
									o = (r = a) && r.__esModule ? r : { default: r },
									i = n(41),
									l = n(87),
									u = 6 / 29,
									s = 3 * u * u
								function f(e) {
									if (e instanceof d) return new d(e.l, e.a, e.b, e.opacity)
									if (e instanceof b) {
										var t = e.h * l.deg2rad
										return new d(e.l, Math.cos(t) * e.c, Math.sin(t) * e.c, e.opacity)
									}
									e instanceof i.Rgb || (e = (0, i.rgbConvert)(e))
									var n = m(e.r),
										r = m(e.g),
										a = m(e.b),
										o = p((0.4124564 * n + 0.3575761 * r + 0.1804375 * a) / 0.95047),
										u = p((0.2126729 * n + 0.7151522 * r + 0.072175 * a) / 1)
									return new d(
										116 * u - 16,
										500 * (o - u),
										200 * (u - p((0.0193339 * n + 0.119192 * r + 0.9503041 * a) / 1.08883)),
										e.opacity
									)
								}
								function c(e, t, n, r) {
									return 1 === arguments.length ? f(e) : new d(e, t, n, null == r ? 1 : r)
								}
								function d(e, t, n, r) {
									;(this.l = +e), (this.a = +t), (this.b = +n), (this.opacity = +r)
								}
								function p(e) {
									return e > 0.008856451679035631 ? Math.pow(e, 1 / 3) : e / s + 4 / 29
								}
								function h(e) {
									return e > u ? e * e * e : s * (e - 4 / 29)
								}
								function v(e) {
									return 255 * (e <= 0.0031308 ? 12.92 * e : 1.055 * Math.pow(e, 1 / 2.4) - 0.055)
								}
								function m(e) {
									return (e /= 255) <= 0.04045 ? e / 12.92 : Math.pow((e + 0.055) / 1.055, 2.4)
								}
								function y(e) {
									if (e instanceof b) return new b(e.h, e.c, e.l, e.opacity)
									e instanceof d || (e = f(e))
									var t = Math.atan2(e.b, e.a) * l.rad2deg
									return new b(t < 0 ? t + 360 : t, Math.sqrt(e.a * e.a + e.b * e.b), e.l, e.opacity)
								}
								function g(e, t, n, r) {
									return 1 === arguments.length ? y(e) : new b(e, t, n, null == r ? 1 : r)
								}
								function b(e, t, n, r) {
									;(this.h = +e), (this.c = +t), (this.l = +n), (this.opacity = +r)
								}
								;(0, o.default)(
									d,
									c,
									(0, a.extend)(i.Color, {
										brighter: function(e) {
											return new d(this.l + 18 * (null == e ? 1 : e), this.a, this.b, this.opacity)
										},
										darker: function(e) {
											return new d(this.l - 18 * (null == e ? 1 : e), this.a, this.b, this.opacity)
										},
										rgb: function() {
											var e = (this.l + 16) / 116,
												t = isNaN(this.a) ? e : e + this.a / 500,
												n = isNaN(this.b) ? e : e - this.b / 200
											return (
												(e = 1 * h(e)),
												(t = 0.95047 * h(t)),
												(n = 1.08883 * h(n)),
												new i.Rgb(
													v(3.2404542 * t - 1.5371385 * e - 0.4985314 * n),
													v(-0.969266 * t + 1.8760108 * e + 0.041556 * n),
													v(0.0556434 * t - 0.2040259 * e + 1.0572252 * n),
													this.opacity
												)
											)
										}
									})
								),
									(0, o.default)(
										b,
										g,
										(0, a.extend)(i.Color, {
											brighter: function(e) {
												return new b(this.h, this.c, this.l + 18 * (null == e ? 1 : e), this.opacity)
											},
											darker: function(e) {
												return new b(this.h, this.c, this.l - 18 * (null == e ? 1 : e), this.opacity)
											},
											rgb: function() {
												return f(this).rgb()
											}
										})
									)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.default = y), (t.Cubehelix = g)
								var r,
									a = n(42),
									o = (r = a) && r.__esModule ? r : { default: r },
									i = n(41),
									l = n(87),
									u = -0.14861,
									s = 1.78277,
									f = -0.29227,
									c = -0.90649,
									d = 1.97294,
									p = d * c,
									h = d * s,
									v = s * f - c * u
								function m(e) {
									if (e instanceof g) return new g(e.h, e.s, e.l, e.opacity)
									e instanceof i.Rgb || (e = (0, i.rgbConvert)(e))
									var t = e.r / 255,
										n = e.g / 255,
										r = e.b / 255,
										a = (v * r + p * t - h * n) / (v + p - h),
										o = r - a,
										u = (d * (n - a) - f * o) / c,
										s = Math.sqrt(u * u + o * o) / (d * a * (1 - a)),
										m = s ? Math.atan2(u, o) * l.rad2deg - 120 : NaN
									return new g(m < 0 ? m + 360 : m, s, a, e.opacity)
								}
								function y(e, t, n, r) {
									return 1 === arguments.length ? m(e) : new g(e, t, n, null == r ? 1 : r)
								}
								function g(e, t, n, r) {
									;(this.h = +e), (this.s = +t), (this.l = +n), (this.opacity = +r)
								}
								;(0, o.default)(
									g,
									y,
									(0, a.extend)(i.Color, {
										brighter: function(e) {
											return (
												(e = null == e ? i.brighter : Math.pow(i.brighter, e)),
												new g(this.h, this.s, this.l * e, this.opacity)
											)
										},
										darker: function(e) {
											return (
												(e = null == e ? i.darker : Math.pow(i.darker, e)),
												new g(this.h, this.s, this.l * e, this.opacity)
											)
										},
										rgb: function() {
											var e = isNaN(this.h) ? 0 : (this.h + 120) * l.deg2rad,
												t = +this.l,
												n = isNaN(this.s) ? 0 : this.s * t * (1 - t),
												r = Math.cos(e),
												a = Math.sin(e)
											return new i.Rgb(
												255 * (t + n * (u * r + s * a)),
												255 * (t + n * (f * r + c * a)),
												255 * (t + n * (d * r)),
												this.opacity
											)
										}
									})
								)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										return (
											(t -= e = +e),
											function(n) {
												return Math.round(e + t * n)
											}
										)
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.interpolateTransformSvg = t.interpolateTransformCss = void 0)
								var r,
									a = (r = n(23)) && r.__esModule ? r : { default: r },
									o = n(188)
								function i(e, t, n, r) {
									function o(e) {
										return e.length ? e.pop() + ' ' : ''
									}
									return function(i, l) {
										var u = [],
											s = []
										return (
											(i = e(i)),
											(l = e(l)),
											(function(e, r, o, i, l, u) {
												if (e !== o || r !== i) {
													var s = l.push('translate(', null, t, null, n)
													u.push({ i: s - 4, x: (0, a.default)(e, o) }, { i: s - 2, x: (0, a.default)(r, i) })
												} else (o || i) && l.push('translate(' + o + t + i + n)
											})(i.translateX, i.translateY, l.translateX, l.translateY, u, s),
											(function(e, t, n, i) {
												e !== t
													? (e - t > 180 ? (t += 360) : t - e > 180 && (e += 360),
													  i.push({ i: n.push(o(n) + 'rotate(', null, r) - 2, x: (0, a.default)(e, t) }))
													: t && n.push(o(n) + 'rotate(' + t + r)
											})(i.rotate, l.rotate, u, s),
											(function(e, t, n, i) {
												e !== t
													? i.push({ i: n.push(o(n) + 'skewX(', null, r) - 2, x: (0, a.default)(e, t) })
													: t && n.push(o(n) + 'skewX(' + t + r)
											})(i.skewX, l.skewX, u, s),
											(function(e, t, n, r, i, l) {
												if (e !== n || t !== r) {
													var u = i.push(o(i) + 'scale(', null, ',', null, ')')
													l.push({ i: u - 4, x: (0, a.default)(e, n) }, { i: u - 2, x: (0, a.default)(t, r) })
												} else (1 === n && 1 === r) || i.push(o(i) + 'scale(' + n + ',' + r + ')')
											})(i.scaleX, i.scaleY, l.scaleX, l.scaleY, u, s),
											(i = l = null),
											function(e) {
												for (var t, n = -1, r = s.length; ++n < r; ) u[(t = s[n]).i] = t.x(e)
												return u.join('')
											}
										)
									}
								}
								;(t.interpolateTransformCss = i(o.parseCss, 'px, ', 'px)', 'deg)')),
									(t.interpolateTransformSvg = i(o.parseSvg, ', ', ')', ')'))
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.parseCss = function(e) {
										return 'none' === e
											? u.identity
											: (a ||
													((a = document.createElement('DIV')),
													(o = document.documentElement),
													(i = document.defaultView)),
											  (a.style.transform = e),
											  (e = i.getComputedStyle(o.appendChild(a), null).getPropertyValue('transform')),
											  o.removeChild(a),
											  (e = e.slice(7, -1).split(',')),
											  (0, s.default)(+e[0], +e[1], +e[2], +e[3], +e[4], +e[5]))
									}),
									(t.parseSvg = function(e) {
										return null == e
											? u.identity
											: (l || (l = document.createElementNS('http://www.w3.org/2000/svg', 'g')),
											  l.setAttribute('transform', e),
											  (e = l.transform.baseVal.consolidate())
													? ((e = e.matrix), (0, s.default)(e.a, e.b, e.c, e.d, e.e, e.f))
													: u.identity)
									})
								var r,
									a,
									o,
									i,
									l,
									u = n(189),
									s = (r = u) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n, a, o, i) {
										var l, u, s
										return (
											(l = Math.sqrt(e * e + t * t)) && ((e /= l), (t /= l)),
											(s = e * n + t * a) && ((n -= e * s), (a -= t * s)),
											(u = Math.sqrt(n * n + a * a)) && ((n /= u), (a /= u), (s /= u)),
											e * a < t * n && ((e = -e), (t = -t), (s = -s), (l = -l)),
											{
												translateX: o,
												translateY: i,
												rotate: Math.atan2(t, e) * r,
												skewX: Math.atan(s) * r,
												scaleX: l,
												scaleY: u
											}
										)
									})
								var r = 180 / Math.PI
								t.identity = { translateX: 0, translateY: 0, rotate: 0, skewX: 0, scaleX: 1, scaleY: 1 }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n,
											u,
											s = e[0],
											f = e[1],
											c = e[2],
											d = t[0],
											p = t[1],
											h = t[2],
											v = d - s,
											m = p - f,
											y = v * v + m * m
										if (y < i)
											(u = Math.log(h / c) / r),
												(n = function(e) {
													return [s + e * v, f + e * m, c * Math.exp(r * e * u)]
												})
										else {
											var g = Math.sqrt(y),
												b = (h * h - c * c + o * y) / (2 * c * a * g),
												_ = (h * h - c * c - o * y) / (2 * h * a * g),
												x = Math.log(Math.sqrt(b * b + 1) - b),
												w = Math.log(Math.sqrt(_ * _ + 1) - _)
											;(u = (w - x) / r),
												(n = function(e) {
													var t,
														n = e * u,
														o = l(x),
														i =
															(c / (a * g)) *
															(o * ((t = r * n + x), ((t = Math.exp(2 * t)) - 1) / (t + 1)) -
																(function(e) {
																	return ((e = Math.exp(e)) - 1 / e) / 2
																})(x))
													return [s + i * v, f + i * m, (c * o) / l(r * n + x)]
												})
										}
										return (n.duration = 1e3 * u), n
									})
								var r = Math.SQRT2,
									a = 2,
									o = 4,
									i = 1e-12
								function l(e) {
									return ((e = Math.exp(e)) + 1 / e) / 2
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.hslLong = void 0)
								var r,
									a = n(3),
									o = n(17),
									i = (r = o) && r.__esModule ? r : { default: r }
								function l(e) {
									return function(t, n) {
										var r = e((t = (0, a.hsl)(t)).h, (n = (0, a.hsl)(n)).h),
											o = (0, i.default)(t.s, n.s),
											l = (0, i.default)(t.l, n.l),
											u = (0, i.default)(t.opacity, n.opacity)
										return function(e) {
											return (t.h = r(e)), (t.s = o(e)), (t.l = l(e)), (t.opacity = u(e)), t + ''
										}
									}
								}
								;(t.default = l(o.hue)), (t.hslLong = l(i.default))
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n = (0, o.default)((e = (0, a.lab)(e)).l, (t = (0, a.lab)(t)).l),
											r = (0, o.default)(e.a, t.a),
											i = (0, o.default)(e.b, t.b),
											l = (0, o.default)(e.opacity, t.opacity)
										return function(t) {
											return (e.l = n(t)), (e.a = r(t)), (e.b = i(t)), (e.opacity = l(t)), e + ''
										}
									})
								var r,
									a = n(3),
									o = (r = n(17)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.hclLong = void 0)
								var r,
									a = n(3),
									o = n(17),
									i = (r = o) && r.__esModule ? r : { default: r }
								function l(e) {
									return function(t, n) {
										var r = e((t = (0, a.hcl)(t)).h, (n = (0, a.hcl)(n)).h),
											o = (0, i.default)(t.c, n.c),
											l = (0, i.default)(t.l, n.l),
											u = (0, i.default)(t.opacity, n.opacity)
										return function(e) {
											return (t.h = r(e)), (t.c = o(e)), (t.l = l(e)), (t.opacity = u(e)), t + ''
										}
									}
								}
								;(t.default = l(o.hue)), (t.hclLong = l(i.default))
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.cubehelixLong = void 0)
								var r,
									a = n(3),
									o = n(17),
									i = (r = o) && r.__esModule ? r : { default: r }
								function l(e) {
									return (function t(n) {
										function r(t, r) {
											var o = e((t = (0, a.cubehelix)(t)).h, (r = (0, a.cubehelix)(r)).h),
												l = (0, i.default)(t.s, r.s),
												u = (0, i.default)(t.l, r.l),
												s = (0, i.default)(t.opacity, r.opacity)
											return function(e) {
												return (t.h = o(e)), (t.s = l(e)), (t.l = u(Math.pow(e, n))), (t.opacity = s(e)), t + ''
											}
										}
										return (n = +n), (r.gamma = t), r
									})(1)
								}
								;(t.default = l(o.hue)), (t.cubehelixLong = l(i.default))
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										for (var n = new Array(t), r = 0; r < t; ++r) n[r] = e(r / (t - 1))
										return n
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n) {
										var o,
											i = e[0],
											l = e[e.length - 1],
											u = (0, r.tickStep)(i, l, null == t ? 10 : t)
										switch ((n = (0, a.formatSpecifier)(null == n ? ',f' : n)).type) {
											case 's':
												var s = Math.max(Math.abs(i), Math.abs(l))
												return (
													null != n.precision || isNaN((o = (0, a.precisionPrefix)(u, s))) || (n.precision = o),
													(0, a.formatPrefix)(n, s)
												)
											case '':
											case 'e':
											case 'g':
											case 'p':
											case 'r':
												null != n.precision ||
													isNaN((o = (0, a.precisionRound)(u, Math.max(Math.abs(i), Math.abs(l))))) ||
													(n.precision = o - ('e' === n.type))
												break
											case 'f':
											case '%':
												null != n.precision ||
													isNaN((o = (0, a.precisionFixed)(u))) ||
													(n.precision = o - 2 * ('%' === n.type))
										}
										return (0, a.format)(n)
									})
								var r = n(7),
									a = n(54)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.formatPrefix = t.format = void 0),
									(t.default = i)
								var r,
									a,
									o = (r = n(96)) && r.__esModule ? r : { default: r }
								function i(e) {
									return (a = (0, o.default)(e)), (t.format = a.format), (t.formatPrefix = a.formatPrefix), a
								}
								;(t.format = void 0),
									(t.formatPrefix = void 0),
									i({ decimal: '.', thousands: ',', grouping: [3], currency: ['$', ''] })
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										return function(n, r) {
											for (
												var a = n.length, o = [], i = 0, l = e[0], u = 0;
												a > 0 &&
												l > 0 &&
												(u + l + 1 > r && (l = Math.max(1, r - u)),
												o.push(n.substring((a -= l), a + l)),
												!((u += l + 1) > r));

											)
												l = e[(i = (i + 1) % e.length)]
											return o.reverse().join(t)
										}
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return function(t) {
											return t.replace(/[0-9]/g, function(t) {
												return e[+t]
											})
										}
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										e: for (var n, r = (e = e.toPrecision(t)).length, a = 1, o = -1; a < r; ++a)
											switch (e[a]) {
												case '.':
													o = n = a
													break
												case '0':
													0 === o && (o = a), (n = a)
													break
												case 'e':
													break e
												default:
													o > 0 && (o = 0)
											}
										return o > 0 ? e.slice(0, o) + e.slice(n + 1) : e
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n = (0, a.default)(e, t)
										if (!n) return e + ''
										var r = n[0],
											o = n[1]
										return o < 0
											? '0.' + new Array(-o).join('0') + r
											: r.length > o + 1
											? r.slice(0, o + 1) + '.' + r.slice(o + 1)
											: r + new Array(o - r.length + 2).join('0')
									})
								var r,
									a = (r = n(45)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return e
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return Math.max(0, -(0, a.default)(Math.abs(e)))
									})
								var r,
									a = (r = n(25)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										return Math.max(
											0,
											3 * Math.max(-8, Math.min(8, Math.floor((0, a.default)(t) / 3))) - (0, a.default)(Math.abs(e))
										)
									})
								var r,
									a = (r = n(25)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										return (
											(e = Math.abs(e)), (t = Math.abs(t) - e), Math.max(0, (0, a.default)(t) - (0, a.default)(e)) + 1
										)
									})
								var r,
									a = (r = n(25)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function e() {
										var t = (0, u.default)(f, c).domain([1, 10]),
											n = t.domain,
											o = 10,
											s = h(10),
											d = p(10)
										function m() {
											return (s = h(o)), (d = p(o)), n()[0] < 0 && ((s = v(s)), (d = v(d))), t
										}
										return (
											(t.base = function(e) {
												return arguments.length ? ((o = +e), m()) : o
											}),
											(t.domain = function(e) {
												return arguments.length ? (n(e), m()) : n()
											}),
											(t.ticks = function(e) {
												var t,
													a = n(),
													i = a[0],
													l = a[a.length - 1]
												;(t = l < i) && ((p = i), (i = l), (l = p))
												var u,
													f,
													c,
													p = s(i),
													h = s(l),
													v = null == e ? 10 : +e,
													m = []
												if (!(o % 1) && h - p < v) {
													if (((p = Math.round(p) - 1), (h = Math.round(h) + 1), i > 0)) {
														for (; p < h; ++p)
															for (f = 1, u = d(p); f < o; ++f)
																if (!((c = u * f) < i)) {
																	if (c > l) break
																	m.push(c)
																}
													} else
														for (; p < h; ++p)
															for (f = o - 1, u = d(p); f >= 1; --f)
																if (!((c = u * f) < i)) {
																	if (c > l) break
																	m.push(c)
																}
												} else m = (0, r.ticks)(p, h, Math.min(h - p, v)).map(d)
												return t ? m.reverse() : m
											}),
											(t.tickFormat = function(e, n) {
												if (
													(null == n && (n = 10 === o ? '.0e' : ','),
													'function' != typeof n && (n = (0, a.format)(n)),
													e === 1 / 0)
												)
													return n
												null == e && (e = 10)
												var r = Math.max(1, (o * e) / t.ticks().length)
												return function(e) {
													var t = e / d(Math.round(s(e)))
													return t * o < o - 0.5 && (t *= o), t <= r ? n(e) : ''
												}
											}),
											(t.nice = function() {
												return n(
													(0, i.default)(n(), {
														floor: function(e) {
															return d(Math.floor(s(e)))
														},
														ceil: function(e) {
															return d(Math.ceil(s(e)))
														}
													})
												)
											}),
											(t.copy = function() {
												return (0, l.copy)(t, e().base(o))
											}),
											t
										)
									})
								var r = n(7),
									a = n(54),
									o = s(n(44)),
									i = s(n(100)),
									l = n(24),
									u = s(l)
								function s(e) {
									return e && e.__esModule ? e : { default: e }
								}
								function f(e, t) {
									return (t = Math.log(t / e))
										? function(n) {
												return Math.log(n / e) / t
										  }
										: (0, o.default)(t)
								}
								function c(e, t) {
									return e < 0
										? function(n) {
												return -Math.pow(-t, n) * Math.pow(-e, 1 - n)
										  }
										: function(n) {
												return Math.pow(t, n) * Math.pow(e, 1 - n)
										  }
								}
								function d(e) {
									return isFinite(e) ? +('1e' + e) : e < 0 ? 0 : e
								}
								function p(e) {
									return 10 === e
										? d
										: e === Math.E
										? Math.exp
										: function(t) {
												return Math.pow(e, t)
										  }
								}
								function h(e) {
									return e === Math.E
										? Math.log
										: (10 === e && Math.log10) ||
												(2 === e && Math.log2) ||
												((e = Math.log(e)),
												function(t) {
													return Math.log(t) / e
												})
								}
								function v(e) {
									return function(t) {
										return -e(-t)
									}
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = s),
									(t.sqrt = function() {
										return s().exponent(0.5)
									})
								var r = l(n(44)),
									a = n(16),
									o = n(24),
									i = l(o)
								function l(e) {
									return e && e.__esModule ? e : { default: e }
								}
								function u(e, t) {
									return e < 0 ? -Math.pow(-e, t) : Math.pow(e, t)
								}
								function s() {
									var e = 1,
										t = (0, i.default)(
											function(t, n) {
												return (n = u(n, e) - (t = u(t, e)))
													? function(r) {
															return (u(r, e) - t) / n
													  }
													: (0, r.default)(n)
											},
											function(t, n) {
												return (
													(n = u(n, e) - (t = u(t, e))),
													function(r) {
														return u(t + n * r, 1 / e)
													}
												)
											}
										),
										n = t.domain
									return (
										(t.exponent = function(t) {
											return arguments.length ? ((e = +t), n(n())) : e
										}),
										(t.copy = function() {
											return (0, o.copy)(t, s().exponent(e))
										}),
										(0, a.linearish)(t)
									)
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function e() {
										var t = [],
											n = [],
											o = []
										function i() {
											var e = 0,
												a = Math.max(1, n.length)
											for (o = new Array(a - 1); ++e < a; ) o[e - 1] = (0, r.quantile)(t, e / a)
											return l
										}
										function l(e) {
											if (!isNaN((e = +e))) return n[(0, r.bisect)(o, e)]
										}
										return (
											(l.invertExtent = function(e) {
												var r = n.indexOf(e)
												return r < 0 ? [NaN, NaN] : [r > 0 ? o[r - 1] : t[0], r < o.length ? o[r] : t[t.length - 1]]
											}),
											(l.domain = function(e) {
												if (!arguments.length) return t.slice()
												t = []
												for (var n, a = 0, o = e.length; a < o; ++a) null == (n = e[a]) || isNaN((n = +n)) || t.push(n)
												return t.sort(r.ascending), i()
											}),
											(l.range = function(e) {
												return arguments.length ? ((n = a.slice.call(e)), i()) : n.slice()
											}),
											(l.quantiles = function() {
												return o.slice()
											}),
											(l.copy = function() {
												return e()
													.domain(t)
													.range(n)
											}),
											l
										)
									})
								var r = n(7),
									a = n(12)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function e() {
										var t = 0,
											n = 1,
											i = 1,
											l = [0.5],
											u = [0, 1]
										function s(e) {
											if (e <= e) return u[(0, r.bisect)(l, e, 0, i)]
										}
										function f() {
											var e = -1
											for (l = new Array(i); ++e < i; ) l[e] = ((e + 1) * n - (e - i) * t) / (i + 1)
											return s
										}
										return (
											(s.domain = function(e) {
												return arguments.length ? ((t = +e[0]), (n = +e[1]), f()) : [t, n]
											}),
											(s.range = function(e) {
												return arguments.length ? ((i = (u = a.slice.call(e)).length - 1), f()) : u.slice()
											}),
											(s.invertExtent = function(e) {
												var r = u.indexOf(e)
												return r < 0 ? [NaN, NaN] : r < 1 ? [t, l[0]] : r >= i ? [l[i - 1], n] : [l[r - 1], l[r]]
											}),
											(s.copy = function() {
												return e()
													.domain([t, n])
													.range(u)
											}),
											(0, o.linearish)(s)
										)
									})
								var r = n(7),
									a = n(12),
									o = n(16)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function e() {
										var t = [0.5],
											n = [0, 1],
											o = 1
										function i(e) {
											if (e <= e) return n[(0, r.bisect)(t, e, 0, o)]
										}
										return (
											(i.domain = function(e) {
												return arguments.length
													? ((t = a.slice.call(e)), (o = Math.min(t.length, n.length - 1)), i)
													: t.slice()
											}),
											(i.range = function(e) {
												return arguments.length
													? ((n = a.slice.call(e)), (o = Math.min(t.length, n.length - 1)), i)
													: n.slice()
											}),
											(i.invertExtent = function(e) {
												var r = n.indexOf(e)
												return [t[r - 1], t[r]]
											}),
											(i.copy = function() {
												return e()
													.domain(t)
													.range(n)
											}),
											i
										)
									})
								var r = n(7),
									a = n(12)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.milliseconds = void 0)
								var r,
									a = (r = n(1)) && r.__esModule ? r : { default: r },
									o = (0, a.default)(
										function() {},
										function(e, t) {
											e.setTime(+e + t)
										},
										function(e, t) {
											return t - e
										}
									)
								;(o.every = function(e) {
									return (
										(e = Math.floor(e)),
										isFinite(e) && e > 0
											? e > 1
												? (0, a.default)(
														function(t) {
															t.setTime(Math.floor(t / e) * e)
														},
														function(t, n) {
															t.setTime(+t + n * e)
														},
														function(t, n) {
															return (n - t) / e
														}
												  )
												: o
											: null
									)
								}),
									(t.default = o),
									(t.milliseconds = o.range)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.seconds = void 0)
								var r,
									a = (r = n(1)) && r.__esModule ? r : { default: r },
									o = n(8),
									i = (0, a.default)(
										function(e) {
											e.setTime(Math.floor(e / o.durationSecond) * o.durationSecond)
										},
										function(e, t) {
											e.setTime(+e + t * o.durationSecond)
										},
										function(e, t) {
											return (t - e) / o.durationSecond
										},
										function(e) {
											return e.getUTCSeconds()
										}
									)
								;(t.default = i), (t.seconds = i.range)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.minutes = void 0)
								var r,
									a = (r = n(1)) && r.__esModule ? r : { default: r },
									o = n(8),
									i = (0, a.default)(
										function(e) {
											e.setTime(Math.floor(e / o.durationMinute) * o.durationMinute)
										},
										function(e, t) {
											e.setTime(+e + t * o.durationMinute)
										},
										function(e, t) {
											return (t - e) / o.durationMinute
										},
										function(e) {
											return e.getMinutes()
										}
									)
								;(t.default = i), (t.minutes = i.range)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.hours = void 0)
								var r,
									a = (r = n(1)) && r.__esModule ? r : { default: r },
									o = n(8),
									i = (0, a.default)(
										function(e) {
											var t = (e.getTimezoneOffset() * o.durationMinute) % o.durationHour
											t < 0 && (t += o.durationHour),
												e.setTime(Math.floor((+e - t) / o.durationHour) * o.durationHour + t)
										},
										function(e, t) {
											e.setTime(+e + t * o.durationHour)
										},
										function(e, t) {
											return (t - e) / o.durationHour
										},
										function(e) {
											return e.getHours()
										}
									)
								;(t.default = i), (t.hours = i.range)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.days = void 0)
								var r,
									a = (r = n(1)) && r.__esModule ? r : { default: r },
									o = n(8),
									i = (0, a.default)(
										function(e) {
											e.setHours(0, 0, 0, 0)
										},
										function(e, t) {
											e.setDate(e.getDate() + t)
										},
										function(e, t) {
											return (
												(t - e - (t.getTimezoneOffset() - e.getTimezoneOffset()) * o.durationMinute) / o.durationDay
											)
										},
										function(e) {
											return e.getDate() - 1
										}
									)
								;(t.default = i), (t.days = i.range)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.saturdays = t.fridays = t.thursdays = t.wednesdays = t.tuesdays = t.mondays = t.sundays = t.saturday = t.friday = t.thursday = t.wednesday = t.tuesday = t.monday = t.sunday = void 0)
								var r,
									a = (r = n(1)) && r.__esModule ? r : { default: r },
									o = n(8)
								function i(e) {
									return (0, a.default)(
										function(t) {
											t.setDate(t.getDate() - ((t.getDay() + 7 - e) % 7)), t.setHours(0, 0, 0, 0)
										},
										function(e, t) {
											e.setDate(e.getDate() + 7 * t)
										},
										function(e, t) {
											return (
												(t - e - (t.getTimezoneOffset() - e.getTimezoneOffset()) * o.durationMinute) / o.durationWeek
											)
										}
									)
								}
								var l = (t.sunday = i(0)),
									u = (t.monday = i(1)),
									s = (t.tuesday = i(2)),
									f = (t.wednesday = i(3)),
									c = (t.thursday = i(4)),
									d = (t.friday = i(5)),
									p = (t.saturday = i(6))
								;(t.sundays = l.range),
									(t.mondays = u.range),
									(t.tuesdays = s.range),
									(t.wednesdays = f.range),
									(t.thursdays = c.range),
									(t.fridays = d.range),
									(t.saturdays = p.range)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.months = void 0)
								var r,
									a = (0, ((r = n(1)) && r.__esModule ? r : { default: r }).default)(
										function(e) {
											e.setDate(1), e.setHours(0, 0, 0, 0)
										},
										function(e, t) {
											e.setMonth(e.getMonth() + t)
										},
										function(e, t) {
											return t.getMonth() - e.getMonth() + 12 * (t.getFullYear() - e.getFullYear())
										},
										function(e) {
											return e.getMonth()
										}
									)
								;(t.default = a), (t.months = a.range)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.years = void 0)
								var r,
									a = (r = n(1)) && r.__esModule ? r : { default: r },
									o = (0, a.default)(
										function(e) {
											e.setMonth(0, 1), e.setHours(0, 0, 0, 0)
										},
										function(e, t) {
											e.setFullYear(e.getFullYear() + t)
										},
										function(e, t) {
											return t.getFullYear() - e.getFullYear()
										},
										function(e) {
											return e.getFullYear()
										}
									)
								;(o.every = function(e) {
									return isFinite((e = Math.floor(e))) && e > 0
										? (0, a.default)(
												function(t) {
													t.setFullYear(Math.floor(t.getFullYear() / e) * e), t.setMonth(0, 1), t.setHours(0, 0, 0, 0)
												},
												function(t, n) {
													t.setFullYear(t.getFullYear() + n * e)
												}
										  )
										: null
								}),
									(t.default = o),
									(t.years = o.range)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.utcMinutes = void 0)
								var r,
									a = (r = n(1)) && r.__esModule ? r : { default: r },
									o = n(8),
									i = (0, a.default)(
										function(e) {
											e.setUTCSeconds(0, 0)
										},
										function(e, t) {
											e.setTime(+e + t * o.durationMinute)
										},
										function(e, t) {
											return (t - e) / o.durationMinute
										},
										function(e) {
											return e.getUTCMinutes()
										}
									)
								;(t.default = i), (t.utcMinutes = i.range)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.utcHours = void 0)
								var r,
									a = (r = n(1)) && r.__esModule ? r : { default: r },
									o = n(8),
									i = (0, a.default)(
										function(e) {
											e.setUTCMinutes(0, 0, 0)
										},
										function(e, t) {
											e.setTime(+e + t * o.durationHour)
										},
										function(e, t) {
											return (t - e) / o.durationHour
										},
										function(e) {
											return e.getUTCHours()
										}
									)
								;(t.default = i), (t.utcHours = i.range)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.utcDays = void 0)
								var r,
									a = (r = n(1)) && r.__esModule ? r : { default: r },
									o = n(8),
									i = (0, a.default)(
										function(e) {
											e.setUTCHours(0, 0, 0, 0)
										},
										function(e, t) {
											e.setUTCDate(e.getUTCDate() + t)
										},
										function(e, t) {
											return (t - e) / o.durationDay
										},
										function(e) {
											return e.getUTCDate() - 1
										}
									)
								;(t.default = i), (t.utcDays = i.range)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.utcSaturdays = t.utcFridays = t.utcThursdays = t.utcWednesdays = t.utcTuesdays = t.utcMondays = t.utcSundays = t.utcSaturday = t.utcFriday = t.utcThursday = t.utcWednesday = t.utcTuesday = t.utcMonday = t.utcSunday = void 0)
								var r,
									a = (r = n(1)) && r.__esModule ? r : { default: r },
									o = n(8)
								function i(e) {
									return (0, a.default)(
										function(t) {
											t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 7 - e) % 7)), t.setUTCHours(0, 0, 0, 0)
										},
										function(e, t) {
											e.setUTCDate(e.getUTCDate() + 7 * t)
										},
										function(e, t) {
											return (t - e) / o.durationWeek
										}
									)
								}
								var l = (t.utcSunday = i(0)),
									u = (t.utcMonday = i(1)),
									s = (t.utcTuesday = i(2)),
									f = (t.utcWednesday = i(3)),
									c = (t.utcThursday = i(4)),
									d = (t.utcFriday = i(5)),
									p = (t.utcSaturday = i(6))
								;(t.utcSundays = l.range),
									(t.utcMondays = u.range),
									(t.utcTuesdays = s.range),
									(t.utcWednesdays = f.range),
									(t.utcThursdays = c.range),
									(t.utcFridays = d.range),
									(t.utcSaturdays = p.range)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.utcMonths = void 0)
								var r,
									a = (0, ((r = n(1)) && r.__esModule ? r : { default: r }).default)(
										function(e) {
											e.setUTCDate(1), e.setUTCHours(0, 0, 0, 0)
										},
										function(e, t) {
											e.setUTCMonth(e.getUTCMonth() + t)
										},
										function(e, t) {
											return t.getUTCMonth() - e.getUTCMonth() + 12 * (t.getUTCFullYear() - e.getUTCFullYear())
										},
										function(e) {
											return e.getUTCMonth()
										}
									)
								;(t.default = a), (t.utcMonths = a.range)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.utcYears = void 0)
								var r,
									a = (r = n(1)) && r.__esModule ? r : { default: r },
									o = (0, a.default)(
										function(e) {
											e.setUTCMonth(0, 1), e.setUTCHours(0, 0, 0, 0)
										},
										function(e, t) {
											e.setUTCFullYear(e.getUTCFullYear() + t)
										},
										function(e, t) {
											return t.getUTCFullYear() - e.getUTCFullYear()
										},
										function(e) {
											return e.getUTCFullYear()
										}
									)
								;(o.every = function(e) {
									return isFinite((e = Math.floor(e))) && e > 0
										? (0, a.default)(
												function(t) {
													t.setUTCFullYear(Math.floor(t.getUTCFullYear() / e) * e),
														t.setUTCMonth(0, 1),
														t.setUTCHours(0, 0, 0, 0)
												},
												function(t, n) {
													t.setUTCFullYear(t.getUTCFullYear() + n * e)
												}
										  )
										: null
								}),
									(t.default = o),
									(t.utcYears = o.range)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = n(103),
									a = n(46),
									o = +new Date('2000-01-01T00:00:00.000Z')
										? function(e) {
												var t = new Date(e)
												return isNaN(t) ? null : t
										  }
										: (0, a.utcParse)(r.isoSpecifier)
								t.default = o
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										return (0, r.calendar)(
											o.utcYear,
											o.utcMonth,
											o.utcWeek,
											o.utcDay,
											o.utcHour,
											o.utcMinute,
											o.utcSecond,
											o.utcMillisecond,
											a.utcFormat
										).domain([Date.UTC(2e3, 0, 1), Date.UTC(2e3, 0, 2)])
									})
								var r = n(101),
									a = n(62),
									o = n(30)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r,
									a = (r = n(18)) && r.__esModule ? r : { default: r }
								t.default = (0, a.default)('1f77b4ff7f0e2ca02cd627289467bd8c564be377c27f7f7fbcbd2217becf')
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r,
									a = (r = n(18)) && r.__esModule ? r : { default: r }
								t.default = (0, a.default)(
									'393b795254a36b6ecf9c9ede6379398ca252b5cf6bcedb9c8c6d31bd9e39e7ba52e7cb94843c39ad494ad6616be7969c7b4173a55194ce6dbdde9ed6'
								)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r,
									a = (r = n(18)) && r.__esModule ? r : { default: r }
								t.default = (0, a.default)(
									'3182bd6baed69ecae1c6dbefe6550dfd8d3cfdae6bfdd0a231a35474c476a1d99bc7e9c0756bb19e9ac8bcbddcdadaeb636363969696bdbdbdd9d9d9'
								)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r,
									a = (r = n(18)) && r.__esModule ? r : { default: r }
								t.default = (0, a.default)(
									'1f77b4aec7e8ff7f0effbb782ca02c98df8ad62728ff98969467bdc5b0d58c564bc49c94e377c2f7b6d27f7f7fc7c7c7bcbd22dbdb8d17becf9edae5'
								)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = n(3),
									a = n(9)
								t.default = (0, a.interpolateCubehelixLong)(
									(0, r.cubehelix)(300, 0.5, 0),
									(0, r.cubehelix)(-240, 0.5, 1)
								)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.cool = t.warm = void 0),
									(t.default = function(e) {
										;(e < 0 || e > 1) && (e -= Math.floor(e))
										var t = Math.abs(e - 0.5)
										return (o.h = 360 * e - 100), (o.s = 1.5 - 1.5 * t), (o.l = 0.8 - 0.9 * t), o + ''
									})
								var r = n(3),
									a = n(9),
									o =
										((t.warm = (0, a.interpolateCubehelixLong)(
											(0, r.cubehelix)(-100, 0.75, 0.35),
											(0, r.cubehelix)(80, 1.5, 0.8)
										)),
										(t.cool = (0, a.interpolateCubehelixLong)(
											(0, r.cubehelix)(260, 0.75, 0.35),
											(0, r.cubehelix)(80, 1.5, 0.8)
										)),
										(0, r.cubehelix)())
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.plasma = t.inferno = t.magma = void 0)
								var r,
									a = (r = n(18)) && r.__esModule ? r : { default: r }
								function o(e) {
									var t = e.length
									return function(n) {
										return e[Math.max(0, Math.min(t - 1, Math.floor(n * t)))]
									}
								}
								;(t.default = o(
									(0, a.default)(
										'44015444025645045745055946075a46085c460a5d460b5e470d60470e6147106347116447136548146748166848176948186a481a6c481b6d481c6e481d6f481f70482071482173482374482475482576482677482878482979472a7a472c7a472d7b472e7c472f7d46307e46327e46337f463480453581453781453882443983443a83443b84433d84433e85423f854240864241864142874144874045884046883f47883f48893e49893e4a893e4c8a3d4d8a3d4e8a3c4f8a3c508b3b518b3b528b3a538b3a548c39558c39568c38588c38598c375a8c375b8d365c8d365d8d355e8d355f8d34608d34618d33628d33638d32648e32658e31668e31678e31688e30698e306a8e2f6b8e2f6c8e2e6d8e2e6e8e2e6f8e2d708e2d718e2c718e2c728e2c738e2b748e2b758e2a768e2a778e2a788e29798e297a8e297b8e287c8e287d8e277e8e277f8e27808e26818e26828e26828e25838e25848e25858e24868e24878e23888e23898e238a8d228b8d228c8d228d8d218e8d218f8d21908d21918c20928c20928c20938c1f948c1f958b1f968b1f978b1f988b1f998a1f9a8a1e9b8a1e9c891e9d891f9e891f9f881fa0881fa1881fa1871fa28720a38620a48621a58521a68522a78522a88423a98324aa8325ab8225ac8226ad8127ad8128ae8029af7f2ab07f2cb17e2db27d2eb37c2fb47c31b57b32b67a34b67935b77937b87838b9773aba763bbb753dbc743fbc7340bd7242be7144bf7046c06f48c16e4ac16d4cc26c4ec36b50c46a52c56954c56856c66758c7655ac8645cc8635ec96260ca6063cb5f65cb5e67cc5c69cd5b6ccd5a6ece5870cf5773d05675d05477d1537ad1517cd2507fd34e81d34d84d44b86d54989d5488bd6468ed64590d74393d74195d84098d83e9bd93c9dd93ba0da39a2da37a5db36a8db34aadc32addc30b0dd2fb2dd2db5de2bb8de29bade28bddf26c0df25c2df23c5e021c8e020cae11fcde11dd0e11cd2e21bd5e21ad8e219dae319dde318dfe318e2e418e5e419e7e419eae51aece51befe51cf1e51df4e61ef6e620f8e621fbe723fde725'
									)
								)),
									(t.magma = o(
										(0, a.default)(
											'00000401000501010601010802010902020b02020d03030f03031204041405041606051806051a07061c08071e0907200a08220b09240c09260d0a290e0b2b100b2d110c2f120d31130d34140e36150e38160f3b180f3d19103f1a10421c10441d11471e114920114b21114e22115024125325125527125829115a2a115c2c115f2d11612f116331116533106734106936106b38106c390f6e3b0f703d0f713f0f72400f74420f75440f764510774710784910784a10794c117a4e117b4f127b51127c52137c54137d56147d57157e59157e5a167e5c167f5d177f5f187f601880621980641a80651a80671b80681c816a1c816b1d816d1d816e1e81701f81721f817320817521817621817822817922827b23827c23827e24828025828125818326818426818627818827818928818b29818c29818e2a81902a81912b81932b80942c80962c80982d80992d809b2e7f9c2e7f9e2f7fa02f7fa1307ea3307ea5317ea6317da8327daa337dab337cad347cae347bb0357bb2357bb3367ab5367ab73779b83779ba3878bc3978bd3977bf3a77c03a76c23b75c43c75c53c74c73d73c83e73ca3e72cc3f71cd4071cf4070d0416fd2426fd3436ed5446dd6456cd8456cd9466bdb476adc4869de4968df4a68e04c67e24d66e34e65e44f64e55064e75263e85362e95462ea5661eb5760ec5860ed5a5fee5b5eef5d5ef05f5ef1605df2625df2645cf3655cf4675cf4695cf56b5cf66c5cf66e5cf7705cf7725cf8745cf8765cf9785df9795df97b5dfa7d5efa7f5efa815ffb835ffb8560fb8761fc8961fc8a62fc8c63fc8e64fc9065fd9266fd9467fd9668fd9869fd9a6afd9b6bfe9d6cfe9f6dfea16efea36ffea571fea772fea973feaa74feac76feae77feb078feb27afeb47bfeb67cfeb77efeb97ffebb81febd82febf84fec185fec287fec488fec68afec88cfeca8dfecc8ffecd90fecf92fed194fed395fed597fed799fed89afdda9cfddc9efddea0fde0a1fde2a3fde3a5fde5a7fde7a9fde9aafdebacfcecaefceeb0fcf0b2fcf2b4fcf4b6fcf6b8fcf7b9fcf9bbfcfbbdfcfdbf'
										)
									)),
									(t.inferno = o(
										(0, a.default)(
											'00000401000501010601010802010a02020c02020e03021004031204031405041706041907051b08051d09061f0a07220b07240c08260d08290e092b10092d110a30120a32140b34150b37160b39180c3c190c3e1b0c411c0c431e0c451f0c48210c4a230c4c240c4f260c51280b53290b552b0b572d0b592f0a5b310a5c320a5e340a5f3609613809623909633b09643d09653e0966400a67420a68440a68450a69470b6a490b6a4a0c6b4c0c6b4d0d6c4f0d6c510e6c520e6d540f6d550f6d57106e59106e5a116e5c126e5d126e5f136e61136e62146e64156e65156e67166e69166e6a176e6c186e6d186e6f196e71196e721a6e741a6e751b6e771c6d781c6d7a1d6d7c1d6d7d1e6d7f1e6c801f6c82206c84206b85216b87216b88226a8a226a8c23698d23698f24699025689225689326679526679727669827669a28659b29649d29649f2a63a02a63a22b62a32c61a52c60a62d60a82e5fa92e5eab2f5ead305dae305cb0315bb1325ab3325ab43359b63458b73557b93556ba3655bc3754bd3853bf3952c03a51c13a50c33b4fc43c4ec63d4dc73e4cc83f4bca404acb4149cc4248ce4347cf4446d04545d24644d34743d44842d54a41d74b3fd84c3ed94d3dda4e3cdb503bdd513ade5238df5337e05536e15635e25734e35933e45a31e55c30e65d2fe75e2ee8602de9612bea632aeb6429eb6628ec6726ed6925ee6a24ef6c23ef6e21f06f20f1711ff1731df2741cf3761bf37819f47918f57b17f57d15f67e14f68013f78212f78410f8850ff8870ef8890cf98b0bf98c0af98e09fa9008fa9207fa9407fb9606fb9706fb9906fb9b06fb9d07fc9f07fca108fca309fca50afca60cfca80dfcaa0ffcac11fcae12fcb014fcb216fcb418fbb61afbb81dfbba1ffbbc21fbbe23fac026fac228fac42afac62df9c72ff9c932f9cb35f8cd37f8cf3af7d13df7d340f6d543f6d746f5d949f5db4cf4dd4ff4df53f4e156f3e35af3e55df2e661f2e865f2ea69f1ec6df1ed71f1ef75f1f179f2f27df2f482f3f586f3f68af4f88ef5f992f6fa96f8fb9af9fc9dfafda1fcffa4'
										)
									)),
									(t.plasma = o(
										(0, a.default)(
											'0d088710078813078916078a19068c1b068d1d068e20068f2206902406912605912805922a05932c05942e05952f059631059733059735049837049938049a3a049a3c049b3e049c3f049c41049d43039e44039e46039f48039f4903a04b03a14c02a14e02a25002a25102a35302a35502a45601a45801a45901a55b01a55c01a65e01a66001a66100a76300a76400a76600a76700a86900a86a00a86c00a86e00a86f00a87100a87201a87401a87501a87701a87801a87a02a87b02a87d03a87e03a88004a88104a78305a78405a78606a68707a68808a68a09a58b0aa58d0ba58e0ca48f0da4910ea3920fa39410a29511a19613a19814a099159f9a169f9c179e9d189d9e199da01a9ca11b9ba21d9aa31e9aa51f99a62098a72197a82296aa2395ab2494ac2694ad2793ae2892b02991b12a90b22b8fb32c8eb42e8db52f8cb6308bb7318ab83289ba3388bb3488bc3587bd3786be3885bf3984c03a83c13b82c23c81c33d80c43e7fc5407ec6417dc7427cc8437bc9447aca457acb4679cc4778cc4977cd4a76ce4b75cf4c74d04d73d14e72d24f71d35171d45270d5536fd5546ed6556dd7566cd8576bd9586ada5a6ada5b69db5c68dc5d67dd5e66de5f65de6164df6263e06363e16462e26561e26660e3685fe4695ee56a5de56b5de66c5ce76e5be76f5ae87059e97158e97257ea7457eb7556eb7655ec7754ed7953ed7a52ee7b51ef7c51ef7e50f07f4ff0804ef1814df1834cf2844bf3854bf3874af48849f48948f58b47f58c46f68d45f68f44f79044f79143f79342f89441f89540f9973ff9983ef99a3efa9b3dfa9c3cfa9e3bfb9f3afba139fba238fca338fca537fca636fca835fca934fdab33fdac33fdae32fdaf31fdb130fdb22ffdb42ffdb52efeb72dfeb82cfeba2cfebb2bfebd2afebe2afec029fdc229fdc328fdc527fdc627fdc827fdca26fdcb26fccd25fcce25fcd025fcd225fbd324fbd524fbd724fad824fada24f9dc24f9dd25f8df25f8e125f7e225f7e425f6e626f6e826f5e926f5eb27f4ed27f3ee27f3f027f2f227f1f426f1f525f0f724f0f921'
										)
									))
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function e(t) {
										var n = 0,
											a = 1,
											o = !1
										function i(e) {
											var r = (e - n) / (a - n)
											return t(o ? Math.max(0, Math.min(1, r)) : r)
										}
										return (
											(i.domain = function(e) {
												return arguments.length ? ((n = +e[0]), (a = +e[1]), i) : [n, a]
											}),
											(i.clamp = function(e) {
												return arguments.length ? ((o = !!e), i) : o
											}),
											(i.interpolator = function(e) {
												return arguments.length ? ((t = e), i) : t
											}),
											(i.copy = function() {
												return e(t)
													.domain([n, a])
													.clamp(o)
											}),
											(0, r.linearish)(i)
										)
									})
								var r = n(16)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n = (0, o.namespace)(e),
											r = 'transform' === n ? a.interpolateTransformSvg : l.default
										return this.attrTween(
											e,
											'function' == typeof t
												? (n.local ? p : d)(n, r, (0, i.tweenValue)(this, 'attr.' + e, t))
												: null == t
												? (n.local ? s : u)(n)
												: (n.local ? c : f)(n, r, t + '')
										)
									})
								var r,
									a = n(9),
									o = n(0),
									i = n(26),
									l = (r = n(104)) && r.__esModule ? r : { default: r }
								function u(e) {
									return function() {
										this.removeAttribute(e)
									}
								}
								function s(e) {
									return function() {
										this.removeAttributeNS(e.space, e.local)
									}
								}
								function f(e, t, n) {
									var r, a
									return function() {
										var o = this.getAttribute(e)
										return o === n ? null : o === r ? a : (a = t((r = o), n))
									}
								}
								function c(e, t, n) {
									var r, a
									return function() {
										var o = this.getAttributeNS(e.space, e.local)
										return o === n ? null : o === r ? a : (a = t((r = o), n))
									}
								}
								function d(e, t, n) {
									var r, a, o
									return function() {
										var i,
											l = n(this)
										if (null != l)
											return (i = this.getAttribute(e)) === l
												? null
												: i === r && l === a
												? o
												: (o = t((r = i), (a = l)))
										this.removeAttribute(e)
									}
								}
								function p(e, t, n) {
									var r, a, o
									return function() {
										var i,
											l = n(this)
										if (null != l)
											return (i = this.getAttributeNS(e.space, e.local)) === l
												? null
												: i === r && l === a
												? o
												: (o = t((r = i), (a = l)))
										this.removeAttributeNS(e.space, e.local)
									}
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = { value: function() {} }
								function a() {
									for (var e, t = 0, n = arguments.length, r = {}; t < n; ++t) {
										if (!(e = arguments[t] + '') || e in r) throw new Error('illegal type: ' + e)
										r[e] = []
									}
									return new o(r)
								}
								function o(e) {
									this._ = e
								}
								function i(e, t) {
									return e
										.trim()
										.split(/^|\s+/)
										.map(function(e) {
											var n = '',
												r = e.indexOf('.')
											if ((r >= 0 && ((n = e.slice(r + 1)), (e = e.slice(0, r))), e && !t.hasOwnProperty(e)))
												throw new Error('unknown type: ' + e)
											return { type: e, name: n }
										})
								}
								function l(e, t) {
									for (var n, r = 0, a = e.length; r < a; ++r) if ((n = e[r]).name === t) return n.value
								}
								function u(e, t, n) {
									for (var a = 0, o = e.length; a < o; ++a)
										if (e[a].name === t) {
											;(e[a] = r), (e = e.slice(0, a).concat(e.slice(a + 1)))
											break
										}
									return null != n && e.push({ name: t, value: n }), e
								}
								;(o.prototype = a.prototype = {
									constructor: o,
									on: function(e, t) {
										var n,
											r = this._,
											a = i(e + '', r),
											o = -1,
											s = a.length
										if (!(arguments.length < 2)) {
											if (null != t && 'function' != typeof t) throw new Error('invalid callback: ' + t)
											for (; ++o < s; )
												if ((n = (e = a[o]).type)) r[n] = u(r[n], e.name, t)
												else if (null == t) for (n in r) r[n] = u(r[n], e.name, null)
											return this
										}
										for (; ++o < s; ) if ((n = (e = a[o]).type) && (n = l(r[n], e.name))) return n
									},
									copy: function() {
										var e = {},
											t = this._
										for (var n in t) e[n] = t[n].slice()
										return new o(e)
									},
									call: function(e, t) {
										if ((n = arguments.length - 2) > 0)
											for (var n, r, a = new Array(n), o = 0; o < n; ++o) a[o] = arguments[o + 2]
										if (!this._.hasOwnProperty(e)) throw new Error('unknown type: ' + e)
										for (o = 0, n = (r = this._[e]).length; o < n; ++o) r[o].value.apply(t, a)
									},
									apply: function(e, t, n) {
										if (!this._.hasOwnProperty(e)) throw new Error('unknown type: ' + e)
										for (var r = this._[e], a = 0, o = r.length; a < o; ++a) r[a].value.apply(t, n)
									}
								}),
									(t.default = a)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n) {
										var a = new r.Timer()
										return (
											(t = null == t ? 0 : +t),
											a.restart(
												function(n) {
													a.stop(), e(n + t)
												},
												t,
												n
											),
											a
										)
									})
								var r = n(47)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n) {
										var a = new r.Timer(),
											o = t
										return null == t
											? (a.restart(e, t, n), a)
											: ((t = +t),
											  (n = null == n ? (0, r.now)() : +n),
											  a.restart(
													function r(i) {
														;(i += o), a.restart(r, (o += t), n), e(i)
													},
													t,
													n
											  ),
											  a)
									})
								var r = n(47)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n = 'attr.' + e
										if (arguments.length < 2) return (n = this.tween(n)) && n._value
										if (null == t) return this.tween(n, null)
										if ('function' != typeof t) throw new Error()
										var i = (0, r.namespace)(e)
										return this.tween(n, (i.local ? a : o)(i, t))
									})
								var r = n(0)
								function a(e, t) {
									function n() {
										var n = this,
											r = t.apply(n, arguments)
										return (
											r &&
											function(t) {
												n.setAttributeNS(e.space, e.local, r(t))
											}
										)
									}
									return (n._value = t), n
								}
								function o(e, t) {
									function n() {
										var n = this,
											r = t.apply(n, arguments)
										return (
											r &&
											function(t) {
												n.setAttribute(e, r(t))
											}
										)
									}
									return (n._value = t), n
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t = this._id
										return arguments.length
											? this.each(('function' == typeof e ? a : o)(t, e))
											: (0, r.get)(this.node(), t).delay
									})
								var r = n(5)
								function a(e, t) {
									return function() {
										;(0, r.init)(this, e).delay = +t.apply(this, arguments)
									}
								}
								function o(e, t) {
									return (
										(t = +t),
										function() {
											;(0, r.init)(this, e).delay = t
										}
									)
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t = this._id
										return arguments.length
											? this.each(('function' == typeof e ? a : o)(t, e))
											: (0, r.get)(this.node(), t).duration
									})
								var r = n(5)
								function a(e, t) {
									return function() {
										;(0, r.set)(this, e).duration = +t.apply(this, arguments)
									}
								}
								function o(e, t) {
									return (
										(t = +t),
										function() {
											;(0, r.set)(this, e).duration = t
										}
									)
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t = this._id
										return arguments.length ? this.each(a(t, e)) : (0, r.get)(this.node(), t).ease
									})
								var r = n(5)
								function a(e, t) {
									if ('function' != typeof t) throw new Error()
									return function() {
										;(0, r.set)(this, e).ease = t
									}
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										'function' != typeof e && (e = (0, r.matcher)(e))
										for (var t = this._groups, n = t.length, o = new Array(n), i = 0; i < n; ++i)
											for (var l, u = t[i], s = u.length, f = (o[i] = []), c = 0; c < s; ++c)
												(l = u[c]) && e.call(l, l.__data__, c, u) && f.push(l)
										return new a.Transition(o, this._parents, this._name, this._id)
									})
								var r = n(0),
									a = n(11)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										if (e._id !== this._id) throw new Error()
										for (
											var t = this._groups,
												n = e._groups,
												a = t.length,
												o = n.length,
												i = Math.min(a, o),
												l = new Array(a),
												u = 0;
											u < i;
											++u
										)
											for (var s, f = t[u], c = n[u], d = f.length, p = (l[u] = new Array(d)), h = 0; h < d; ++h)
												(s = f[h] || c[h]) && (p[h] = s)
										for (; u < a; ++u) l[u] = t[u]
										return new r.Transition(l, this._parents, this._name, this._id)
									})
								var r = n(11)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n = this._id
										return arguments.length < 2 ? (0, r.get)(this.node(), n).on.on(e) : this.each(a(n, e, t))
									})
								var r = n(5)
								function a(e, t, n) {
									var a,
										o,
										i = (function(e) {
											return (e + '')
												.trim()
												.split(/^|\s+/)
												.every(function(e) {
													var t = e.indexOf('.')
													return t >= 0 && (e = e.slice(0, t)), !e || 'start' === e
												})
										})(t)
											? r.init
											: r.set
									return function() {
										var r = i(this, e),
											l = r.on
										l !== a && (o = (a = l).copy()).on(t, n), (r.on = o)
									}
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										return this.on(
											'end.remove',
											((e = this._id),
											function() {
												var t = this.parentNode
												for (var n in this.__transition) if (+n !== e) return
												t && t.removeChild(this)
											})
										)
										var e
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t = this._name,
											n = this._id
										'function' != typeof e && (e = (0, a.selector)(e))
										for (var r = this._groups, u = r.length, s = new Array(u), f = 0; f < u; ++f)
											for (var c, d, p = r[f], h = p.length, v = (s[f] = new Array(h)), m = 0; m < h; ++m)
												(c = p[m]) &&
													(d = e.call(c, c.__data__, m, p)) &&
													('__data__' in c && (d.__data__ = c.__data__),
													(v[m] = d),
													(0, l.default)(v[m], t, n, m, v, (0, i.get)(c, n)))
										return new o.Transition(s, this._parents, t, n)
									})
								var r,
									a = n(0),
									o = n(11),
									i = n(5),
									l = (r = i) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t = this._name,
											n = this._id
										'function' != typeof e && (e = (0, a.selectorAll)(e))
										for (var r = this._groups, u = r.length, s = [], f = [], c = 0; c < u; ++c)
											for (var d, p = r[c], h = p.length, v = 0; v < h; ++v)
												if ((d = p[v])) {
													for (
														var m, y = e.call(d, d.__data__, v, p), g = (0, i.get)(d, n), b = 0, _ = y.length;
														b < _;
														++b
													)
														(m = y[b]) && (0, l.default)(m, t, n, b, y, g)
													s.push(y), f.push(d)
												}
										return new o.Transition(s, f, t, n)
									})
								var r,
									a = n(0),
									o = n(11),
									i = n(5),
									l = (r = i) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										return new r(this._groups, this._parents)
									})
								var r = n(0).selection.prototype.constructor
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n) {
										var r = 'transform' == (e += '') ? a.interpolateTransformCss : l.default
										return null == t
											? this.styleTween(
													e,
													(function(e, t) {
														var n, r, a
														return function() {
															var i = (0, o.style)(this, e),
																l = (this.style.removeProperty(e), (0, o.style)(this, e))
															return i === l ? null : i === n && l === r ? a : (a = t((n = i), (r = l)))
														}
													})(e, r)
											  ).on(
													'end.style.' + e,
													(function(e) {
														return function() {
															this.style.removeProperty(e)
														}
													})(e)
											  )
											: this.styleTween(
													e,
													'function' == typeof t
														? (function(e, t, n) {
																var r, a, i
																return function() {
																	var l = (0, o.style)(this, e),
																		u = n(this)
																	return (
																		null == u && (this.style.removeProperty(e), (u = (0, o.style)(this, e))),
																		l === u ? null : l === r && u === a ? i : (i = t((r = l), (a = u)))
																	)
																}
														  })(e, r, (0, i.tweenValue)(this, 'style.' + e, t))
														: (function(e, t, n) {
																var r, a
																return function() {
																	var i = (0, o.style)(this, e)
																	return i === n ? null : i === r ? a : (a = t((r = i), n))
																}
														  })(e, r, t + ''),
													n
											  )
									})
								var r,
									a = n(9),
									o = n(0),
									i = n(26),
									l = (r = n(104)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								function r(e, t, n) {
									function r() {
										var r = this,
											a = t.apply(r, arguments)
										return (
											a &&
											function(t) {
												r.style.setProperty(e, a(t), n)
											}
										)
									}
									return (r._value = t), r
								}
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n) {
										var a = 'style.' + (e += '')
										if (arguments.length < 2) return (a = this.tween(a)) && a._value
										if (null == t) return this.tween(a, null)
										if ('function' != typeof t) throw new Error()
										return this.tween(a, r(e, t, null == n ? '' : n))
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return this.tween(
											'text',
											'function' == typeof e
												? (function(e) {
														return function() {
															var t = e(this)
															this.textContent = null == t ? '' : t
														}
												  })((0, r.tweenValue)(this, 'text', e))
												: (function(e) {
														return function() {
															this.textContent = e
														}
												  })(null == e ? '' : e + '')
										)
									})
								var r = n(26)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										for (
											var e = this._name, t = this._id, n = (0, a.newId)(), r = this._groups, l = r.length, u = 0;
											u < l;
											++u
										)
											for (var s, f = r[u], c = f.length, d = 0; d < c; ++d)
												if ((s = f[d])) {
													var p = (0, o.get)(s, t)
													;(0, i.default)(s, e, n, d, f, {
														time: p.time + p.delay + p.duration,
														delay: 0,
														duration: p.duration,
														ease: p.ease
													})
												}
										return new a.Transition(r, this._parents, e, n)
									})
								var r,
									a = n(11),
									o = n(5),
									i = (r = o) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t) {
										var n,
											i,
											l = e.__transition
										if (l)
											for (i in ((t = null == t ? null : t + ''), l))
												if ((n = l[i]).state > a.SCHEDULED && n.name === t) return new r.Transition([[e]], o, t, +i)
										return null
									})
								var r = n(11),
									a = n(5),
									o = [null]
							},
							function(e, t, n) {
								var r = n(0),
									a = i(n(256)),
									o = i(n(257))
								function i(e) {
									return e && e.__esModule ? e : { default: e }
								}
								;(r.selection.prototype.interrupt = a.default), (r.selection.prototype.transition = o.default)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return this.each(function() {
											;(0, a.default)(this, e)
										})
									})
								var r,
									a = (r = n(105)) && r.__esModule ? r : { default: r }
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t, n
										e instanceof a.Transition
											? ((t = e._id), (e = e._name))
											: ((t = (0, a.newId)()), ((n = u).time = (0, l.now)()), (e = null == e ? null : e + ''))
										for (var r = this._groups, i = r.length, f = 0; f < i; ++f)
											for (var c, d = r[f], p = d.length, h = 0; h < p; ++h)
												(c = d[h]) && (0, o.default)(c, e, t, h, d, n || s(c, t))
										return new a.Transition(r, this._parents, e, t)
									})
								var r,
									a = n(11),
									o = (r = n(5)) && r.__esModule ? r : { default: r },
									i = n(120),
									l = n(63),
									u = { time: null, delay: 0, duration: 250, ease: i.easeCubicInOut }
								function s(e, t) {
									for (var n; !(n = e.__transition) || !(n = n[t]); )
										if (!(e = e.parentNode)) return (u.time = (0, l.now)()), u
									return n
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.linear = function(e) {
										return +e
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.quadIn = function(e) {
										return e * e
									}),
									(t.quadOut = function(e) {
										return e * (2 - e)
									}),
									(t.quadInOut = function(e) {
										return ((e *= 2) <= 1 ? e * e : --e * (2 - e) + 1) / 2
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.cubicIn = function(e) {
										return e * e * e
									}),
									(t.cubicOut = function(e) {
										return --e * e * e + 1
									}),
									(t.cubicInOut = function(e) {
										return ((e *= 2) <= 1 ? e * e * e : (e -= 2) * e * e + 2) / 2
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.polyIn = (function e(t) {
										function n(e) {
											return Math.pow(e, t)
										}
										return (t = +t), (n.exponent = e), n
									})(3)),
									(t.polyOut = (function e(t) {
										function n(e) {
											return 1 - Math.pow(1 - e, t)
										}
										return (t = +t), (n.exponent = e), n
									})(3)),
									(t.polyInOut = (function e(t) {
										function n(e) {
											return ((e *= 2) <= 1 ? Math.pow(e, t) : 2 - Math.pow(2 - e, t)) / 2
										}
										return (t = +t), (n.exponent = e), n
									})(3))
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.sinIn = function(e) {
										return 1 - Math.cos(e * a)
									}),
									(t.sinOut = function(e) {
										return Math.sin(e * a)
									}),
									(t.sinInOut = function(e) {
										return (1 - Math.cos(r * e)) / 2
									})
								var r = Math.PI,
									a = r / 2
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.expIn = function(e) {
										return Math.pow(2, 10 * e - 10)
									}),
									(t.expOut = function(e) {
										return 1 - Math.pow(2, -10 * e)
									}),
									(t.expInOut = function(e) {
										return ((e *= 2) <= 1 ? Math.pow(2, 10 * e - 10) : 2 - Math.pow(2, 10 - 10 * e)) / 2
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.circleIn = function(e) {
										return 1 - Math.sqrt(1 - e * e)
									}),
									(t.circleOut = function(e) {
										return Math.sqrt(1 - --e * e)
									}),
									(t.circleInOut = function(e) {
										return ((e *= 2) <= 1 ? 1 - Math.sqrt(1 - e * e) : Math.sqrt(1 - (e -= 2) * e) + 1) / 2
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.bounceIn = function(e) {
										return 1 - a(1 - e)
									}),
									(t.bounceOut = a),
									(t.bounceInOut = function(e) {
										return ((e *= 2) <= 1 ? 1 - a(1 - e) : a(e - 1) + 1) / 2
									})
								var r = 7.5625
								function a(e) {
									return (e = +e) < 4 / 11
										? r * e * e
										: e < 8 / 11
										? r * (e -= 6 / 11) * e + 3 / 4
										: e < 10 / 11
										? r * (e -= 9 / 11) * e + 15 / 16
										: r * (e -= 21 / 22) * e + 63 / 64
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.backIn = (function e(t) {
										function n(e) {
											return e * e * ((t + 1) * e - t)
										}
										return (t = +t), (n.overshoot = e), n
									})(1.70158)),
									(t.backOut = (function e(t) {
										function n(e) {
											return --e * e * ((t + 1) * e + t) + 1
										}
										return (t = +t), (n.overshoot = e), n
									})(1.70158)),
									(t.backInOut = (function e(t) {
										function n(e) {
											return ((e *= 2) < 1 ? e * e * ((t + 1) * e - t) : (e -= 2) * e * ((t + 1) * e + t) + 2) / 2
										}
										return (t = +t), (n.overshoot = e), n
									})(1.70158))
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = 2 * Math.PI
								;(t.elasticIn = (function e(t, n) {
									var a = Math.asin(1 / (t = Math.max(1, t))) * (n /= r)
									function o(e) {
										return t * Math.pow(2, 10 * --e) * Math.sin((a - e) / n)
									}
									return (
										(o.amplitude = function(t) {
											return e(t, n * r)
										}),
										(o.period = function(n) {
											return e(t, n)
										}),
										o
									)
								})(1, 0.3)),
									(t.elasticOut = (function e(t, n) {
										var a = Math.asin(1 / (t = Math.max(1, t))) * (n /= r)
										function o(e) {
											return 1 - t * Math.pow(2, -10 * (e = +e)) * Math.sin((e + a) / n)
										}
										return (
											(o.amplitude = function(t) {
												return e(t, n * r)
											}),
											(o.period = function(n) {
												return e(t, n)
											}),
											o
										)
									})(1, 0.3)),
									(t.elasticInOut = (function e(t, n) {
										var a = Math.asin(1 / (t = Math.max(1, t))) * (n /= r)
										function o(e) {
											return (
												((e = 2 * e - 1) < 0
													? t * Math.pow(2, 10 * e) * Math.sin((a - e) / n)
													: 2 - t * Math.pow(2, -10 * e) * Math.sin((a + e) / n)) / 2
											)
										}
										return (
											(o.amplitude = function(t) {
												return e(t, n * r)
											}),
											(o.period = function(n) {
												return e(t, n)
											}),
											o
										)
									})(1, 0.3))
							},
							function(e, t, n) {
								function r(e, t) {
									return e.parent === t.parent ? 1 : 2
								}
								function a(e, t) {
									return e + t.x
								}
								function o(e, t) {
									return Math.max(e, t.y)
								}
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										var e = r,
											t = 1,
											n = 1,
											i = !1
										function l(r) {
											var l,
												u = 0
											r.eachAfter(function(t) {
												var n = t.children
												n
													? ((t.x = (function(e) {
															return e.reduce(a, 0) / e.length
													  })(n)),
													  (t.y = (function(e) {
															return 1 + e.reduce(o, 0)
													  })(n)))
													: ((t.x = l ? (u += e(t, l)) : 0), (t.y = 0), (l = t))
											})
											var s = (function(e) {
													for (var t; (t = e.children); ) e = t[0]
													return e
												})(r),
												f = (function(e) {
													for (var t; (t = e.children); ) e = t[t.length - 1]
													return e
												})(r),
												c = s.x - e(s, f) / 2,
												d = f.x + e(f, s) / 2
											return r.eachAfter(
												i
													? function(e) {
															;(e.x = (e.x - r.x) * t), (e.y = (r.y - e.y) * n)
													  }
													: function(e) {
															;(e.x = ((e.x - c) / (d - c)) * t), (e.y = (1 - (r.y ? e.y / r.y : 1)) * n)
													  }
											)
										}
										return (
											(l.separation = function(t) {
												return arguments.length ? ((e = t), l) : e
											}),
											(l.size = function(e) {
												return arguments.length ? ((i = !1), (t = +e[0]), (n = +e[1]), l) : i ? null : [t, n]
											}),
											(l.nodeSize = function(e) {
												return arguments.length ? ((i = !0), (t = +e[0]), (n = +e[1]), l) : i ? [t, n] : null
											}),
											l
										)
									})
							},
							function(e, t, n) {
								function r(e) {
									var t = 0,
										n = e.children,
										r = n && n.length
									if (r) for (; --r >= 0; ) t += n[r].value
									else t = 1
									e.value = t
								}
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										return this.eachAfter(r)
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										var t,
											n,
											r,
											a,
											o = this,
											i = [o]
										do {
											for (t = i.reverse(), i = []; (o = t.pop()); )
												if ((e(o), (n = o.children))) for (r = 0, a = n.length; r < a; ++r) i.push(n[r])
										} while (i.length)
										return this
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										for (var t, n, r = this, a = [r]; (r = a.pop()); )
											if ((e(r), (t = r.children))) for (n = t.length - 1; n >= 0; --n) a.push(t[n])
										return this
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										for (var t, n, r, a = this, o = [a], i = []; (a = o.pop()); )
											if ((i.push(a), (t = a.children))) for (n = 0, r = t.length; n < r; ++n) o.push(t[n])
										for (; (a = i.pop()); ) e(a)
										return this
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return this.eachAfter(function(t) {
											for (var n = +e(t.data) || 0, r = t.children, a = r && r.length; --a >= 0; ) n += r[a].value
											t.value = n
										})
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										return this.eachBefore(function(t) {
											t.children && t.children.sort(e)
										})
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e) {
										for (
											var t = this,
												n = (function(e, t) {
													if (e === t) return e
													var n = e.ancestors(),
														r = t.ancestors(),
														a = null
													for (e = n.pop(), t = r.pop(); e === t; ) (a = e), (e = n.pop()), (t = r.pop())
													return a
												})(t, e),
												r = [t];
											t !== n;

										)
											(t = t.parent), r.push(t)
										for (var a = r.length; e !== n; ) r.splice(a, 0, e), (e = e.parent)
										return r
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										for (var e = this, t = [e]; (e = e.parent); ) t.push(e)
										return t
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										var e = []
										return (
											this.each(function(t) {
												e.push(t)
											}),
											e
										)
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										var e = []
										return (
											this.eachBefore(function(t) {
												t.children || e.push(t)
											}),
											e
										)
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										var e = this,
											t = []
										return (
											e.each(function(n) {
												n !== e && t.push({ source: n.parent, target: n })
											}),
											t
										)
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										var e = null,
											t = 1,
											n = 1,
											r = i.constantZero
										function a(a) {
											return (
												(a.x = t / 2),
												(a.y = n / 2),
												e
													? a
															.eachBefore(s(e))
															.eachAfter(f(r, 0.5))
															.eachBefore(c(1))
													: a
															.eachBefore(s(u))
															.eachAfter(f(i.constantZero, 1))
															.eachAfter(f(r, a.r / Math.min(t, n)))
															.eachBefore(c(Math.min(t, n) / (2 * a.r))),
												a
											)
										}
										return (
											(a.radius = function(t) {
												return arguments.length ? ((e = (0, o.optional)(t)), a) : e
											}),
											(a.size = function(e) {
												return arguments.length ? ((t = +e[0]), (n = +e[1]), a) : [t, n]
											}),
											(a.padding = function(e) {
												return arguments.length ? ((r = 'function' == typeof e ? e : (0, l.default)(+e)), a) : r
											}),
											a
										)
									})
								var r,
									a = n(106),
									o = n(49),
									i = n(108),
									l = (r = i) && r.__esModule ? r : { default: r }
								function u(e) {
									return Math.sqrt(e.value)
								}
								function s(e) {
									return function(t) {
										t.children || (t.r = Math.max(0, +e(t) || 0))
									}
								}
								function f(e, t) {
									return function(n) {
										if ((r = n.children)) {
											var r,
												o,
												i,
												l = r.length,
												u = e(n) * t || 0
											if (u) for (o = 0; o < l; ++o) r[o].r += u
											if (((i = (0, a.packEnclose)(r)), u)) for (o = 0; o < l; ++o) r[o].r -= u
											n.r = i + u
										}
									}
								}
								function c(e) {
									return function(t) {
										var n = t.parent
										;(t.r *= e), n && ((t.x = n.x + e * t.x), (t.y = n.y + e * t.y))
									}
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.shuffle = function(e) {
										for (var t, n, r = e.length; r; )
											(n = (Math.random() * r--) | 0), (t = e[r]), (e[r] = e[n]), (e[n] = t)
										return e
									}),
									(t.slice = Array.prototype.slice)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										var e = 1,
											t = 1,
											n = 0,
											o = !1
										function i(i) {
											var l = i.height + 1
											return (
												(i.x0 = i.y0 = n),
												(i.x1 = e),
												(i.y1 = t / l),
												i.eachBefore(
													(function(e, t) {
														return function(r) {
															r.children &&
																(0, a.default)(r, r.x0, (e * (r.depth + 1)) / t, r.x1, (e * (r.depth + 2)) / t)
															var o = r.x0,
																i = r.y0,
																l = r.x1 - n,
																u = r.y1 - n
															l < o && (o = l = (o + l) / 2),
																u < i && (i = u = (i + u) / 2),
																(r.x0 = o),
																(r.y0 = i),
																(r.x1 = l),
																(r.y1 = u)
														}
													})(t, l)
												),
												o && i.eachBefore(r.default),
												i
											)
										}
										return (
											(i.round = function(e) {
												return arguments.length ? ((o = !!e), i) : o
											}),
											(i.size = function(n) {
												return arguments.length ? ((e = +n[0]), (t = +n[1]), i) : [e, t]
											}),
											(i.padding = function(e) {
												return arguments.length ? ((n = +e), i) : n
											}),
											i
										)
									})
								var r = o(n(109)),
									a = o(n(19))
								function o(e) {
									return e && e.__esModule ? e : { default: e }
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										var e = u,
											t = s
										function n(n) {
											var r,
												u,
												s,
												f,
												c,
												d,
												p,
												h = n.length,
												v = new Array(h),
												m = {}
											for (u = 0; u < h; ++u)
												(r = n[u]),
													(c = v[u] = new a.Node(r)),
													null != (d = e(r, u, n)) && (d += '') && (m[(p = o + (c.id = d))] = p in m ? l : c)
											for (u = 0; u < h; ++u)
												if (((c = v[u]), null != (d = t(n[u], u, n)) && (d += ''))) {
													if (!(f = m[o + d])) throw new Error('missing: ' + d)
													if (f === l) throw new Error('ambiguous: ' + d)
													f.children ? f.children.push(c) : (f.children = [c]), (c.parent = f)
												} else {
													if (s) throw new Error('multiple roots')
													s = c
												}
											if (!s) throw new Error('no root')
											if (
												((s.parent = i),
												s
													.eachBefore(function(e) {
														;(e.depth = e.parent.depth + 1), --h
													})
													.eachBefore(a.computeHeight),
												(s.parent = null),
												h > 0)
											)
												throw new Error('cycle')
											return s
										}
										return (
											(n.id = function(t) {
												return arguments.length ? ((e = (0, r.required)(t)), n) : e
											}),
											(n.parentId = function(e) {
												return arguments.length ? ((t = (0, r.required)(e)), n) : t
											}),
											n
										)
									})
								var r = n(49),
									a = n(48),
									o = '$',
									i = { depth: -1 },
									l = {}
								function u(e) {
									return e.id
								}
								function s(e) {
									return e.parentId
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										var e = a,
											t = 1,
											n = 1,
											r = null
										function f(a) {
											var o = (function(e) {
												for (var t, n, r, a, o, i = new s(e, 0), l = [i]; (t = l.pop()); )
													if ((r = t._.children))
														for (t.children = new Array((o = r.length)), a = o - 1; a >= 0; --a)
															l.push((n = t.children[a] = new s(r[a], a))), (n.parent = t)
												return ((i.parent = new s(null, 0)).children = [i]), i
											})(a)
											if ((o.eachAfter(c), (o.parent.m = -o.z), o.eachBefore(d), r)) a.eachBefore(p)
											else {
												var i = a,
													l = a,
													u = a
												a.eachBefore(function(e) {
													e.x < i.x && (i = e), e.x > l.x && (l = e), e.depth > u.depth && (u = e)
												})
												var f = i === l ? 1 : e(i, l) / 2,
													h = f - i.x,
													v = t / (l.x + f + h),
													m = n / (u.depth || 1)
												a.eachBefore(function(e) {
													;(e.x = (e.x + h) * v), (e.y = e.depth * m)
												})
											}
											return a
										}
										function c(t) {
											var n = t.children,
												r = t.parent.children,
												a = t.i ? r[t.i - 1] : null
											if (n) {
												!(function(e) {
													for (var t, n = 0, r = 0, a = e.children, o = a.length; --o >= 0; )
														((t = a[o]).z += n), (t.m += n), (n += t.s + (r += t.c))
												})(t)
												var s = (n[0].z + n[n.length - 1].z) / 2
												a ? ((t.z = a.z + e(t._, a._)), (t.m = t.z - s)) : (t.z = s)
											} else a && (t.z = a.z + e(t._, a._))
											t.parent.A = (function(t, n, r) {
												if (n) {
													for (
														var a, s = t, f = t, c = n, d = s.parent.children[0], p = s.m, h = f.m, v = c.m, m = d.m;
														(c = i(c)), (s = o(s)), c && s;

													)
														(d = o(d)),
															((f = i(f)).a = t),
															(a = c.z + v - s.z - p + e(c._, s._)) > 0 && (l(u(c, t, r), t, a), (p += a), (h += a)),
															(v += c.m),
															(p += s.m),
															(m += d.m),
															(h += f.m)
													c && !i(f) && ((f.t = c), (f.m += v - h)), s && !o(d) && ((d.t = s), (d.m += p - m), (r = t))
												}
												return r
											})(t, a, t.parent.A || r[0])
										}
										function d(e) {
											;(e._.x = e.z + e.parent.m), (e.m += e.parent.m)
										}
										function p(e) {
											;(e.x *= t), (e.y = e.depth * n)
										}
										return (
											(f.separation = function(t) {
												return arguments.length ? ((e = t), f) : e
											}),
											(f.size = function(e) {
												return arguments.length ? ((r = !1), (t = +e[0]), (n = +e[1]), f) : r ? null : [t, n]
											}),
											(f.nodeSize = function(e) {
												return arguments.length ? ((r = !0), (t = +e[0]), (n = +e[1]), f) : r ? [t, n] : null
											}),
											f
										)
									})
								var r = n(48)
								function a(e, t) {
									return e.parent === t.parent ? 1 : 2
								}
								function o(e) {
									var t = e.children
									return t ? t[0] : e.t
								}
								function i(e) {
									var t = e.children
									return t ? t[t.length - 1] : e.t
								}
								function l(e, t, n) {
									var r = n / (t.i - e.i)
									;(t.c -= r), (t.s += n), (e.c += r), (t.z += n), (t.m += n)
								}
								function u(e, t, n) {
									return e.a.parent === t.parent ? e.a : n
								}
								function s(e, t) {
									;(this._ = e),
										(this.parent = null),
										(this.children = null),
										(this.A = null),
										(this.a = this),
										(this.z = 0),
										(this.m = 0),
										(this.c = 0),
										(this.s = 0),
										(this.t = null),
										(this.i = t)
								}
								s.prototype = Object.create(r.Node.prototype)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function() {
										var e = a.default,
											t = !1,
											n = 1,
											u = 1,
											s = [0],
											f = i.constantZero,
											c = i.constantZero,
											d = i.constantZero,
											p = i.constantZero,
											h = i.constantZero
										function v(e) {
											return (
												(e.x0 = e.y0 = 0),
												(e.x1 = n),
												(e.y1 = u),
												e.eachBefore(m),
												(s = [0]),
												t && e.eachBefore(r.default),
												e
											)
										}
										function m(t) {
											var n = s[t.depth],
												r = t.x0 + n,
												a = t.y0 + n,
												o = t.x1 - n,
												i = t.y1 - n
											o < r && (r = o = (r + o) / 2),
												i < a && (a = i = (a + i) / 2),
												(t.x0 = r),
												(t.y0 = a),
												(t.x1 = o),
												(t.y1 = i),
												t.children &&
													((n = s[t.depth + 1] = f(t) / 2),
													(r += h(t) - n),
													(a += c(t) - n),
													(o -= d(t) - n) < r && (r = o = (r + o) / 2),
													(i -= p(t) - n) < a && (a = i = (a + i) / 2),
													e(t, r, a, o, i))
										}
										return (
											(v.round = function(e) {
												return arguments.length ? ((t = !!e), v) : t
											}),
											(v.size = function(e) {
												return arguments.length ? ((n = +e[0]), (u = +e[1]), v) : [n, u]
											}),
											(v.tile = function(t) {
												return arguments.length ? ((e = (0, o.required)(t)), v) : e
											}),
											(v.padding = function(e) {
												return arguments.length ? v.paddingInner(e).paddingOuter(e) : v.paddingInner()
											}),
											(v.paddingInner = function(e) {
												return arguments.length ? ((f = 'function' == typeof e ? e : (0, l.default)(+e)), v) : f
											}),
											(v.paddingOuter = function(e) {
												return arguments.length
													? v
															.paddingTop(e)
															.paddingRight(e)
															.paddingBottom(e)
															.paddingLeft(e)
													: v.paddingTop()
											}),
											(v.paddingTop = function(e) {
												return arguments.length ? ((c = 'function' == typeof e ? e : (0, l.default)(+e)), v) : c
											}),
											(v.paddingRight = function(e) {
												return arguments.length ? ((d = 'function' == typeof e ? e : (0, l.default)(+e)), v) : d
											}),
											(v.paddingBottom = function(e) {
												return arguments.length ? ((p = 'function' == typeof e ? e : (0, l.default)(+e)), v) : p
											}),
											(v.paddingLeft = function(e) {
												return arguments.length ? ((h = 'function' == typeof e ? e : (0, l.default)(+e)), v) : h
											}),
											v
										)
									})
								var r = u(n(109)),
									a = u(n(50)),
									o = n(49),
									i = n(108),
									l = u(i)
								function u(e) {
									return e && e.__esModule ? e : { default: e }
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n, r, a) {
										var o,
											i,
											l = e.children,
											u = l.length,
											s = new Array(u + 1)
										for (s[0] = i = o = 0; o < u; ++o) s[o + 1] = i += l[o].value
										!(function e(t, n, r, a, o, i, u) {
											if (t >= n - 1) {
												var f = l[t]
												return (f.x0 = a), (f.y0 = o), (f.x1 = i), void (f.y1 = u)
											}
											for (var c = s[t], d = r / 2 + c, p = t + 1, h = n - 1; p < h; ) {
												var v = (p + h) >>> 1
												s[v] < d ? (p = v + 1) : (h = v)
											}
											d - s[p - 1] < s[p] - d && t + 1 < p && --p
											var m = s[p] - c,
												y = r - m
											if (i - a > u - o) {
												var g = (a * y + i * m) / r
												e(t, p, m, a, o, g, u), e(p, n, y, g, o, i, u)
											} else {
												var b = (o * y + u * m) / r
												e(t, p, m, a, o, i, b), e(p, n, y, a, b, i, u)
											}
										})(0, u, e.value, t, n, r, a)
									})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.default = function(e, t, n, o, i) {
										;(1 & e.depth ? a.default : r.default)(e, t, n, o, i)
									})
								var r = o(n(19)),
									a = o(n(27))
								function o(e) {
									return e && e.__esModule ? e : { default: e }
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r = i(n(19)),
									a = i(n(27)),
									o = n(50)
								function i(e) {
									return e && e.__esModule ? e : { default: e }
								}
								t.default = (function e(t) {
									function n(e, n, i, l, u) {
										if ((s = e._squarify) && s.ratio === t)
											for (var s, f, c, d, p, h = -1, v = s.length, m = e.value; ++h < v; ) {
												for (c = (f = s[h]).children, d = f.value = 0, p = c.length; d < p; ++d) f.value += c[d].value
												f.dice
													? (0, r.default)(f, n, i, l, (i += ((u - i) * f.value) / m))
													: (0, a.default)(f, n, i, (n += ((l - n) * f.value) / m), u),
													(m -= f.value)
											}
										else (e._squarify = s = (0, o.squarifyRatio)(t, e, n, i, l, u)), (s.ratio = t)
									}
									return (
										(n.ratio = function(t) {
											return e((t = +t) > 1 ? t : 1)
										}),
										n
									)
								})(o.phi)
							},
							function(e, t, n) {
								var r = n(290)
								'string' == typeof r && (r = [[e.i, r, '']]), n(111)(r, {}), r.locals && (e.exports = r.locals)
							},
							function(e, t, n) {
								;(e.exports = n(110)()).push([
									e.i,
									'/*! normalize.css v4.1.1 | MIT License | github.com/necolas/normalize.css */\n\n/**\n * 1. Change the default font family in all browsers (opinionated).\n * 2. Correct the line height in all browsers.\n * 3. Prevent adjustments of font size after orientation changes in IE and iOS.\n */\n\nhtml {\n  font-family: sans-serif; /* 1 */\n  line-height: 1.15; /* 2 */\n  -ms-text-size-adjust: 100%; /* 3 */\n  -webkit-text-size-adjust: 100%; /* 3 */\n}\n\n/**\n * Remove the margin in all browsers (opinionated).\n */\n\nbody {\n  margin: 0;\n}\n\n/* HTML5 display definitions\n   ========================================================================== */\n\n/**\n * Add the correct display in IE 9-.\n * 1. Add the correct display in Edge, IE, and Firefox.\n * 2. Add the correct display in IE.\n */\n\narticle,\naside,\ndetails, /* 1 */\nfigcaption,\nfigure,\nfooter,\nheader,\nmain, /* 2 */\nmenu,\nnav,\nsection,\nsummary { /* 1 */\n  display: block;\n}\n\n/**\n * Add the correct display in IE 9-.\n */\n\naudio,\ncanvas,\nprogress,\nvideo {\n  display: inline-block;\n}\n\n/**\n * Add the correct display in iOS 4-7.\n */\n\naudio:not([controls]) {\n  display: none;\n  height: 0;\n}\n\n/**\n * Add the correct vertical alignment in Chrome, Firefox, and Opera.\n */\n\nprogress {\n  vertical-align: baseline;\n}\n\n/**\n * Add the correct display in IE 10-.\n * 1. Add the correct display in IE.\n */\n\ntemplate, /* 1 */\n[hidden] {\n  display: none;\n}\n\n/* Links\n   ========================================================================== */\n\n/**\n * 1. Remove the gray background on active links in IE 10.\n * 2. Remove gaps in links underline in iOS 8+ and Safari 8+.\n */\n\na {\n  background-color: transparent; /* 1 */\n  -webkit-text-decoration-skip: objects; /* 2 */\n}\n\n/**\n * Remove the outline on focused links when they are also active or hovered\n * in all browsers (opinionated).\n */\n\na:active,\na:hover {\n  outline-width: 0;\n}\n\n/* Text-level semantics\n   ========================================================================== */\n\n/**\n * 1. Remove the bottom border in Firefox 39-.\n * 2. Add the correct text decoration in Chrome, Edge, IE, Opera, and Safari.\n */\n\nabbr[title] {\n  border-bottom: none; /* 1 */\n  text-decoration: underline; /* 2 */\n  text-decoration: underline dotted; /* 2 */\n}\n\n/**\n * Prevent the duplicate application of `bolder` by the next rule in Safari 6.\n */\n\nb,\nstrong {\n  font-weight: inherit;\n}\n\n/**\n * Add the correct font weight in Chrome, Edge, and Safari.\n */\n\nb,\nstrong {\n  font-weight: bolder;\n}\n\n/**\n * Add the correct font style in Android 4.3-.\n */\n\ndfn {\n  font-style: italic;\n}\n\n/**\n * Correct the font size and margin on `h1` elements within `section` and\n * `article` contexts in Chrome, Firefox, and Safari.\n */\n\nh1 {\n  font-size: 2em;\n  margin: 0.67em 0;\n}\n\n/**\n * Add the correct background and color in IE 9-.\n */\n\nmark {\n  background-color: #ff0;\n  color: #000;\n}\n\n/**\n * Add the correct font size in all browsers.\n */\n\nsmall {\n  font-size: 80%;\n}\n\n/**\n * Prevent `sub` and `sup` elements from affecting the line height in\n * all browsers.\n */\n\nsub,\nsup {\n  font-size: 75%;\n  line-height: 0;\n  position: relative;\n  vertical-align: baseline;\n}\n\nsub {\n  bottom: -0.25em;\n}\n\nsup {\n  top: -0.5em;\n}\n\n/* Embedded content\n   ========================================================================== */\n\n/**\n * Remove the border on images inside links in IE 10-.\n */\n\nimg {\n  border-style: none;\n}\n\n/**\n * Hide the overflow in IE.\n */\n\nsvg:not(:root) {\n  overflow: hidden;\n}\n\n/* Grouping content\n   ========================================================================== */\n\n/**\n * 1. Correct the inheritance and scaling of font size in all browsers.\n * 2. Correct the odd `em` font sizing in all browsers.\n */\n\ncode,\nkbd,\npre,\nsamp {\n  font-family: monospace, monospace; /* 1 */\n  font-size: 1em; /* 2 */\n}\n\n/**\n * Add the correct margin in IE 8.\n */\n\nfigure {\n  margin: 1em 40px;\n}\n\n/**\n * 1. Add the correct box sizing in Firefox.\n * 2. Show the overflow in Edge and IE.\n */\n\nhr {\n  box-sizing: content-box; /* 1 */\n  height: 0; /* 1 */\n  overflow: visible; /* 2 */\n}\n\n/* Forms\n   ========================================================================== */\n\n/**\n * 1. Change font properties to `inherit` in all browsers (opinionated).\n * 2. Remove the margin in Firefox and Safari.\n */\n\nbutton,\ninput,\noptgroup,\nselect,\ntextarea {\n  font: inherit; /* 1 */\n  margin: 0; /* 2 */\n}\n\n/**\n * Restore the font weight unset by the previous rule.\n */\n\noptgroup {\n  font-weight: bold;\n}\n\n/**\n * Show the overflow in IE.\n * 1. Show the overflow in Edge.\n */\n\nbutton,\ninput { /* 1 */\n  overflow: visible;\n}\n\n/**\n * Remove the inheritance of text transform in Edge, Firefox, and IE.\n * 1. Remove the inheritance of text transform in Firefox.\n */\n\nbutton,\nselect { /* 1 */\n  text-transform: none;\n}\n\n/**\n * 1. Prevent a WebKit bug where (2) destroys native `audio` and `video`\n *    controls in Android 4.\n * 2. Correct the inability to style clickable types in iOS and Safari.\n */\n\nbutton,\nhtml [type="button"], /* 1 */\n[type="reset"],\n[type="submit"] {\n  -webkit-appearance: button; /* 2 */\n}\n\n/**\n * Remove the inner border and padding in Firefox.\n */\n\nbutton::-moz-focus-inner,\n[type="button"]::-moz-focus-inner,\n[type="reset"]::-moz-focus-inner,\n[type="submit"]::-moz-focus-inner {\n  border-style: none;\n  padding: 0;\n}\n\n/**\n * Restore the focus styles unset by the previous rule.\n */\n\nbutton:-moz-focusring,\n[type="button"]:-moz-focusring,\n[type="reset"]:-moz-focusring,\n[type="submit"]:-moz-focusring {\n  outline: 1px dotted ButtonText;\n}\n\n/**\n * Change the border, margin, and padding in all browsers (opinionated).\n */\n\nfieldset {\n  border: 1px solid #c0c0c0;\n  margin: 0 2px;\n  padding: 0.35em 0.625em 0.75em;\n}\n\n/**\n * 1. Correct the text wrapping in Edge and IE.\n * 2. Correct the color inheritance from `fieldset` elements in IE.\n * 3. Remove the padding so developers are not caught out when they zero out\n *    `fieldset` elements in all browsers.\n */\n\nlegend {\n  box-sizing: border-box; /* 1 */\n  color: inherit; /* 2 */\n  display: table; /* 1 */\n  max-width: 100%; /* 1 */\n  padding: 0; /* 3 */\n  white-space: normal; /* 1 */\n}\n\n/**\n * Remove the default vertical scrollbar in IE.\n */\n\ntextarea {\n  overflow: auto;\n}\n\n/**\n * 1. Add the correct box sizing in IE 10-.\n * 2. Remove the padding in IE 10-.\n */\n\n[type="checkbox"],\n[type="radio"] {\n  box-sizing: border-box; /* 1 */\n  padding: 0; /* 2 */\n}\n\n/**\n * Correct the cursor style of increment and decrement buttons in Chrome.\n */\n\n[type="number"]::-webkit-inner-spin-button,\n[type="number"]::-webkit-outer-spin-button {\n  height: auto;\n}\n\n/**\n * 1. Correct the odd appearance in Chrome and Safari.\n * 2. Correct the outline style in Safari.\n */\n\n[type="search"] {\n  -webkit-appearance: textfield; /* 1 */\n  outline-offset: -2px; /* 2 */\n}\n\n/**\n * Remove the inner padding and cancel buttons in Chrome and Safari on OS X.\n */\n\n[type="search"]::-webkit-search-cancel-button,\n[type="search"]::-webkit-search-decoration {\n  -webkit-appearance: none;\n}\n\n/**\n * Correct the text style of placeholders in Chrome, Edge, and Safari.\n */\n\n::-webkit-input-placeholder {\n  color: inherit;\n  opacity: 0.54;\n}\n\n/**\n * 1. Correct the inability to style clickable types in iOS and Safari.\n * 2. Change font properties to `inherit` in Safari.\n */\n\n::-webkit-file-upload-button {\n  -webkit-appearance: button; /* 1 */\n  font: inherit; /* 2 */\n}\n',
									''
								])
							},
							function(e, t, n) {
								var r = n(292)
								'string' == typeof r && (r = [[e.i, r, '']]), n(111)(r, {}), r.locals && (e.exports = r.locals)
							},
							function(e, t, n) {
								;(e.exports = n(110)()).push([
									e.i,
									'/*\nhtml {\n\theight:100%;\n}\nbody {\n\tmin-height:100%;\n}\ntable {\n\tfont-size:1em;\n\tborder-spacing:1px;\n\tborder-collapse:separate;\n}\n*/\n\n/***************************************\n\ttag-based styles\n\n  prevent embedder styles from overriding\n  the styles within pp-controlled divs\n****************************************/\n\n/* use default browser styles within pp-controlled divs */\n.sja_root_holder,\n.sja_menu_div,\n.sja_pane {\n  all: initial; /* block inheritance for all properties */\n}\n.sja_root_holder table,\n.sja_menu_div table,\n.sja_pane table {\n\tborder-collapse: separate; \n\tborder-spacing: 2px; \n}\n/*\n\toverride the thicker button border\n\tthat results when a button\'s \n\tborder-radius: 0 which seems to override\n\tall associated styles of \n\t-webkit-appearance: button;\n*/\n.sja_root_holder button,\n.sja_menu_div button,\n.sja_pane button {\n\tborder-width: 1px;\n\tborder-style: solid;\n\tborder-radius: 3px;\n\tbox-shadow: inset 0 0 0 99999px rgba(255,255,255,0.3);\n}\n.sja_root_holder button:hover,\n.sja_menu_div button:hover,\n.sja_pane button:hover {\n\tbox-shadow: none;\n}\n.sja_root_holder label,\n.sja_menu_div label,\n.sja_pane label {\n\tmargin-bottom: 0;\n}\n.sja_root_holder a,\n.sja_menu_div a,\n.sja_pane a {\n\tcolor: rgb(0, 0, 238);\n  cursor: pointer;\n  text-decoration: underline;\n}\n\n/*************************\n \tclass-specific styles\n*************************/\n\n.sja_errorbar {\n\tposition:relative;\n\tpadding:5px 50px 5px 10px;\n\tbackground-color:rgba(200,0,0,.1);\n\tcolor:rgba(190,0,0,.5);\n\tborder:solid 1px rgba(200,0,0,.2);\n\tborder-width:1px 0px;\n}\n.sja_errorbar>:nth-child(2) {\n\tposition:absolute;\n\tpadding:5px 10px;\n\tcursor:default;\n\ttop:0px; right:10px;\n}\n.sja_inset_a {\n\tbackground-color:#ebedeb;\n\tbox-shadow:inset 0px 0px 14px 0px #858585;\n\tpadding:5px 10px;\n}\n.sja_menu, .sja_menu_persist, .sja_tooltip {\n\tposition:absolute;\n\tbackground-color:white;\n\tfont-family:Arial;\n\tz-index:1000;\n}\n.sja_menuoption {\n\tcolor:black;\n\tpadding:5px 10px;\n\tcursor:default;\n\tbackground-color:#f2f2f2;\n\tmargin:1px;\n}\n.sja_menuoption:hover { background-color:#e6e6e6}\n.sja_menuoption:active { color:#cc0000; background-color:#FCE2E1;}\n\n.sja_filter_tag_btn {\n\tdisplay :inline-block;\n\tcolor:black;\n\tpadding: 5px 8px;\n\tbackground-color: #cfe2f3;\n}\n/* .sja_filter_tag_btn:hover { opacity: 0.8; cursor:default} */\n.sja_filter_tag_btn:active {color:#cc0000; opacity: 0.6;}\n\n.ts_pill:hover, .tvs_pill:hover {opacity: 0.8; cursor:default}\n\n.apply_btn {\n\tbackground-color: #d0e0e3;\n}\n\n.delete_btn, .remove_btn {\n\tbackground-color: #f4cccc;\n}\n\n.ts_summary_btn {\n\tbackground-color: #d9d2e9;\n}\n\n/* mostly for table tr */\n.sja_clb { padding:5px 10px; cursor:default; }\n.sja_clb:hover { background:#ffff99; }\n.sja_clb:active {background:#ffcc99; }\n\n.sja_clb_selected {\n\tpadding:5px 10px;\n\tcursor:default;\n\tbackground:#FAF0C8;\n\tborder-bottom:solid 2px #E3CA64;\n}\n.sja_clb_selected:hover { background:#FCE68B}\n.sja_clb_selected:active { background:#ffcc99}\n\n/* table tr, gray highlight */\n.sja_clb_gray { padding:5px 10px; cursor:default; }\n.sja_clb_gray:hover { background-color:#f1f1f1; }\n.sja_clb_gray:active {background-color:#ffffcc; }\n\n.sja_hideable_legend {\n\tcursor: default;\n}\n\n.sja_hideable_legend:hover {\n\tbackground:#ffff99;\n}\n\n.sja_legend_more_btn {\n\tpadding: 3px;\n\ttext-align: center;\n\tfont-size: 0.7em;\n\topacity: 0.5;\n\tcursor: default;\n} \n\n.sja_legend_more_btn:hover {\n\ttext-decoration: underline;\n}\n\n\n\n/* text only */\n.sja_clbtext2 {\n\tcursor:default;\n\ttext-decoration:none;\n}\n.sja_clbtext2:hover {\n\ttext-decoration:underline;\n}\n.sja_clbtext2:active {\n\tfill:#CC0000;\n\tcolor:#CC0000;\n}\n\n.sja_clbtext {cursor:default; color:black; fill:black; border-bottom:solid 1px transparent;}\n.sja_clbtext:hover { color:#631318;fill:#631318;border-color:black; }\n.sja_clbtext:active { color:#CC0000; border-color:#cc0000; fill:#cc0000;}\n\n.sja_clbtextbold {cursor:default; color:black; fill:black; font-weight:normal; }\n.sja_clbtextbold:hover { color:#631318;fill:#631318;font-weight:bold; }\n.sja_clbtextbold:active { color:#CC0000; fill:#cc0000; font-weight:bold;}\n\n.sja_opaque6 {opacity:.6;cursor:default;}\n.sja_opaque6:hover {opacity:.9;}\n.sja_opaque8 {opacity:.8;cursor:default;}\n.sja_opaque8:hover {opacity:1;}\n\n.sja_simpletable tr td {\n\tborder-bottom:solid 1px #ededed;\n}\n.sja_mcdot {\n\tcursor:default;\n\tborder-radius:8px;\n\tpadding:1px 2px;\n\tmargin-right:1px;\n\tcolor:white;\n\tfont-size:.8em;\n}\n.sja_variantpagesnv {\n\tcursor:default;\n\tdisplay:inline-block;\n\tborder-radius:3px;\n\tpadding:3px 10px;\n\tmargin-right:2px;\n\tcolor:white;\n\tbackground-color:#0099FF;\n\topacity:.6;\n}\n.sja_variantpagesnv:hover {\n\topacity:1;\n}\n.sja_variantpagesnv:active {\n\tbackground-color:#3366FF;\n}\n\n.sja_selectsample {\n\tcursor:default;\n\tdisplay:inline-block;\n\tborder-radius:2px;\n\tborder:solid 1px #545454;\n\tpadding:3px 10px;\n\tmargin-right:2px;\n\tcolor:#545454;\n\tbackground-color:white;\n\tfont-size:.8em;\n}\n.sja_selectsample:hover {\n\tbackground-color:#f1f1f1;\n}\n.sja_selectsample:active {\n\tbackground-color:#F2E1E3;\n}\n\n\n\n\n\n\n.sja_pane {\n\tposition:absolute;\n\t/*border:solid 1px #ccc;\n\t*/\n\tbox-shadow:0px 2px 4px 1px #999;\n\tbackground-color:white;\n}\n.sja_pane>:first-child {\n\tpadding-right:10px;\n\tcursor:move;\n\tbackground-color:#f0f0f0;\n}\n.sja_pane>:nth-child(2) {\n\tpadding:0px 10px 10px 10px;\n\tfont-family:Arial;\n}\n.sja_pane button {\n\tfont-family:Arial;\n\tcolor:black;\n}\n.sja_pane button:disabled {\n\tcolor:#858585;\n}\n\n.sja_cursor_hmove {\n\tcursor:ew-resize;\n}\n\n.sja_svgtext {cursor:default; fill-opacity:.8}\n.sja_svgtext2 {cursor:default; fill:black;}\n.sja_svgtext2:hover {fill:#B30000}\n.sja_clb5 { /* tree button */\n\tcursor:default;\n\tdisplay:inline-block;\n\tborder:solid 1px #006600;\n\tcolor:#006600;\n\tbackground-color:white;\n\tmargin-left:6px;\n\tpadding:0px 4px;\n\tfont-size:80%;\n}\n.sja_clb5:hover { background-color:#006600; color:white; }\n.sja_clb5:active { background-color:#009900;}\n.sja_clb2 {\n\tcolor:black;\n\tfont-family:Courier;\n\tdisplay:inline-block;\n\tpadding:1px 5px;\n\tcursor:default;\n}\n.sja_clb2:hover {\n\tbackground-color:#ffff99;\n}\n.sja_clb2:active {\n\tbackground-color:#ccff99;\n}\n.sja_clbb { /* highlight border */\n\tborder:solid 1px transparent;\n\tcursor:default;\n}\n.sja_clbb:hover {\n\tborder-color:#ccc;\n}\n\n.sja_clbbox {\n\tcursor:default;\n\tpadding:2px 5px;\n\tcolor:white;\n\tfont-size:.7em;\n\tfont-weight:normal;\n}\n.sja_clbbox:hover {\n\tfont-weight:bold;\n}\n\n.sja_tr {\n\tcursor:default;\n\tbackground-color:#f1f1f1;\n}\n.sja_tr:hover { background-color:white; }\n.sja_tr:active { background-color:#ffffcc; }\n.sja_tr2 {\n\tcursor:default;\n}\n.sja_tr2:hover { background-color:#ffffcc; }\n.sja_tr2:active { background-color:#ffff00; }\n\n.sja_aa_disclabel {\n\tcursor:default;\n}\n.sja_aa_discnum {\n\tcursor:default;\n\ttext-rendering:geometricPrecision;\n}\n.sja_aa_skkick:hover {\n\tstroke:#858585;\n}\n.sja_aa_disckick:hover {\n\tstroke-opacity:1;\n}\n.sja_menuoption_y {\n\tdisplay:inline-block;\n\tcolor:black;\n\tpadding:2px 4px;\n\tcursor:default;\n\tbackground-color:#E6E5C5;\n\tmargin:2px;\n}\n.sja_menuoption_y:hover { background-color:#DEDCA9}\n.sja_menuoption_y:active { background-color:#FFFF99}\n.sja_menuoption_r {\n\tdisplay:inline-block;\n\tcolor:black;\n\tpadding:2px 4px;\n\tcursor:default;\n\tbackground-color:#EDDDDE;\n\tmargin:2px;\n}\n.sja_menuoption_r:hover { background-color:#E8CFD1}\n.sja_menuoption_r:active { background-color:#FCD9DD}\n.sja_error2 {\n\tdisplay:inline-block;\n\tpadding:5px 50px 5px 10px;\n\tmargin:10px 20px;\n\tbackground-color:rgba(200,0,0,.5);\n\tcolor:white;\n\tborder-radius:6px;\n}\n.sja_paint {\n\tposition:relative;\n}\n.sja_paint>:first-child {\n}\n.sja_paint>:nth-child(2) {\n\tposition:absolute;\n\tpadding:3px 6px;\n\tcursor:default;\n\ttop:10px;right:30px;\n\tfont-size:80%;\n}\n.sja_tree_ul {\n\tlist-style-type:none;\n\tpadding-left:25px;\n\tline-height:1.4;\n}\n.sja_input { display:inline-block; padding:2px 6px; }\n.sja_bulkcell {\n\tdisplay:inline-block;\n\twidth:3px;\n\theight:9px;\n\tmargin:1px 1px 0px 0px;\n}\n.sja_tag {\n\tdisplay:inline-block;\n\tmargin-left:10px;\n\tpadding:1px 3px;\n\tbackground-color:#858585;\n\tcolor:white;\n\tfont-size:80%;\n\t}\n.sja_bgbox {\n\tcursor:default;\n\tfill:yellow;\n\tfill-opacity:0;\n}\n.sja_bgbox:hover {\n\tfill-opacity:.2;\n}\n.sja_diseasehm_search_item {\n\tdisplay:inline-block; \n\tmargin:3px; \n\tpadding:2px; \n}\n\n\n.sja_pulse {\n\tanimation: pulse .5s alternate infinite;\n}\n@keyframes pulse {\n\tfrom {\n\t\topacity: .2;\n\t}\n\tto {\n\t\topacity: 1;\n\t}\n}\n\n.sja_hm-edittool-table td {\n\tpadding: 0 2px;\n\tcursor: pointer;\n\ttext-align: center;\n\tfont-size: 14px;\n}\n\n.sja_hm-edittool-table td:hover {\n\topacity: 1;\n\tfont-weight: 600;\n}\n\n\n\n.sja_tinylogo_head {\n\tdisplay:inline-block;\n\tbackground-color:#858585;\n\tcolor:white;\n\tfont-size:.6em;\n\tpadding:1px 3px;\n}\n.sja_tinylogo_body {\n\tdisplay:inline-block;\n\tmargin-left:10px;\n\tbackground-color:#ededed;\n\tfont-size:.9em;\n\tcolor:black;\n\tpadding:1px 5px;\n}\n\n\n\n.sja_handle_green {\n\tdisplay:inline-block;\n\tfont-size:.9em;\n\tpadding:3px 6px;\n\tbackground-color:#f0f7f1;\n\tcolor:#146E17;\n\tcursor:default;\n}\n.sja_handle_green:hover {\n\tbackground-color:#D5F0D8;\n}\n.sja_handle_green:active {\n\tbackground-color:#BAD1BC;\n\tcolor:black;\n}\n\n.sja_handle_red {\n\tdisplay:inline-block;\n\tfont-size:.9em;\n\tpadding:3px 6px;\n\tbackground-color:#F5EBEC;\n\tcolor:#991F1F;\n\tcursor:default;\n}\n.sja_handle_red:hover {\n\tbackground-color:#F2D8DB;\n}\n.sja_handle_red:active {\n\tbackground-color:#E3B1B7;\n\tcolor:black;\n}\n.sja_btn {\n    -webkit-appearance: button;\n    -moz-appearance: button;\n    appearance: button;\n\n    text-decoration: none;\n    color: initial;\n}\n.sja_button {display:inline-block;background:white;padding:3px 5px;border:solid 1px black;opacity:.8;cursor:default;}\n.sja_button:hover {opacity:1;}\n.sja_button_open {display:inline-block;background:#ddd;padding:3px 5px;border:solid 1px black;opacity:.8;cursor:default;}\n.sja_button_open:hover {opacity:1;}\n.sja_button_fold {display:inline-block;background:#aaa;color:white;padding:3px 5px;border:solid 1px black;opacity:.8;cursor:default;}\n.sja_button_fold:hover {opacity:1;}\n\n.sja-termdb-config-row-label {\n\tpadding: 5px;\n\ttext-align: left;\n\tvertical-align: middle;\n}\n\n.sja_edit_btn {\n\tdisplay: inline-block;\n\tcolor:black;\n\tbackground-color:#f2f2f2;\n\tborder-radius: 5px;\n\tborder:solid 1px #aaa;\n\tpadding:5px 10px;\n\tcursor:default;\n\tmargin:1px;\n\tfont-size:0.8em;\n\tmargin-left:20px;\n}\n.sja_edit_btn:hover { background-color:#e6e6e6}\n.sja_edit_btn:active { color:#cc0000; background-color:#FCE2E1;}\n  \ninput[type="search"].tree_search {-webkit-appearance: searchfield;}\ninput[type="search"].tree_search::-webkit-search-cancel-button {-webkit-appearance: searchfield-cancel-button;}\n',
									''
								])
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.parseheader = function(e, t) {
										var n = e.toLowerCase().split('\t')
										if (n.length <= 1) return 'invalid file header for snv/indel'
										var r = function() {
												for (var e = arguments.length, t = Array(e), r = 0; r < e; r++) t[r] = arguments[r]
												var a = !0,
													o = !1,
													i = void 0
												try {
													for (var l, u = t[Symbol.iterator](); !(a = (l = u.next()).done); a = !0) {
														var s = l.value,
															f = n.indexOf(s)
														if (-1 != f) return f
													}
												} catch (e) {
													;(o = !0), (i = e)
												} finally {
													try {
														!a && u.return && u.return()
													} finally {
														if (o) throw i
													}
												}
												return -1
											},
											a = r('annovar_gene', 'annovar_sj_gene', 'gene', 'genename', 'gene_symbol', 'hugo_symbol')
										return -1 == a
											? 'gene missing from header'
											: ((n[a] = 'gene'),
											  -1 ==
											  (a = r(
													'annovar_aachange',
													'amino_acid_change',
													'annovar_sj_aachange',
													'aachange',
													'protein_change',
													'variant'
											  ))
													? 'amino_acid_change missing from header'
													: ((n[a] = 'mname'),
													  -1 ==
													  (a = r(
															'annovar_class',
															'class',
															'mclass',
															'variant_class',
															'variant_classification',
															'annovar_sj_class'
													  ))
															? 'variant_class missing from header'
															: ((n[a] = 'class'),
															  -1 == (a = r('chromosome', 'chr'))
																	? 'chromosome missing from header'
																	: ((n[a] = 'chr'),
																	  -1 == (a = r('wu_hg19_pos', 'start', 'start_position', 'chr_position', 'position'))
																			? 'start missing from header'
																			: ((n[a] = 'pos'),
																			  -1 ==
																			  (a = r(
																					'annovar_isoform',
																					'mrna_accession',
																					'mrna accession',
																					'refseq_mrna_id',
																					'annovar_sj_filter_isoform',
																					'refseq',
																					'isoform'
																			  ))
																					? 'isoform missing from header'
																					: ((n[a] = 'isoform'),
																					  -1 != (a = r('sample', 'sample_name', 'tumor_sample_barcode')) &&
																							(n[a] = 'sample'),
																					  -1 != (a = r('patient', 'donor', 'target_case_id')) && (n[a] = 'patient'),
																					  -1 != (a = r('quantitative_measurements')) && (n[a] = 'qmset'),
																					  -1 !=
																							(a = r(
																								'mutant_reads_in_case',
																								'mutant_in_tumor',
																								'tumor_readcount_alt'
																							)) && (n[a] = 'maf_tumor_v1'),
																					  -1 !=
																							(a = r(
																								'total_reads_in_case',
																								'total_in_tumor',
																								'tumor_readcount_total'
																							)) && (n[a] = 'maf_tumor_v2'),
																					  -1 !=
																							(a = r(
																								'mutant_reads_in_control',
																								'mutant_in_normal',
																								'normal_readcount_alt'
																							)) && (n[a] = 'maf_normal_v1'),
																					  -1 !=
																							(a = r(
																								'total_reads_in_control',
																								'total_in_normal',
																								'normal_readcount_total'
																							)) && (n[a] = 'maf_normal_v2'),
																					  -1 != (a = r('cdna_change')) && (n[a] = 'cdna_change'),
																					  -1 != (a = r('sampletype', 'sample type', 'sample_type')) &&
																							(n[a] = 'sampletype'),
																					  -1 != (a = r('origin')) && (n[a] = 'origin'),
																					  -1 != (a = r('cancer', 'disease', 'diagnosis')) && (n[a] = 'disease'),
																					  (t.snv.header = n),
																					  (t.snv.loaded = !0),
																					  !1))))))
									}),
									(t.parseline = function(e, t, n) {
										if ('' != t && '#' != t[0]) {
											for (var o = t.split('\t'), i = {}, l = 0; l < n.snv.header.length && null != o[l]; l++)
												i[n.snv.header[l]] = o[l]
											if (i.gene)
												if ('UNKNOWN' != i.gene.toUpperCase())
													if (i.isoform) {
														if (i.mname) 0 == i.mname.indexOf('p.') && (i.mname = i.mname.replace(/^p\./, ''))
														else if (((i.mname = i.cdna_change), !i.mname))
															return void n.snv.badlines.push([e, 'missing amino acid change', o])
														if (i.class) {
															var u = n.mclasslabel2key[i.class.toUpperCase()]
															if (u) i.class = u
															else {
																if (!(u = r.mclasstester(i.class)))
																	return void n.snv.badlines.push([e, 'wrong mutation class: ' + i.class, o])
																i.class = u
															}
															if (!a.parsesample(i, n, e, o, n.snv.badlines))
																if (i.chr)
																	if ((0 != i.chr.toLowerCase().indexOf('chr') && (i.chr = 'chr' + i.chr), i.pos)) {
																		var s = Number.parseInt(i.pos)
																		if (Number.isNaN(s)) n.snv.badlines.push([e, 'invalid chromosome position', o])
																		else {
																			if (((i.pos = s - 1), null != i.maf_tumor_v2 && null != i.maf_tumor_v1)) {
																				if ('' == i.maf_tumor_v2);
																				else {
																					var f = Number.parseInt(i.maf_tumor_v1),
																						c = Number.parseInt(i.maf_tumor_v2)
																					if (Number.isNaN(f) || Number.isNaN(c))
																						return void n.snv.badlines.push([
																							e,
																							'invalid maf_tumor mutant and/or total read count',
																							o
																						])
																					i.maf_tumor = { f: f / c, v1: f, v2: c }
																				}
																				delete i.maf_tumor_v1, delete i.maf_tumor_v2
																			}
																			if (null != i.maf_normal_v1 && null != i.maf_normal_v2) {
																				if ('' == i.maf_normal_v2);
																				else {
																					var d = Number.parseInt(i.maf_normal_v1),
																						p = Number.parseInt(i.maf_normal_v2)
																					if (Number.isNaN(d) || Number.isNaN(p))
																						return void n.snv.badlines.push([
																							e,
																							'invalid maf_normal mutant and/or total read count',
																							o
																						])
																					i.maf_normal = { f: d / p, v1: d, v2: p }
																				}
																				delete i.maf_normal_v1, delete i.maf_normal_v2
																			}
																			n.good++, 'M' == i.class ? n.snv.missense++ : 'S' == i.class && n.snv.silent++
																			var h = n.geneToUpper ? i.gene.toUpperCase() : i.gene
																			n.data[h] || (n.data[h] = []), (i.dt = r.dtsnvindel), n.data[h].push(i)
																		}
																	} else n.snv.badlines.push([e, 'missing chromosome position', o])
																else n.snv.badlines.push([e, 'missing chromosome', o])
														} else n.snv.badlines.push([e, 'missing mutation class', o])
													} else n.snv.badlines.push([e, 'missing isoform', o])
												else n.snv.badlines.push([e, 'gene name is UNKNOWN', o])
											else n.snv.badlines.push([e, 'missing gene', o])
										}
									})
								var r = o(n(2)),
									a = o(n(10))
								function o(e) {
									if (e && e.__esModule) return e
									var t = {}
									if (null != e) for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (t[n] = e[n])
									return (t.default = e), t
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.parseheader = function(e, t) {
										var n = e.toLowerCase().split('\t')
										if (n.length <= 1) return 'invalid file header for svjson'
										var r = function() {
												for (var e = arguments.length, t = Array(e), r = 0; r < e; r++) t[r] = arguments[r]
												var a = !0,
													o = !1,
													i = void 0
												try {
													for (var l, u = t[Symbol.iterator](); !(a = (l = u.next()).done); a = !0) {
														var s = l.value,
															f = n.indexOf(s)
														if (-1 != f) return f
													}
												} catch (e) {
													;(o = !0), (i = e)
												} finally {
													try {
														!a && u.return && u.return()
													} finally {
														if (o) throw i
													}
												}
												return -1
											},
											a = r('sample')
										return (
											-1 != a && (n[a] = 'sample'),
											-1 != (a = r('sampletype')) && (n[a] = 'sampletype'),
											-1 != (a = r('patient')) && (n[a] = 'patient'),
											-1 == (a = r('json', 'jsontext'))
												? ['json missing from header']
												: ((n[a] = 'jsontext'), [null, n])
										)
									}),
									(t.parseline = function(e, t, n, o) {
										if ('' != t && '#' != t[0]) {
											for (var l = t.split('\t'), u = {}, s = n.svjson.badlines, f = 0; f < o.length; f++)
												u[o[f]] = l[f]
											if (u.jsontext) {
												if (!a.parsesample(u, n, e, l, s)) {
													var c = void 0
													try {
														c = JSON.parse(u.jsontext)
													} catch (t) {
														return void s.push([e, 'invalid JSON text', l])
													}
													if (Array.isArray(c)) {
														var d = !0,
															p = !1,
															h = void 0
														try {
															for (var v, m = c[Symbol.iterator](); !(d = (v = m.next()).done); d = !0) {
																var y = v.value
																if (y.a && y.a.name && y.a.isoform) {
																	n.good++
																	var g = {
																		dt: r.dtfusionrna,
																		class: r.mclassfusionrna,
																		isoform: y.a.isoform,
																		mname: y.b.name
																	}
																	for (var b in u) 'jsontext' != b && (g[b] = u[b])
																	g.pairlst = i(c)
																	var _ = y.a.name.toUpperCase()
																	n.data[_] || (n.data[_] = []), n.data[_].push(g)
																}
																if (y.b && y.b.name && y.b.isoform) {
																	n.good++
																	var x = {
																		dt: r.dtfusionrna,
																		class: r.mclassfusionrna,
																		isoform: y.b.isoform,
																		mname: y.a.name
																	}
																	for (var w in u) 'jsontext' != w && (x[w] = u[w])
																	x.pairlst = i(c)
																	var j = y.b.name.toUpperCase()
																	n.data[j] || (n.data[j] = []), n.data[j].push(x)
																}
															}
														} catch (e) {
															;(p = !0), (h = e)
														} finally {
															try {
																!d && m.return && m.return()
															} finally {
																if (p) throw h
															}
														}
													} else {
														switch (((c.dt = c.typecode), delete c.typecode, c.dt)) {
															case r.dtitd:
																;(c.class = r.mclassitd), (c.mname = 'ITD')
																break
															case r.dtnloss:
																;(c.class = r.mclassnloss), (c.mname = 'N-loss')
																break
															case r.dtcloss:
																;(c.class = r.mclasscloss), (c.mname = 'C-loss')
																break
															case r.dtdel:
																;(c.class = r.mclassdel), (c.mname = 'Del')
																break
															default:
																return void s.push([e, 'unknown datatype', l])
														}
														if (!c.gene) return void s.push([e, 'json.gene missing', l])
														for (var k in (n.good++, u)) 'jsontext' != k && (c[k] = u[k])
														var O = (n.geneToUpper, c.gene.toUpperCase())
														n.data[O] || (n.data[O] = []), n.data[O].push(c)
													}
												}
											} else s.push([e, 'missing jsontext', l])
										}
									})
								var r = o(n(2)),
									a = o(n(10))
								function o(e) {
									if (e && e.__esModule) return e
									var t = {}
									if (null != e) for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (t[n] = e[n])
									return (t.default = e), t
								}
								function i(e) {
									var t = [],
										n = !0,
										r = !1,
										a = void 0
									try {
										for (var o, i = e[Symbol.iterator](); !(n = (o = i.next()).done); n = !0) {
											var l = o.value,
												u = { a: {}, b: {} }
											for (var s in l) 'a' != s && 'b' != s && (u[s] = l[s])
											for (var f in l.a) u.a[f] = l.a[f]
											for (var c in l.b) u.b[c] = l.b[c]
											t.push(u)
										}
									} catch (e) {
										;(r = !0), (a = e)
									} finally {
										try {
											!n && i.return && i.return()
										} finally {
											if (r) throw a
										}
									}
									return t
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.parseheader = function(e, t) {
										var n = e.toLowerCase().split('\t')
										if (n.length <= 1) return 'invalid file header for CNV'
										var r = function() {
												for (var e = arguments.length, t = Array(e), r = 0; r < e; r++) t[r] = arguments[r]
												var a = !0,
													o = !1,
													i = void 0
												try {
													for (var l, u = t[Symbol.iterator](); !(a = (l = u.next()).done); a = !0) {
														var s = l.value,
															f = n.indexOf(s)
														if (-1 != f) return f
													}
												} catch (e) {
													;(o = !0), (i = e)
												} finally {
													try {
														!a && u.return && u.return()
													} finally {
														if (o) throw i
													}
												}
												return -1
											},
											a = r('gene')
										return -1 == a
											? 'gene missing from header'
											: ((n[a] = 'gene'),
											  -1 == (a = r('cnv'))
													? 'CNV missing from header'
													: ((n[a] = 'cnv'),
													  -1 != (a = r('sample', 'sample_name', 'tumor_sample_barcode')) && (n[a] = 'sample'),
													  -1 != (a = r('patient', 'donor', 'target_case_id')) && (n[a] = 'patient'),
													  -1 != (a = r('disease')) && (n[a] = 'disease'),
													  -1 != (a = r('origin')) && (n[a] = 'origin'),
													  -1 != (a = r('sampletype', 'sample type', 'sample_type')) && (n[a] = 'sampletype'),
													  (t.cnv.header = n),
													  (t.cnv.loaded = !0),
													  !1))
									}),
									(t.parseline = function(e, t, n) {
										if ('' != t && '#' != t[0]) {
											for (var o = t.split('\t'), i = {}, l = 0; l < n.cnv.header.length; l++) i[n.cnv.header[l]] = o[l]
											if (i.gene)
												if (i.cnv) {
													switch (i.cnv.toLowerCase()) {
														case 'amplification':
														case 'gain':
															i.class = r.mclasscnvgain
															break
														case 'deletion':
														case 'loss':
															i.class = r.mclasscnvloss
															break
														case 'loh':
															i.class = r.mclasscnvloh
															break
														default:
															n.cnv.badlines.push([e, 'invalid cnv value: ' + i.cnv, o]), (i.class = null)
													}
													if (i.class && !a.parsesample(i, n, e, o, n.cnv.badlines)) {
														;(i.dt = r.dtcnv), n.good++
														var u = n.geneToUpper ? i.gene.toUpperCase() : i.gene
														u in n.data || (n.data[u] = []), n.data[u].push(i)
													}
												} else n.cnv.badlines.push([e, 'missing cnv value', o])
											else n.cnv.badlines.push([e, 'missing gene', o])
										}
									})
								var r = o(n(2)),
									a = o(n(10))
								function o(e) {
									if (e && e.__esModule) return e
									var t = {}
									if (null != e) for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (t[n] = e[n])
									return (t.default = e), t
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.parseheader = function(e, t) {
										var n = e.toLowerCase().split('\t')
										if (n.length <= 1) return 'invalid header line for ITD'
										var r = function() {
												for (var e = arguments.length, t = Array(e), r = 0; r < e; r++) t[r] = arguments[r]
												var a = !0,
													o = !1,
													i = void 0
												try {
													for (var l, u = t[Symbol.iterator](); !(a = (l = u.next()).done); a = !0) {
														var s = l.value,
															f = n.indexOf(s)
														if (-1 != f) return f
													}
												} catch (e) {
													;(o = !0), (i = e)
												} finally {
													try {
														!a && u.return && u.return()
													} finally {
														if (o) throw i
													}
												}
												return -1
											},
											a = r('gene')
										if (-1 == a) return 'gene missing from header'
										if (
											((n[a] = 'gene'),
											-1 ==
												(a = r(
													'annovar_isoform',
													'mrna_accession',
													'mrna accession',
													'refseq_mrna_id',
													'annovar_sj_filter_isoform',
													'refseq',
													'isoform'
												)))
										)
											return 'isoform missing from header'
										if (((n[a] = 'isoform'), -1 != (a = r('rnaposition')))) {
											if (((n[a] = 'rnaposition'), -1 == (a = r('rnaduplength'))))
												return 'rnaduplength is required when rnaposition is present'
											n[a] = 'rnaduplength'
										}
										if (-1 != (a = r('chromosome', 'chr'))) {
											if (((n[a] = 'chr'), -1 == (a = r('chr_start'))))
												return 'chr_start is required when chr is present'
											if (((n[a] = 'chrpos1'), -1 == (a = r('chr_stop'))))
												return 'chr_stop is required when chr is present'
											n[a] = 'chrpos2'
										}
										return (
											-1 != (a = r('sample', 'sample_name', 'tumor_sample_barcode')) && (n[a] = 'sample'),
											-1 != (a = r('patient', 'donor', 'target_case_id')) && (n[a] = 'patient'),
											-1 != (a = r('disease')) && (n[a] = 'disease'),
											-1 != (a = r('origin')) && (n[a] = 'origin'),
											-1 != (a = r('sampletype', 'sample type', 'sample_type')) && (n[a] = 'sampletype'),
											(t.itd.header = n),
											(t.itd.loaded = !0),
											!1
										)
									}),
									(t.parseline = function(e, t, n) {
										if ('' != t && '#' != t[0]) {
											for (var o = t.split('\t'), i = {}, l = 0; l < n.itd.header.length && null != o[l]; l++)
												i[n.itd.header[l]] = o[l]
											if (i.gene) {
												if (i.rnaposition) {
													var u = Number.parseInt(i.rnaposition)
													if (Number.isNaN(u) || u < 0)
														return void n.itd.badlines.push([e, 'invalid rnaPosition value', o])
													if (((i.rnaposition = u), !i.rnaduplength))
														return void n.itd.badlines.push([e, 'missing rnaDuplength value', o])
													if (((u = Number.parseInt(i.rnaduplength)), Number.isNaN(u) || u < 0))
														return void n.itd.badlines.push([e, 'invalid rnaDuplength value', o])
													i.rnaduplength = u
												}
												if (i.chr) {
													var s = Number.parseInt(i.chrpos1)
													if (Number.isNaN(s) || s < 0)
														return void n.itd.badlines.push([e, 'invalid chr_start value', o])
													if (((i.chrpos1 = s), (s = Number.parseInt(i.chrpos2)), Number.isNaN(s) || s < 0))
														return void n.itd.badlines.push([e, 'invalid chr_stop value', o])
													i.chrpos2 = s
												}
												if (!a.parsesample(i, n, e, o, n.itd.badlines)) {
													;(i.dt = r.dtitd), (i.class = r.mclassitd), (i.mname = 'ITD'), n.good++
													var f = n.geneToUpper ? i.gene.toUpperCase() : i.gene
													f in n.data || (n.data[f] = []), n.data[f].push(i)
												}
											} else n.itd.badlines.push([e, 'missing gene', o])
										}
									})
								var r = o(n(2)),
									a = o(n(10))
								function o(e) {
									if (e && e.__esModule) return e
									var t = {}
									if (null != e) for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (t[n] = e[n])
									return (t.default = e), t
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.parseheader = function(e, t) {
										var n = e.toLowerCase().split('\t')
										if (n.length <= 1) return 'invalid header line for intragenic deletion'
										var r = function() {
												for (var e = arguments.length, t = Array(e), r = 0; r < e; r++) t[r] = arguments[r]
												var a = !0,
													o = !1,
													i = void 0
												try {
													for (var l, u = t[Symbol.iterator](); !(a = (l = u.next()).done); a = !0) {
														var s = l.value,
															f = n.indexOf(s)
														if (-1 != f) return f
													}
												} catch (e) {
													;(o = !0), (i = e)
												} finally {
													try {
														!a && u.return && u.return()
													} finally {
														if (o) throw i
													}
												}
												return -1
											},
											a = r('gene')
										if (-1 == a) return 'gene missing from header'
										if (
											((n[a] = 'gene'),
											-1 ==
												(a = r(
													'annovar_isoform',
													'mrna_accession',
													'mrna accession',
													'refseq_mrna_id',
													'annovar_sj_filter_isoform',
													'refseq',
													'isoform'
												)))
										)
											return 'isoform missing from header'
										if (((n[a] = 'isoform'), -1 != (a = r('rnaposition')))) {
											if (((n[a] = 'rnaposition'), -1 == (a = r('rnadellength'))))
												return 'rnadellength is required when rnaPosition is used'
											n[a] = 'rnadellength'
										}
										if (-1 != (a = r('chromosome', 'chr'))) {
											if (((n[a] = 'chr'), -1 == (a = r('chr_start')))) return 'chr_start is required when chr is used'
											if (((n[a] = 'chrpos1'), -1 == (a = r('chr_stop'))))
												return 'chr_stop is required when chr is used'
											n[a] = 'chrpos2'
										}
										return (
											-1 != (a = r('sample', 'sample_name', 'tumor_sample_barcode')) && (n[a] = 'sample'),
											-1 != (a = r('patient', 'donor', 'target_case_id')) && (n[a] = 'patient'),
											-1 != (a = r('disease')) && (n[a] = 'disease'),
											-1 != (a = r('origin')) && (n[a] = 'origin'),
											-1 != (a = r('sampletype', 'sample type', 'sample_type')) && (n[a] = 'sampletype'),
											(t.del.header = n),
											(t.del.loaded = !0),
											!1
										)
									}),
									(t.parseline = function(e, t, n) {
										if ('' != t && '#' != t[0]) {
											for (var o = t.split('\t'), i = {}, l = 0; l < n.del.header.length && null != o[l]; l++)
												i[n.del.header[l]] = o[l]
											if (i.gene) {
												if (i.rnaposition) {
													var u = Number.parseInt(i.rnaposition)
													if (Number.isNaN(u) || u < 0)
														return void n.del.badlines.push([e, 'invalid rnaPosition value', o])
													if (((i.rnaposition = u), !i.rnadellength))
														return void n.del.badlines.push([e, 'missing rnaDellength value', o])
													if (((u = Number.parseInt(i.rnadellength)), Number.isNaN(u) || u < 0))
														return void n.del.badlines.push([e, 'invalid rnaDellength value', o])
													i.rnadellength = u
												}
												if (i.chr) {
													var s = Number.parseInt(i.chrpos1)
													if (Number.isNaN(s) || s < 0)
														return void n.del.badlines.push([e, 'invalid chr_start value', o])
													if (((i.chrpos1 = s), (s = Number.parseInt(i.chrpos2)), Number.isNaN(s) || s < 0))
														return void n.del.badlines.push([e, 'invalid chr_stop value', o])
													i.chrpos2 = s
												}
												if (!a.parsesample(i, n, e, o, n.del.badlines)) {
													;(i.dt = r.dtdel), (i.class = r.mclassdel), (i.mname = 'DEL'), n.good++
													var f = n.geneToUpper ? i.gene.toUpperCase() : i.gene
													f in n.data || (n.data[f] = []), n.data[f].push(i)
												}
											} else n.del.badlines.push([e, 'missing gene', o])
										}
									})
								var r = o(n(2)),
									a = o(n(10))
								function o(e) {
									if (e && e.__esModule) return e
									var t = {}
									if (null != e) for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (t[n] = e[n])
									return (t.default = e), t
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.parseheader = function(e, t) {
										var n = e.toLowerCase().split('\t')
										if (n.length <= 1) return 'invalid header line for truncation'
										var r = function() {
												for (var e = arguments.length, t = Array(e), r = 0; r < e; r++) t[r] = arguments[r]
												var a = !0,
													o = !1,
													i = void 0
												try {
													for (var l, u = t[Symbol.iterator](); !(a = (l = u.next()).done); a = !0) {
														var s = l.value,
															f = n.indexOf(s)
														if (-1 != f) return f
													}
												} catch (e) {
													;(o = !0), (i = e)
												} finally {
													try {
														!a && u.return && u.return()
													} finally {
														if (o) throw i
													}
												}
												return -1
											},
											a = r('gene')
										if (-1 == a) return 'gene missing from header'
										if (
											((n[a] = 'gene'),
											-1 ==
												(a = r(
													'annovar_isoform',
													'mrna_accession',
													'mrna accession',
													'refseq_mrna_id',
													'annovar_sj_filter_isoform',
													'refseq',
													'isoform'
												)))
										)
											return 'isoform missing from header'
										n[a] = 'isoform'
										var o = !1
										if ((-1 != (a = r('rnaposition')) && ((n[a] = 'rnaposition'), (o = !0)), -1 == (a = r('losstype'))))
											return 'lossType missing from header'
										n[a] = 'losstype'
										var i = !1
										if (-1 != (a = r('chromosome', 'chr'))) {
											if (
												((n[a] = 'chr'),
												-1 == (a = r('start', 'start_position', 'wu_hg19_pos', 'chr_position', 'position')))
											)
												return 'genomic position missing from header'
											;(n[a] = 'pos'), (i = !0)
										}
										return o || i
											? (-1 != (a = r('sample', 'sample_name', 'tumor_sample_barcode')) && (n[a] = 'sample'),
											  -1 != (a = r('patient', 'donor', 'target_case_id')) && (n[a] = 'patient'),
											  -1 != (a = r('disease')) && (n[a] = 'disease'),
											  -1 != (a = r('origin')) && (n[a] = 'origin'),
											  -1 != (a = r('sampletype', 'sample type', 'sample_type')) && (n[a] = 'sampletype'),
											  (t.truncation.header = n),
											  (t.truncation.loaded = !0),
											  !1)
											: 'neither rnaposition nor genomic position is given'
									}),
									(t.parseline = function(e, t, n) {
										if ('' != t && '#' != t[0]) {
											for (var o = t.split('\t'), i = {}, l = 0; l < n.truncation.header.length; l++)
												i[n.truncation.header[l]] = o[l]
											if (i.gene) {
												if (i.rnaposition) {
													var u = Number.parseInt(i.rnaposition)
													if (Number.isNaN(u) || u < 0)
														return void n.truncation.badlines.push([e, 'invalid rnaPosition value', o])
													i.rnaposition = u
												}
												if (i.pos) {
													var s = Number.parseInt(i.pos)
													if (Number.isNaN(s) || s < 0)
														return void n.truncation.badlines.push([e, 'invalid genomic position', o])
													i.pos = s
												}
												if (i.losstype)
													if ('n' == i.losstype || 'c' == i.losstype) {
														if (!a.parsesample(i, n, e, o, n.truncation.badlines)) {
															'n' == i.losstype
																? ((i.dt = r.dtnloss), (i.class = r.mclassnloss), (i.mname = 'N-loss'))
																: ((i.dt = r.dtcloss), (i.class = r.mclasscloss), (i.mname = 'C-loss')),
																n.good++
															var f = n.geneToUpper ? i.gene.toUpperCase() : i.gene
															f in n.data || (n.data[f] = []), n.data[f].push(i)
														}
													} else n.truncation.badlines.push([e, 'lossType value not "n" or "c"', o])
												else n.truncation.badlines.push([e, 'missing lossType value', o])
											} else n.truncation.badlines.push([e, 'missing gene', o])
										}
									})
								var r = o(n(2)),
									a = o(n(10))
								function o(e) {
									if (e && e.__esModule) return e
									var t = {}
									if (null != e) for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (t[n] = e[n])
									return (t.default = e), t
								}
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }), (t.ProjectHandler = void 0)
								var r = function(e, t) {
										if (Array.isArray(e)) return e
										if (Symbol.iterator in Object(e))
											return (function(e, t) {
												var n = [],
													r = !0,
													a = !1,
													o = void 0
												try {
													for (
														var i, l = e[Symbol.iterator]();
														!(r = (i = l.next()).done) && (n.push(i.value), !t || n.length !== t);
														r = !0
													);
												} catch (e) {
													;(a = !0), (o = e)
												} finally {
													try {
														!r && l.return && l.return()
													} finally {
														if (a) throw o
													}
												}
												return n
											})(e, t)
										throw new TypeError('Invalid attempt to destructure non-iterable instance')
									},
									a = (function() {
										function e(e, t) {
											for (var n = 0; n < t.length; n++) {
												var r = t[n]
												;(r.enumerable = r.enumerable || !1),
													(r.configurable = !0),
													'value' in r && (r.writable = !0),
													Object.defineProperty(e, r.key, r)
											}
										}
										return function(t, n, r) {
											return n && e(t.prototype, n), r && e(t, r), t
										}
									})(),
									o = n(0),
									i = (function(e) {
										if (e && e.__esModule) return e
										var t = {}
										if (null != e) for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (t[n] = e[n])
										return (t.default = e), t
									})(n(6)),
									l = ['heatmapJSON', 'piebarJSON', 'survivalJSON', 'discoJSON', 'riverJSON'],
									u = { snvindel: 0, si: 0, sv: 1, fusion: 2, itd: 3, deletion: 4, truncation: 5, cnv: 6 },
									s = !1
								t.ProjectHandler = (function() {
									function e(t) {
										if (
											((function(e, t) {
												if (!(e instanceof t)) throw new TypeError('Cannot call a class as a function')
											})(this, e),
											(this.bt = t),
											(this.err = this.errHandler()),
											!s)
										) {
											var n = (function() {
												var e = {}
												return (
													window.location.search
														.substr(1)
														.split('&')
														.forEach(function(t) {
															var n = t.split('='),
																a = r(n, 2),
																o = a[0],
																i = a[1]
															e[o] = i
														}),
													e
												)
											})()
											n.project && (this.getData(n.project), (s = !0))
										}
										t.filediv && this.projectByInput(t.filediv)
									}
									return (
										a(e, [
											{
												key: 'processData',
												value: function(e) {
													var t = this,
														n = e.files.pop(),
														r = e.expectedFileNames.indexOf(n.name)
													if (-1 != r) {
														e.expectedFileNames.splice(r, 1),
															(this.cohort = {
																name: 'project',
																genome: this.bt.genomes[
																	this.bt.gselect.options[this.bt.gselect.selectedIndex].innerHTML
																]
															}),
															this.flag || (this.flag = this.bt.init_bulk_flag(this.cohort.genome))
														var a = this.bt.content2flag(n.content, n.type, this.flag)
														if (a) this.err(a), this.processData(e)
														else {
															if (!e.files.length)
																return (
																	e.expectedFileNames.length &&
																		this.err(
																			'These referenced files were not found: "' +
																				e.expectedFileNames.join('", "') +
																				'".'
																		),
																	void this.bt.flag2tp(
																		this.flag,
																		{ name: 'project' },
																		Object.assign(this.cohort, e.schema),
																		this.ds
																	)
																)
															if (!this.ds)
																for (var o in this.cohort.dsset) {
																	this.ds = this.cohort.dsset[o]
																	break
																}
															var i = this.bt.bulkin(
																{ flag: this.flag, cohort: this.cohort, flag2thisds: this.ds, filename: 'project' },
																function() {
																	t.processData(e)
																}
															)
															if (i) return void this.err('Error with ' + n.name + ': ' + i)
															if (0 === this.flag.good) return void this.err(n.name + ': no data loaded')
														}
													} else
														e.files.length &&
															setTimeout(function() {
																t.processData(e)
															}, 1)
												}
											},
											{
												key: 'getData',
												value: function(e) {
													var t = this,
														n = e.split('/'),
														a = r(n, 2),
														o = a[0],
														i = a[1],
														s = i && i.trim() ? i.trim() : 'ref.txt'
													this.gettext('/data/projects/' + o + '/' + s, function(e) {
														var n = {},
															a = {},
															i = { schema: {}, files: [], expectedFileNames: [] },
															s = 0
														e
															.trim()
															.split('\n')
															.forEach(function(e) {
																var o = e.trim().split('\t'),
																	i = r(o, 2),
																	f = i[0],
																	c = i[1]
																l.includes(f)
																	? ((a[c] = f), (s += 1))
																	: u[f] || 0 === u[f]
																	? ((n[c] = u[f]), (s += 1))
																	: t.err('Unrecognized type ' + f + ' for file ' + c + ' in reference.txt.')
															}),
															(i.expectedFileNames = Object.keys(n))
														var f = t.getTracker(s, function() {
															return t.processData(i)
														})
														Object.keys(a).forEach(function(e) {
															t.getjson('/data/projects/' + o + '/' + e, function(t) {
																;(i.schema[a[e]] = t), f()
															})
														}),
															Object.keys(n).forEach(function(e) {
																t.gettext('/data/projects/' + o + '/' + e, function(t) {
																	i.files.push({ name: e, type: n[e], content: t }), f()
																})
															})
													})
												}
											},
											{
												key: 'gettext',
												value: function(e, t) {
													var n = this
													fetch(e)
														.then(function(t) {
															if (t.ok) return t.text()
															n.err('File request error: ' + e)
														})
														.then(t)
														.catch(function(t) {
															return n.err('File request error: ' + e + ' ' + t)
														})
												}
											},
											{
												key: 'getjson',
												value: function(e, t) {
													var n = this
													fetch(e)
														.then(function(t) {
															if (t.ok) return t.json()
															n.err('Network error for ' + e)
														})
														.then(t)
														.catch(function(t) {
															return n.err('file request error: ' + e + ' ' + t)
														})
												}
											},
											{
												key: 'getTracker',
												value: function(e, t) {
													var n = 0
													return function() {
														;(n += 1) == e && t()
													}
												}
											},
											{
												key: 'projectByInput',
												value: function(e) {
													var t = this
													this.tp = null
													var n = e.append('div')
													n.append('span').html('Project: reference &nbsp;'),
														(this.refNameInput = n
															.append('input')
															.attr('type', 'text')
															.property('value', 'ref.txt')
															.style('margin-right', '20px')
															.style('padding-left', '7px')),
														n
															.append('label')
															.attr('for', 'sja-pp-bulk-ui-project-btn')
															.attr('class', 'sja_btn')
															.style('padding', '3px 5px')
															.html('Choose folder'),
														n
															.append('input')
															.attr('type', 'file')
															.attr('id', 'sja-pp-bulk-ui-project-btn')
															.property('multiple', !0)
															.property('webkitdirectory', !0)
															.property('directory', !0)
															.style('width', '0')
															.on('change', function() {
																return t.readFiles()
															}),
														n
															.append('div')
															.style('margin', '10px 10px 10px 0')
															.html(
																'<a href="https://docs.google.com/document/d/1wlfGzyhxFYtWu9Fyf3FK7pgvS3rVb9_vrfYUBUOUrw4/edit?usp=sharing" target="new">Project user guide</a> | \n\t\t\t<a href=\'https://pecan.stjude.org/static/target-tall-project/ref.txt\' target=_blank>Example project reference file</a>'
															),
														n
															.append('div')
															.style('margin', '20px')
															.style('width', '100%')
															.html('-- OR --')
												}
											},
											{
												key: 'readFiles',
												value: function() {
													var e = this,
														t = e.refNameInput.property('value'),
														n = Array.from(o.event.target.files),
														a = n.filter(function(e) {
															return e.name == t
														})[0]
													if (a) {
														var i = {},
															s = {},
															f = { schema: {}, files: [], expectedFileNames: [] },
															c = new FileReader(),
															d = 0
														;(c.onload = function(t) {
															t.target.result
																.trim()
																.split('\n')
																.forEach(function(t) {
																	var n = t.trim().split('\t'),
																		a = r(n, 2),
																		o = a[0],
																		f = a[1]
																	l.includes(o)
																		? (s[f] = o)
																		: u[o] || 0 === u[o]
																		? (i[f] = u[o])
																		: e.err('Unrecognized type ' + o + ' for file ' + f + ' in reference.txt.')
																}),
																(f.expectedFileNames = Object.keys(i))
															var a = n.filter(function(e) {
																	return e.name in s
																}),
																o = 0
															function c(t) {
																if (f.expectedFileNames.includes(t.name)) {
																	if (!t) return e.err('Error reading file.'), void (d += 1)
																	if (0 == t.size) return e.err('Wrong file: ' + t.name), void (d += 1)
																	if (!i[t.name] && 0 !== i[t.name] && '' != t.name)
																		return (
																			e.err('Missing or invalid type assigned to file ' + t.name + '.'), void (d += 1)
																		)
																	var r = new FileReader()
																	;(r.onload = function(r) {
																		;(d += 1),
																			f.files.push({ name: t.name, type: i[t.name], content: r.target.result }),
																			d == n.length && e.processData(f)
																	}),
																		(r.onerror = function() {
																			;(d += 1),
																				e.err('Error reading file ' + t.name),
																				d == n.length && e.processData(f)
																		}),
																		r.readAsText(t, 'utf8')
																} else d += 1
															}
															a.length
																? a.forEach(function(t) {
																		var r = new FileReader()
																		;(r.onload = function(r) {
																			var i = JSON.parse(r.target.result)
																			;(o += 1),
																				i
																					? (f.schema[s[t.name]] = i)
																					: e.err('Unable to parse schema file="' + t.name + '".'),
																				o == a.length && n.forEach(c)
																		}),
																			(r.onerror = function() {
																				e.err('Error reading schema.txt.')
																			}),
																			r.readAsText(t, 'utf8')
																  })
																: n.forEach(c)
														}),
															(c.onerror = function() {
																e.err('Error reading reference.txt.')
															}),
															c.readAsText(a, 'utf8')
													} else e.err("Missing reference file='" + t + "'.")
												}
											},
											{
												key: 'errHandler',
												value: function() {
													var e = (0, o.select)('body').append('div')
													return function(t) {
														t && i.sayerror(e, t)
													}
												}
											}
										]),
										e
									)
								})()
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r,
									a = (r = n(28)) && r.__esModule ? r : { default: r }
								t.default = (0, a.default)('text/html', function(e) {
									return document.createRange().createContextualFragment(e.responseText)
								})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r,
									a = (r = n(28)) && r.__esModule ? r : { default: r }
								t.default = (0, a.default)('application/json', function(e) {
									return JSON.parse(e.responseText)
								})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r,
									a = (r = n(28)) && r.__esModule ? r : { default: r }
								t.default = (0, a.default)('text/plain', function(e) {
									return e.responseText
								})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r,
									a = (r = n(28)) && r.__esModule ? r : { default: r }
								t.default = (0, a.default)('application/xml', function(e) {
									var t = e.responseXML
									if (!t) throw new Error('parse error')
									return t
								})
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r,
									a = n(66),
									o = (r = n(112)) && r.__esModule ? r : { default: r }
								t.default = (0, o.default)('text/csv', a.csvParse)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.csvFormatRows = t.csvFormat = t.csvParseRows = t.csvParse = void 0)
								var r,
									a = (0, ((r = n(53)) && r.__esModule ? r : { default: r }).default)(',')
								;(t.csvParse = a.parse),
									(t.csvParseRows = a.parseRows),
									(t.csvFormat = a.format),
									(t.csvFormatRows = a.formatRows)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.tsvFormatRows = t.tsvFormat = t.tsvParseRows = t.tsvParse = void 0)
								var r,
									a = (0, ((r = n(53)) && r.__esModule ? r : { default: r }).default)('\t')
								;(t.tsvParse = a.parse),
									(t.tsvParseRows = a.parseRows),
									(t.tsvFormat = a.format),
									(t.tsvFormatRows = a.formatRows)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 })
								var r,
									a = n(66),
									o = (r = n(112)) && r.__esModule ? r : { default: r }
								t.default = (0, o.default)('text/tab-separated-values', a.tsvParse)
							},
							function(e, t, n) {
								Object.defineProperty(t, '__esModule', { value: !0 }),
									(t.url2map = c),
									(t.parse = async function(e) {
										var t = c()
										if (t.has('mdsjsonform')) {
											var s = await Promise.all([n.e(0), n.e(1), n.e(4), n.e(30), n.e(47)]).then(n.t.bind(null, 319, 7))
											await s.init_mdsjsonform(e)
										} else {
											if (t.has('genome') && e.selectgenome)
												for (var f = t.get('genome'), p = 0; p < e.selectgenome.node().childNodes.length; p++)
													if (e.selectgenome.node().childNodes[p].value == f) {
														e.selectgenome.property('selectedIndex', p)
														break
													}
											if (t.has('hicfile') || t.has('hicurl')) {
												var h = void 0,
													v = void 0
												t.has('hicfile') ? (h = t.get('hicfile')) : (v = t.get('hicurl'))
												var m = t.get('genome')
												if (!m) return 'genome is required for hic'
												var y = e.genomes[m]
												if (!y) return 'invalid genome'
												var g = {
													genome: y,
													file: h,
													url: v,
													name: l.default.basename(h || v),
													hostURL: e.hostURL,
													enzyme: t.get('enzyme'),
													holder: e.holder
												}
												Promise.all([n.e(11), n.e(22)])
													.then(n.t.bind(null, 119, 7))
													.then(function(e) {
														e.hicparsefile(g)
													})
											} else {
												if (t.has('singlecell')) {
													if (!t.has('genome')) return '"genome" is required for "singlecell"'
													var b = t.get('genome'),
														_ = e.genomes[b]
													return _
														? void a
																.add_scriptTag('/static/js/three.js')
																.then(function() {
																	return a.add_scriptTag('/static/js/loaders/PCDLoader.js')
																})
																.then(function() {
																	return a.add_scriptTag('/static/js/controls/TrackballControls.js')
																})
																.then(function() {
																	return a.add_scriptTag('/static/js/WebGL.js')
																})
																.then(function() {
																	return a.add_scriptTag('/static/js/libs/stats.min.js')
																})
																.then(function() {
																	Promise.all([n.e(0), n.e(1), n.e(4), n.e(21)])
																		.then(n.t.bind(null, 125, 7))
																		.then(function(n) {
																			n.init({ genome: _, jsonfile: t.get('singlecell') }, e.holder)
																		})
																})
														: 'invalid genome: ' + b
												}
												if (t.has('mavbfile')) {
													if (!t.has('genome')) return '"genome" is required for "mavb"'
													var x = t.get('genome'),
														w = e.genomes[x]
													return w
														? void n
																.e(6)
																.then(n.t.bind(null, 31, 7))
																.then(function(n) {
																	n.mavbparseinput(
																		{ genome: w, hostURL: e.hostURL, file: t.get('mavbfile') },
																		function() {},
																		e.holder,
																		e.jwt
																	)
																})
														: 'invalid genome: ' + x
												}
												if (t.has('mavburl')) {
													if (!t.has('genome')) return '"genome" is required for "mavb"'
													var j = t.get('genome'),
														k = e.genomes[j]
													return k
														? void n
																.e(6)
																.then(n.t.bind(null, 31, 7))
																.then(function(n) {
																	n.mavbparseinput(
																		{ genome: k, hostURL: e.hostURL, url: t.get('mavburl') },
																		function() {},
																		e.holder,
																		e.jwt
																	)
																})
														: 'invalid genome: ' + j
												}
												if (t.has('scatterplot')) {
													if (!t.has('genome')) return '"genome" is required for "scatterplot"'
													var O = t.get('genome')
													if (!e.genomes[O]) return 'invalid genome: ' + O
													var M = void 0
													try {
														if (t.has('mdsjson') || t.has('mdsjsonurl')) {
															var P = t.get('mdsjsonurl'),
																S = t.get('mdsjson')
															M = await u.get_scatterplot_data(S, P, e.holder)
														}
													} catch (e) {
														return e.stack && console.log(e.stack), e.message || e
													}
													await Promise.all([n.e(0), n.e(1), n.e(4), n.e(17)])
														.then(n.t.bind(null, 124, 7))
														.then(function(t) {
															t.init(M.mdssamplescatterplot, e.holder, !1)
														})
												} else {
													if (t.has('block')) {
														if (!t.has('genome')) return 'missing genome for block'
														var A = t.get('genome'),
															C = e.genomes[A]
														if (!C) return 'invalid genome: ' + A
														var N = {
																nobox: 1,
																hostURL: e.hostURL,
																jwt: e.jwt,
																holder: e.holder,
																genome: C,
																dogtag: A,
																allowpopup: !0,
																debugmode: e.debugmode
															},
															T = null,
															E = null
														if (t.has('position')) {
															var I = t.get('position').split(/[:-]/),
																R = I[0],
																L = Number.parseInt(I[1]),
																D = Number.parseInt(I[2])
															if (Number.isNaN(L) || Number.isNaN(D)) return 'Invalid start/stop value in position'
															T = { chr: R, start: L, stop: D }
														}
														if (t.has('regions')) {
															E = []
															var F = !0,
																q = !1,
																U = void 0
															try {
																for (
																	var G,
																		z = t
																			.get('regions')
																			.split(',')
																			[Symbol.iterator]();
																	!(F = (G = z.next()).done);
																	F = !0
																) {
																	var B = G.value.split(/[:-]/),
																		Y = (B[0], Number.parseInt(B[1])),
																		V = Number.parseInt(B[2])
																	if (Number.isNaN(Y) || Number.isNaN(V)) return 'Invalid start/stop value in regions'
																	E.push({ chr: B[0], start: Y, stop: V })
																}
															} catch (e) {
																;(q = !0), (U = e)
															} finally {
																try {
																	!F && z.return && z.return()
																} finally {
																	if (q) throw U
																}
															}
														}
														if (
															(T ||
																E ||
																(C.defaultcoord &&
																	(T = {
																		chr: C.defaultcoord.chr,
																		start: C.defaultcoord.start,
																		stop: C.defaultcoord.stop
																	})),
															T ? ((N.chr = T.chr), (N.start = T.start), (N.stop = T.stop)) : E && (N.rglst = E),
															t.has('hlregion'))
														) {
															var H = [],
																W = !0,
																X = !1,
																J = void 0
															try {
																for (
																	var K,
																		Z = t
																			.get('hlregion')
																			.split(',')
																			[Symbol.iterator]();
																	!(W = (K = Z.next()).done);
																	W = !0
																) {
																	var $ = K.value,
																		Q = (0, i.string2pos)($, C, !0)
																	Q && H.push(Q)
																}
															} catch (e) {
																;(X = !0), (J = e)
															} finally {
																try {
																	!W && Z.return && Z.return()
																} finally {
																	if (X) throw J
																}
															}
															H.length && (N.hlregions = H)
														}
														if (t.has('mds')) {
															var ee = t.get('mds').split(',')
															ee[0] &&
																ee[1] &&
																((N.datasetqueries = [{ dataset: ee[0], querykey: ee[1] }]),
																t.has('sample') &&
																	((N.datasetqueries[0].singlesample = { name: t.get('sample') }),
																	(N.datasetqueries[0].getsampletrackquickfix = !0)))
														}
														try {
															N.tklst = await d(t, e.holder, C)
														} catch (e) {
															return e.stack && console.log(e.stack), e.message || e
														}
														return (
															a.first_genetrack_tolist(e.genomes[A], N.tklst),
															void Promise.all([n.e(0), n.e(2), n.e(3)])
																.then(n.t.bind(null, 13, 7))
																.then(function(e) {
																	return new e.Block(N)
																})
														)
													}
													if (t.has('gene')) {
														var te = t.get('gene')
														if (0 == te.length) return 'zero length query string'
														var ne = void 0
														for (var re in e.genomes)
															if (e.genomes[re].isdefault) {
																ne = re
																break
															}
														if ((t.has('genome') && (ne = t.get('genome')), !ne))
															return 'No genome, and none set as default'
														var ae = e.genomes[ne]
														if (!ae) return 'invalid genome: ' + ne
														var oe = null
														t.has('dataset') && (oe = t.get('dataset').split(','))
														var ie = null
														if (t.has('hlaachange')) {
															ie = new Map()
															var le = !0,
																ue = !1,
																se = void 0
															try {
																for (
																	var fe,
																		ce = t
																			.get('hlaachange')
																			.split(',')
																			[Symbol.iterator]();
																	!(le = (fe = ce.next()).done);
																	le = !0
																) {
																	var de = fe.value
																	ie.set(de, !1)
																}
															} catch (e) {
																;(ue = !0), (se = e)
															} finally {
																try {
																	!le && ce.return && ce.return()
																} finally {
																	if (ue) throw se
																}
															}
														}
														var pe = void 0
														try {
															pe = await d(t, e.holder, ae)
														} catch (e) {
															return e.stack && console.log(e.stack), e.message || e
														}
														;(0, r.default)({
															hostURL: e.hostURL,
															query: te,
															genome: e.genomes[ne],
															tklst: pe,
															holder: e.holder,
															dataset: oe,
															hlaachange: ie,
															variantPageCall_snv: e.variantPageCall_snv,
															samplecart: e.samplecart,
															debugmode: e.debugmode
														})
													} else if (t.has('study')) {
														var he = t.get('study')
														'' != he &&
															(0, o.loadstudycohort)(e.genomes, he, e.holder, e.hostURL, void 0, !1, e.debugmode)
													}
												}
											}
										}
									}),
									(t.get_tklst = d)
								var r = f(n(61)),
									a = s(n(6)),
									o = n(51),
									i = n(20),
									l = f(n(122)),
									u = s(n(113))
								function s(e) {
									if (e && e.__esModule) return e
									var t = {}
									if (null != e) for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (t[n] = e[n])
									return (t.default = e), t
								}
								function f(e) {
									return e && e.__esModule ? e : { default: e }
								}
								function c() {
									var e = new Map(),
										t = !0,
										n = !1,
										r = void 0
									try {
										for (
											var a,
												o = decodeURIComponent(location.search.substr(1))
													.split('&')
													[Symbol.iterator]();
											!(t = (a = o.next()).done);
											t = !0
										) {
											var i = a.value.split('=')
											if (2 == i.length) {
												var l = i[0].toLowerCase()
												'p' == l && (l = 'gene'), e.set(l, i[1]), sessionStorage.setItem('urlp_' + l, i[1])
											}
										}
									} catch (e) {
										;(n = !0), (r = e)
									} finally {
										try {
											!t && o.return && o.return()
										} finally {
											if (n) throw r
										}
									}
									return e
								}
								async function d(e, t, n) {
									var r = []
									if (e.has('mdsjsoncache')) {
										var o = await a.dofetch2('mdsjsonform', {
											method: 'POST',
											body: JSON.stringify({ draw: e.get('mdsjsoncache') })
										})
										if (o.error) throw o.error
										u.validate_mdsjson(o.json)
										var i = u.get_json_tk(o.json)
										r.push(i)
									}
									if (e.has('mdsjson') || e.has('mdsjsonurl')) {
										var l = e.get('mdsjsonurl'),
											s = e.get('mdsjson'),
											f = await u.init_mdsjson(s, l, t)
										r.push.apply(
											r,
											(function(e) {
												if (Array.isArray(e)) {
													for (var t = 0, n = Array(e.length); t < e.length; t++) n[t] = e[t]
													return n
												}
												return Array.from(e)
											})(f)
										)
									}
									if (e.has('tkjsonfile')) {
										var c = await a.dofetch('textfile', { file: e.get('tkjsonfile') })
										if (c.error) throw c.error
										if (!c.text) throw '.text missing'
										var d = JSON.parse(c.text),
											p = !0,
											h = !1,
											v = void 0
										try {
											for (var m, y = d[Symbol.iterator](); !(p = (m = y.next()).done); p = !0) {
												var g = m.value
												if (g.isfacet) {
													if ((n.tkset || (n.tkset = []), !g.tracks)) throw '.tracks[] missing from a facet table'
													if (!Array.isArray(g.tracks)) throw '.tracks[] not an array from a facet table'
													;(g.tklst = g.tracks), delete g.tracks
													var b = !0,
														_ = !1,
														x = void 0
													try {
														for (var w, j = g.tklst[Symbol.iterator](); !(b = (w = j.next()).done); b = !0) {
															var k = w.value
															if (!k.assay) throw '.assay missing from a facet track'
															if (((k.assayname = k.assay), delete k.assay, !k.sample))
																throw '.sample missing from a facet track'
															;(k.patient = k.sample),
																delete k.sample,
																k.sampletype || (k.sampletype = k.patient),
																(k.tkid = Math.random().toString())
														}
													} catch (e) {
														;(_ = !0), (x = e)
													} finally {
														try {
															!b && j.return && j.return()
														} finally {
															if (_) throw x
														}
													}
													n.tkset.push(g)
												} else r.push(g)
											}
										} catch (e) {
											;(h = !0), (v = e)
										} finally {
											try {
												!p && y.return && y.return()
											} finally {
												if (h) throw v
											}
										}
									}
									if (e.has('bamfile'))
										for (var O = e.get('bamfile').split(','), M = 0; M < O.length; M += 2)
											O[M] && O[M + 1] && r.push({ type: a.tkt.bam, name: O[M], file: O[M + 1] })
									if (e.has('bamurl'))
										for (var P = e.get('bamurl').split(','), S = 0; S < P.length; S += 2)
											P[S] && P[S + 1] && r.push({ type: a.tkt.bam, name: P[S], url: P[S + 1] })
									if (e.has('bedjfile'))
										for (var A = e.get('bedjfile').split(','), C = 0; C < A.length; C += 2)
											A[C] && A[C + 1] && r.push({ type: a.tkt.bedj, name: A[C], file: A[C + 1] })
									if (e.has('bedjurl'))
										for (var N = e.get('bedjurl').split(','), T = 0; T < N.length; T += 2)
											N[T] && N[T + 1] && r.push({ type: a.tkt.bedj, name: N[T], url: N[T + 1] })
									if (e.has('bigwigfile'))
										for (var E = e.get('bigwigfile').split(','), I = 0; I < E.length; I += 2)
											E[I] && E[I + 1] && r.push({ type: a.tkt.bigwig, name: E[I], file: E[I + 1], scale: { auto: 1 } })
									if (e.has('bigwigurl'))
										for (var R = e.get('bigwigurl').split(','), L = 0; L < R.length; L += 2)
											R[L] && R[L + 1] && r.push({ type: a.tkt.bigwig, name: R[L], url: R[L + 1], scale: { auto: 1 } })
									if (e.has('junctionfile'))
										for (var D = e.get('junctionfile').split(','), F = 0; F < D.length; F += 2)
											D[F] && D[F + 1] && r.push({ type: a.tkt.junction, name: D[F], tracks: [{ file: D[F + 1] }] })
									if (e.has('junctionurl'))
										for (var q = e.get('junctionurl').split(','), U = 0; U < q.length; U += 2)
											q[U] && q[U + 1] && r.push({ type: a.tkt.junction, name: q[U], tracks: [{ url: q[U + 1] }] })
									if (e.has('vcffile'))
										for (var G = e.get('vcffile').split(','), z = 0; z < G.length; z += 2)
											G[z] && G[z + 1] && r.push({ type: 'vcf', name: G[z], file: G[z + 1] })
									if (e.has('vcfurl'))
										for (var B = e.get('vcfurl').split(','), Y = 0; Y < B.length; Y += 2)
											B[Y] && B[Y + 1] && r.push({ type: 'vcf', name: B[Y], url: B[Y + 1] })
									if (e.has('aicheckfile'))
										for (var V = e.get('aicheckfile').split(','), H = 0; H < V.length; H += 2)
											V[H] && V[H + 1] && r.push({ type: 'aicheck', name: V[H], file: V[H + 1] })
									if (e.has('bampilefile')) {
										var W = e.get('bampilefile').split(','),
											X = null
										e.has('bampilelink') &&
											(X = e
												.get('bampilelink')
												.split(',')
												.map(decodeURIComponent))
										for (var J = 0; J < W.length; J += 2)
											if (W[J] && W[J + 1]) {
												var K = { type: a.tkt.bampile, name: W[J], file: W[J + 1] }
												X && X[J / 2] && (K.link = X[J / 2]), r.push(K)
											}
									}
									if (e.has('svcnvfpkmurl')) {
										for (var Z = e.get('svcnvfpkmurl').split(','), $ = Z[0], Q = {}, ee = 1; ee < Z.length; ee += 2)
											Q[Z[ee]] = Z[ee + 1]
										if (Q.svcnv || Q.vcf) {
											var te = { type: a.tkt.mdssvcnv, name: $ }
											Q.svcnv && (te.url = Q.svcnv),
												Q.vcf && (te.checkvcf = { url: Q.vcf, indexURL: Q.vcfindex }),
												Q.fpkm && (te.checkexpressionrank = { datatype: 'FPKM', url: Q.fpkm, indexURL: Q.fpkmindex }),
												r.push(te)
										}
									}
									if (e.has('svcnvfpkmfile')) {
										for (
											var ne = e.get('svcnvfpkmfile').split(','), re = ne[0], ae = {}, oe = 1;
											oe < ne.length;
											oe += 2
										)
											ae[ne[oe]] = ne[oe + 1]
										if (ae.svcnv || ae.vcf) {
											var ie = { type: a.tkt.mdssvcnv, name: re }
											ae.svcnv && (ie.file = ae.svcnv),
												ae.vcf && (ie.checkvcf = { file: ae.vcf }),
												ae.fpkm && (ie.checkexpressionrank = { datatype: 'FPKM', file: ae.fpkm }),
												r.push(ie)
										}
									}
									if (e.has('mdsjunctionfile'))
										for (var le = e.get('mdsjunctionfile').split(','), ue = 0; ue < le.length; ue += 2)
											le[ue] && le[ue + 1] && r.push({ type: 'mdsjunction', name: le[ue], file: le[ue + 1] })
									var se = !0,
										fe = !1,
										ce = void 0
									try {
										for (var de, pe = r[Symbol.iterator](); !(se = (de = pe.next()).done); se = !0)
											de.value.iscustom = !0
									} catch (e) {
										;(fe = !0), (ce = e)
									} finally {
										try {
											!se && pe.return && pe.return()
										} finally {
											if (fe) throw ce
										}
									}
									return r
								}
							}
						])
					}),
					'object' == _typeof2(exports) && 'object' == _typeof2(module)
						? (module.exports = t())
						: ((__WEBPACK_AMD_DEFINE_ARRAY__ = []),
						  void 0 ===
								(__WEBPACK_AMD_DEFINE_RESULT__ =
									'function' == typeof (__WEBPACK_AMD_DEFINE_FACTORY__ = t)
										? __WEBPACK_AMD_DEFINE_FACTORY__.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__)
										: __WEBPACK_AMD_DEFINE_FACTORY__) || (module.exports = __WEBPACK_AMD_DEFINE_RESULT__))
			}.call(this, __webpack_require__(17)(module)))
		},
		function(e, t, n) {
			'use strict'
			e.exports = function(e) {
				return (
					e.webpackPolyfill ||
						((e.deprecate = function() {}),
						(e.paths = []),
						e.children || (e.children = []),
						Object.defineProperty(e, 'loaded', {
							enumerable: !0,
							get: function() {
								return e.l
							}
						}),
						Object.defineProperty(e, 'id', {
							enumerable: !0,
							get: function() {
								return e.i
							}
						}),
						(e.webpackPolyfill = 1)),
					e
				)
			}
		},
		function(e, t, n) {
			'use strict'
			var r
			Object.defineProperty(t, '__esModule', { value: !0 })
			var a = n(19)
			function o(e, t, n) {
				return (
					t in e
						? Object.defineProperty(e, t, { value: n, enumerable: !0, configurable: !0, writable: !0 })
						: (e[t] = n),
					e
				)
			}
			Object.defineProperty(t, 'Partjson', {
				enumerable: !0,
				get: function() {
					return ((e = a), e && e.__esModule ? e : { default: e }).default
					var e
				}
			}),
				(t.mclasstester = function(e) {
					switch (e.toLowerCase()) {
						case 'missense_mutation':
							return 'M'
						case 'nonsense_mutation':
							return 'N'
						case 'splice_site':
							return 'L'
						case 'rna':
							return O
						case 'frame_shift_del':
						case 'frame_shift_ins':
							return 'F'
						case 'in_frame_del':
							return 'D'
						case 'in_frame_ins':
							return 'I'
						case 'translation_start_site':
							return k
						case 'nonstop_mutation':
							return 'N'
						case "3'utr":
							return w
						case "3'flank":
							return O
						case "5'utr":
							return j
						case "5'flank":
							return O
						default:
							return null
					}
				}),
				(t.validtkt = function(e) {
					for (var t in D) if (e == D[t]) return !0
					return !1
				}),
				(t.nt2aa = U),
				(t.bplen = function(e) {
					return e >= 1e9
						? (e / 1e9).toFixed(1) + ' Gb'
						: e >= 1e7
						? Math.ceil(e / 1e6) + ' Mb'
						: e >= 1e6
						? (e / 1e6).toFixed(1) + ' Mb'
						: e >= 1e4
						? Math.ceil(e / 1e3) + ' Kb'
						: e >= 1e3
						? (e / 1e3).toFixed(1) + ' Kb'
						: e + ' bp'
				}),
				(t.basecompliment = G),
				(t.reversecompliment = z),
				(t.spliceeventchangegmexon = function(e, t) {
					var n = { chr: e.chr, start: e.start, stop: e.stop, strand: e.strand, coding: [] }
					if (t.isskipexon || t.isaltexon)
						for (var r = 0; r < e.exon.length; r++) {
							var a = Math.max(e.codingstart, e.exon[r][0]),
								o = Math.min(e.codingstop, e.exon[r][1])
							a > o || (-1 == t.skippedexon.indexOf(r) && n.coding.push([a, o]))
						}
					else if (t.a5ss || t.a3ss) {
						var i = e.exon.map(function(e) {
								return [e[0], e[1]]
							}),
							l = '+' == e.strand
						t.a5ss
							? l
								? (i[t.exon5idx][1] = t.junctionB.start)
								: (i[t.exon5idx + 1][0] = t.junctionB.stop)
							: l
							? (i[t.exon5idx + 1][0] = t.junctionB.stop)
							: (i[t.exon5idx][1] = t.junctionB.start)
						var u = !0,
							s = !1,
							f = void 0
						try {
							for (var c, d = i[Symbol.iterator](); !(u = (c = d.next()).done); u = !0) {
								var p = c.value,
									h = Math.max(e.codingstart, p[0]),
									v = Math.min(e.codingstop, p[1])
								h > v || n.coding.push([h, v])
							}
						} catch (e) {
							;(s = !0), (f = e)
						} finally {
							try {
								!u && d.return && d.return()
							} finally {
								if (s) throw f
							}
						}
					}
					return n
				}),
				(t.fasta2gmframecheck = function(e, t) {
					var n = t.split('\n')
					n.shift(), (e.genomicseq = n.join('').toUpperCase())
					var r = U(e),
						a = l
					r.indexOf(q) == r.length - 1 && (a = i)
					return a
				}),
				(t.validate_vcfinfofilter = function(e) {
					if (!e.lst) return '.lst missing'
					if (!Array.isArray(e.lst)) return 'input is not an array'
					var t = !0,
						n = !1,
						r = void 0
					try {
						for (var a, o = e.lst[Symbol.iterator](); !(t = (a = o.next()).done); t = !0) {
							var i = a.value
							if (!i.name) return 'name missing from a set of .vcfinfofilter.lst'
							if (i.autocategory || i.categories) {
								if (!i.autocategory)
									for (var l in i.categories) {
										var u = i.categories[l]
										if (!i.autocolor && !u.color)
											return '.color missing for class ' + l + ' from .categories of set ' + i.name
										u.label || (u.label = l)
									}
								if (i.categoryhidden) {
									for (var s in i.categoryhidden)
										if (!i.categories[s]) return 'unknown hidden-by-default category ' + s + ' from set ' + i.name
								} else i.categoryhidden = {}
							} else if (i.numericfilter) {
								var f = [],
									c = !0,
									d = !1,
									p = void 0
								try {
									for (var h, v = i.numericfilter[Symbol.iterator](); !(c = (h = v.next()).done); c = !0) {
										var m = h.value
										'number' == typeof m
											? f.push({ side: '<', value: m })
											: f.push({ side: m.side || '<', value: m.value })
									}
								} catch (e) {
									;(d = !0), (p = e)
								} finally {
									try {
										!c && v.return && v.return()
									} finally {
										if (d) throw p
									}
								}
								i.numericfilter = f
							}
							if (i.altalleleinfo) {
								if (!i.altalleleinfo.key) return '.key missing from .altalleleinfo from set ' + i.name
							} else {
								if (!i.locusinfo) return 'neither .altalleleinfo or .locusinfo is available from set ' + i.name
								if (!i.locusinfo.key) return '.key missing from .locusinfo from set ' + i.name
							}
						}
					} catch (e) {
						;(n = !0), (r = e)
					} finally {
						try {
							!t && o.return && o.return()
						} finally {
							if (n) throw r
						}
					}
				}),
				(t.contigNameNoChr = function(e, t) {
					for (var n in e.majorchr) if (-1 != t.indexOf(n.replace('chr', ''))) return !0
					if (e.minorchr) for (var r in e.minorchr) if (-1 != t.indexOf(r.replace('chr', ''))) return !0
					return !1
				}),
				(t.contigNameNoChr2 = function(e, t) {
					var n = 0,
						r = 0
					for (var a in e.majorchr) t.includes(a) ? r++ : t.includes(a.replace('chr', '')) && n++
					if (e.minorchr) for (var o in e.minorchr) t.includes(o) ? r++ : t.includes(o.replace('chr', '')) && n++
					return [n, r]
				}),
				(t.getMax_byiqr = function(e, t) {
					if (0 == e.length) return t
					e.sort(function(e, t) {
						return e - t
					})
					var n = e[e.length - 1]
					if (e.length <= 5) return n
					var r = e[Math.floor(e.length / 4)],
						a = e[Math.floor((3 * e.length) / 4)]
					return Math.min(a + 1.5 * (a - r), n)
				}),
				(t.alleleInGenotypeStr = function(e, t) {
					if (!e) return !1
					if (-1 != e.indexOf('/')) return -1 != e.split('/').indexOf(t)
					return -1 != e.split('|').indexOf(t)
				}),
				(t.vcfcopymclass = function(e, t) {
					if (e.csq) {
						var n = null
						if (t.usegm) {
							var r = !0,
								a = !1,
								o = void 0
							try {
								for (var i, l = e.csq[Symbol.iterator](); !(r = (i = l.next()).done); r = !0) {
									var s = i.value
									s._isoform == t.usegm.isoform && (n ? s._csqrank < n._csqrank && (n = s) : (n = s))
								}
							} catch (e) {
								;(a = !0), (o = e)
							} finally {
								try {
									!r && l.return && l.return()
								} finally {
									if (a) throw o
								}
							}
							n || t.gmmode != B.genomic || (n = e.csq[0])
						} else {
							n = e.csq[0]
							var f = !0,
								c = !1,
								d = void 0
							try {
								for (var p, h = e.csq[Symbol.iterator](); !(f = (p = h.next()).done); f = !0) {
									var v = p.value
									v._csqrank < n._csqrank && (n = v)
								}
							} catch (e) {
								;(c = !0), (d = e)
							} finally {
								try {
									!f && h.return && h.return()
								} finally {
									if (c) throw d
								}
							}
						}
						n &&
							((e.gene = n._gene),
							(e.isoform = n._isoform),
							(e.class = n._class),
							(e.dt = n._dt),
							(e.mname = n._mname),
							e.class == O && delete e.class)
					} else if (e.ann) {
						var m = null
						if (t.usegm) {
							var g = !0,
								b = !1,
								_ = void 0
							try {
								for (var x, w = e.ann[Symbol.iterator](); !(g = (x = w.next()).done); g = !0) {
									var j = x.value
									j._isoform == t.usegm.isoform && (m ? j._csqrank < m._csqrank && (m = j) : (m = j))
								}
							} catch (e) {
								;(b = !0), (_ = e)
							} finally {
								try {
									!g && w.return && w.return()
								} finally {
									if (b) throw _
								}
							}
							m || t.gmmode != B.genomic || (m = e.ann[0])
						} else {
							m = e.ann[0]
							var M = !0,
								P = !1,
								S = void 0
							try {
								for (var A, C = e.ann[Symbol.iterator](); !(M = (A = C.next()).done); M = !0) {
									var N = A.value
									N._csqrank < m._csqrank && (m = N)
								}
							} catch (e) {
								;(P = !0), (S = e)
							} finally {
								try {
									!M && C.return && C.return()
								} finally {
									if (P) throw S
								}
							}
						}
						m &&
							((e.gene = m._gene),
							(e.isoform = m._isoform),
							(e.class = m._class),
							(e.dt = m._dt),
							(e.mname = m._mname),
							e.class == O && delete e.class)
					}
					null == e.class &&
						(y[e.type]
							? ((e.class = e.type),
							  (e.dt = y[e.type].dt),
							  (e.mname = e.ref + '>' + e.alt),
							  e.mname.length > 15 && (e.mname = e.type))
							: ((e.class = k), (e.dt = u), (e.mname = e.type)))
					delete e.type
				}),
				(t.kernelDensityEstimator = function(e, t) {
					return function(n) {
						return t.map(function(t) {
							return [
								t,
								n
									.map(function(n) {
										return e(t - n)
									})
									.reduce(function(e, t) {
										return e + t
									}, 0) / n.length
							]
						})
					}
				}),
				(t.kernelEpanechnikov = function(e) {
					return function(t) {
						return Math.abs((t /= e)) <= 1 ? (0.75 * (1 - t * t)) / e : 0
					}
				})
			;(t.defaultcolor = '#8AB1D4'), (t.exoncolor = '#4F8053')
			var i = (t.IN_frame = !0),
				l = (t.OUT_frame = !1),
				u = (t.dtsnvindel = 1),
				s = (t.dtfusionrna = 2),
				f = ((t.dtgeneexpression = 3), (t.dtcnv = 4)),
				c = (t.dtsv = 5),
				d = (t.dtitd = 6),
				p = (t.dtdel = 7),
				h = (t.dtnloss = 8),
				v = (t.dtcloss = 9),
				m = (t.dtloh = 10),
				y =
					((t.dt2label =
						(o((r = {}), u, 'SNV/indel'),
						o(r, s, 'Fusion RNA'),
						o(r, f, 'CNV'),
						o(r, c, 'SV'),
						o(r, d, 'ITD'),
						o(r, p, 'Deletion'),
						o(r, h, 'N-loss'),
						o(r, v, 'C-loss'),
						o(r, m, 'LOH'),
						r)),
					(t.mclass = {
						M: {
							label: 'MISSENSE',
							color: '#3987CC',
							dt: u,
							desc: 'A substitution variant in the coding region resulting in altered protein coding.'
						},
						E: { label: 'EXON', color: '#bcbd22', dt: u, desc: 'A variant in the exon of a non-coding RNA.' },
						F: {
							label: 'FRAMESHIFT',
							color: '#db3d3d',
							dt: u,
							desc: 'An insertion or deletion variant that alters the protein coding frame.'
						},
						N: {
							label: 'NONSENSE',
							color: '#ff7f0e',
							dt: u,
							desc: 'A variant altering protein coding to produce a premature stopgain or stoploss.'
						},
						S: {
							label: 'SILENT',
							color: '#2ca02c',
							dt: u,
							desc: 'A substitution variant in the coding region that does not alter protein coding.'
						},
						D: {
							label: 'PROTEINDEL',
							color: '#7f7f7f',
							dt: u,
							desc:
								'A deletion resulting in a loss of one or more codons from the product, but not altering the protein coding frame.'
						},
						I: {
							label: 'PROTEININS',
							color: '#8c564b',
							dt: u,
							desc:
								'An insertion introducing one or more codons into the product, but not altering the protein coding frame.'
						},
						P: {
							label: 'SPLICE_REGION',
							color: '#9467bd',
							dt: u,
							desc: 'A variant in an intron within 10 nt of an exon boundary.'
						},
						L: {
							label: 'SPLICE',
							color: '#6633FF',
							dt: u,
							desc: 'A variant near an exon edge that may affect splicing functionality.'
						},
						Intron: { label: 'INTRON', color: '#bbbbbb', dt: u, desc: 'An intronic variant.' }
					})),
				g = (t.mclassitd = 'ITD')
			y[g] = { label: 'ITD', color: '#ff70ff', dt: d, desc: 'In-frame internal tandem duplication.' }
			var b = (t.mclassdel = 'DEL')
			y[b] = { label: 'DELETION, intragenic', color: '#858585', dt: p, desc: 'Intragenic deletion.' }
			var _ = (t.mclassnloss = 'NLOSS')
			y[_] = { label: 'N-terminus loss', color: '#545454', dt: h, desc: 'N-terminus loss due to translocation' }
			var x = (t.mclasscloss = 'CLOSS')
			y[x] = { label: 'C-terminus loss', color: '#545454', dt: v, desc: 'C-terminus loss due to translocation' }
			var w = (t.mclassutr3 = 'Utr3')
			y[w] = { label: 'UTR_3', color: '#998199', dt: u, desc: "A variant in the 3' untranslated region." }
			var j = (t.mclassutr5 = 'Utr5')
			y[j] = { label: 'UTR_5', color: '#819981', dt: u, desc: "A variant in the 5' untranslated region." }
			var k = (t.mclassnonstandard = 'X')
			y[k] = {
				label: 'NONSTANDARD',
				color: 'black',
				dt: u,
				desc: 'A mutation class that either does not match our notation, or is unspecified.'
			}
			var O = (t.mclassnoncoding = 'noncoding')
			y[O] = { label: 'NONCODING', color: 'black', dt: u, desc: 'Noncoding mutation.' }
			var M = (t.mclassfusionrna = 'Fuserna')
			y[M] = {
				label: 'Fusion transcript',
				color: '#545454',
				dt: s,
				desc:
					'Marks the break points leading to fusion transcripts, predicted by "Cicero" from RNA-seq data.<br><span style="font-size:150%">&#9680;</span> - 3\' end of the break point is fused to the 5\' end of another break point in a different gene.<br><span style="font-size:150%">&#9681;</span> - 5\' end of the break point is fused to the 3\' end of another break point in a different gene.'
			}
			var P = (t.mclasssv = 'SV')
			y[P] = {
				label: 'Structural variation',
				color: '#858585',
				dt: c,
				desc: 'Structural variation detected in genomic DNA.'
			}
			var S = (t.mclasscnvgain = 'CNV_amp')
			y[S] = { label: 'Copy number gain', color: '#e9a3c9', dt: f, desc: 'Copy number gain' }
			var A = (t.mclasscnvloss = 'CNV_loss')
			y[A] = { label: 'Copy number loss', color: '#a1d76a', dt: f, desc: 'Copy number loss' }
			var C = (t.mclasscnvloh = 'CNV_loh')
			y[C] = { label: 'LOH', color: '#12EDFC', dt: f, desc: 'Loss of heterozygosity' }
			var N = (t.mclasssnv = 'snv')
			y[N] = { label: 'SNV', color: '#5781FF', dt: u, desc: 'Single nucleotide variation' }
			var T = (t.mclassmnv = 'mnv')
			y[T] = { label: 'MNV', color: '#6378B8', dt: u, desc: 'Multiple nucleotide variation' }
			var E = (t.mclassinsertion = 'insertion')
			y[E] = { label: 'Sequence insertion', color: '#ED5C66', dt: u, desc: 'Sequence insertion' }
			var I = (t.mclassdeletion = 'deletion')
			y[I] = { label: 'Sequence deletion', color: '#F0B11F', dt: u, desc: 'Sequence deletion' }
			t.vepinfo = function(e) {
				var t = e.toLowerCase().split(','),
					n = 1
				return -1 != t.indexOf('transcript_ablation')
					? [p, b, n]
					: (n++,
					  -1 != t.indexOf('splice_acceptor_variant')
							? [u, 'L', n]
							: (n++,
							  -1 != t.indexOf('splice_donor_variant')
									? [u, 'L', n]
									: (n++,
									  -1 != t.indexOf('stop_gained')
											? [u, 'N', n]
											: (n++,
											  -1 != t.indexOf('frameshift_variant')
													? [u, 'F', n]
													: (n++,
													  -1 != t.indexOf('stop_lost')
															? [u, 'N', n]
															: (n++,
															  -1 != t.indexOf('start_lost')
																	? [u, 'N', n]
																	: (n++,
																	  -1 != t.indexOf('transcript_amplification')
																			? [u, k, n]
																			: (n++,
																			  -1 != t.indexOf('inframe_insertion') ||
																			  -1 != t.indexOf('conservative_inframe_insertion') ||
																			  -1 != t.indexOf('disruptive_inframe_insertion')
																					? [u, 'I', n]
																					: (n++,
																					  -1 != t.indexOf('inframe_deletion') ||
																					  -1 != t.indexOf('conservative_inframe_deletion') ||
																					  -1 != t.indexOf('disruptive_inframe_deletion')
																							? [u, 'D', n]
																							: (n++,
																							  -1 != t.indexOf('missense_variant')
																									? [u, 'M', n]
																									: (n++,
																									  -1 != t.indexOf('protein_altering_variant')
																											? [u, 'N', n]
																											: (n++,
																											  -1 != t.indexOf('splice_region_variant')
																													? [u, 'P', n]
																													: (n++,
																													  -1 != t.indexOf('incomplete_terminal_codon_variant')
																															? [u, 'N', n]
																															: (n++,
																															  -1 != t.indexOf('stop_retained_variant')
																																	? [u, 'S', n]
																																	: (n++,
																																	  -1 != t.indexOf('synonymous_variant')
																																			? [u, 'S', n]
																																			: (n++,
																																			  -1 != t.indexOf('coding_sequence_variant')
																																					? [u, k, n]
																																					: (n++,
																																					  -1 != t.indexOf('mature_mirna_variant')
																																							? [u, 'E', n]
																																							: (n++,
																																							  -1 != t.indexOf('5_prime_utr_variant')
																																									? [u, j, n]
																																									: (n++,
																																									  -1 !=
																																									  t.indexOf('3_prime_utr_variant')
																																											? [u, w, n]
																																											: (n++,
																																											  -1 !=
																																											  t.indexOf(
																																													'non_coding_transcript_exon_variant'
																																											  )
																																													? [u, 'E', n]
																																													: (n++,
																																													  -1 !=
																																													  t.indexOf('intron_variant')
																																															? [u, 'Intron', n]
																																															: (n++,
																																															  -1 !=
																																															  t.indexOf(
																																																	'nmd_transcript_variant'
																																															  )
																																																	? [u, 'S', n]
																																																	: (n++,
																																																	  -1 !=
																																																	  t.indexOf(
																																																			'non_coding_transcript_variant'
																																																	  )
																																																			? [u, 'E', n]
																																																			: (n++,
																																																			  -1 !=
																																																			  t.indexOf(
																																																					'upstream_gene_variant'
																																																			  )
																																																					? [u, O, n]
																																																					: (n++,
																																																					  -1 !=
																																																					  t.indexOf(
																																																							'downstream_gene_variant'
																																																					  )
																																																							? [
																																																									u,
																																																									O,
																																																									n
																																																							  ]
																																																							: (n++,
																																																							  -1 !=
																																																							  t.indexOf(
																																																									'tfbs_ablation'
																																																							  )
																																																									? [
																																																											u,
																																																											O,
																																																											n
																																																									  ]
																																																									: (n++,
																																																									  -1 !=
																																																									  t.indexOf(
																																																											'tfbs_amplification'
																																																									  )
																																																											? [
																																																													u,
																																																													O,
																																																													n
																																																											  ]
																																																											: (n++,
																																																											  -1 !=
																																																											  t.indexOf(
																																																													'tf_binding_site_variant'
																																																											  )
																																																													? [
																																																															u,
																																																															O,
																																																															n
																																																													  ]
																																																													: (n++,
																																																													  -1 !=
																																																													  t.indexOf(
																																																															'regulatory_region_ablation'
																																																													  )
																																																															? [
																																																																	u,
																																																																	O,
																																																																	n
																																																															  ]
																																																															: (n++,
																																																															  -1 !=
																																																															  t.indexOf(
																																																																	'regulatory_region_amplification'
																																																															  )
																																																																	? [
																																																																			u,
																																																																			O,
																																																																			n
																																																																	  ]
																																																																	: (n++,
																																																																	  -1 !=
																																																																	  t.indexOf(
																																																																			'feature_elongation'
																																																																	  )
																																																																			? [
																																																																					u,
																																																																					O,
																																																																					n
																																																																			  ]
																																																																			: (n++,
																																																																			  -1 !=
																																																																			  t.indexOf(
																																																																					'regulatory_region_variant'
																																																																			  )
																																																																					? [
																																																																							u,
																																																																							O,
																																																																							n
																																																																					  ]
																																																																					: (n++,
																																																																					  -1 !=
																																																																					  t.indexOf(
																																																																							'feature_truncation'
																																																																					  )
																																																																							? [
																																																																									u,
																																																																									O,
																																																																									n
																																																																							  ]
																																																																							: (n++,
																																																																							  -1 !=
																																																																							  t.indexOf(
																																																																									'intergenic_variant'
																																																																							  )
																																																																									? [
																																																																											u,
																																																																											O,
																																																																											n
																																																																									  ]
																																																																									: (n++,
																																																																									  [
																																																																											u,
																																																																											k,
																																																																											n
																																																																									  ])))))))))))))))))))))))))))))))))))
			}
			var R = (t.germlinelegend =
					'<circle cx="7" cy="12" r="7" fill="#b1b1b1"></circle><path d="M6.735557395310443e-16,-11A11,11 0 0,1 11,0L9,0A9,9 0 0,0 5.51091059616309e-16,-9Z" transform="translate(7,12)" fill="#858585" stroke="none"></path>'),
				L = (t.morigin = {})
			;(L[(t.moriginsomatic = 'S')] = {
				label: 'Somatic',
				desc: 'A variant found only in a tumor sample. The proportion is indicated by lack of any arc.',
				legend: '<circle cx="7" cy="12" r="7" fill="#b1b1b1"></circle>'
			}),
				(L[(t.morigingermline = 'G')] = {
					label: 'Germline',
					desc:
						'A constitutional variant found in a normal sample. The proportion is indicated by the span of the solid arc within the whole circle.',
					legend: R
				}),
				(L[(t.moriginrelapse = 'R')] = {
					label: 'Relapse',
					desc:
						'A somatic variant found only in a relapse sample. The proportion is indicated by the span of the hollow arc within the whole circle.',
					legend:
						'<circle cx="7" cy="12" r="7" fill="#b1b1b1"></circle><path d="M6.735557395310443e-16,-11A11,11 0 0,1 11,0L9,0A9,9 0 0,0 5.51091059616309e-16,-9Z" transform="translate(7,12)" fill="none" stroke="#858585"></path>'
				}),
				(L[(t.morigingermlinepathogenic = 'GP')] = {
					label: 'Germline pathogenic',
					desc: 'A constitutional variant with pathogenic allele.',
					legend: R
				}),
				(L[(t.morigingermlinenonpathogenic = 'GNP')] = {
					label: 'Germline non-pathogenic',
					desc: 'A constitutional variant with non-pathogenic allele.',
					legend: R,
					hidden: !0
				})
			var D = (t.tkt = {
				usegm: 'usegm',
				ds: 'dataset',
				bigwig: 'bigwig',
				bigwigstranded: 'bigwigstranded',
				junction: 'junction',
				mdsjunction: 'mdsjunction',
				mdscnv: 'mdscnv',
				mdssvcnv: 'mdssvcnv',
				mdsexpressionrank: 'mdsexpressionrank',
				mdsvcf: 'mdsvcf',
				bedj: 'bedj',
				pgv: 'profilegenevalue',
				bampile: 'bampile',
				hicstraw: 'hicstraw',
				expressionrank: 'expressionrank',
				aicheck: 'aicheck',
				ase: 'ase',
				mds2: 'mds2',
				mds3: 'mds3',
				bedgraphdot: 'bedgraphdot',
				bam: 'bam'
			})
			;(t.mdsvcftype = { vcf: 'vcf' }),
				(t.custommdstktype = { vcf: 'vcf', svcnvitd: 'svcnvitd', geneexpression: 'geneexpression' })
			var F = (t.codon = {
					GCT: 'A',
					GCC: 'A',
					GCA: 'A',
					GCG: 'A',
					CGT: 'R',
					CGC: 'R',
					CGA: 'R',
					CGG: 'R',
					AGA: 'R',
					AGG: 'R',
					AAT: 'N',
					AAC: 'N',
					GAT: 'D',
					GAC: 'D',
					TGT: 'C',
					TGC: 'C',
					CAA: 'Q',
					CAG: 'Q',
					GAA: 'E',
					GAG: 'E',
					GGT: 'G',
					GGC: 'G',
					GGA: 'G',
					GGG: 'G',
					CAT: 'H',
					CAC: 'H',
					ATT: 'I',
					ATC: 'I',
					ATA: 'I',
					TTA: 'L',
					TTG: 'L',
					CTT: 'L',
					CTC: 'L',
					CTA: 'L',
					CTG: 'L',
					AAA: 'K',
					AAG: 'K',
					ATG: 'M',
					TTT: 'F',
					TTC: 'F',
					CCT: 'P',
					CCC: 'P',
					CCA: 'P',
					CCG: 'P',
					TCT: 'S',
					TCC: 'S',
					TCA: 'S',
					TCG: 'S',
					AGT: 'S',
					AGC: 'S',
					ACT: 'T',
					ACC: 'T',
					ACA: 'T',
					ACG: 'T',
					TGG: 'W',
					TAT: 'Y',
					TAC: 'Y',
					GTT: 'V',
					GTC: 'V',
					GTA: 'V',
					GTG: 'V'
				}),
				q = (t.codon_stop = '*')
			function U(e) {
				if (e.genomicseq) {
					var t = []
					if (e.coding) {
						var n = !0,
							r = !1,
							a = void 0
						try {
							for (var o, i = e.coding[Symbol.iterator](); !(n = (o = i.next()).done); n = !0) {
								var l = o.value,
									u = e.genomicseq.substr(l[0] - e.start, l[1] - l[0])
								'-' == e.strand ? t.push(z(u)) : t.push(u)
							}
						} catch (e) {
							;(r = !0), (a = e)
						} finally {
							try {
								!n && i.return && i.return()
							} finally {
								if (r) throw a
							}
						}
					}
					for (var s = t.join(''), f = [], c = 0; c < s.length; c += 3) {
						var d = F[s.substr(c, 3)]
						f.push(d || q)
					}
					return (e.cdseq = s), f.join('')
				}
			}
			t.basecolor = { A: '#ca0020', T: '#f4a582', C: '#92c5de', G: '#0571b0' }
			function G(e) {
				switch (e) {
					case 'A':
						return 'T'
					case 'T':
						return 'A'
					case 'C':
						return 'G'
					case 'G':
						return 'C'
					case 'a':
						return 't'
					case 't':
						return 'a'
					case 'c':
						return 'g'
					case 'g':
						return 'c'
					default:
						return e
				}
			}
			function z(e) {
				for (var t = [], n = e.length - 1; n >= 0; n--) t.push(G(e[n]))
				return t.join('')
			}
			var B = (t.gmmode = {
				genomic: 'genomic',
				splicingrna: 'splicing RNA',
				exononly: 'exon only',
				protein: 'protein',
				gmsum: 'aggregated exons'
			})
			t.not_annotated = 'Unannotated'
		},
		function(e, t, n) {
			'use strict'
			var r,
				a,
				o = function(e, t) {
					if (Array.isArray(e)) return e
					if (Symbol.iterator in Object(e))
						return (function(e, t) {
							var n = [],
								r = !0,
								a = !1,
								o = void 0
							try {
								for (
									var i, l = e[Symbol.iterator]();
									!(r = (i = l.next()).done) && (n.push(i.value), !t || n.length !== t);
									r = !0
								);
							} catch (e) {
								;(a = !0), (o = e)
							} finally {
								try {
									!r && l.return && l.return()
								} finally {
									if (a) throw o
								}
							}
							return n
						})(e, t)
					throw new TypeError('Invalid attempt to destructure non-iterable instance')
				},
				i = (function() {
					function e(e, t) {
						for (var n = 0; n < t.length; n++) {
							var r = t[n]
							;(r.enumerable = r.enumerable || !1),
								(r.configurable = !0),
								'value' in r && (r.writable = !0),
								Object.defineProperty(e, r.key, r)
						}
					}
					return function(t, n, r) {
						return n && e(t.prototype, n), r && e(t, r), t
					}
				})(),
				l =
					'function' == typeof Symbol && 'symbol' == typeof Symbol.iterator
						? function(e) {
								return typeof e
						  }
						: function(e) {
								return e && 'function' == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype
									? 'symbol'
									: typeof e
						  }
			function u(e) {
				if (Array.isArray(e)) {
					for (var t = 0, n = Array(e.length); t < e.length; t++) n[t] = e[t]
					return n
				}
				return Array.from(e)
			}
			function s(e, t) {
				if (!(e instanceof t)) throw new TypeError('Cannot call a class as a function')
			}
			!(function(o, i) {
				'object' == l(t) && void 0 !== e
					? (e.exports = i())
					: void 0 === (a = 'function' == typeof (r = i) ? r.call(t, n, t, e) : r) || (e.exports = a)
			})(0, function() {
				var e = (function() {
					function e(t) {
						s(this, e),
							(this.Pj = t),
							(this.opts = ['@delimit', '@errmode']),
							(this.contexts = ['@branch', '@parent', '@root', '@self', '@values', '@key']),
							(this.filters = ['@split()', '@before()', '@join()', '@ignore()']),
							(this.post = ['@after()', '@dist()', '@end()']),
							(this.terms = [].concat(u(this.opts), u(this.contexts), u(this.filters), u(this.post)))
					}
					return (
						i(e, [
							{
								key: 'setFxn',
								value: function(e, t, n, r) {
									this[e] ? (n[e] = this[e](r, t, n)) : t.errors.push(['key', 'UNRECOGNIZED-RESERVED-' + e])
								}
							},
							{
								key: 'trueFxn',
								value: function() {
									return !0
								}
							},
							{
								key: 'notDefined',
								value: function(e) {
									return void 0 === e
								}
							}
						]),
						e
					)
				})()
				;(e.prototype['@split'] = function(e) {
					var t = e.slice(1, -2),
						n = this.Pj.opts['='][t]
					if (!n) throw 'missing @split() function ' + t
					this.Pj.split = n
				}),
					(e.prototype['@before'] = function(e, t) {
						var n = e.slice(1, -2)
						return this.Pj.opts['='][n] || (t.errors.push(['val', 'MISSING-' + t.term + '-FXN', n]), this.trueFxn)
					}),
					(e.prototype['@after'] = e.prototype['@before']),
					(e.prototype['@done'] = e.prototype['@before']),
					(e.prototype['@join'] = function(e, t, n) {
						var r = this
						return function(n, a) {
							var o = !0
							for (var i in e) {
								var l = e[i].slice(1, -2),
									u = r.Pj.opts['='][l]
								if (u) {
									var s = u(n, a, i)
									s ? r.Pj.joins.set(i, s) : (o = !1)
								} else t.errors.push(['val', 'MISSING-@join-FXN', l])
							}
							return o
						}
					}),
					(e.prototype['@dist'] = function(e, t) {
						var n = Array.isArray(e) ? e : [e],
							r = {},
							a = !0,
							o = !1,
							i = void 0
						try {
							for (var l, u = n[Symbol.iterator](); !(a = (l = u.next()).done); a = !0) {
								var s = l.value
								r[s] = this.Pj.converter.subs['@'](this.Pj, s)
							}
						} catch (e) {
							;(o = !0), (i = e)
						} finally {
							try {
								!a && u.return && u.return()
							} finally {
								if (o) throw i
							}
						}
						return function(e) {
							e['@dist'] = function(n) {
								for (var a in r) {
									var o = (0, r[a])(null, e)
									o
										? Array.isArray(o)
											? o.includes(n) || o.push(n)
											: e.errors.push([t, 'NON-ARRAY-DIST-TARGET', a])
										: e.errors.push([t, 'MISSING-DIST-TARGET', a])
								}
							}
						}
					}),
					(e.prototype['@ignore'] = function(e, t, n) {
						var r = this
						if (!e['@ignore()']) return t
						var a = Array.isArray(e['@ignore()']) || 'string' == typeof e['@ignore()'] || 'object' != l(e['@ignore()']),
							o = a ? { '@': e['@ignore()'] } : e['@ignore()'],
							i = {},
							u = function(e) {
								var t = o[e]
								if (Array.isArray(t))
									i[e] = function(e) {
										return t.includes(e)
									}
								else if ('string' == typeof t && '=' == t[0]) {
									var a = r.Pj.opts['='][t.slice(1, -2)]
									a ? (i[e] = a) : (n.errors.push(['val', 'MISSING-@ignore()-FXN', t]), (i[e] = r.notDefined))
								} else n.errors.push(['val', 'UNSUPPORTED-@ignore()-VALUE', t]), (i[e] = r.notDefined)
							}
						for (var s in o) u(s)
						return a ? i : Object.assign({}, t, i)
					})
				var t = (function() {
					function e(t) {
						s(this, e), (this.Pj = t), (this.allowedKeyTypes = new Set(['string', 'number']))
					}
					return (
						i(e, [
							{
								key: 'getFxn',
								value: function(e, t) {
									var n = this.Pj.converter.default(this.Pj, e, t, e.term),
										r = o(n, 2),
										a = r[0],
										i = r[1]
									if (a) return this[i.conv](a, e)
								}
							},
							{
								key: 'getAllowedKeys',
								value: function(e, t, n, r) {
									if (!Array.isArray(e)) return r.errors.push(['key', 'NON-ARRAY-KEYS', t]), []
									var a = [],
										o = !0,
										i = !1,
										u = void 0
									try {
										for (var s, f = e[Symbol.iterator](); !(o = (s = f.next()).done); o = !0) {
											var c = s.value
											n.ignore(c) ||
												(this.allowedKeyTypes.has(void 0 === c ? 'undefined' : l(c))
													? a.push(c)
													: r.errors.push([n, 'INVALID-RESULT-KEY', t]))
										}
									} catch (e) {
										;(i = !0), (u = e)
									} finally {
										try {
											!o && f.return && f.return()
										} finally {
											if (i) throw u
										}
									}
									return a
								}
							}
						]),
						e
					)
				})()
				;(t.prototype[''] = function(e, t) {
					var n = this
					return function(r, a) {
						return n.getAllowedKeys([e(r, a)], r, t, a)
					}
				}),
					(t.prototype['()'] = t.prototype['']),
					(t.prototype['[]'] = function(e, t) {
						var n = this
						return function(r, a) {
							return n.getAllowedKeys(e(r, a), r, t, a)
						}
					}),
					(t.prototype['(]'] = t.prototype['[]'])
				var n = (function() {
					function e(t) {
						s(this, e), (this.Pj = t)
					}
					return (
						i(e, [
							{
								key: 'getFxn',
								value: function(e, t) {
									return this[this.getValType(e.templateVal) + 'Filler'](e, t, e.templateVal)
								}
							},
							{
								key: 'getValType',
								value: function(e) {
									return 'string' == typeof e
										? 'str'
										: Array.isArray(e)
										? 'arr'
										: e && 'object' == (void 0 === e ? 'undefined' : l(e))
										? 'obj'
										: 'default'
								}
							},
							{
								key: 'strFiller',
								value: function(e, t, n, r) {
									var a = this.Pj.converter.default(this.Pj, e, t, n),
										i = o(a, 2),
										l = i[0],
										u = i[1]
									if (l) {
										var s = (r || u.aggr) + ',' + u.conv
										return s in this ? this[s](l, e) : void 0
									}
								}
							},
							{
								key: 'arrFiller',
								value: function(e, t, n) {
									var r = this.getValType(n[0])
									return 'str' == r
										? this.strFiller(e, t, n[0], '[]')
										: 'arr' == r
										? this['[[,]]'](n[0], e)
										: 'obj' == r
										? this['[{}]'](n[0], e)
										: this.defaultFiller(e, t, n)
								}
							},
							{
								key: 'objFiller',
								value: function(e, t, n) {
									var r = this
									return (
										this.Pj.parseTemplate(n, e.inheritedIgnore, e.lineage),
										function(e, t, a) {
											r.Pj.setResultContext('{}', t, a), r.Pj.processRow(e, n, a[t])
										}
									)
								}
							},
							{
								key: 'defaultFiller',
								value: function(e, t, n) {
									var r = JSON.stringify(n)
									return function(e, t, n) {
										n[t] = JSON.parse(r)
									}
								}
							},
							{
								key: 'getArrSeed',
								value: function(e) {
									var t = e.templateVal && e.templateVal.length > 1 ? e.templateVal[1] : 1
									if ('set' == t)
										return function(e, t, n) {
											t in e ? Array.isArray(e[t]) && (e[t] = new Set(e[t])) : (e[t] = new Set()), e[t].add(n)
										}
									if (0 == t)
										return function(e, t, n) {
											t in e || (e[t] = []), e[t].push(n)
										}
									if (this.isNumeric(t)) {
										var n = new Map()
										return function(e, r, a) {
											r in e || (e[r] = []), n.has(e[r]) || n.set(e[r], new Map())
											var o = n.get(e[r])
											o.has(a) || o.set(a, 0)
											var i = o.get(a)
											i < t && (e[r].push(a), o.set(a, i + 1))
										}
									}
								}
							},
							{
								key: 'isNumeric',
								value: function(e) {
									return !isNaN(parseFloat(e)) && isFinite(e) && '' !== e
								}
							}
						]),
						e
					)
				})()
				;(n.prototype[','] = function(e, t) {
					return function(n, r, a, o) {
						var i = e(n, o)
						t.ignore(i, r, n) || (a[r] = i)
					}
				}),
					(n.prototype[',()'] = n.prototype[',']),
					(n.prototype[',[]'] = n.prototype[',']),
					(n.prototype[',(]'] = n.prototype[',']),
					(n.prototype['[],'] = function(e, t) {
						var n = this.getArrSeed(t)
						if (n)
							return function(r, a, o, i) {
								var l = e(r, i)
								t.ignore(l, a, r, i) || n(o, a, l)
							}
						t.errors.push(['val', 'INVALID-[]-OPTION'])
					}),
					(n.prototype['[],()'] = n.prototype['[],']),
					(n.prototype['[],[]'] = function(e, t) {
						var n = this.getArrSeed(t)
						return function(r, a, o, i) {
							var l = e(r, i)
							if (Array.isArray(l)) {
								var u = !0,
									s = !1,
									f = void 0
								try {
									for (var c, d = l[Symbol.iterator](); !(u = (c = d.next()).done); u = !0) {
										var p = c.value
										t.ignore(p, a, r, i) || n(o, a, p)
									}
								} catch (e) {
									;(s = !0), (f = e)
								} finally {
									try {
										!u && d.return && d.return()
									} finally {
										if (s) throw f
									}
								}
							} else i.errors.push([t, 'NON-ARRAY-VALS', r])
						}
					}),
					(n.prototype['[],(]'] = n.prototype['[],[]']),
					(n.prototype['[{}]'] = function(e, t) {
						var n = this
						this.Pj.parseTemplate(e, t.inheritedIgnore, t.lineage)
						var r = t.templateVal && t.templateVal.length > 1 ? t.templateVal[1] : ''
						if (!r)
							return function(t, r, a) {
								n.Pj.setResultContext('[]', r, a)
								var o = n.Pj.setResultContext('{}', a[r].length, a[r])
								n.Pj.processRow(t, e, o)
							}
						if ('string' == typeof r) {
							var a = this.Pj.converter.default(this.Pj, Object.assign({}, { templateVal: r }), t.inheritedIgnore, r),
								i = o(a, 2),
								l = i[0],
								u = i[1]
							return u.aggr || u.skip || u.timing
								? void t.errors.push(['val', 'INVALID-[{}]-OPTION-TOKEN'])
								: function(a, o, i, u) {
										var s = n.Pj.setResultContext('[]', o, i, !0),
											f = n.Pj.contexts.get(s).tracker,
											c = l(a, u),
											d = ']' == r.slice(-1) ? c : [c]
										if (Array.isArray(d)) {
											var p = !0,
												h = !1,
												v = void 0
											try {
												for (var m, y = d[Symbol.iterator](); !(p = (m = y.next()).done); p = !0) {
													var g = m.value
													if (f.has(g)) n.Pj.processRow(a, e, f.get(g))
													else {
														var b = n.Pj.setResultContext('{}', s.length, s, !1, g, a, e)
														b && (f.set(g, b), n.Pj.processRow(a, e, b))
													}
												}
											} catch (e) {
												;(h = !0), (v = e)
											} finally {
												try {
													!p && y.return && y.return()
												} finally {
													if (h) throw v
												}
											}
										} else u.errors.push([t, 'NON-ARRAY-VALS', a])
								  }
						}
						t.errors.push(['val', 'INVALID-[{}]-OPTION'])
					}),
					(n.prototype['[[,]]'] = function(e, t) {
						var n = [],
							r = !0,
							a = !1,
							o = void 0
						try {
							for (var i, l = e[Symbol.iterator](); !(r = (i = l.next()).done); r = !0) {
								var u = i.value,
									s = Object.assign({}, t, { templateVal: u })
								n.push(this.getFxn(s, t.inheritedIgnore))
							}
						} catch (e) {
							;(a = !0), (o = e)
						} finally {
							try {
								!r && l.return && l.return()
							} finally {
								if (a) throw o
							}
						}
						return 'map' != (t.templateVal[1] ? t.templateVal[1] : '')
							? function(e, t, r) {
									t in r || (r[t] = [])
									var a = []
									for (var o in n) n[+o](e, +o, a)
									r[t].push(a)
							  }
							: function(e, t, r) {
									t in r ? r[t] instanceof Map || (r[t] = new Map(r[t])) : (r[t] = new Map())
									var a = []
									n[0](e, 0, a), r[t].has(a[0]) && (a[1] = r[t].get(a[0])), n[1](e, 1, a), r[t].set(a[0], a[1])
							  }
					}),
					(n.prototype['+,'] = function(e, t) {
						var n = this
						return function(r, a, o, i) {
							a in o || (o[a] = 0)
							var l = e(r, i)
							t.ignore(l, a, r, i) || (n.isNumeric(l) ? (o[a] += +l) : i.errors.push([t, 'NON-NUMERIC-INCREMENT', r]))
						}
					}),
					(n.prototype['+,()'] = n.prototype['+,']),
					(n.prototype['+,[]'] = function(e, t) {
						var n = this
						return function(r, a, o, i) {
							a in o || (o[a] = 0)
							var l = e(r, i)
							if (Array.isArray(l)) {
								var u = !0,
									s = !1,
									f = void 0
								try {
									for (var c, d = l[Symbol.iterator](); !(u = (c = d.next()).done); u = !0) {
										var p = c.value
										t.ignore(p, a, r, i) ||
											(n.isNumeric(p) ? (o[a] += +p) : i.errors.push([t, 'NON-NUMERIC-INCREMENT', r]))
									}
								} catch (e) {
									;(s = !0), (f = e)
								} finally {
									try {
										!u && d.return && d.return()
									} finally {
										if (s) throw f
									}
								}
							} else t.errors.push(['val', 'NON-ARRAY-VALS', r])
						}
					}),
					(n.prototype['+,(]'] = n.prototype['+,[]']),
					(n.prototype['-,'] = function(e, t) {
						var n = this
						return function(r, a, o, i) {
							a in o || (o[a] = 0)
							var l = e(r, i)
							t.ignore(l, a, r, i) || (n.isNumeric(l) ? (o[a] += -l) : i.errors.push([t, 'NON-NUMERIC-DECREMENT', r]))
						}
					}),
					(n.prototype['-,()'] = n.prototype['-,']),
					(n.prototype['-,[]'] = function(e, t) {
						return function(n, r, a, o) {
							var i = e(n, o)
							if (Array.isArray(i)) {
								r in a || (a[r] = 0)
								var l = !0,
									u = !1,
									s = void 0
								try {
									for (var f, c = i[Symbol.iterator](); !(l = (f = c.next()).done); l = !0) {
										var d = f.value
										t.ignore(d, r, n, o) || (a[r] += -d)
									}
								} catch (e) {
									;(u = !0), (s = e)
								} finally {
									try {
										!l && c.return && c.return()
									} finally {
										if (u) throw s
									}
								}
							} else t.errors.push(['val', 'NON-ARRAY-VALS', n])
						}
					}),
					(n.prototype['-,(]'] = n.prototype['-,[]']),
					(n.prototype['<,'] = function(e, t) {
						var n = this
						return function(r, a, o, i) {
							var l = e(r, i)
							if (!t.ignore(l, a, r, i)) {
								var u = +l
								n.isNumeric(u)
									? a in o
										? o[a] < u && (o[a] = u)
										: (o[a] = u)
									: i.errors.push([t, 'NON-NUMERIC-THAN', r])
							}
						}
					}),
					(n.prototype['<,()'] = n.prototype['<,']),
					(n.prototype['<,[]'] = function(e, t) {
						var n = this
						return function(r, a, o, i) {
							var l = e(r, i)
							if (Array.isArray(l)) {
								var u = !0,
									s = !1,
									f = void 0
								try {
									for (var c, d = l[Symbol.iterator](); !(u = (c = d.next()).done); u = !0) {
										var p = c.value
										if (t.ignore(p, a, r, i)) return
										if (!n.isNumeric(p)) return void i.errors.push([t, 'NON-NUMERIC-THAN', r])
										var h = +p
										a in o ? o[a] < h && (o[a] = h) : (o[a] = h)
									}
								} catch (e) {
									;(s = !0), (f = e)
								} finally {
									try {
										!u && d.return && d.return()
									} finally {
										if (s) throw f
									}
								}
							} else t.errors.push(['val', 'NON-ARRAY-VALS', r])
						}
					}),
					(n.prototype['<,(]'] = n.prototype['<,[]']),
					(n.prototype['>,'] = function(e, t) {
						var n = this
						return function(r, a, o, i) {
							var l = +e(r, i)
							t.ignore(l, a, r, i) ||
								(n.isNumeric(l)
									? a in o
										? o[a] > l && (o[a] = l)
										: (o[a] = l)
									: i.errors.push([t, 'NON-NUMERIC-THAN', r]))
						}
					}),
					(n.prototype['>,()'] = n.prototype['>,']),
					(n.prototype['>,[]'] = function(e, t) {
						var n = this
						return function(r, a, o, i) {
							var l = e(r, i)
							if (Array.isArray(l)) {
								var u = !0,
									s = !1,
									f = void 0
								try {
									for (var c, d = l[Symbol.iterator](); !(u = (c = d.next()).done); u = !0) {
										var p = c.value
										if (t.ignore(p, a, r, i)) return
										if (!n.isNumeric(p)) return void i.errors.push([t, 'NON-NUMERIC-THAN', r])
										var h = +p
										a in o ? o[a] > h && (o[a] = h) : (o[a] = h)
									}
								} catch (e) {
									;(s = !0), (f = e)
								} finally {
									try {
										!u && d.return && d.return()
									} finally {
										if (s) throw f
									}
								}
							} else t.errors.push(['val', 'NON-ARRAY-VALS', r])
						}
					}),
					(n.prototype['>,(]'] = n.prototype['>,[]'])
				var r = (function() {
					function e(t) {
						s(this, e),
							(this.Pj = t),
							(this.allErrSet = new Set()),
							(this.allErrObj = Object.create(null)),
							(this.mode = { input: '{}', result: '{}-', root: '', console: '{}' }),
							(this.modeKeys = ['input', 'result', 'root', 'console']),
							this.setMode()
					}
					return (
						i(e, [
							{
								key: 'setMode',
								value: function() {
									var e = this,
										t = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {}
									Array.isArray(t)
										? this.modeKeys.forEach(function(n, r) {
												return (e.mode[n] = t[r])
										  })
										: 'object' == (void 0 === t ? 'undefined' : l(t)) &&
										  this.modeKeys.forEach(function(n) {
												n in t && (e.mode[n] = t[n])
										  })
								}
							},
							{
								key: 'clear',
								value: function() {
									var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {}
									this.allErrSet.clear(), (this.allErrObj = Object.create(null)), this.setMode(e)
								}
							},
							{
								key: 'markErrors',
								value: function(e, t) {
									if (t) {
										var n = '[]' == this.mode.result.slice(0, 2) ? [] : {}
										for (var r in t.filler.inputs) {
											var a = t.filler.inputs[r],
												i = !0,
												l = !1,
												s = void 0
											try {
												for (var f, c = a.errors[Symbol.iterator](); !(i = (f = c.next()).done); i = !0) {
													var d = f.value,
														p = o(d, 3),
														h = p[0],
														v = p[1]
													p[2]
													'key' == h
														? (this.track(n, d, a.lineage.join(this.Pj.delimit)),
														  this.mode.input && (e['{{ ' + v + ' }} ' + a.term] = a.templateVal))
														: 'val' == h &&
														  (Array.isArray(a.templateVal)
																? (this.track(n, d, a.templateVal[0]),
																  this.mode.input && (e[a.term] = ['{{ ' + v + ' }} '].concat(u(a.templateVal))))
																: 'string' == typeof a.templateVal
																? (this.track(n, d, a.templateVal),
																  this.mode.input && (e[a.term] = '{{ ' + v + ' }} ' + a.templateVal))
																: (this.track(n, d, a.templateVal),
																  this.mode.input && (e[a.term] = '{{ ' + v + ' }} ')))
												}
											} catch (e) {
												;(l = !0), (s = e)
											} finally {
												try {
													!i && c.return && c.return()
												} finally {
													if (l) throw s
												}
											}
										}
										if (t.errors.length) {
											var m = {}
											e['@errors'] = m
											var y = !0,
												g = !1,
												b = void 0
											try {
												for (var _, x = t.errors[Symbol.iterator](); !(y = (_ = x.next()).done); y = !0) {
													var w = _.value,
														j = o(w, 3),
														k = j[0],
														O = j[1]
													j[2]
													if ((this.track(n, w, k.term), this.mode.input)) {
														var M = '{{ ' + O + ' }} ' + k.term
														M in m || (m[M] = 0), (m[M] += 1)
													}
												}
											} catch (e) {
												;(g = !0), (b = e)
											} finally {
												try {
													!y && x.return && x.return()
												} finally {
													if (g) throw b
												}
											}
										}
										if (t.filler.errors.length) {
											var P = !0,
												S = !1,
												A = void 0
											try {
												for (var C, N = t.filler.errors[Symbol.iterator](); !(P = (C = N.next()).done); P = !0) {
													var T = C.value
													this.track(n, T, T[2], !1)
												}
											} catch (e) {
												;(S = !0), (A = e)
											} finally {
												try {
													!P && N.return && N.return()
												} finally {
													if (S) throw A
												}
											}
										}
										Object.keys(n).length && this.mode.result && (e['@errors'] = n)
									}
								}
							},
							{
								key: 'track',
								value: function(e, t, n) {
									var r = !(arguments.length > 3 && void 0 !== arguments[3]) || arguments[3]
									this.allErrSet.add(t),
										this.trackAsObj(this.allErrObj, t, n),
										(r && '-' == this.mode.result.slice(-1)) ||
											(Array.isArray(e) ? e.push(t) : this.trackAsObj(e, t, n))
								}
							},
							{
								key: 'trackAsObj',
								value: function(e, t, n) {
									var r = o(t, 3),
										a = (r[0], r[1]),
										i = r[2]
									a in e || (e[a] = Object.create(null)),
										n in e[a] || (e[a][n] = i ? [] : 0),
										i ? e[a][n].includes(i) || e[a][n].push(i) : (e[a][n] += 1)
								}
							},
							{
								key: 'log',
								value: function() {
									var e = [].concat(u(this.allErrSet))
									if (e.length) {
										if (this.mode.root) {
											var t = this.mode.root
											this.Pj.tree['@errorsAll'] = '[]' == t ? e : this.allErrObj
										}
										if (this.mode.console) {
											var n = this.mode.console.slice(0, 2)
											console.log('[]' == n ? e : this.allErrObj)
										}
									}
								}
							}
						]),
						e
					)
				})()
				function a(e, t) {
					var n = e.skipSymbols.includes(t[0]) ? t[0] : '',
						r = t.slice(n.length, n.length + 3),
						a = e.timeSymbols.includes(r) ? r : '',
						o = n.length + a.length,
						i = t[o],
						l = t.slice(-2),
						u = e.aggrSymbols.includes(i) && i != t ? i : '',
						s = e.convSymbols.includes(l) && l != t ? l : '',
						f = u && s ? t.slice(o + 1, -2) : u ? t.slice(o + 1) : s ? t.slice(o, -2) : n || a ? t.slice(o) : t,
						c = e.subsSymbols.includes(f[0]) ? f[0] : '',
						d = u + c + s,
						p = c ? f.slice(1) : f
					return [f, d, { skip: n, time: a, aggr: u, subs: c, stem: p, conv: s, subterm: f }, e.steps.indexOf(a)]
				}
				var f = {
						'#': function(e, t, n) {
							e.commentedTerms.has(n) || e.commentedTerms.set(n, []), e.commentedTerms.get(n).push(t)
						},
						'*': function(e, t, n) {
							e.focusTemplate[n.term.slice(1)] = n.templateVal
						},
						'': function(e, t, n) {
							return e.valFiller.isNumeric(t)
								? function() {
										return +t
								  }
								: function() {
										return t
								  }
						},
						$: function(e, t, n) {
							if ('$' == t || t == '$' + e.delimit)
								return function(e) {
									return e
								}
							if (t.includes(e.delimit)) {
								var r = t.slice(1).split(e.delimit)
								'' == r[0] && r.shift()
								var a = function(e, t) {
									return e ? e[t] : void 0
								}
								return function(e) {
									return r.reduce(a, e)
								}
							}
							var o = t.slice(1)
							return function(e) {
								return e[o]
							}
						},
						'=': function(e, t, n) {
							var r = t
								.slice(1)
								.split(e.delimit)
								.reduce(function(e, t) {
									return e && t in e ? e[t] : void 0
								}, e.opts['='])
							if (r)
								return function(e) {
									return r
								}
							n.errors.push(['val', 'MISSING-EXTERNAL-SUBS'])
						},
						'@': function(e, t, n) {
							if (!e.reserved.opts.includes(t)) {
								if ('@' == t || t == '@' + e.delimit)
									return function(e, t) {
										return t.self
									}
								if (t.includes(e.delimit)) {
									var r = t.split(e.delimit),
										a = function(r, a) {
											if ('@' == a[0] && a.length > 1 && !e.reserved.contexts.includes(a))
												return (
													n.errors.push(['val', 'UNRECOGNIZED-CONTEXT-' + t, n.lineage.join('.') + '.' + a]),
													[null, null]
												)
											var i = o(r, 2),
												l = i[0],
												u = i[1]
											return l && a
												? '@' == a
													? [u.self, u]
													: '@values' == a
													? [Object.values(l), u]
													: '@' == a[0]
													? [u[a.slice(1)], e.contexts.get(u[a.slice(1)])]
													: [l[a], e.contexts.get(l[a])]
												: [null, null]
										}
									return function(e, t) {
										return r.reduce(a, [t.self, t])[0]
									}
								}
								if (e.reserved.contexts.includes(t)) {
									var i = t.slice(1)
									return function(e, t) {
										return t[i]
									}
								}
								n.errors.push(['val', 'UNRECOGNIZED-CONTEXT-' + t])
							}
						},
						'&': function(e, t, n) {
							var r = t.slice(1).split(e.delimit),
								a = r.shift()
							if (r.length) {
								if (1 == r.length) {
									var o = r[0]
									return function() {
										var t = e.joins.get(a)
										return t ? t[o] : null
									}
								}
								var i = function(e, t) {
									return e ? e[t] : null
								}
								return (
									e.joins.get(a),
									function(t) {
										return r.reduce(i, e.joins.get(a))
									}
								)
							}
							return function() {
								return e.joins.get(a)
							}
						}
					},
					c = {
						'': function(e, t, n) {
							return e
						},
						'()': function(e, t, n) {
							if ('=' == n.subs) {
								var r = e()
								return 'function' != typeof r
									? void t.errors.push(['val', 'NOT-A-FUNCTION', n.subs + n.term + n.conv])
									: r
							}
							return function(n, r) {
								var a = e(n, r)
								if ('function' == typeof a) return a(n, r)
								t.errors.push(['val', 'NOT-A-FUNCTION', n])
							}
						}
					}
				;(c['[]'] = c['']), (c['(]'] = c['()'])
				var d = Object.freeze({
						__proto__: null,
						default: function(e, t, n, r) {
							var i = a(e, r),
								l = o(i, 3),
								u = l[0],
								s = (l[1], l[2])
							if (e.reserved.opts.includes(u)) return []
							var d = u + s.conv
							if (((t.ignore = d in n ? n[d] : n['@']), s.skip && '~' != s.skip)) return f[s.skip](e, u, t), []
							if (s.subs in f) {
								var p = f[s.subs](e, u, t)
								return p ? [c[s.conv](p, t, s), s] : []
							}
							return t.errors.push(['val', 'UNSUPPORTED-SYMBOL-' + s.subs]), []
						},
						parseTerm: a,
						subs: f,
						conv: c
					}),
					p = (function() {
						function f() {
							var a = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {}
							s(this, f),
								(this.defaultOpts = { template: {}, seed: '{}', '=': {} }),
								(this.opts = Object.assign(this.defaultOpts, a)),
								(this.delimit = '.'),
								(this.subsSymbols = ['$', '=', '@', '&']),
								(this.convSymbols = ['()', '[]', '(]']),
								(this.aggrSymbols = ['+', '-', '<', '>']),
								(this.timePost = ['_0:', '_1:', '_2:', '_3:', '_4:', '_5:', '_6:', '_7:', '_8:', '_9:']),
								(this.timeSymbols = [':__', '_:_', '__:'].concat(u(this.timePost))),
								(this.skipSymbols = ['#', '*', '~']),
								(this.steps = [':__', '', '_:_']),
								(this.errors = new r(this)),
								(this.reserved = new e(this)),
								(this.keyFiller = new t(this)),
								(this.valFiller = new n(this)),
								(this.commentedTerms = new Map()),
								(this.joins = new Map()),
								(this.fillers = new Map()),
								(this.contexts = new Map()),
								(this.temps = new Map()),
								this.refresh()
						}
						return (
							i(f, [
								{
									key: 'refresh',
									value: function() {
										var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {}
										;(this.times = { start: +new Date() }),
											Object.assign(this.opts, e),
											'string' != typeof this.opts.template && (this.opts.template = JSON.stringify(this.opts.template))
										var t = JSON.parse(this.opts.template)
										this.errors.clear(t['@errmode']),
											t['@delimit'] && (this.delimit = t['@delimit']),
											this.commentedTerms.clear(),
											this.joins.clear(),
											this.fillers.clear(),
											this.contexts.clear(),
											this.temps.clear(),
											delete this.tree,
											(this.tree = this.setResultContext(this.opts.seed)),
											(this.focusTemplate = Object.create(null)),
											this.parseTemplate(t, { '@': this.reserved.notDefined }),
											(this.times.parse = +new Date() - this.times.start),
											Object.keys(this.focusTemplate).length
												? (this.parseTemplate(this.focusTemplate, { '@': this.reserved.notDefined }),
												  (this.template = this.focusTemplate))
												: (this.template = t),
											(this.postLoopTerms = Object.create(null)),
											(this.done = []),
											this.opts.data && this.add(this.opts.data, !1),
											this.errors.log(this.fillers)
									}
								},
								{
									key: 'setResultContext',
									value: function(e) {
										var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null,
											n = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : null,
											r = arguments.length > 3 && void 0 !== arguments[3] && arguments[3],
											a = arguments[4],
											o = arguments.length > 5 && void 0 !== arguments[5] ? arguments[5] : null,
											i = arguments.length > 6 && void 0 !== arguments[6] ? arguments[6] : null,
											l = null !== t && t in n ? n[t] : JSON.parse(e)
										if (this.contexts.has(l)) return l
										var u = {
											branch: t,
											parent: n,
											context: this.contexts.get(n),
											self: l,
											root: this.tree ? this.tree : l,
											joins: this.joins,
											errors: [],
											key: a
										}
										if ((r && (u.tracker = new Map()), o && i)) {
											var s = this.fillers.get(i)
											if (!s['@before'](o, u)) return
											if (s['@join'] && !s['@join'](o, u)) return
										}
										return this.contexts.set(l, u), null !== t && (n[t] = l), l
									}
								},
								{
									key: 'parseTemplate',
									value: function(e, t) {
										var n = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : [],
											r = Object.create(null)
										;(r.inputs = Object.create(null)),
											(r['@before'] = this.reserved.trueFxn),
											(r['@after'] = this.reserved.trueFxn),
											(r.postTerms = {}),
											(r.errors = [])
										var i = this.reserved['@ignore'](e, t, r)
										;(r['@ignore'] = i), this.fillers.set(e, r)
										var l = this.steps.map(function(e) {
											return []
										})
										for (var s in e) {
											var f = a(this, s),
												c = o(f, 4),
												d = c[0],
												p = c[1],
												h = c[2],
												v = c[3],
												m = e[s],
												y = (r.inputs[s] = {
													term: s,
													subterm: d,
													symbols: p,
													keyTokens: h,
													templateVal: m,
													lineage: [].concat(u(n), [s]),
													inheritedIgnore: i,
													errors: []
												})
											'@()' == p
												? this.reserved.setFxn(d, y, r, m)
												: ((y.keyFxn = this.keyFiller.getFxn(y, i)),
												  y.keyFxn &&
														((y.valFxn = this.valFiller.getFxn(y, i)),
														'__:' == h.time || this.timePost.includes(h.time)
															? (r.postTerms[h.time] || (r.postTerms[h.time] = []),
															  r.postTerms[h.time].includes(s) || r.postTerms[h.time].push(s))
															: l[v].push(s)))
										}
										r.steps = l.filter(function(e) {
											return e.length
										})
									}
								},
								{
									key: 'add',
									value: function(e) {
										var t = !(arguments.length > 1 && void 0 !== arguments[1]) || arguments[1]
										this.times.start || (this.times.start = +new Date()), t && this.errors.clear(), this.joins.clear()
										var n = !0,
											r = !1,
											a = void 0
										try {
											for (var i, l = e[Symbol.iterator](); !(n = (i = l.next()).done); n = !0) {
												var u = i.value
												if (this.split) {
													var s = !0,
														f = !1,
														c = void 0
													try {
														for (var d, p = this.split(u)[Symbol.iterator](); !(s = (d = p.next()).done); s = !0) {
															var h = d.value
															this.processRow(h, this.template, this.tree), this.joins.clear()
														}
													} catch (e) {
														;(f = !0), (c = e)
													} finally {
														try {
															!s && p.return && p.return()
														} finally {
															if (f) throw c
														}
													}
												} else this.processRow(u, this.template, this.tree), this.joins.clear()
											}
										} catch (e) {
											;(r = !0), (a = e)
										} finally {
											try {
												!n && l.return && l.return()
											} finally {
												if (r) throw a
											}
										}
										this.processResult(this.tree)
										var v = !0,
											m = !1,
											y = void 0
										try {
											for (var g, b = this.timePost[Symbol.iterator](); !(v = (g = b.next()).done); v = !0) {
												var _ = g.value
												if (this.postLoopTerms[_]) {
													var x = !0,
														w = !1,
														j = void 0
													try {
														for (
															var k, O = this.postLoopTerms[_][Symbol.iterator]();
															!(x = (k = O.next()).done);
															x = !0
														) {
															var M = k.value
															this.postLoop(M.self, M, _)
														}
													} catch (e) {
														;(w = !0), (j = e)
													} finally {
														try {
															!x && O.return && O.return()
														} finally {
															if (w) throw j
														}
													}
												}
											}
										} catch (e) {
											;(m = !0), (y = e)
										} finally {
											try {
												!v && b.return && b.return()
											} finally {
												if (m) throw y
											}
										}
										var P = !0,
											S = !1,
											A = void 0
										try {
											for (var C, N = this.done[Symbol.iterator](); !(P = (C = N.next()).done); P = !0) {
												var T = C.value
												T.done(T.self, T)
											}
										} catch (e) {
											;(S = !0), (A = e)
										} finally {
											try {
												!P && N.return && N.return()
											} finally {
												if (S) throw A
											}
										}
										var E = !0,
											I = !1,
											R = void 0
										try {
											for (var L, D = this.temps[Symbol.iterator](); !(E = (L = D.next()).done); E = !0) {
												var F = o(L.value, 2),
													q = F[0],
													U = F[1],
													G = !0,
													z = !1,
													B = void 0
												try {
													for (var Y, V = U[Symbol.iterator](); !(G = (Y = V.next()).done); G = !0) {
														var H = Y.value
														delete q[H]
													}
												} catch (e) {
													;(z = !0), (B = e)
												} finally {
													try {
														!G && V.return && V.return()
													} finally {
														if (z) throw B
													}
												}
											}
										} catch (e) {
											;(I = !0), (R = e)
										} finally {
											try {
												!E && D.return && D.return()
											} finally {
												if (I) throw R
											}
										}
										;(this.times.total = +new Date() - this.times.start),
											delete this.times.start,
											t && this.errors.log()
									}
								},
								{
									key: 'processRow',
									value: function(e, t, n) {
										var r = this.contexts.get(n),
											a = this.fillers.get(t)
										if (((r.filler = a), a['@before'](e, r) && (!a['@join'] || a['@join'](e, r)))) {
											var o = !0,
												i = !1,
												l = void 0
											try {
												for (var u, s = a.steps[Symbol.iterator](); !(o = (u = s.next()).done); o = !0) {
													var f = u.value,
														c = !0,
														d = !1,
														p = void 0
													try {
														for (var h, v = f[Symbol.iterator](); !(c = (h = v.next()).done); c = !0) {
															var m = h.value,
																y = a.inputs[m]
															if (y.keyFxn && y.valFxn) {
																var g = y.keyFxn(e, r),
																	b = !0,
																	_ = !1,
																	x = void 0
																try {
																	for (var w, j = g[Symbol.iterator](); !(b = (w = j.next()).done); b = !0) {
																		var k = w.value
																		y.valFxn(e, k, n, r),
																			'~' == y.keyTokens.skip &&
																				(this.temps.has(n) || this.temps.set(n, new Set()), this.temps.get(n).add(k))
																	}
																} catch (e) {
																	;(_ = !0), (x = e)
																} finally {
																	try {
																		!b && j.return && j.return()
																	} finally {
																		if (_) throw x
																	}
																}
															}
														}
													} catch (e) {
														;(d = !0), (p = e)
													} finally {
														try {
															!c && v.return && v.return()
														} finally {
															if (d) throw p
														}
													}
												}
											} catch (e) {
												;(i = !0), (l = e)
											} finally {
												try {
													!o && s.return && s.return()
												} finally {
													if (i) throw l
												}
											}
											for (var O in (a['@after'](e, r),
											a['@dist'] && a['@dist'](r),
											a['@done'] && !this.done.includes(r) && ((r.done = a['@done']), this.done.push(r)),
											a.postTerms))
												this.postLoopTerms[O] || (this.postLoopTerms[O] = []),
													this.postLoopTerms[O].includes(r) || this.postLoopTerms[O].push(r)
											return !0
										}
									}
								},
								{
									key: 'postLoop',
									value: function(e, t) {
										var n = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : '__:'
										if (t && t.filler && t.filler.postTerms[n]) {
											var r = !0,
												a = !1,
												o = void 0
											try {
												for (var i, l = t.filler.postTerms[n][Symbol.iterator](); !(r = (i = l.next()).done); r = !0) {
													var u = i.value,
														s = t.filler.inputs[u]
													if (s.keyFxn && s.valFxn) {
														var f = s.keyFxn(null, t),
															c = !0,
															d = !1,
															p = void 0
														try {
															for (var h, v = f[Symbol.iterator](); !(c = (h = v.next()).done); c = !0) {
																var m = h.value
																s.valFxn(null, m, e, t)
															}
														} catch (e) {
															;(d = !0), (p = e)
														} finally {
															try {
																!c && v.return && v.return()
															} finally {
																if (d) throw p
															}
														}
													}
												}
											} catch (e) {
												;(a = !0), (o = e)
											} finally {
												try {
													!r && l.return && l.return()
												} finally {
													if (a) throw o
												}
											}
										}
									}
								},
								{
									key: 'processResult',
									value: function(e) {
										var t = this.contexts.get(e)
										for (var n in (this.postLoop(e, t, '__:'), e)) {
											var r = e[n]
											if (r)
												if (Array.isArray(r) || r instanceof Set || r instanceof Map) {
													var a = !0,
														o = !1,
														i = void 0
													try {
														for (var u, s = r[Symbol.iterator](); !(a = (u = s.next()).done); a = !0) {
															var f = u.value
															'object' == (void 0 === f ? 'undefined' : l(f)) && this.processResult(f)
														}
													} catch (e) {
														;(o = !0), (i = e)
													} finally {
														try {
															!a && s.return && s.return()
														} finally {
															if (o) throw i
														}
													}
												} else if ('object' == (void 0 === r ? 'undefined' : l(r))) {
													var c = this.contexts.get(r)
													c && c['@dist'] && c['@dist'](r), this.processResult(r)
												}
										}
										t && t.filler && this.errors.markErrors(e, t)
									}
								},
								{
									key: 'copyResult',
									value: function(e) {
										var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {}
										if (!arguments.length || void 0 !== e) {
											var n = arguments.length ? e : this.tree
											for (var r in n) {
												var a = n[r]
												if (a instanceof Set || a instanceof Map) t[r] = [].concat(u(a))
												else if (Array.isArray(a)) {
													t[r] = []
													var o = !0,
														i = !1,
														s = void 0
													try {
														for (var f, c = a[Symbol.iterator](); !(o = (f = c.next()).done); o = !0) {
															var d = f.value
															if (Array.isArray(d)) {
																var p = []
																t[r].push(p), this.copyResult(d, p)
															} else if (d && 'object' == (void 0 === d ? 'undefined' : l(d))) {
																var h = Object.create(null)
																t[r].push(h), this.copyResult(d, h)
															} else t[r] = JSON.parse(JSON.stringify(a))
														}
													} catch (e) {
														;(i = !0), (s = e)
													} finally {
														try {
															!o && c.return && c.return()
														} finally {
															if (i) throw s
														}
													}
												} else
													a && 'object' == (void 0 === a ? 'undefined' : l(a))
														? ((t[r] = Object.create(null)), this.copyResult(a, t[r]))
														: (t[r] = JSON.parse(JSON.stringify(a)))
											}
											return t
										}
									}
								}
							]),
							f
						)
					})()
				return (p.prototype.converter = d), p
			})
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 })
			var r = n(21)
			Object.defineProperty(t, 'create', {
				enumerable: !0,
				get: function() {
					return x(r).default
				}
			})
			var a = n(1)
			Object.defineProperty(t, 'creator', {
				enumerable: !0,
				get: function() {
					return x(a).default
				}
			})
			var o = n(50)
			Object.defineProperty(t, 'local', {
				enumerable: !0,
				get: function() {
					return x(o).default
				}
			})
			var i = n(11)
			Object.defineProperty(t, 'matcher', {
				enumerable: !0,
				get: function() {
					return x(i).default
				}
			})
			var l = n(51)
			Object.defineProperty(t, 'mouse', {
				enumerable: !0,
				get: function() {
					return x(l).default
				}
			})
			var u = n(3)
			Object.defineProperty(t, 'namespace', {
				enumerable: !0,
				get: function() {
					return x(u).default
				}
			})
			var s = n(4)
			Object.defineProperty(t, 'namespaces', {
				enumerable: !0,
				get: function() {
					return x(s).default
				}
			})
			var f = n(2)
			Object.defineProperty(t, 'clientPoint', {
				enumerable: !0,
				get: function() {
					return x(f).default
				}
			})
			var c = n(9)
			Object.defineProperty(t, 'select', {
				enumerable: !0,
				get: function() {
					return x(c).default
				}
			})
			var d = n(52)
			Object.defineProperty(t, 'selectAll', {
				enumerable: !0,
				get: function() {
					return x(d).default
				}
			})
			var p = n(0)
			Object.defineProperty(t, 'selection', {
				enumerable: !0,
				get: function() {
					return x(p).default
				}
			})
			var h = n(5)
			Object.defineProperty(t, 'selector', {
				enumerable: !0,
				get: function() {
					return x(h).default
				}
			})
			var v = n(10)
			Object.defineProperty(t, 'selectorAll', {
				enumerable: !0,
				get: function() {
					return x(v).default
				}
			})
			var m = n(14)
			Object.defineProperty(t, 'style', {
				enumerable: !0,
				get: function() {
					return m.styleValue
				}
			})
			var y = n(53)
			Object.defineProperty(t, 'touch', {
				enumerable: !0,
				get: function() {
					return x(y).default
				}
			})
			var g = n(54)
			Object.defineProperty(t, 'touches', {
				enumerable: !0,
				get: function() {
					return x(g).default
				}
			})
			var b = n(6)
			Object.defineProperty(t, 'window', {
				enumerable: !0,
				get: function() {
					return x(b).default
				}
			})
			var _ = n(7)
			function x(e) {
				return e && e.__esModule ? e : { default: e }
			}
			Object.defineProperty(t, 'event', {
				enumerable: !0,
				get: function() {
					return _.event
				}
			}),
				Object.defineProperty(t, 'customEvent', {
					enumerable: !0,
					get: function() {
						return _.customEvent
					}
				})
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					return (0, a.default)((0, r.default)(e).call(document.documentElement))
				})
			var r = o(n(1)),
				a = o(n(9))
			function o(e) {
				return e && e.__esModule ? e : { default: e }
			}
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					'function' != typeof e && (e = (0, i.default)(e))
					for (var t = this._groups, n = t.length, r = new Array(n), o = 0; o < n; ++o)
						for (var l, u, s = t[o], f = s.length, c = (r[o] = new Array(f)), d = 0; d < f; ++d)
							(l = s[d]) &&
								(u = e.call(l, l.__data__, d, s)) &&
								('__data__' in l && (u.__data__ = l.__data__), (c[d] = u))
					return new a.Selection(r, this._parents)
				})
			var r,
				a = n(0),
				o = n(5),
				i = (r = o) && r.__esModule ? r : { default: r }
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					'function' != typeof e && (e = (0, i.default)(e))
					for (var t = this._groups, n = t.length, r = [], o = [], l = 0; l < n; ++l)
						for (var u, s = t[l], f = s.length, c = 0; c < f; ++c)
							(u = s[c]) && (r.push(e.call(u, u.__data__, c, s)), o.push(u))
					return new a.Selection(r, o)
				})
			var r,
				a = n(0),
				o = n(10),
				i = (r = o) && r.__esModule ? r : { default: r }
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					'function' != typeof e && (e = (0, i.default)(e))
					for (var t = this._groups, n = t.length, r = new Array(n), o = 0; o < n; ++o)
						for (var l, u = t[o], s = u.length, f = (r[o] = []), c = 0; c < s; ++c)
							(l = u[c]) && e.call(l, l.__data__, c, u) && f.push(l)
					return new a.Selection(r, this._parents)
				})
			var r,
				a = n(0),
				o = n(11),
				i = (r = o) && r.__esModule ? r : { default: r }
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e, t) {
					if (!e)
						return (
							(y = new Array(this.size())),
							(p = -1),
							this.each(function(e) {
								y[++p] = e
							}),
							y
						)
					var n = t ? s : u,
						r = this._parents,
						o = this._groups
					'function' != typeof e && (e = (0, l.default)(e))
					for (var i = o.length, f = new Array(i), c = new Array(i), d = new Array(i), p = 0; p < i; ++p) {
						var h = r[p],
							v = o[p],
							m = v.length,
							y = e.call(h, h && h.__data__, p, r),
							g = y.length,
							b = (c[p] = new Array(g)),
							_ = (f[p] = new Array(g))
						n(h, v, b, _, (d[p] = new Array(m)), y, t)
						for (var x, w, j = 0, k = 0; j < g; ++j)
							if ((x = b[j])) {
								for (j >= k && (k = j + 1); !(w = _[k]) && ++k < g; );
								x._next = w || null
							}
					}
					return ((f = new a.Selection(f, r))._enter = c), (f._exit = d), f
				})
			var r,
				a = n(0),
				o = n(12),
				i = n(26),
				l = (r = i) && r.__esModule ? r : { default: r }
			function u(e, t, n, r, a, i) {
				for (var l, u = 0, s = t.length, f = i.length; u < f; ++u)
					(l = t[u]) ? ((l.__data__ = i[u]), (r[u] = l)) : (n[u] = new o.EnterNode(e, i[u]))
				for (; u < s; ++u) (l = t[u]) && (a[u] = l)
			}
			function s(e, t, n, r, a, i, l) {
				var u,
					s,
					f,
					c = {},
					d = t.length,
					p = i.length,
					h = new Array(d)
				for (u = 0; u < d; ++u)
					(s = t[u]) && ((h[u] = f = '$' + l.call(s, s.__data__, u, t)), f in c ? (a[u] = s) : (c[f] = s))
				for (u = 0; u < p; ++u)
					(s = c[(f = '$' + l.call(e, i[u], u, i))])
						? ((r[u] = s), (s.__data__ = i[u]), (c[f] = null))
						: (n[u] = new o.EnterNode(e, i[u]))
				for (u = 0; u < d; ++u) (s = t[u]) && c[h[u]] === s && (a[u] = s)
			}
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					return function() {
						return e
					}
				})
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function() {
					return new i.Selection(this._exit || this._groups.map(o.default), this._parents)
				})
			var r,
				a = n(13),
				o = (r = a) && r.__esModule ? r : { default: r },
				i = n(0)
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					for (
						var t = this._groups,
							n = e._groups,
							a = t.length,
							o = n.length,
							i = Math.min(a, o),
							l = new Array(a),
							u = 0;
						u < i;
						++u
					)
						for (var s, f = t[u], c = n[u], d = f.length, p = (l[u] = new Array(d)), h = 0; h < d; ++h)
							(s = f[h] || c[h]) && (p[h] = s)
					for (; u < a; ++u) l[u] = t[u]
					return new r.Selection(l, this._parents)
				})
			var r = n(0)
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function() {
					for (var e = this._groups, t = -1, n = e.length; ++t < n; )
						for (var r, a = e[t], o = a.length - 1, i = a[o]; --o >= 0; )
							(r = a[o]) && (i && i !== r.nextSibling && i.parentNode.insertBefore(r, i), (i = r))
					return this
				})
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					function t(t, n) {
						return t && n ? e(t.__data__, n.__data__) : !t - !n
					}
					e || (e = a)
					for (var n = this._groups, o = n.length, i = new Array(o), l = 0; l < o; ++l) {
						for (var u, s = n[l], f = s.length, c = (i[l] = new Array(f)), d = 0; d < f; ++d) (u = s[d]) && (c[d] = u)
						c.sort(t)
					}
					return new r.Selection(i, this._parents).order()
				})
			var r = n(0)
			function a(e, t) {
				return e < t ? -1 : e > t ? 1 : e >= t ? 0 : NaN
			}
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function() {
					var e = arguments[0]
					return (arguments[0] = this), e.apply(null, arguments), this
				})
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function() {
					var e = new Array(this.size()),
						t = -1
					return (
						this.each(function() {
							e[++t] = this
						}),
						e
					)
				})
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function() {
					for (var e = this._groups, t = 0, n = e.length; t < n; ++t)
						for (var r = e[t], a = 0, o = r.length; a < o; ++a) {
							var i = r[a]
							if (i) return i
						}
					return null
				})
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function() {
					var e = 0
					return (
						this.each(function() {
							++e
						}),
						e
					)
				})
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function() {
					return !this.node()
				})
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					for (var t = this._groups, n = 0, r = t.length; n < r; ++n)
						for (var a, o = t[n], i = 0, l = o.length; i < l; ++i) (a = o[i]) && e.call(a, a.__data__, i, o)
					return this
				})
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e, t) {
					var n = (0, o.default)(e)
					if (arguments.length < 2) {
						var r = this.node()
						return n.local ? r.getAttributeNS(n.space, n.local) : r.getAttribute(n)
					}
					return this.each(
						(null == t ? (n.local ? l : i) : 'function' == typeof t ? (n.local ? c : f) : n.local ? s : u)(n, t)
					)
				})
			var r,
				a = n(3),
				o = (r = a) && r.__esModule ? r : { default: r }
			function i(e) {
				return function() {
					this.removeAttribute(e)
				}
			}
			function l(e) {
				return function() {
					this.removeAttributeNS(e.space, e.local)
				}
			}
			function u(e, t) {
				return function() {
					this.setAttribute(e, t)
				}
			}
			function s(e, t) {
				return function() {
					this.setAttributeNS(e.space, e.local, t)
				}
			}
			function f(e, t) {
				return function() {
					var n = t.apply(this, arguments)
					null == n ? this.removeAttribute(e) : this.setAttribute(e, n)
				}
			}
			function c(e, t) {
				return function() {
					var n = t.apply(this, arguments)
					null == n ? this.removeAttributeNS(e.space, e.local) : this.setAttributeNS(e.space, e.local, n)
				}
			}
		},
		function(e, t, n) {
			'use strict'
			function r(e) {
				return function() {
					delete this[e]
				}
			}
			function a(e, t) {
				return function() {
					this[e] = t
				}
			}
			function o(e, t) {
				return function() {
					var n = t.apply(this, arguments)
					null == n ? delete this[e] : (this[e] = n)
				}
			}
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e, t) {
					return arguments.length > 1
						? this.each((null == t ? r : 'function' == typeof t ? o : a)(e, t))
						: this.node()[e]
				})
		},
		function(e, t, n) {
			'use strict'
			function r(e) {
				return e.trim().split(/^|\s+/)
			}
			function a(e) {
				return e.classList || new o(e)
			}
			function o(e) {
				;(this._node = e), (this._names = r(e.getAttribute('class') || ''))
			}
			function i(e, t) {
				for (var n = a(e), r = -1, o = t.length; ++r < o; ) n.add(t[r])
			}
			function l(e, t) {
				for (var n = a(e), r = -1, o = t.length; ++r < o; ) n.remove(t[r])
			}
			function u(e) {
				return function() {
					i(this, e)
				}
			}
			function s(e) {
				return function() {
					l(this, e)
				}
			}
			function f(e, t) {
				return function() {
					;(t.apply(this, arguments) ? i : l)(this, e)
				}
			}
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e, t) {
					var n = r(e + '')
					if (arguments.length < 2) {
						for (var o = a(this.node()), i = -1, l = n.length; ++i < l; ) if (!o.contains(n[i])) return !1
						return !0
					}
					return this.each(('function' == typeof t ? f : t ? u : s)(n, t))
				}),
				(o.prototype = {
					add: function(e) {
						this._names.indexOf(e) < 0 && (this._names.push(e), this._node.setAttribute('class', this._names.join(' ')))
					},
					remove: function(e) {
						var t = this._names.indexOf(e)
						t >= 0 && (this._names.splice(t, 1), this._node.setAttribute('class', this._names.join(' ')))
					},
					contains: function(e) {
						return this._names.indexOf(e) >= 0
					}
				})
		},
		function(e, t, n) {
			'use strict'
			function r() {
				this.textContent = ''
			}
			function a(e) {
				return function() {
					this.textContent = e
				}
			}
			function o(e) {
				return function() {
					var t = e.apply(this, arguments)
					this.textContent = null == t ? '' : t
				}
			}
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					return arguments.length
						? this.each(null == e ? r : ('function' == typeof e ? o : a)(e))
						: this.node().textContent
				})
		},
		function(e, t, n) {
			'use strict'
			function r() {
				this.innerHTML = ''
			}
			function a(e) {
				return function() {
					this.innerHTML = e
				}
			}
			function o(e) {
				return function() {
					var t = e.apply(this, arguments)
					this.innerHTML = null == t ? '' : t
				}
			}
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					return arguments.length
						? this.each(null == e ? r : ('function' == typeof e ? o : a)(e))
						: this.node().innerHTML
				})
		},
		function(e, t, n) {
			'use strict'
			function r() {
				this.nextSibling && this.parentNode.appendChild(this)
			}
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function() {
					return this.each(r)
				})
		},
		function(e, t, n) {
			'use strict'
			function r() {
				this.previousSibling && this.parentNode.insertBefore(this, this.parentNode.firstChild)
			}
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function() {
					return this.each(r)
				})
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					var t = 'function' == typeof e ? e : (0, o.default)(e)
					return this.select(function() {
						return this.appendChild(t.apply(this, arguments))
					})
				})
			var r,
				a = n(1),
				o = (r = a) && r.__esModule ? r : { default: r }
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e, t) {
					var n = 'function' == typeof e ? e : (0, r.default)(e),
						o = null == t ? i : 'function' == typeof t ? t : (0, a.default)(t)
					return this.select(function() {
						return this.insertBefore(n.apply(this, arguments), o.apply(this, arguments) || null)
					})
				})
			var r = o(n(1)),
				a = o(n(5))
			function o(e) {
				return e && e.__esModule ? e : { default: e }
			}
			function i() {
				return null
			}
		},
		function(e, t, n) {
			'use strict'
			function r() {
				var e = this.parentNode
				e && e.removeChild(this)
			}
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function() {
					return this.each(r)
				})
		},
		function(e, t, n) {
			'use strict'
			function r() {
				return this.parentNode.insertBefore(this.cloneNode(!1), this.nextSibling)
			}
			function a() {
				return this.parentNode.insertBefore(this.cloneNode(!0), this.nextSibling)
			}
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					return this.select(e ? a : r)
				})
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					return arguments.length ? this.property('__data__', e) : this.node().__data__
				})
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e, t) {
					return this.each(('function' == typeof t ? u : l)(e, t))
				})
			var r,
				a = n(6),
				o = (r = a) && r.__esModule ? r : { default: r }
			function i(e, t, n) {
				var r = (0, o.default)(e),
					a = r.CustomEvent
				'function' == typeof a
					? (a = new a(t, n))
					: ((a = r.document.createEvent('Event')),
					  n ? (a.initEvent(t, n.bubbles, n.cancelable), (a.detail = n.detail)) : a.initEvent(t, !1, !1)),
					e.dispatchEvent(a)
			}
			function l(e, t) {
				return function() {
					return i(this, e, t)
				}
			}
			function u(e, t) {
				return function() {
					return i(this, e, t.apply(this, arguments))
				}
			}
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }), (t.default = a)
			var r = 0
			function a() {
				return new o()
			}
			function o() {
				this._ = '@' + (++r).toString(36)
			}
			o.prototype = a.prototype = {
				constructor: o,
				get: function(e) {
					for (var t = this._; !(t in e); ) if (!(e = e.parentNode)) return
					return e[t]
				},
				set: function(e, t) {
					return (e[this._] = t)
				},
				remove: function(e) {
					return this._ in e && delete e[this._]
				},
				toString: function() {
					return this._
				}
			}
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					var t = (0, r.default)()
					return t.changedTouches && (t = t.changedTouches[0]), (0, a.default)(e, t)
				})
			var r = o(n(8)),
				a = o(n(2))
			function o(e) {
				return e && e.__esModule ? e : { default: e }
			}
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e) {
					return 'string' == typeof e
						? new r.Selection([document.querySelectorAll(e)], [document.documentElement])
						: new r.Selection([null == e ? [] : e], r.root)
				})
			var r = n(0)
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e, t, n) {
					arguments.length < 3 && ((n = t), (t = (0, r.default)().changedTouches))
					for (var o, i = 0, l = t ? t.length : 0; i < l; ++i)
						if ((o = t[i]).identifier === n) return (0, a.default)(e, o)
					return null
				})
			var r = o(n(8)),
				a = o(n(2))
			function o(e) {
				return e && e.__esModule ? e : { default: e }
			}
		},
		function(e, t, n) {
			'use strict'
			Object.defineProperty(t, '__esModule', { value: !0 }),
				(t.default = function(e, t) {
					null == t && (t = (0, r.default)().touches)
					for (var n = 0, o = t ? t.length : 0, i = new Array(o); n < o; ++n) i[n] = (0, a.default)(e, t[n])
					return i
				})
			var r = o(n(8)),
				a = o(n(2))
			function o(e) {
				return e && e.__esModule ? e : { default: e }
			}
		}
	])
})
//# sourceMappingURL=portal.js.map
