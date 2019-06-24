"use strict"
class Reserved {
  constructor(e) {
    ;(this.Pj = e),
      (this.opts = ["@delimit", "@errmode"]),
      (this.contexts = [
        "@branch",
        "@parent",
        "@root",
        "@self",
        "@values",
        "@key"
      ]),
      (this.filters = ["@before()", "@join()", "@ignore()"]),
      (this.post = ["@after()", "@dist()", "@end()"]),
      (this.terms = [
        ...this.opts,
        ...this.contexts,
        ...this.filters,
        ...this.post
      ])
  }
  setFxn(e, t, s, r) {
    this[e]
      ? (s[e] = this[e](r, t, s))
      : t.errors.push(["key", "UNRECOGNIZED-RESERVED-" + e])
  }
  trueFxn() {
    return !0
  }
  notDefined(e) {
    return void 0 === e
  }
}
;(Reserved.prototype["@before"] = function(e, t) {
  const s = e.slice(1, -2),
    r = this.Pj.opts["="][s]
  return (
    r || (t.errors.push(["val", "MISSING-" + t.term + "-FXN", s]), this.trueFxn)
  )
}),
  (Reserved.prototype["@after"] = Reserved.prototype["@before"]),
  (Reserved.prototype["@done"] = Reserved.prototype["@before"]),
  (Reserved.prototype["@join"] = function(e, t, s) {
    return (s, r) => {
      let o = !0
      for (const i in e) {
        const n = e[i].slice(1, -2),
          l = this.Pj.opts["="][n]
        if (l) {
          const e = l(s, r, i)
          e ? this.Pj.joins.set(i, e) : (o = !1)
        } else t.errors.push(["val", "MISSING-@join-FXN", n])
      }
      return o
    }
  }),
  (Reserved.prototype["@dist"] = function(e, t) {
    const s = Array.isArray(e) ? e : [e],
      r = {}
    for (const e of s) r[e] = this.Pj.converter.subs["@"](this.Pj, e)
    return e => {
      e["@dist"] = s => {
        for (const o in r) {
          const i = (0, r[o])(null, e)
          i
            ? Array.isArray(i)
              ? i.includes(s) || i.push(s)
              : e.errors.push([t, "NON-ARRAY-DIST-TARGET", o])
            : e.errors.push([t, "MISSING-DIST-TARGET", o])
        }
      }
    }
  }),
  (Reserved.prototype["@ignore"] = function(e, t, s) {
    if (!e["@ignore()"]) return t
    const r =
        Array.isArray(e["@ignore()"]) ||
        "string" == typeof e["@ignore()"] ||
        "object" != typeof e["@ignore()"],
      o = r ? { "@": e["@ignore()"] } : e["@ignore()"],
      i = {}
    for (const e in o) {
      const t = o[e]
      if (Array.isArray(t)) i[e] = e => t.includes(e)
      else if ("string" == typeof t && "=" == t[0]) {
        const r = this.Pj.opts["="][t.slice(1, -2)]
        r
          ? (i[e] = r)
          : (s.errors.push(["val", "MISSING-@ignore()-FXN", t]),
            (i[e] = this.notDefined))
      } else
        s.errors.push(["val", "UNSUPPORTED-@ignore()-VALUE", t]),
          (i[e] = this.notDefined)
    }
    return r ? i : Object.assign({}, t, i)
  })
class KeyFiller {
  constructor(e) {
    ;(this.Pj = e), (this.allowedKeyTypes = new Set(["string", "number"]))
  }
  getFxn(e, t) {
    const [s, r] = this.Pj.converter.default(this.Pj, e, t, e.term)
    if (s) return this[r.conv](s, e)
  }
  getAllowedKeys(e, t, s, r) {
    if (!Array.isArray(e))
      return r.errors.push(["key", "NON-ARRAY-KEYS", t]), []
    const o = []
    for (const i of e)
      s.ignore(i) ||
        (this.allowedKeyTypes.has(typeof i)
          ? o.push(i)
          : r.errors.push([s, "INVALID-RESULT-KEY", t]))
    return o
  }
}
;(KeyFiller.prototype[""] = function(e, t) {
  return (s, r) => this.getAllowedKeys([e(s, r)], s, t, r)
}),
  (KeyFiller.prototype["()"] = KeyFiller.prototype[""]),
  (KeyFiller.prototype["[]"] = function(e, t) {
    return (s, r) => this.getAllowedKeys(e(s, r), s, t, r)
  }),
  (KeyFiller.prototype["(]"] = KeyFiller.prototype["[]"])
class ValFiller {
  constructor(e) {
    this.Pj = e
  }
  getFxn(e, t) {
    return this[this.getValType(e.templateVal) + "Filler"](e, t, e.templateVal)
  }
  getValType(e) {
    return "string" == typeof e
      ? "str"
      : Array.isArray(e)
      ? "arr"
      : e && "object" == typeof e
      ? "obj"
      : "default"
  }
  strFiller(e, t, s, r) {
    const [o, i] = this.Pj.converter.default(this.Pj, e, t, s)
    if (!o) return
    const n = (r || i.aggr) + "," + i.conv
    return n in this ? this[n](o, e) : void 0
  }
  arrFiller(e, t, s) {
    const r = this.getValType(s[0])
    return "str" == r
      ? this.strFiller(e, t, s[0], "[]")
      : "arr" == r
      ? this["[[,]]"](s[0], e)
      : "obj" == r
      ? this["[{}]"](s[0], e)
      : this.defaultFiller(e, t, s)
  }
  objFiller(e, t, s) {
    return (
      this.Pj.parseTemplate(s, e.inheritedIgnore, e.lineage),
      (e, t, r) => {
        this.Pj.setResultContext("{}", t, r), this.Pj.processRow(e, s, r[t])
      }
    )
  }
  defaultFiller(e, t, s) {
    const r = JSON.stringify(s)
    return (e, t, s) => {
      s[t] = JSON.parse(r)
    }
  }
  getArrSeed(e) {
    const t = e.templateVal && e.templateVal.length > 1 ? e.templateVal[1] : 1
    if ("set" == t)
      return (e, t, s) => {
        t in e
          ? Array.isArray(e[t]) && (e[t] = new Set(e[t]))
          : (e[t] = new Set()),
          e[t].add(s)
      }
    if (0 == t)
      return (e, t, s) => {
        t in e || (e[t] = []), e[t].push(s)
      }
    if (this.isNumeric(t)) {
      const e = new Map()
      return (s, r, o) => {
        r in s || (s[r] = []), e.has(s[r]) || e.set(s[r], new Map())
        const i = e.get(s[r])
        i.has(o) || i.set(o, 0)
        const n = i.get(o)
        n < t && (s[r].push(o), i.set(o, n + 1))
      }
    }
  }
  isNumeric(e) {
    return !isNaN(parseFloat(e)) && isFinite(e) && "" !== e
  }
}
;(ValFiller.prototype[","] = function(e, t) {
  return (s, r, o, i) => {
    const n = e(s, i)
    t.ignore(n, r, s) || (o[r] = n)
  }
}),
  (ValFiller.prototype[",()"] = ValFiller.prototype[","]),
  (ValFiller.prototype[",[]"] = ValFiller.prototype[","]),
  (ValFiller.prototype[",(]"] = ValFiller.prototype[","]),
  (ValFiller.prototype["[],"] = function(e, t) {
    const s = this.getArrSeed(t)
    if (s)
      return (r, o, i, n) => {
        const l = e(r, n)
        t.ignore(l, o, r, n) || s(i, o, l)
      }
    t.errors.push(["val", "INVALID-[]-OPTION"])
  }),
  (ValFiller.prototype["[],()"] = ValFiller.prototype["[],"]),
  (ValFiller.prototype["[],[]"] = function(e, t) {
    const s = this.getArrSeed(t)
    return (r, o, i, n) => {
      const l = e(r, n)
      if (Array.isArray(l))
        for (const e of l) t.ignore(e, o, r, n) || s(i, o, e)
      else n.errors.push([t, "NON-ARRAY-VALS", r])
    }
  }),
  (ValFiller.prototype["[],(]"] = ValFiller.prototype["[],[]"]),
  (ValFiller.prototype["[{}]"] = function(e, t) {
    this.Pj.parseTemplate(e, t.inheritedIgnore, t.lineage)
    const s = t.templateVal && t.templateVal.length > 1 ? t.templateVal[1] : ""
    if (!s)
      return (t, s, r) => {
        this.Pj.setResultContext("[]", s, r)
        const o = this.Pj.setResultContext("{}", r[s].length, r[s])
        this.Pj.processRow(t, e, o)
      }
    if ("string" == typeof s) {
      const [r, o] = this.Pj.converter.default(
        this.Pj,
        Object.assign({}, { templateVal: s }),
        t.inheritedIgnore,
        s
      )
      return o.aggr || o.skip || o.timing
        ? void t.errors.push(["val", "INVALID-[{}]-OPTION-TOKEN"])
        : (o, i, n, l) => {
            const c = this.Pj.setResultContext("[]", i, n, !0),
              p = this.Pj.contexts.get(c).tracker,
              a = r(o, l),
              h = "]" == s.slice(-1) ? a : [a]
            if (Array.isArray(h))
              for (const t of h)
                if (p.has(t)) this.Pj.processRow(o, e, p.get(t))
                else {
                  const s = this.Pj.setResultContext("{}", c.length, c, !1, t)
                  p.set(t, s), this.Pj.processRow(o, e, s)
                }
            else l.errors.push([t, "NON-ARRAY-VALS", o])
          }
    }
    t.errors.push(["val", "INVALID-[{}]-OPTION"])
  }),
  (ValFiller.prototype["[[,]]"] = function(e, t) {
    const s = []
    for (const r of e) {
      const e = Object.assign({}, t, { templateVal: r })
      s.push(this.getFxn(e, t.inheritedIgnore))
    }
    return "map" != (t.templateVal[1] ? t.templateVal[1] : "")
      ? (e, t, r) => {
          t in r || (r[t] = [])
          const o = []
          for (const t in s) s[+t](e, +t, o)
          r[t].push(o)
        }
      : (e, t, r) => {
          t in r
            ? r[t] instanceof Map || (r[t] = new Map(r[t]))
            : (r[t] = new Map())
          const o = []
          s[0](e, 0, o),
            r[t].has(o[0]) && (o[1] = r[t].get(o[0])),
            s[1](e, 1, o),
            r[t].set(o[0], o[1])
        }
  }),
  (ValFiller.prototype["+,"] = function(e, t) {
    return (s, r, o, i) => {
      r in o || (o[r] = 0)
      const n = e(s, i)
      t.ignore(n, r, s, i) ||
        (this.isNumeric(n)
          ? (o[r] += +n)
          : i.errors.push([t, "NON-NUMERIC-INCREMENT", s]))
    }
  }),
  (ValFiller.prototype["+,()"] = ValFiller.prototype["+,"]),
  (ValFiller.prototype["+,[]"] = function(e, t) {
    return (s, r, o, i) => {
      r in o || (o[r] = 0)
      const n = e(s, i)
      if (Array.isArray(n))
        for (const e of n)
          t.ignore(e, r, s, i) ||
            (this.isNumeric(e)
              ? (o[r] += +e)
              : i.errors.push([t, "NON-NUMERIC-INCREMENT", s]))
      else t.errors.push(["val", "NON-ARRAY-VALS", s])
    }
  }),
  (ValFiller.prototype["+,(]"] = ValFiller.prototype["+,[]"]),
  (ValFiller.prototype["-,"] = function(e, t) {
    return (s, r, o, i) => {
      r in o || (o[r] = 0)
      const n = e(s, i)
      t.ignore(n, r, s, i) ||
        (this.isNumeric(n)
          ? (o[r] += -n)
          : i.errors.push([t, "NON-NUMERIC-DECREMENT", s]))
    }
  }),
  (ValFiller.prototype["-,()"] = ValFiller.prototype["-,"]),
  (ValFiller.prototype["-,[]"] = function(e, t) {
    return (s, r, o, i) => {
      const n = e(s, i)
      if (Array.isArray(n)) {
        r in o || (o[r] = 0)
        for (const e of n) t.ignore(e, r, s, i) || (o[r] += -e)
      } else t.errors.push(["val", "NON-ARRAY-VALS", s])
    }
  }),
  (ValFiller.prototype["-,(]"] = ValFiller.prototype["-,[]"]),
  (ValFiller.prototype["<,"] = function(e, t) {
    return (s, r, o, i) => {
      const n = +e(s, i)
      t.ignore(n, r, s, i) ||
        (this.isNumeric(n)
          ? r in o
            ? o[r] < n && (o[r] = n)
            : (o[r] = n)
          : i.errors.push([t, "NON-NUMERIC-THAN", s]))
    }
  }),
  (ValFiller.prototype["<,()"] = ValFiller.prototype["<,"]),
  (ValFiller.prototype["<,[]"] = function(e, t) {
    return (s, r, o, i) => {
      const n = e(s, i)
      if (Array.isArray(n))
        for (const e of n) {
          if (t.ignore(e, r, s, i)) return
          if (!this.isNumeric(e))
            return void i.errors.push([t, "NON-NUMERIC-THAN", s])
          const n = +e
          r in o ? o[r] < n && (o[r] = n) : (o[r] = n)
        }
      else t.errors.push(["val", "NON-ARRAY-VALS", s])
    }
  }),
  (ValFiller.prototype["<,(]"] = ValFiller.prototype["<,[]"]),
  (ValFiller.prototype[">,"] = function(e, t) {
    return (s, r, o, i) => {
      const n = +e(s, i)
      t.ignore(n, r, s, i) ||
        (this.isNumeric(n)
          ? r in o
            ? o[r] > n && (o[r] = n)
            : (o[r] = n)
          : i.errors.push([t, "NON-NUMERIC-THAN", s]))
    }
  }),
  (ValFiller.prototype[">,()"] = ValFiller.prototype[">,"]),
  (ValFiller.prototype[">,[]"] = function(e, t) {
    return (s, r, o, i) => {
      const n = e(s, i)
      if (Array.isArray(n))
        for (const e of n) {
          if (t.ignore(e, r, s, i)) return
          if (!this.isNumeric(e))
            return void i.errors.push([t, "NON-NUMERIC-THAN", s])
          const n = +e
          r in o ? o[r] > n && (o[r] = n) : (o[r] = n)
        }
      else t.errors.push(["val", "NON-ARRAY-VALS", s])
    }
  }),
  (ValFiller.prototype[">,(]"] = ValFiller.prototype[">,[]"])
class Err {
  constructor(e) {
    ;(this.Pj = e),
      (this.allErrSet = new Set()),
      (this.allErrObj = Object.create(null)),
      (this.mode = { input: "{}", result: "{}-", root: "", console: "{}" }),
      (this.modeKeys = ["input", "result", "root", "console"]),
      this.setMode()
  }
  setMode(e = {}) {
    Array.isArray(e)
      ? this.modeKeys.forEach((t, s) => (this.mode[t] = e[s]))
      : "object" == typeof e &&
        this.modeKeys.forEach(t => {
          t in e && (this.mode[t] = e[t])
        })
  }
  clear(e = {}) {
    this.allErrSet.clear(),
      (this.allErrObj = Object.create(null)),
      this.setMode(e)
  }
  markErrors(e, t) {
    if (!t) return
    const s = "[]" == this.mode.result.slice(0, 2) ? [] : {}
    for (const r in t.filler.inputs) {
      const o = t.filler.inputs[r]
      for (const t of o.errors) {
        const [r, i, n] = t
        "key" == r
          ? (this.track(s, t, o.lineage.join(this.Pj.delimit)),
            this.mode.input && (e["{{ " + i + " }} " + o.term] = o.templateVal))
          : "val" == r &&
            (Array.isArray(o.templateVal)
              ? (this.track(s, t, o.templateVal[0]),
                this.mode.input &&
                  (e[o.term] = ["{{ " + i + " }} ", ...o.templateVal]))
              : "string" == typeof o.templateVal
              ? (this.track(s, t, o.templateVal),
                this.mode.input &&
                  (e[o.term] = "{{ " + i + " }} " + o.templateVal))
              : (this.track(s, t, o.templateVal),
                this.mode.input && (e[o.term] = "{{ " + i + " }} ")))
      }
    }
    if (t.errors.length) {
      const r = {}
      e["@errors"] = r
      for (const e of t.errors) {
        const [t, o, i] = e
        if ((this.track(s, e, t.term), !this.mode.input)) continue
        const n = "{{ " + o + " }} " + t.term
        n in r || (r[n] = 0), (r[n] += 1)
      }
    }
    if (t.filler.errors.length)
      for (const e of t.filler.errors) this.track(s, e, e[2], !1)
    Object.keys(s).length && this.mode.result && (e["@errors"] = s)
  }
  track(e, t, s, r = !0) {
    this.allErrSet.add(t),
      this.trackAsObj(this.allErrObj, t, s),
      (r && "-" == this.mode.result.slice(-1)) ||
        (Array.isArray(e) ? e.push(t) : this.trackAsObj(e, t, s))
  }
  trackAsObj(e, t, s) {
    const [r, o, i] = t
    o in e || (e[o] = Object.create(null)),
      s in e[o] || (e[o][s] = i ? [] : 0),
      i ? e[o][s].includes(i) || e[o][s].push(i) : (e[o][s] += 1)
  }
  log() {
    const e = [...this.allErrSet]
    if (e.length) {
      if (this.mode.root) {
        const t = this.mode.root
        this.Pj.tree["@errorsAll"] = "[]" == t ? e : this.allErrObj
      }
      if (this.mode.console) {
        const t = this.mode.console.slice(0, 2)
        console.log("[]" == t ? e : this.allErrObj)
      }
    }
  }
}
function converter(e, t, s, r) {
  const [o, i, n] = parseTerm(e, r)
  if (e.reserved.opts.includes(o)) return []
  const l = o + n.conv
  if (((t.ignore = l in s ? s[l] : s["@"]), n.skip))
    return subs[n.skip](e, o, t), []
  if (n.subs in subs) {
    const s = subs[n.subs](e, o, t)
    return s ? [conv[n.conv](s, t, n), n] : []
  }
  return t.errors.push(["val", "UNSUPPORTED-SYMBOL-" + n.subs]), []
}
function parseTerm(e, t) {
  const s = e.skipSymbols.includes(t[0]) ? t[0] : "",
    r = t.slice(0, 3),
    o = e.timeSymbols.includes(r) ? r : "",
    i = s.length + o.length,
    n = t[i],
    l = t.slice(-2),
    c = e.aggrSymbols.includes(n) && n != t ? n : "",
    p = e.convSymbols.includes(l) && l != t ? l : "",
    a =
      c && p
        ? t.slice(i + 1, -2)
        : c
        ? t.slice(i + 1)
        : p
        ? t.slice(i, -2)
        : o
        ? t.slice(i)
        : t,
    h = e.subsSymbols.includes(a[0]) ? a[0] : "",
    u = c + h + p,
    f = h ? a.slice(1) : a
  return [
    a,
    u,
    { skip: s, time: o, aggr: c, subs: h, stem: f, conv: p, subterm: a },
    e.steps.indexOf(o)
  ]
}
const subs = {
    "#": function(e, t, s) {
      e.commentedTerms.has(s) || e.commentedTerms.set(s, []),
        e.commentedTerms.get(s).push(t)
    },
    "*": function(e, t, s) {
      e.focusTemplate[s.term.slice(1)] = s.templateVal
    },
    "": function(e, t, s) {
      return e.valFiller.isNumeric(t) ? () => +t : () => t
    },
    $: function(e, t, s) {
      if ("$" == t || t == "$" + e.delimit) return e => e
      if (t.includes(e.delimit)) {
        const s = t.slice(1).split(e.delimit)
        "" == s[0] && s.shift()
        const r = (e, t) => (e ? e[t] : void 0)
        return e => s.reduce(r, e)
      }
      {
        const e = t.slice(1)
        return t => t[e]
      }
    },
    "=": function(e, t, s) {
      const r = t
        .slice(1)
        .split(e.delimit)
        .reduce((e, t) => (e && t in e ? e[t] : void 0), e.opts["="])
      if (r) return e => r
      s.errors.push(["val", "MISSING-EXTERNAL-SUBS"])
    },
    "@": function(e, t, s) {
      if (!e.reserved.opts.includes(t)) {
        if ("@" == t || t == "@" + e.delimit) return (e, t) => t.self
        if (t.includes(e.delimit)) {
          const r = t.split(e.delimit),
            o = (r, o) => {
              if (
                "@" == o[0] &&
                o.length > 1 &&
                !e.reserved.contexts.includes(o)
              )
                return (
                  s.errors.push([
                    "val",
                    "UNRECOGNIZED-CONTEXT-" + t,
                    s.lineage.join(".") + "." + o
                  ]),
                  [null, null]
                )
              const [i, n] = r
              return i && o
                ? "@" == o
                  ? [n.self, n]
                  : "@values" == o
                  ? [Object.values(i), n]
                  : "@" == o[0]
                  ? [n[o.slice(1)], e.contexts.get(n[o.slice(1)])]
                  : [i[o], e.contexts.get(i[o])]
                : [null, null]
            }
          return (e, t) => r.reduce(o, [t.self, t])[0]
        }
        if (e.reserved.contexts.includes(t)) {
          const e = t.slice(1)
          return (t, s) => s[e]
        }
        s.errors.push(["val", "UNRECOGNIZED-CONTEXT-" + t])
      }
    },
    "&": function(e, t, s) {
      const r = t.slice(1).split(e.delimit),
        o = r.shift()
      if (r.length) {
        if (1 == r.length) {
          const t = r[0]
          return () => {
            const s = e.joins.get(o)
            return s ? s[t] : null
          }
        }
        {
          const t = (e, t) => (e ? e[t] : null)
          e.joins.get(o)
          return s => r.reduce(t, e.joins.get(o))
        }
      }
      return () => e.joins.get(o)
    }
  },
  conv = {
    "": function(e, t, s) {
      return e
    },
    "()": function(e, t, s) {
      if ("=" == s.subs) {
        const r = e()
        return "function" != typeof r
          ? void t.errors.push([
              "val",
              "NOT-A-FUNCTION",
              s.subs + s.term + s.conv
            ])
          : r
      }
      return (s, r) => {
        const o = e(s, r)
        if ("function" == typeof o) return o(s, r)
        t.errors.push(["val", "NOT-A-FUNCTION", s])
      }
    }
  }
;(conv["[]"] = conv[""]), (conv["(]"] = conv["()"])
var converter$1 = Object.freeze({ default: converter, parseTerm, subs, conv })
class Partjson {
  constructor(e = {}) {
    ;(this.defaultOpts = { template: {}, seed: "{}", "=": {} }),
      (this.opts = Object.assign(this.defaultOpts, e)),
      (this.delimit = "."),
      (this.subsSymbols = ["$", "=", "@", "&"]),
      (this.convSymbols = ["()", "[]", "(]"]),
      (this.aggrSymbols = ["+", "-", "<", ">"]),
      (this.timePost = [
        "_0:",
        "_1:",
        "_2:",
        "_3:",
        "_4:",
        "_5:",
        "_6:",
        "_7:",
        "_8:",
        "_9:"
      ]),
      (this.timeSymbols = [":__", "_:_", "__:", ...this.timePost]),
      (this.skipSymbols = ["#", "*"]),
      (this.steps = [":__", "", "_:_"]),
      (this.errors = new Err(this)),
      (this.reserved = new Reserved(this)),
      (this.keyFiller = new KeyFiller(this)),
      (this.valFiller = new ValFiller(this)),
      (this.commentedTerms = new Map()),
      (this.joins = new Map()),
      (this.fillers = new Map()),
      (this.contexts = new Map()),
      this.refresh()
  }
  refresh(e = {}) {
    this.times = {start: +(new Date())}
    Object.assign(this.opts, e),
      "string" != typeof this.opts.template &&
        (this.opts.template = JSON.stringify(this.opts.template))
    const t = JSON.parse(this.opts.template)
    this.errors.clear(t["@errmode"]),
      t["@delimit"] && (this.delimit = t["@delimit"]),
      this.commentedTerms.clear(),
      this.joins.clear(),
      this.fillers.clear(),
      this.contexts.clear(),
      delete this.tree,
      (this.tree = this.setResultContext(this.opts.seed)),
      (this.focusTemplate = Object.create(null)),
      this.parseTemplate(t, { "@": this.reserved.notDefined }),
      Object.keys(this.focusTemplate).length
        ? (this.parseTemplate(this.focusTemplate, {
            "@": this.reserved.notDefined
          }),
          (this.template = this.focusTemplate))
        : (this.template = t),
      (this.postLoopTerms = Object.create(null)),
      (this.done = []),
      this.times.parse = +(new Date()) - this.times.start
      this.opts.data && this.add(this.opts.data, !1),
      this.errors.log(this.fillers)
  }
  setResultContext(e, t = null, s = null, r = !1, o) {
    const i = null !== t && t in s ? s[t] : JSON.parse(e)
    if (this.contexts.has(i)) return i
    const n = {
      branch: t,
      parent: s,
      self: i,
      root: this.tree ? this.tree : i,
      joins: this.joins,
      errors: [],
      key: o
    }
    return (
      r && (n.tracker = new Map()),
      this.contexts.set(i, n),
      null !== t && (s[t] = i),
      i
    )
  }
  parseTemplate(e, t, s = []) {
    const r = Object.create(null)
    ;(r.inputs = Object.create(null)),
      (r["@before"] = this.reserved.trueFxn),
      (r["@after"] = this.reserved.trueFxn),
      (r.postTerms = {}),
      (r.errors = [])
    const o = this.reserved["@ignore"](e, t, r)
    ;(r["@ignore"] = o), this.fillers.set(e, r)
    const i = this.steps.map(e => [])
    for (const t in e) {
      const [n, l, c, p] = parseTerm(this, t),
        a = e[t],
        h = (r.inputs[t] = {
          term: t,
          subterm: n,
          symbols: l,
          keyTokens: c,
          templateVal: a,
          lineage: [...s, t],
          inheritedIgnore: o,
          errors: []
        })
      "@()" == l
        ? this.reserved.setFxn(n, h, r, a)
        : ((h.keyFxn = this.keyFiller.getFxn(h, o)),
          h.keyFxn &&
            ((h.valFxn = this.valFiller.getFxn(h, o)),
            "__:" == c.time || this.timePost.includes(c.time)
              ? (r.postTerms[c.time] || (r.postTerms[c.time] = []),
                r.postTerms[c.time].includes(t) || r.postTerms[c.time].push(t))
              : i[p].push(t)))
    }
    r.steps = i.filter(e => e.length)
  }
  add(e, t = !0) {
    t && this.errors.clear(), this.joins.clear()
    for (const t of e)
      this.processRow(t, this.template, this.tree), this.joins.clear()
    this.processResult(this.tree)
    for (const e of this.timePost)
      if (this.postLoopTerms[e])
        for (const t of this.postLoopTerms[e]) this.postLoop(t.self, t, e)
    for (const e of this.done) e.done(e.self, e)
    t && this.errors.log(); 
    this.times.total = +(new Date()) - this.times.start
  }
  processRow(e, t, s) {
    const r = this.contexts.get(s),
      o = this.fillers.get(t)
    if (
      ((r.filler = o), o["@before"](e, r) && (!o["@join"] || o["@join"](e, r)))
    ) {
      for (const t of o.steps)
        for (const i of t) {
          const t = o.inputs[i]
          if (t.keyFxn && t.valFxn) {
            const o = t.keyFxn(e, r)
            for (const i of o) t.valFxn(e, i, s, r)
          }
        }
      o["@after"](e, r),
        o["@dist"] && o["@dist"](r),
        o["@done"] &&
          !this.done.includes(r) &&
          ((r.done = o["@done"]), this.done.push(r))
      for (const e in o.postTerms)
        this.postLoopTerms[e] || (this.postLoopTerms[e] = []),
          this.postLoopTerms[e].includes(r) || this.postLoopTerms[e].push(r)
    }
  }
  postLoop(e, t, s = "__:") {
    if (t && t.filler && t.filler.postTerms[s])
      for (const r of t.filler.postTerms[s]) {
        const s = t.filler.inputs[r]
        if (s.keyFxn && s.valFxn) {
          const r = s.keyFxn(null, t)
          for (const o of r) s.valFxn(null, o, e, t)
        }
      }
  }
  processResult(e) {
    const t = this.contexts.get(e)
    this.postLoop(e, t, "__:")
    for (const t in e) {
      const s = e[t]
      if (s)
        if (Array.isArray(s) || s instanceof Set || s instanceof Map)
          for (const e of s) "object" == typeof e && this.processResult(e)
        else if ("object" == typeof s) {
          const e = this.contexts.get(s)
          e && e["@dist"] && e["@dist"](s), this.processResult(s)
        }
    }
    t && t.filler && this.errors.markErrors(e, t)
  }
  copyResult(e, t = {}) {
    if (arguments.length && void 0 === e) return
    const s = arguments.length ? e : this.tree
    for (const e in s) {
      const r = s[e]
      if (r instanceof Set || r instanceof Map) t[e] = [...r]
      else if (Array.isArray(r)) {
        t[e] = []
        for (const s of r)
          if (Array.isArray(s)) {
            const r = []
            t[e].push(r), this.copyResult(s, r)
          } else if (s && "object" == typeof s) {
            const r = Object.create(null)
            t[e].push(r), this.copyResult(s, r)
          } else t[e] = JSON.parse(JSON.stringify(r))
      } else
        r && "object" == typeof r
          ? ((t[e] = Object.create(null)), this.copyResult(r, t[e]))
          : (t[e] = JSON.parse(JSON.stringify(r)))
    }
    return t
  }
}
;(Partjson.prototype.converter = converter$1), (module.exports = Partjson)
