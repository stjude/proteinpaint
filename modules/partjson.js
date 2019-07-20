"use strict"
class Reserved {
  constructor(t) {
    ;(this.Pj = t),
      (this.opts = ["@delimit", "@errmode"]),
      (this.contexts = [
        "@branch",
        "@parent",
        "@root",
        "@self",
        "@values",
        "@key"
      ]),
      (this.filters = ["@split()", "@before()", "@join()", "@ignore()"]),
      (this.post = ["@after()", "@dist()", "@end()"]),
      (this.terms = [
        ...this.opts,
        ...this.contexts,
        ...this.filters,
        ...this.post
      ])
  }
  setFxn(t, e, s, r) {
    this[t]
      ? (s[t] = this[t](r, e, s))
      : e.errors.push(["key", "UNRECOGNIZED-RESERVED-" + t])
  }
  trueFxn() {
    return !0
  }
  notDefined(t) {
    return void 0 === t
  }
}
;(Reserved.prototype["@split"] = function(t) {
  const e = t.slice(1, -2),
    s = this.Pj.opts["="][e]
  if (!s) throw `missing @split() function ${e}`
  this.Pj.split = s
}),
  (Reserved.prototype["@before"] = function(t, e) {
    const s = t.slice(1, -2),
      r = this.Pj.opts["="][s]
    return (
      r ||
      (e.errors.push(["val", "MISSING-" + e.term + "-FXN", s]), this.trueFxn)
    )
  }),
  (Reserved.prototype["@after"] = Reserved.prototype["@before"]),
  (Reserved.prototype["@done"] = Reserved.prototype["@before"]),
  (Reserved.prototype["@join"] = function(t, e, s) {
    return (s, r) => {
      let i = !0
      for (const o in t) {
        const n = t[o].slice(1, -2),
          l = this.Pj.opts["="][n]
        if (l) {
          const t = l(s, r, o)
          t ? this.Pj.joins.set(o, t) : (i = !1)
        } else e.errors.push(["val", "MISSING-@join-FXN", n])
      }
      return i
    }
  }),
  (Reserved.prototype["@dist"] = function(t, e) {
    const s = Array.isArray(t) ? t : [t],
      r = {}
    for (const t of s) r[t] = this.Pj.converter.subs["@"](this.Pj, t)
    return t => {
      t["@dist"] = s => {
        for (const i in r) {
          const o = (0, r[i])(null, t)
          o
            ? Array.isArray(o)
              ? o.includes(s) || o.push(s)
              : t.errors.push([e, "NON-ARRAY-DIST-TARGET", i])
            : t.errors.push([e, "MISSING-DIST-TARGET", i])
        }
      }
    }
  }),
  (Reserved.prototype["@ignore"] = function(t, e, s) {
    if (!t["@ignore()"]) return e
    const r =
        Array.isArray(t["@ignore()"]) ||
        "string" == typeof t["@ignore()"] ||
        "object" != typeof t["@ignore()"],
      i = r ? { "@": t["@ignore()"] } : t["@ignore()"],
      o = {}
    for (const t in i) {
      const e = i[t]
      if (Array.isArray(e)) o[t] = t => e.includes(t)
      else if ("string" == typeof e && "=" == e[0]) {
        const r = this.Pj.opts["="][e.slice(1, -2)]
        r
          ? (o[t] = r)
          : (s.errors.push(["val", "MISSING-@ignore()-FXN", e]),
            (o[t] = this.notDefined))
      } else
        s.errors.push(["val", "UNSUPPORTED-@ignore()-VALUE", e]),
          (o[t] = this.notDefined)
    }
    return r ? o : Object.assign({}, e, o)
  })
class KeyFiller {
  constructor(t) {
    ;(this.Pj = t), (this.allowedKeyTypes = new Set(["string", "number"]))
  }
  getFxn(t, e) {
    const [s, r] = this.Pj.converter.default(this.Pj, t, e, t.term)
    if (s) return this[r.conv](s, t)
  }
  getAllowedKeys(t, e, s, r) {
    if (!Array.isArray(t))
      return r.errors.push(["key", "NON-ARRAY-KEYS", e]), []
    const i = []
    for (const o of t)
      s.ignore(o) ||
        (this.allowedKeyTypes.has(typeof o)
          ? i.push(o)
          : r.errors.push([s, "INVALID-RESULT-KEY", e]))
    return i
  }
}
;(KeyFiller.prototype[""] = function(t, e) {
  return (s, r) => this.getAllowedKeys([t(s, r)], s, e, r)
}),
  (KeyFiller.prototype["()"] = KeyFiller.prototype[""]),
  (KeyFiller.prototype["[]"] = function(t, e) {
    return (s, r) => this.getAllowedKeys(t(s, r), s, e, r)
  }),
  (KeyFiller.prototype["(]"] = KeyFiller.prototype["[]"])
class ValFiller {
  constructor(t) {
    this.Pj = t
  }
  getFxn(t, e) {
    return this[this.getValType(t.templateVal) + "Filler"](t, e, t.templateVal)
  }
  getValType(t) {
    return "string" == typeof t
      ? "str"
      : Array.isArray(t)
      ? "arr"
      : t && "object" == typeof t
      ? "obj"
      : "default"
  }
  strFiller(t, e, s, r) {
    const [i, o] = this.Pj.converter.default(this.Pj, t, e, s)
    if (!i) return
    const n = (r || o.aggr) + "," + o.conv
    return n in this ? this[n](i, t) : void 0
  }
  arrFiller(t, e, s) {
    const r = this.getValType(s[0])
    return "str" == r
      ? this.strFiller(t, e, s[0], "[]")
      : "arr" == r
      ? this["[[,]]"](s[0], t)
      : "obj" == r
      ? this["[{}]"](s[0], t)
      : this.defaultFiller(t, e, s)
  }
  objFiller(t, e, s) {
    return (
      this.Pj.parseTemplate(s, t.inheritedIgnore, t.lineage),
      (t, e, r) => {
        this.Pj.setResultContext("{}", e, r), this.Pj.processRow(t, s, r[e])
      }
    )
  }
  defaultFiller(t, e, s) {
    const r = JSON.stringify(s)
    return (t, e, s) => {
      s[e] = JSON.parse(r)
    }
  }
  getArrSeed(t) {
    const e = t.templateVal && t.templateVal.length > 1 ? t.templateVal[1] : 1
    if ("set" == e)
      return (t, e, s) => {
        e in t
          ? Array.isArray(t[e]) && (t[e] = new Set(t[e]))
          : (t[e] = new Set()),
          t[e].add(s)
      }
    if (0 == e)
      return (t, e, s) => {
        e in t || (t[e] = []), t[e].push(s)
      }
    if (this.isNumeric(e)) {
      const t = new Map()
      return (s, r, i) => {
        r in s || (s[r] = []), t.has(s[r]) || t.set(s[r], new Map())
        const o = t.get(s[r])
        o.has(i) || o.set(i, 0)
        const n = o.get(i)
        n < e && (s[r].push(i), o.set(i, n + 1))
      }
    }
  }
  isNumeric(t) {
    return !isNaN(parseFloat(t)) && isFinite(t) && "" !== t
  }
}
;(ValFiller.prototype[","] = function(t, e) {
  return (s, r, i, o) => {
    const n = t(s, o)
    e.ignore(n, r, s) || (i[r] = n)
  }
}),
  (ValFiller.prototype[",()"] = ValFiller.prototype[","]),
  (ValFiller.prototype[",[]"] = ValFiller.prototype[","]),
  (ValFiller.prototype[",(]"] = ValFiller.prototype[","]),
  (ValFiller.prototype["[],"] = function(t, e) {
    const s = this.getArrSeed(e)
    if (s)
      return (r, i, o, n) => {
        const l = t(r, n)
        e.ignore(l, i, r, n) || s(o, i, l)
      }
    e.errors.push(["val", "INVALID-[]-OPTION"])
  }),
  (ValFiller.prototype["[],()"] = ValFiller.prototype["[],"]),
  (ValFiller.prototype["[],[]"] = function(t, e) {
    const s = this.getArrSeed(e)
    return (r, i, o, n) => {
      const l = t(r, n)
      if (Array.isArray(l))
        for (const t of l) e.ignore(t, i, r, n) || s(o, i, t)
      else n.errors.push([e, "NON-ARRAY-VALS", r])
    }
  }),
  (ValFiller.prototype["[],(]"] = ValFiller.prototype["[],[]"]),
  (ValFiller.prototype["[{}]"] = function(t, e) {
    this.Pj.parseTemplate(t, e.inheritedIgnore, e.lineage)
    const s = e.templateVal && e.templateVal.length > 1 ? e.templateVal[1] : ""
    if (!s)
      return (e, s, r) => {
        this.Pj.setResultContext("[]", s, r)
        const i = this.Pj.setResultContext("{}", r[s].length, r[s])
        this.Pj.processRow(e, t, i)
      }
    if ("string" == typeof s) {
      const [r, i] = this.Pj.converter.default(
        this.Pj,
        Object.assign({}, { templateVal: s }),
        e.inheritedIgnore,
        s
      )
      return i.aggr || i.skip || i.timing
        ? void e.errors.push(["val", "INVALID-[{}]-OPTION-TOKEN"])
        : (i, o, n, l) => {
            const c = this.Pj.setResultContext("[]", o, n, !0),
              p = this.Pj.contexts.get(c).tracker,
              a = r(i, l),
              h = "]" == s.slice(-1) ? a : [a]
            if (Array.isArray(h))
              for (const e of h)
                if (p.has(e)) this.Pj.processRow(i, t, p.get(e))
                else {
                  const s = this.Pj.setResultContext(
                    "{}",
                    c.length,
                    c,
                    !1,
                    e,
                    i,
                    t
                  )
                  s && (p.set(e, s), this.Pj.processRow(i, t, s))
                }
            else l.errors.push([e, "NON-ARRAY-VALS", i])
          }
    }
    e.errors.push(["val", "INVALID-[{}]-OPTION"])
  }),
  (ValFiller.prototype["[[,]]"] = function(t, e) {
    const s = []
    for (const r of t) {
      const t = Object.assign({}, e, { templateVal: r })
      s.push(this.getFxn(t, e.inheritedIgnore))
    }
    return "map" != (e.templateVal[1] ? e.templateVal[1] : "")
      ? (t, e, r) => {
          e in r || (r[e] = [])
          const i = []
          for (const e in s) s[+e](t, +e, i)
          r[e].push(i)
        }
      : (t, e, r) => {
          e in r
            ? r[e] instanceof Map || (r[e] = new Map(r[e]))
            : (r[e] = new Map())
          const i = []
          s[0](t, 0, i),
            r[e].has(i[0]) && (i[1] = r[e].get(i[0])),
            s[1](t, 1, i),
            r[e].set(i[0], i[1])
        }
  }),
  (ValFiller.prototype["+,"] = function(t, e) {
    return (s, r, i, o) => {
      r in i || (i[r] = 0)
      const n = t(s, o)
      e.ignore(n, r, s, o) ||
        (this.isNumeric(n)
          ? (i[r] += +n)
          : o.errors.push([e, "NON-NUMERIC-INCREMENT", s]))
    }
  }),
  (ValFiller.prototype["+,()"] = ValFiller.prototype["+,"]),
  (ValFiller.prototype["+,[]"] = function(t, e) {
    return (s, r, i, o) => {
      r in i || (i[r] = 0)
      const n = t(s, o)
      if (Array.isArray(n))
        for (const t of n)
          e.ignore(t, r, s, o) ||
            (this.isNumeric(t)
              ? (i[r] += +t)
              : o.errors.push([e, "NON-NUMERIC-INCREMENT", s]))
      else e.errors.push(["val", "NON-ARRAY-VALS", s])
    }
  }),
  (ValFiller.prototype["+,(]"] = ValFiller.prototype["+,[]"]),
  (ValFiller.prototype["-,"] = function(t, e) {
    return (s, r, i, o) => {
      r in i || (i[r] = 0)
      const n = t(s, o)
      e.ignore(n, r, s, o) ||
        (this.isNumeric(n)
          ? (i[r] += -n)
          : o.errors.push([e, "NON-NUMERIC-DECREMENT", s]))
    }
  }),
  (ValFiller.prototype["-,()"] = ValFiller.prototype["-,"]),
  (ValFiller.prototype["-,[]"] = function(t, e) {
    return (s, r, i, o) => {
      const n = t(s, o)
      if (Array.isArray(n)) {
        r in i || (i[r] = 0)
        for (const t of n) e.ignore(t, r, s, o) || (i[r] += -t)
      } else e.errors.push(["val", "NON-ARRAY-VALS", s])
    }
  }),
  (ValFiller.prototype["-,(]"] = ValFiller.prototype["-,[]"]),
  (ValFiller.prototype["<,"] = function(t, e) {
    return (s, r, i, o) => {
      const n = t(s, o)
      if (e.ignore(n, r, s, o)) return
      const l = +n
      this.isNumeric(l)
        ? r in i
          ? i[r] < l && (i[r] = l)
          : (i[r] = l)
        : o.errors.push([e, "NON-NUMERIC-THAN", s])
    }
  }),
  (ValFiller.prototype["<,()"] = ValFiller.prototype["<,"]),
  (ValFiller.prototype["<,[]"] = function(t, e) {
    return (s, r, i, o) => {
      const n = t(s, o)
      if (Array.isArray(n))
        for (const t of n) {
          if (e.ignore(t, r, s, o)) return
          if (!this.isNumeric(t))
            return void o.errors.push([e, "NON-NUMERIC-THAN", s])
          const n = +t
          r in i ? i[r] < n && (i[r] = n) : (i[r] = n)
        }
      else e.errors.push(["val", "NON-ARRAY-VALS", s])
    }
  }),
  (ValFiller.prototype["<,(]"] = ValFiller.prototype["<,[]"]),
  (ValFiller.prototype[">,"] = function(t, e) {
    return (s, r, i, o) => {
      const n = +t(s, o)
      e.ignore(n, r, s, o) ||
        (this.isNumeric(n)
          ? r in i
            ? i[r] > n && (i[r] = n)
            : (i[r] = n)
          : o.errors.push([e, "NON-NUMERIC-THAN", s]))
    }
  }),
  (ValFiller.prototype[">,()"] = ValFiller.prototype[">,"]),
  (ValFiller.prototype[">,[]"] = function(t, e) {
    return (s, r, i, o) => {
      const n = t(s, o)
      if (Array.isArray(n))
        for (const t of n) {
          if (e.ignore(t, r, s, o)) return
          if (!this.isNumeric(t))
            return void o.errors.push([e, "NON-NUMERIC-THAN", s])
          const n = +t
          r in i ? i[r] > n && (i[r] = n) : (i[r] = n)
        }
      else e.errors.push(["val", "NON-ARRAY-VALS", s])
    }
  }),
  (ValFiller.prototype[">,(]"] = ValFiller.prototype[">,[]"])
class Err {
  constructor(t) {
    ;(this.Pj = t),
      (this.allErrSet = new Set()),
      (this.allErrObj = Object.create(null)),
      (this.mode = { input: "{}", result: "{}-", root: "", console: "{}" }),
      (this.modeKeys = ["input", "result", "root", "console"]),
      this.setMode()
  }
  setMode(t = {}) {
    Array.isArray(t)
      ? this.modeKeys.forEach((e, s) => (this.mode[e] = t[s]))
      : "object" == typeof t &&
        this.modeKeys.forEach(e => {
          e in t && (this.mode[e] = t[e])
        })
  }
  clear(t = {}) {
    this.allErrSet.clear(),
      (this.allErrObj = Object.create(null)),
      this.setMode(t)
  }
  markErrors(t, e) {
    if (!e) return
    const s = "[]" == this.mode.result.slice(0, 2) ? [] : {}
    for (const r in e.filler.inputs) {
      const i = e.filler.inputs[r]
      for (const e of i.errors) {
        const [r, o, n] = e
        "key" == r
          ? (this.track(s, e, i.lineage.join(this.Pj.delimit)),
            this.mode.input && (t["{{ " + o + " }} " + i.term] = i.templateVal))
          : "val" == r &&
            (Array.isArray(i.templateVal)
              ? (this.track(s, e, i.templateVal[0]),
                this.mode.input &&
                  (t[i.term] = ["{{ " + o + " }} ", ...i.templateVal]))
              : "string" == typeof i.templateVal
              ? (this.track(s, e, i.templateVal),
                this.mode.input &&
                  (t[i.term] = "{{ " + o + " }} " + i.templateVal))
              : (this.track(s, e, i.templateVal),
                this.mode.input && (t[i.term] = "{{ " + o + " }} ")))
      }
    }
    if (e.errors.length) {
      const r = {}
      t["@errors"] = r
      for (const t of e.errors) {
        const [e, i, o] = t
        if ((this.track(s, t, e.term), !this.mode.input)) continue
        const n = "{{ " + i + " }} " + e.term
        n in r || (r[n] = 0), (r[n] += 1)
      }
    }
    if (e.filler.errors.length)
      for (const t of e.filler.errors) this.track(s, t, t[2], !1)
    Object.keys(s).length && this.mode.result && (t["@errors"] = s)
  }
  track(t, e, s, r = !0) {
    this.allErrSet.add(e),
      this.trackAsObj(this.allErrObj, e, s),
      (r && "-" == this.mode.result.slice(-1)) ||
        (Array.isArray(t) ? t.push(e) : this.trackAsObj(t, e, s))
  }
  trackAsObj(t, e, s) {
    const [r, i, o] = e
    i in t || (t[i] = Object.create(null)),
      s in t[i] || (t[i][s] = o ? [] : 0),
      o ? t[i][s].includes(o) || t[i][s].push(o) : (t[i][s] += 1)
  }
  log() {
    const t = [...this.allErrSet]
    if (t.length) {
      if (this.mode.root) {
        const e = this.mode.root
        this.Pj.tree["@errorsAll"] = "[]" == e ? t : this.allErrObj
      }
      if (this.mode.console) {
        const e = this.mode.console.slice(0, 2)
        console.log("[]" == e ? t : this.allErrObj)
      }
    }
  }
}
function converter(t, e, s, r) {
  const [i, o, n] = parseTerm(t, r)
  if (t.reserved.opts.includes(i)) return []
  const l = i + n.conv
  if (((e.ignore = l in s ? s[l] : s["@"]), n.skip && "~" != n.skip))
    return subs[n.skip](t, i, e), []
  if (n.subs in subs) {
    const s = subs[n.subs](t, i, e)
    return s ? [conv[n.conv](s, e, n), n] : []
  }
  return e.errors.push(["val", "UNSUPPORTED-SYMBOL-" + n.subs]), []
}
function parseTerm(t, e) {
  const s = t.skipSymbols.includes(e[0]) ? e[0] : "",
    r = e.slice(s.length, s.length + 3),
    i = t.timeSymbols.includes(r) ? r : "",
    o = s.length + i.length,
    n = e[o],
    l = e.slice(-2),
    c = t.aggrSymbols.includes(n) && n != e ? n : "",
    p = t.convSymbols.includes(l) && l != e ? l : "",
    a =
      c && p
        ? e.slice(o + 1, -2)
        : c
        ? e.slice(o + 1)
        : p
        ? e.slice(o, -2)
        : s || i
        ? e.slice(o)
        : e,
    h = t.subsSymbols.includes(a[0]) ? a[0] : "",
    u = c + h + p,
    f = h ? a.slice(1) : a
  return [
    a,
    u,
    { skip: s, time: i, aggr: c, subs: h, stem: f, conv: p, subterm: a },
    t.steps.indexOf(i)
  ]
}
const subs = {
    "#": function(t, e, s) {
      t.commentedTerms.has(s) || t.commentedTerms.set(s, []),
        t.commentedTerms.get(s).push(e)
    },
    "*": function(t, e, s) {
      t.focusTemplate[s.term.slice(1)] = s.templateVal
    },
    "": function(t, e, s) {
      return t.valFiller.isNumeric(e) ? () => +e : () => e
    },
    $: function(t, e, s) {
      if ("$" == e || e == "$" + t.delimit) return t => t
      if (e.includes(t.delimit)) {
        const s = e.slice(1).split(t.delimit)
        "" == s[0] && s.shift()
        const r = (t, e) => (t ? t[e] : void 0)
        return t => s.reduce(r, t)
      }
      {
        const t = e.slice(1)
        return e => e[t]
      }
    },
    "=": function(t, e, s) {
      const r = e
        .slice(1)
        .split(t.delimit)
        .reduce((t, e) => (t && e in t ? t[e] : void 0), t.opts["="])
      if (r) return t => r
      s.errors.push(["val", "MISSING-EXTERNAL-SUBS"])
    },
    "@": function(t, e, s) {
      if (!t.reserved.opts.includes(e)) {
        if ("@" == e || e == "@" + t.delimit) return (t, e) => e.self
        if (e.includes(t.delimit)) {
          const r = e.split(t.delimit),
            i = (r, i) => {
              if (
                "@" == i[0] &&
                i.length > 1 &&
                !t.reserved.contexts.includes(i)
              )
                return (
                  s.errors.push([
                    "val",
                    "UNRECOGNIZED-CONTEXT-" + e,
                    s.lineage.join(".") + "." + i
                  ]),
                  [null, null]
                )
              const [o, n] = r
              return o && i
                ? "@" == i
                  ? [n.self, n]
                  : "@values" == i
                  ? [Object.values(o), n]
                  : "@" == i[0]
                  ? [n[i.slice(1)], t.contexts.get(n[i.slice(1)])]
                  : [o[i], t.contexts.get(o[i])]
                : [null, null]
            }
          return (t, e) => r.reduce(i, [e.self, e])[0]
        }
        if (t.reserved.contexts.includes(e)) {
          const t = e.slice(1)
          return (e, s) => s[t]
        }
        s.errors.push(["val", "UNRECOGNIZED-CONTEXT-" + e])
      }
    },
    "&": function(t, e, s) {
      const r = e.slice(1).split(t.delimit),
        i = r.shift()
      if (r.length) {
        if (1 == r.length) {
          const e = r[0]
          return () => {
            const s = t.joins.get(i)
            return s ? s[e] : null
          }
        }
        {
          const e = (t, e) => (t ? t[e] : null)
          t.joins.get(i)
          return s => r.reduce(e, t.joins.get(i))
        }
      }
      return () => t.joins.get(i)
    }
  },
  conv = {
    "": function(t, e, s) {
      return t
    },
    "()": function(t, e, s) {
      if ("=" == s.subs) {
        const r = t()
        return "function" != typeof r
          ? void e.errors.push([
              "val",
              "NOT-A-FUNCTION",
              s.subs + s.term + s.conv
            ])
          : r
      }
      return (s, r) => {
        const i = t(s, r)
        if ("function" == typeof i) return i(s, r)
        e.errors.push(["val", "NOT-A-FUNCTION", s])
      }
    }
  }
;(conv["[]"] = conv[""]), (conv["(]"] = conv["()"])
var converter$1 = Object.freeze({ default: converter, parseTerm, subs, conv })
class Partjson {
  constructor(t = {}) {
    ;(this.defaultOpts = { template: {}, seed: "{}", "=": {} }),
      (this.opts = Object.assign(this.defaultOpts, t)),
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
      (this.skipSymbols = ["#", "*", "~"]),
      (this.steps = [":__", "", "_:_"]),
      (this.errors = new Err(this)),
      (this.reserved = new Reserved(this)),
      (this.keyFiller = new KeyFiller(this)),
      (this.valFiller = new ValFiller(this)),
      (this.commentedTerms = new Map()),
      (this.joins = new Map()),
      (this.fillers = new Map()),
      (this.contexts = new Map()),
      (this.temps = new Map()),
      this.refresh()
  }
  refresh(t = {}) {
    ;(this.times = { start: +new Date() }),
      Object.assign(this.opts, t),
      "string" != typeof this.opts.template &&
        (this.opts.template = JSON.stringify(this.opts.template))
    const e = JSON.parse(this.opts.template)
    this.errors.clear(e["@errmode"]),
      e["@delimit"] && (this.delimit = e["@delimit"]),
      this.commentedTerms.clear(),
      this.joins.clear(),
      this.fillers.clear(),
      this.contexts.clear(),
      this.temps.clear(),
      delete this.tree,
      (this.tree = this.setResultContext(this.opts.seed)),
      (this.focusTemplate = Object.create(null)),
      this.parseTemplate(e, { "@": this.reserved.notDefined }),
      (this.times.parse = +new Date() - this.times.start),
      Object.keys(this.focusTemplate).length
        ? (this.parseTemplate(this.focusTemplate, {
            "@": this.reserved.notDefined
          }),
          (this.template = this.focusTemplate))
        : (this.template = e),
      (this.postLoopTerms = Object.create(null)),
      (this.done = []),
      this.opts.data && this.add(this.opts.data, !1),
      this.errors.log(this.fillers)
  }
  setResultContext(t, e = null, s = null, r = !1, i, o = null, n = null) {
    const l = null !== e && e in s ? s[e] : JSON.parse(t)
    if (this.contexts.has(l)) return l
    const c = {
      branch: e,
      parent: s,
      context: this.contexts.get(s),
      self: l,
      root: this.tree ? this.tree : l,
      joins: this.joins,
      errors: [],
      key: i
    }
    if ((r && (c.tracker = new Map()), o && n)) {
      const t = this.fillers.get(n)
      if (!t["@before"](o, c)) return
      if (t["@join"] && !t["@join"](o, c)) return
    }
    return this.contexts.set(l, c), null !== e && (s[e] = l), l
  }
  parseTemplate(t, e, s = []) {
    const r = Object.create(null)
    ;(r.inputs = Object.create(null)),
      (r["@before"] = this.reserved.trueFxn),
      (r["@after"] = this.reserved.trueFxn),
      (r.postTerms = {}),
      (r.errors = [])
    const i = this.reserved["@ignore"](t, e, r)
    ;(r["@ignore"] = i), this.fillers.set(t, r)
    const o = this.steps.map(t => [])
    for (const e in t) {
      const [n, l, c, p] = parseTerm(this, e),
        a = t[e],
        h = (r.inputs[e] = {
          term: e,
          subterm: n,
          symbols: l,
          keyTokens: c,
          templateVal: a,
          lineage: [...s, e],
          inheritedIgnore: i,
          errors: []
        })
      "@()" == l
        ? this.reserved.setFxn(n, h, r, a)
        : ((h.keyFxn = this.keyFiller.getFxn(h, i)),
          h.keyFxn &&
            ((h.valFxn = this.valFiller.getFxn(h, i)),
            "__:" == c.time || this.timePost.includes(c.time)
              ? (r.postTerms[c.time] || (r.postTerms[c.time] = []),
                r.postTerms[c.time].includes(e) || r.postTerms[c.time].push(e))
              : o[p].push(e)))
    }
    r.steps = o.filter(t => t.length)
  }
  add(t, e = !0) {
    this.times.start || (this.times.start = +new Date()),
      e && this.errors.clear(),
      this.joins.clear();
    for (const e of t)
      if (this.split)
        for (const t of this.split(e))
          this.processRow(t, this.template, this.tree), this.joins.clear()
      else this.processRow(e, this.template, this.tree), this.joins.clear()
    this.processResult(this.tree)
    for (const t of this.timePost)
      if (this.postLoopTerms[t])
        for (const e of this.postLoopTerms[t]) this.postLoop(e.self, e, t)
    for (const t of this.done) t.done(t.self, t)
    for (const [t, e] of this.temps) for (const s of e) delete t[s]
    ;(this.times.total = +new Date() - this.times.start),
      delete this.times.start,
      e && this.errors.log()
  }
  processRow(t, e, s) {
    const r = this.contexts.get(s),
      i = this.fillers.get(e)
    if (
      ((r.filler = i), i["@before"](t, r) && (!i["@join"] || i["@join"](t, r)))
    ) {
      for (const e of i.steps)
        for (const o of e) {
          const e = i.inputs[o]
          if (e.keyFxn && e.valFxn) {
            const i = e.keyFxn(t, r)
            for (const o of i)
              e.valFxn(t, o, s, r),
                "~" == e.keyTokens.skip &&
                  (this.temps.has(s) || this.temps.set(s, new Set()),
                  this.temps.get(s).add(o))
          }
        }
      i["@after"](t, r),
        i["@dist"] && i["@dist"](r),
        i["@done"] &&
          !this.done.includes(r) &&
          ((r.done = i["@done"]), this.done.push(r))
      for (const t in i.postTerms)
        this.postLoopTerms[t] || (this.postLoopTerms[t] = []),
          this.postLoopTerms[t].includes(r) || this.postLoopTerms[t].push(r)
      return !0
    }
  }
  postLoop(t, e, s = "__:") {
    if (e && e.filler && e.filler.postTerms[s])
      for (const r of e.filler.postTerms[s]) {
        const s = e.filler.inputs[r]
        if (s.keyFxn && s.valFxn) {
          const r = s.keyFxn(null, e)
          for (const i of r) s.valFxn(null, i, t, e)
        }
      }
  }
  processResult(t) {
    const e = this.contexts.get(t)
    this.postLoop(t, e, "__:")
    for (const e in t) {
      const s = t[e]
      if (s)
        if (Array.isArray(s) || s instanceof Set || s instanceof Map)
          for (const t of s) "object" == typeof t && this.processResult(t)
        else if ("object" == typeof s) {
          const t = this.contexts.get(s)
          t && t["@dist"] && t["@dist"](s), this.processResult(s)
        }
    }
    e && e.filler && this.errors.markErrors(t, e)
  }
  copyResult(t, e = {}) {
    if (arguments.length && void 0 === t) return
    const s = arguments.length ? t : this.tree
    for (const t in s) {
      const r = s[t]
      if (r instanceof Set || r instanceof Map) e[t] = [...r]
      else if (Array.isArray(r)) {
        e[t] = []
        for (const s of r)
          if (Array.isArray(s)) {
            const r = []
            e[t].push(r), this.copyResult(s, r)
          } else if (s && "object" == typeof s) {
            const r = Object.create(null)
            e[t].push(r), this.copyResult(s, r)
          } else e[t] = JSON.parse(JSON.stringify(r))
      } else
        r && "object" == typeof r
          ? ((e[t] = Object.create(null)), this.copyResult(r, e[t]))
          : (e[t] = JSON.parse(JSON.stringify(r)))
    }
    return e
  }
}
;(Partjson.prototype.converter = converter$1), (module.exports = Partjson)
