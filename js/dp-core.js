var zt = Object.defineProperty;
var Bt = (t, e, n) => e in t ? zt(t, e, { enumerable: !0, configurable: !0, writable: !0, value: n }) : t[e] = n;
var Y = (t, e, n) => Bt(t, typeof e != "symbol" ? e + "" : e, n);
const nt = [
  0.9999999999998099,
  676.5203681218851,
  -1259.1392167224028,
  771.3234287776531,
  -176.6150291621406,
  12.507343278686905,
  -0.13857109526572012,
  9984369578019572e-21,
  15056327351493116e-23
], Xt = 0.5 * Math.log(2 * Math.PI);
function y(t) {
  if (!(t > 0)) return Number.NaN;
  if (t < 0.5) return y(t + 1) - Math.log(t);
  const e = t - 1;
  let n = nt[0];
  for (let r = 1; r < nt.length; r += 1) n += nt[r] / (e + r);
  const o = e + 7 + 0.5;
  return Xt + (e + 0.5) * Math.log(o) - o + Math.log(n);
}
const Tt = 10;
function st(t) {
  if (!(t > 0)) return Number.NaN;
  let e = 0, n = t;
  for (; n < Tt; )
    e -= 1 / n, n += 1;
  const o = 1 / n, r = o * o, a = r * (1 / 12 - r * (1 / 120 - r * (1 / 252 - r * (1 / 240 - r * (1 / 132 - r * (691 / 32760 - r / 12))))));
  return e + Math.log(n) - 0.5 * o - a;
}
function ct(t) {
  if (!(t > 0)) return Number.NaN;
  let e = 0, n = t;
  for (; n < Tt; )
    e += 1 / (n * n), n += 1;
  const o = 1 / n, r = o * o, a = o * (1 + o * (0.5 + o * (1 / 6 - r * (1 / 30 - r * (1 / 42 - r * (1 / 30 - r * (5 / 66 - r * (691 / 2730 - r * (7 / 6)))))))));
  return e + a;
}
function Ht(t, e) {
  return t === Number.NEGATIVE_INFINITY ? e : e === Number.NEGATIVE_INFINITY ? t : Math.max(t, e) + Math.log1p(Math.exp(-Math.abs(t - e)));
}
function Z(t) {
  let e = Number.NEGATIVE_INFINITY;
  for (let o = 0; o < t.length; o += 1) t[o] > e && (e = t[o]);
  if (e === Number.NEGATIVE_INFINITY || e === Number.POSITIVE_INFINITY) return e;
  let n = 0;
  for (let o = 0; o < t.length; o += 1) n += Math.exp(t[o] - e);
  return e + Math.log(n);
}
function Ce(t, e) {
  return y(t + e) - y(t);
}
const H = 500, Wt = 200, Zt = 1e-12, k = [Float64Array.of(0)];
function mt(t, e) {
  const n = new Float64Array(e + 2);
  n[0] = Number.NEGATIVE_INFINITY;
  const o = e > 0 ? Math.log(e) : Number.NEGATIVE_INFINITY;
  for (let r = 1; r <= e; r += 1) n[r] = Ht(t[r - 1], o + t[r]);
  return n[e + 1] = 0, n;
}
function At(t) {
  if (!Number.isInteger(t) || t < 0) throw new RangeError(`J must be a non-negative integer, got ${t}`);
  const e = Math.min(t, H);
  for (; k.length <= e; ) k.push(mt(k[k.length - 1], k.length - 1));
  if (t <= H) return k[t];
  let n = k[H];
  for (let o = H; o < t; o += 1) n = mt(n, o);
  return n;
}
function De(t, e) {
  const n = At(t), o = Math.log(e), r = new Float64Array(t);
  for (let l = 1; l <= t; l += 1) r[l - 1] = n[l] + l * o;
  const a = Z(r), s = new Float64Array(t + 1);
  for (let l = 1; l <= t; l += 1) s[l] = Math.exp(r[l - 1] - a);
  return s;
}
function Ye(t, e) {
  let n = new Float64Array(t + 1);
  n[1] = 1;
  for (let o = 2; o <= t; o += 1) {
    const r = e / (e + o - 1), a = new Float64Array(t + 1);
    for (let s = 1; s <= o; s += 1) a[s] = n[s] * (1 - r) + n[s - 1] * r;
    n = a;
  }
  return n;
}
function Qt(t, e) {
  if (t === 1) return 1;
  let n = 0;
  if (e <= t) {
    for (let o = 1; o < t; o += 1) n += e / (e + o);
    return 1 + n;
  }
  for (let o = 1; o < t; o += 1) n += o / (e + o);
  return t - n;
}
function Kt(t, e) {
  let n = 0;
  for (let o = 1; o < t; o += 1) {
    const r = e <= o ? e / o : o / e;
    n += r / ((1 + r) * (1 + r));
  }
  return n;
}
function wt(t, e) {
  return e * (st(e + t) - st(e));
}
function Jt(t, e) {
  return wt(t, e) - e * e * (ct(e) - ct(e + t));
}
const Et = (t, e) => t <= Wt || e > t;
function U(t, e) {
  return Et(t, e) ? Qt(t, e) : wt(t, e);
}
function $(t, e) {
  return Et(t, e) ? Kt(t, e) : Jt(t, e);
}
function _t(t, e) {
  let n = -30, o = 30;
  for (let a = 0; a < 200 && o - n > 1e-13; a += 1) {
    const s = (n + o) / 2;
    U(t, Math.exp(s)) < e ? n = s : o = s;
  }
  const r = Math.exp((n + o) / 2);
  return { alphaStar: r, minVar: $(t, r) };
}
const Ft = (t, e) => (e - 1) * (t - e);
function ot(t, e) {
  let n = 0;
  for (let o = 1; o < t.length; o += 1)
    if (n += t[o], n >= e - Zt) return o;
  return t.length - 1;
}
function te(t) {
  let e = 0, n = 0, o = 1;
  for (let a = 1; a < t.length; a += 1)
    e += a * t[a], n += a * a * t[a], t[a] > t[o] && (o = a);
  const r = Math.max(0, n - e * e);
  return {
    mean: e,
    var: r,
    sd: Math.sqrt(r),
    mode: o,
    median: ot(t, 0.5),
    q05: ot(t, 0.05),
    q95: ot(t, 0.95),
    pK1: t[1]
  };
}
const vt = 1e5, yt = 1e-16, q = 1e-300;
function ee(t, e, n) {
  return t > 0 ? e * Math.log(n) + (e - 1) * Math.log(t) - n * t - y(e) : Number.NEGATIVE_INFINITY;
}
function St(t, e) {
  return -e + t * Math.log(e) - y(t);
}
function Ot(t, e) {
  let n = t, o = 1 / t, r = o;
  for (let a = 0; a < vt && (n += 1, o *= e / n, r += o, !(Math.abs(o) < Math.abs(r) * yt)); a += 1)
    ;
  return r * Math.exp(St(t, e));
}
function kt(t, e) {
  let n = e + 1 - t, o = 1 / q, r = 1 / n, a = r;
  for (let s = 1; s < vt; s += 1) {
    const l = -s * (s - t);
    n += 2, r = l * r + n, Math.abs(r) < q && (r = q), o = n + l / o, Math.abs(o) < q && (o = q), r = 1 / r;
    const c = r * o;
    if (a *= c, Math.abs(c - 1) < yt) break;
  }
  return Math.exp(St(t, e)) * a;
}
function Mt(t, e) {
  return e <= 0 ? 0 : e === Number.POSITIVE_INFINITY ? 1 : e < t + 1 ? Ot(t, e) : 1 - kt(t, e);
}
function Vt(t, e) {
  return e <= 0 ? 1 : e === Number.POSITIVE_INFINITY ? 0 : e < t + 1 ? 1 - Ot(t, e) : kt(t, e);
}
function Gt(t, e, n) {
  return Mt(e, n * t);
}
function qe(t, e, n) {
  return Vt(e, n * t);
}
const ne = 200, oe = 1e-15;
function pt(t, e, n) {
  if (t <= 0) return 0;
  if (t >= 1) return Number.POSITIVE_INFINITY;
  const o = t > 0.5;
  let r = Math.exp((Math.log(t) + y(e + 1)) / e) * 0.5;
  r > 0 || (r = Number.MIN_VALUE);
  let a = Math.max(r * 2, e + 1);
  const s = (h) => o ? Vt(e, h) > 1 - t : Mt(e, h) < t;
  for (; s(a); ) a *= 2;
  for (; !s(r) && r > Number.MIN_VALUE; ) r /= 2;
  let l = Math.log(r), c = Math.log(a);
  for (let h = 0; h < ne && c - l > oe; h += 1) {
    const M = 0.5 * (l + c);
    s(Math.exp(M)) ? l = M : c = M;
  }
  return Math.exp(0.5 * (l + c)) / n;
}
const L = 1e4, Rt = 1e15, re = 401, gt = 12, ae = 1e-12, se = 1e-15, ce = 1e-15, le = 400, ie = 0.02;
function O(t, e, n = 1) {
  if (!(t > 0 && e > 0)) throw new RangeError(`Gamma(a, b) needs a, b > 0, got (${t}, ${e})`);
  if (t >= Rt)
    return { a: t, b: e, pointMass: t / e, logRatio: null, p0: 0, alpha: Float64Array.of(t / e), weight: Float64Array.of(1) };
  if (t > L) return ue(t, e, n);
  const o = Math.max(ae, pt(se, t, e)), r = pt(1 - ce, t, e), a = Gt(o, t, e);
  if (!(r > o))
    return { a: t, b: e, pointMass: null, logRatio: null, p0: 1, alpha: new Float64Array(0), weight: new Float64Array(0) };
  const s = Math.log(o), l = Math.log(r) - s, c = Math.ceil(Math.max(le, l / ie) * n), h = l / (c - 1), M = new Float64Array(c), m = new Float64Array(c), i = new Float64Array(c);
  for (let u = 0; u < c; u += 1) {
    const x = s + u * h;
    M[u] = Math.exp(x), i[u] = Math.exp(ee(M[u], t, e) + x);
    const b = u === 0 || u === c - 1 ? 0.5 : 1;
    m[u] = i[u] * h * b;
  }
  const f = h * h / 12;
  return m[0] += f * (t - e * M[0]) * i[0], m[c - 1] -= f * (t - e * M[c - 1]) * i[c - 1], { a: t, b: e, pointMass: null, logRatio: null, p0: a, alpha: M, weight: m };
}
function he(t) {
  return Math.abs(t) < 0.01 ? t * t * (0.5 + t * (1 / 6 + t * (1 / 24 + t * (1 / 120 + t / 720)))) : Math.expm1(t) - t;
}
function Lt(t) {
  const e = 1 / t, n = e * e;
  return 0.5 * e + n * (1 / 12 - n * (1 / 120 - n / 252));
}
function ue(t, e, n = 1) {
  const o = Math.ceil(re * n), r = Math.sqrt(ct(t)), s = -Lt(t) - gt * r, l = 2 * gt * r / (o - 1), c = new Float64Array(o), h = new Float64Array(o), M = new Float64Array(o), m = new Float64Array(o);
  let i = Number.NEGATIVE_INFINITY;
  for (let u = 0; u < o; u += 1) {
    const x = s + u * l;
    c[u] = x, h[u] = t / e * Math.exp(x), m[u] = -t * he(x), m[u] > i && (i = m[u]);
  }
  let f = 0;
  for (let u = 0; u < o; u += 1)
    M[u] = Math.exp(m[u] - i) * (u === 0 || u === o - 1 ? 0.5 : 1), f += M[u];
  for (let u = 0; u < o; u += 1) M[u] /= f;
  return { a: t, b: e, pointMass: null, logRatio: c, p0: 0, alpha: h, weight: M };
}
function Pt(t, e, n) {
  if (t.pointMass !== null) return e(t.pointMass);
  let o = t.p0 * n;
  for (let r = 0; r < t.alpha.length; r += 1) o += t.weight[r] * e(t.alpha[r]);
  return o;
}
function Me(t, e, n, o = O(e, n)) {
  if (o.pointMass !== null) {
    const c = $(t, o.pointMass);
    return { mean: U(t, o.pointMass), var: c, sd: Math.sqrt(c) };
  }
  let r = o.p0, a = o.p0, s = 0;
  for (let c = 0; c < o.alpha.length; c += 1) {
    const h = U(t, o.alpha[c]);
    r += o.weight[c] * h, a += o.weight[c] * h * h, s += o.weight[c] * $(t, o.alpha[c]);
  }
  const l = Math.max(0, s + a - r * r);
  return { mean: r, var: l, sd: Math.sqrt(l) };
}
function ft(t, e, n, o = O(e, n)) {
  const r = At(t), a = new Float64Array(t + 1), s = new Float64Array(t), l = (c, h) => {
    const M = Math.log(c);
    for (let i = 1; i <= t; i += 1) s[i - 1] = r[i] + i * M;
    const m = Z(s);
    for (let i = 1; i <= t; i += 1) a[i] += h * Math.exp(s[i - 1] - m);
  };
  if (o.pointMass !== null)
    return l(o.pointMass, 1), a;
  a[1] += o.p0;
  for (let c = 0; c < o.alpha.length; c += 1) l(o.alpha[c], o.weight[c]);
  return a;
}
function je(t, e, n) {
  const o = O(e, n);
  return { ...te(ft(t, e, n, o)), prAlphaBelow01: fe(0.1, e, n) };
}
function fe(t, e, n) {
  if (e >= Rt) return e / n < t ? 1 : 0;
  if (e > L) {
    const o = 1 / (9 * e), r = (Math.cbrt(n * t / e) - (1 - o)) / Math.sqrt(o), a = 0.5 * Mt(0.5, r * r / 2);
    return r >= 0 ? 0.5 + a : 0.5 - a;
  }
  return Gt(t, e, n);
}
function Ue(t, e, n, o = O(e, n)) {
  if (t === 1) return 1;
  const r = y(t);
  return Pt(o, (a) => Math.exp(y(a + 1) + r - y(a + t)), 1);
}
const me = 1 - 1e-4, Ct = 0.5, et = (t) => -Math.log1p(-t);
function Q(t, e, n) {
  return t <= 0 ? 1 : t >= 1 ? 0 : Math.exp(-e * Math.log1p(et(t) / n));
}
function $e(t, e) {
  return t <= 0 ? 1 : t >= 1 ? 0 : Math.exp(e * Math.log1p(-t));
}
function ze(t, e, n) {
  if (t < 0 || t > me) return Number.NaN;
  const o = et(t);
  return Math.exp(Math.log(e) + e * Math.log(n) - Math.log1p(-t) - (e + 1) * Math.log(n + o));
}
function Be(t, e, n) {
  return 1 - Q(t, e, n);
}
function Xe(t, e, n) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const o = n * Math.expm1(-Math.log1p(-t) / e);
  return -Math.expm1(-o);
}
function He(t, e, n) {
  const o = Q(t, e, n);
  return { lower: o, upper: Math.min(1, o / t) };
}
const K = 40, rt = 4e3;
function Dt(t, e, n) {
  const o = Math.log(e), r = (Math.log(n) - o) / rt;
  let a = 0;
  for (let s = 0; s <= rt; s += 1) {
    const l = Math.exp(o + s * r), c = s === 0 || s === rt ? 1 : s % 2 === 1 ? 4 : 2;
    a += c * t(l) * l;
  }
  return a * r / 3;
}
function We(t, e, n) {
  if (t >= 1) return 0;
  if (t < Ct) return Number.NaN;
  const o = (a) => Math.exp(Math.log(e) - Math.log(n + a) - e * Math.log1p(a / n) - Math.log(-Math.expm1(-a))), r = Math.exp(-e * Math.log1p(K / n));
  return Dt(o, et(t), K) + r;
}
function Ze(t, e) {
  if (t >= 1) return 0;
  if (t < Ct) return Number.NaN;
  const n = (r) => Math.exp(Math.log(e) - e * r - Math.log(-Math.expm1(-r))), o = Math.exp(-e * K);
  return Dt(n, et(t), K) + o;
}
function pe(t) {
  return 1 / (1 + t);
}
function Qe(t) {
  return 2 * (t / (t + 1)) / (t + 1) / (t + 2) / (t + 3);
}
function Ke(t, e) {
  return Pt(O(t, e), pe, 1);
}
const ge = { high: 1.5, medium: 2.5, low: 5 };
function xe(t, e) {
  return e * (t - 1);
}
function Je(t, e) {
  return xe(t, ge[e]);
}
function tn(t, e) {
  return (e * t) ** 2;
}
function Ne(t) {
  if (t <= 0) return Number.NEGATIVE_INFINITY;
  if (t >= 1) return Number.POSITIVE_INFINITY;
  const e = t - 0.5;
  if (Math.abs(e) <= 0.425) {
    const r = 0.180625 - e * e;
    return e * (((((((r * 2509.0809287301227 + 33430.57558358813) * r + 67265.7709270087) * r + 45921.95393154987) * r + 13731.69376550946) * r + 1971.5909503065513) * r + 133.14166789178438) * r + 3.3871328727963665) / (((((((r * 5226.495278852546 + 28729.085735721943) * r + 39307.89580009271) * r + 21213.794301586597) * r + 5394.196021424751) * r + 687.1870074920579) * r + 42.31333070160091) * r + 1);
  }
  let n = Math.sqrt(-Math.log(e < 0 ? t : 1 - t)), o;
  return n <= 5 ? (n -= 1.6, o = (((((((n * 7745450142783414e-19 + 0.022723844989269184) * n + 0.2417807251774506) * n + 1.2704582524523684) * n + 3.6478483247632045) * n + 5.769497221460691) * n + 4.630337846156546) * n + 1.4234371107496835) / (((((((n * 10507500716444169e-25 + 5475938084995345e-19) * n + 0.015198666563616457) * n + 0.14810397642748008) * n + 0.6897673349851) * n + 1.6763848301838038) * n + 2.053191626637759) * n + 1)) : (n -= 5, o = (((((((n * 20103343992922881e-23 + 27115555687434876e-21) * n + 0.0012426609473880784) * n + 0.026532189526576124) * n + 0.29656057182850487) * n + 1.7848265399172913) * n + 5.463784911164114) * n + 6.657904643501103) / (((((((n * 20442631033899397e-31 + 1421511758316446e-22) * n + 18463183175100548e-21) * n + 7868691311456133e-19) * n + 0.014875361290850615) * n + 0.1369298809227358) * n + 0.599832206555888) * n + 1)), e < 0 ? -o : o;
}
function en(t, e, n, o) {
  const r = Ne((1 + n) / 2), a = (e - t) / (2 * r);
  return { muK: o ?? (t + e) / 2, varK: a * a, z: r };
}
function nn(t, e, n) {
  const o = e > 1 && e < t, r = Ft(t, e), a = o && n > 0 && n < r, { alphaStar: s, minVar: l } = o ? _t(t, e) : { alphaStar: Number.NaN, minVar: Number.NaN }, c = a && n > l, h = n > e - 1;
  let M = "";
  o ? n > 0 ? a ? c || (M = `The variance is at or below ${l.toFixed(3)}, the smallest variance of K_${t} that any Gamma prior with mean ${e.toFixed(2)} can give (the point mass alpha* = ${s.toFixed(3)}). Widen the interval or lower its coverage.`) : M = `A variance of ${n.toFixed(2)} is impossible for a count on 1..${t} with mean ${e.toFixed(2)}: it must stay below (mu_K - 1)(J - mu_K) = ${r.toFixed(2)}.` : M = "The variance must be positive." : M = `The expected count must lie strictly between 1 and J = ${t}.`;
  const m = c && !h ? `The variance is at or below mu_K - 1 = ${(e - 1).toFixed(2)}, so the A1 closed-form start does not exist; TSMM starts from a projected point and still reaches a Gamma prior.` : "";
  return { meanOk: o, supportOk: a, supportUpper: r, minVar: l, alphaStar: s, feasible: c, a1Ok: h, ok: o && a && c, message: M, note: m };
}
function be(t, e, n) {
  const o = e - 1, r = n - o;
  return !(o > 0) || !(r > 0) ? { a0: Number.NaN, b0: Number.NaN, ok: !1 } : { a0: o * o / r, b0: o * Math.log(t) / r, ok: !0 };
}
function Yt(t) {
  let e = t >>> 0;
  return {
    seed: t,
    next() {
      e = e + 1831565813 >>> 0;
      let n = e;
      return n = Math.imul(n ^ n >>> 15, n | 1), n ^= n + Math.imul(n ^ n >>> 7, n | 61), ((n ^ n >>> 14) >>> 0) / 4294967296;
    }
  };
}
function lt(t) {
  let e = t.next();
  for (; e === 0; ) e = t.next();
  return e;
}
function it(t) {
  for (; ; ) {
    const e = 2 * t.next() - 1, n = 2 * t.next() - 1, o = e * e + n * n;
    if (o > 0 && o < 1) return e * Math.sqrt(-2 * Math.log(o) / o);
  }
}
function J(t, e) {
  if (e < 1) return J(t, e + 1) * Math.pow(lt(t), 1 / e);
  const n = e - 1 / 3, o = 1 / Math.sqrt(9 * n);
  for (; ; ) {
    let r, a;
    do
      r = it(t), a = 1 + o * r;
    while (a <= 0);
    a = a * a * a;
    const s = lt(t);
    if (s < 1 - 0.0331 * r * r * r * r || Math.log(s) < 0.5 * r * r + n * (1 - a + Math.log(a))) return n * a;
  }
}
function qt(t, e) {
  return e < 1 ? qt(t, e + 1) + Math.log(lt(t)) / e : Math.log(J(t, e));
}
function on(t, e, n) {
  const o = J(t, e), r = J(t, n);
  return o / (o + r);
}
function Ie(t, e) {
  return -Math.expm1(Math.log1p(-t.next()) / e);
}
function rn(t, e) {
  const n = Array.from(e, (s) => qt(t, s)), o = Math.max(...n), r = n.map((s) => Math.exp(s - o)), a = r.reduce((s, l) => s + l, 0);
  return r.map((s) => s / a);
}
const de = 1e-3, Te = 1e5;
function an(t, e, n = de) {
  const o = [], r = [];
  let a = 1;
  for (; a >= n && o.length < Te; ) {
    const s = Ie(t, e);
    o.push(s), r.push(a * s), a *= 1 - s;
  }
  return { alpha: e, v: o, w: r, rest: a };
}
class Ae {
  constructor(e, n) {
    Y(this, "alpha");
    Y(this, "counts", []);
    Y(this, "n", 0);
    Y(this, "rng");
    this.alpha = e, this.rng = n;
  }
  /** probabilities for the next customer (existing tables, then new) */
  nextProbs() {
    const e = this.alpha + this.n;
    return [...this.counts.map((n) => n / e), this.alpha / e];
  }
  seat() {
    const e = this.nextProbs(), n = this.rng.next();
    let o = 0, r = e.length - 1;
    for (let s = 0; s < e.length; s += 1)
      if (o += e[s], n < o) {
        r = s;
        break;
      }
    const a = r === this.counts.length;
    return a ? this.counts.push(1) : this.counts[r] += 1, this.n += 1, { n: this.n, table: r, isNew: a, probs: e };
  }
  /** number of occupied tables K_n */
  get tables() {
    return this.counts.length;
  }
}
function sn(t, e, n) {
  const o = new Ae(e, t);
  for (let r = 0; r < n; r += 1) o.seat();
  return o.tables;
}
const we = Math.log(2 * Math.PI);
function jt(t, e, n, o, r) {
  const a = t - n, s = e - o;
  return -we - Math.log(r) - (a * a + s * s) / (2 * r);
}
function Ee(t, e, n, o) {
  const r = 1 / (1 / (t.sigma0 * t.sigma0) + e.n / (t.sigma * t.sigma)), a = r / (t.sigma * t.sigma);
  return jt(n, o, a * e.sx, a * e.sy, t.sigma * t.sigma + r);
}
function cn(t, e) {
  const n = Yt(e.seed), o = t.length, r = {
    points: t,
    z: new Int32Array(o),
    clusters: [],
    alpha: e.alpha,
    sigma: e.sigma,
    sigma0: e.sigma0,
    rng: n,
    sweeps: 0,
    trace: [],
    nextId: 0
  }, a = e.init === "one" ? 1 : e.init === "singletons" ? o : Math.max(1, Math.min(o, e.kInit ?? 10));
  for (let s = 0; s < a; s += 1) r.clusters.push({ id: r.nextId++, n: 0, sx: 0, sy: 0 });
  for (let s = 0; s < o; s += 1) {
    const l = e.init === "one" ? 0 : e.init === "singletons" ? s : Math.floor(n.next() * a);
    r.z[s] = l, r.clusters[l].n += 1, r.clusters[l].sx += t[s].x, r.clusters[l].sy += t[s].y;
  }
  return _e(r), r.trace.push(r.clusters.length), r;
}
function _e(t) {
  const e = new Int32Array(t.clusters.length).fill(-1), n = [];
  t.clusters.forEach((o, r) => {
    o.n > 0 && (e[r] = n.length, n.push(o));
  });
  for (let o = 0; o < t.z.length; o += 1) t.z[o] = e[t.z[o]];
  t.clusters = n;
}
function Fe(t, e) {
  const n = t.points[e], o = t.z[e], r = t.clusters[o];
  if (r.n -= 1, r.sx -= n.x, r.sy -= n.y, r.n === 0) {
    const b = t.clusters.length - 1;
    if (o !== b) {
      t.clusters[o] = t.clusters[b];
      for (let T = 0; T < t.z.length; T += 1) t.z[T] === b && (t.z[T] = o);
    }
    t.clusters.pop();
  }
  const a = [], s = [];
  for (const b of t.clusters)
    s.push(Math.log(b.n)), a.push(Math.log(b.n) + Ee(t, b, n.x, n.y));
  s.push(Math.log(t.alpha)), a.push(Math.log(t.alpha) + jt(n.x, n.y, 0, 0, t.sigma * t.sigma + t.sigma0 * t.sigma0));
  const l = Z(a), c = a.map((b) => Math.exp(b - l)), h = Z(s), M = s.map((b) => Math.exp(b - h)), m = t.rng.next();
  let i = 0, f = c.length - 1;
  for (let b = 0; b < c.length; b += 1)
    if (i += c[b], m < i) {
      f = b;
      break;
    }
  const u = [...t.clusters.map((b) => b.id), t.nextId];
  f === t.clusters.length && t.clusters.push({ id: t.nextId++, n: 0, sx: 0, sy: 0 });
  const x = t.clusters[f];
  return x.n += 1, x.sx += n.x, x.sy += n.y, t.z[e] = f, { i: e, ids: u, probs: c, prior: M, chosen: f };
}
function ln(t) {
  for (let e = 0; e < t.points.length; e += 1) Fe(t, e);
  return t.sweeps += 1, t.trace.push(t.clusters.length), t.clusters.length;
}
function hn(t, e) {
  t.alpha = e;
}
function un(t) {
  return t.clusters.map((e) => {
    const o = 1 / (1 / (t.sigma0 * t.sigma0) + e.n / (t.sigma * t.sigma)) / (t.sigma * t.sigma);
    return { x: o * e.sx, y: o * e.sy };
  });
}
const xt = [
  { x: -3, y: 3 },
  { x: 3, y: 3 },
  { x: 3, y: -3 },
  { x: -3, y: -3 }
], at = [5, 3, 2, 1].map((t) => t / 11);
function Mn(t, e = 100, n = 1) {
  const o = Yt(t), r = [], a = new Int32Array(e);
  for (let s = 0; s < e; s += 1) {
    const l = o.next();
    let c = 0, h = at.length - 1;
    for (let M = 0; M < at.length; M += 1)
      if (c += at[M], l < c) {
        h = M;
        break;
      }
    a[s] = h, r.push({ x: xt[h].x + n * it(o), y: xt[h].y + n * it(o) });
  }
  return { points: r, truth: a };
}
const W = { t1: 0.5, p1: 0.25, t2: 0.9, p2: 0.05 };
function fn(t = W.p1, e = W.p2, n = W.t1, o = W.t2) {
  const r = -Math.log1p(-n), a = -Math.log1p(-o), s = Math.log(t) / Math.log(e), l = (f) => {
    const u = Math.exp(f);
    return Math.log(u / (u + r)) / Math.log(u / (u + a)) - s;
  };
  let c = -20, h = 20, M = 0;
  for (; M < 200 && h - c > 1e-14; M += 1) {
    const f = (c + h) / 2;
    l(f) > 0 ? c = f : h = f;
  }
  const m = Math.exp((c + h) / 2), i = Math.log(t) / Math.log(m / (m + r));
  return { a: i, b: m, converged: h - c <= 1e-12, iterations: M, achieved: [Q(n, i, m), Q(o, i, m)] };
}
function ve(t, e, n, o, r) {
  let a = [e, [e[0] + n, e[1]], [e[0], e[1] + n]].map((l) => ({ x: l, v: t(l) })), s = 0;
  for (; s < r; s += 1) {
    a.sort((f, u) => f.v - u.v);
    const [l, c, h] = a;
    if (Math.abs(h.v - l.v) < o && Math.hypot(h.x[0] - l.x[0], h.x[1] - l.x[1]) < 1e-7) break;
    const M = [(l.x[0] + c.x[0]) / 2, (l.x[1] + c.x[1]) / 2], m = (f) => [M[0] + f * (h.x[0] - M[0]), M[1] + f * (h.x[1] - M[1])], i = { x: m(-1), v: 0 };
    if (i.v = t(i.x), i.v < l.v) {
      const f = { x: m(-2), v: 0 };
      f.v = t(f.x), a[2] = f.v < i.v ? f : i;
    } else if (i.v < c.v)
      a[2] = i;
    else {
      const f = { x: m(i.v < h.v ? -0.5 : 0.5), v: 0 };
      f.v = t(f.x), f.v < Math.min(i.v, h.v) ? a[2] = f : a = a.map((u, x) => x === 0 ? u : { x: [(u.x[0] + l.x[0]) / 2, (u.x[1] + l.x[1]) / 2], v: t([(u.x[0] + l.x[0]) / 2, (u.x[1] + l.x[1]) / 2]) });
    }
  }
  return a.sort((l, c) => l.v - c.v), { x: a[0].x, v: a[0].v, iterations: s, converged: s < r };
}
const Ut = 0.25, V = { 10: [0.525, 0.046], 50: [0.467, 7e-3] }, v = 15, Nt = 2;
function ye(t) {
  const e = Object.keys(V).map(Number).sort((h, M) => h - M);
  if (V[t]) return V[t];
  if (t <= e[0]) return V[e[0]];
  if (t >= e[e.length - 1]) return V[e[e.length - 1]];
  const n = e.find((h) => h > t), o = e[e.indexOf(n) - 1], r = (Math.log(t) - Math.log(o)) / (Math.log(n) - Math.log(o)), [a, s] = V[o], [l, c] = V[n];
  return [Math.exp((1 - r) * Math.log(a) + r * Math.log(l)), Math.exp((1 - r) * Math.log(s) + r * Math.log(c))];
}
function bt(t, e, n, o, r = 1) {
  const a = ft(t, n, o, O(n, o, r));
  let s = 0, l = 0;
  for (let c = 1; c <= e; c += 1)
    s += 1 / e * Math.log(1 / e / Math.max(a[c], 1e-300)), l += a[c];
  return { kl: s, leak: 1 - l };
}
function mn(t, e = {}) {
  const n = e.J ?? t, o = e.muK !== void 0 ? Math.min(2 * e.muK - 1, n) : Math.min(t, n), r = e.start ?? (e.muK !== void 0 ? [e.muK / 2, e.muK / 2] : ye(t)), s = ve((M) => {
    const m = Math.max(-v, Math.min(v, M[0])), i = Math.max(-v, Math.min(v, M[1]));
    return bt(n, o, Math.exp(m), Math.exp(i), Ut).kl;
  }, [Math.log(r[0]), Math.log(r[1])], 0.1, 1e-11, 400), l = Math.exp(Math.max(-v, Math.min(v, s.x[0]))), c = Math.exp(Math.max(-v, Math.min(v, s.x[1]))), h = bt(n, o, l, c);
  return { a: l, b: c, kl: h.kl, leak: h.leak, top: o, J: n, converged: s.converged, iterations: s.iterations };
}
const Se = { pOne: 0.34, pTail: 0.15 }, Oe = [0.5, 0.5], ke = 0.033, Ve = (t) => Math.ceil(2 * Math.log(t));
function ht(t, e, n, o = 1) {
  const r = ft(t, e, n, O(e, n, o)), a = Ve(t);
  let s = 0;
  for (let l = 1; l < a; l += 1) s += r[l];
  return { pOne: r[1], pTail: 1 - s, q: a };
}
function pn(t, e = Se, n) {
  const o = (i) => Math.max(-v, Math.min(v, i));
  let r = (n ?? Oe).map((i) => o(Math.log(i)));
  const a = (i) => {
    const f = ht(t, Math.exp(i[0]), Math.exp(i[1]), Ut);
    return [f.pOne - e.pOne, f.pTail - e.pTail];
  };
  let s = a(r), l = 0;
  const c = 1e-5;
  for (; l < 60 && Math.hypot(s[0], s[1]) > 1e-11; l += 1) {
    const i = [a([r[0] + c, r[1]]), a([r[0] - c, r[1]])], f = [a([r[0], r[1] + c]), a([r[0], r[1] - c])], u = (i[0][0] - i[1][0]) / (2 * c), x = (i[0][1] - i[1][1]) / (2 * c), b = (f[0][0] - f[1][0]) / (2 * c), T = (f[0][1] - f[1][1]) / (2 * c), _ = u * T - b * x;
    if (!Number.isFinite(_) || Math.abs(_) < 1e-300) break;
    let g = [(T * s[0] - b * s[1]) / _, (-x * s[0] + u * s[1]) / _];
    const A = Math.hypot(g[0], g[1]);
    A > Nt && (g = g.map((P) => P * Nt / A));
    let p = 1, N = [o(r[0] - g[0]), o(r[1] - g[1])], E = a(N);
    for (; Math.hypot(E[0], E[1]) > Math.hypot(s[0], s[1]) && p > 1 / 64; )
      p /= 2, N = [o(r[0] - p * g[0]), o(r[1] - p * g[1])], E = a(N);
    r = N, s = E;
  }
  const h = Math.exp(r[0]), M = Math.exp(r[1]), m = ht(t, h, M);
  return { a: h, b: M, pOne: m.pOne, pTail: m.pTail, q: m.q, converged: Math.hypot(m.pOne - e.pOne, m.pTail - e.pTail) <= 1e-9, iterations: l };
}
function gn(t) {
  const e = Math.exp(-ke * t), n = ht(t, e, e);
  return { a: e, b: e, ...n, mean: Me(t, e, e).mean };
}
const xn = (t) => (t - 1) * (t - 1) / 4, j = 28, tt = 40, It = 2, Ge = 1e-10, Re = 60, Le = 60;
function ut(t, e, n) {
  const o = O(e, n);
  if (o.pointMass !== null) {
    const g = o.pointMass;
    return { M1: U(t, g), V: $(t, g), jac: null };
  }
  const r = o.alpha.length, a = new Float64Array(r), s = new Float64Array(r);
  if (o.logRatio !== null) {
    const g = Lt(e);
    let A = 0, p = 0;
    for (let N = 0; N < r; N += 1) {
      const E = o.logRatio[N];
      a[N] = e * (E + g), s[N] = -e * Math.expm1(E), A += o.weight[N] * a[N], p += o.weight[N] * s[N];
    }
    for (let N = 0; N < r; N += 1)
      a[N] -= A, s[N] -= p;
  } else {
    const g = Math.log(n) - st(e);
    for (let A = 0; A < r; A += 1)
      a[A] = e * (g + Math.log(o.alpha[A])), s[A] = e - n * o.alpha[A];
  }
  let l = o.p0, c = o.p0, h = 0, M = 0, m = 0, i = 0, f = 0, u = 0, x = 0;
  for (let g = 0; g < r; g += 1) {
    const A = o.alpha[g], p = o.weight[g], N = U(t, A), E = $(t, A);
    l += p * N, c += p * N * N, h += p * E, M += p * N * a[g], m += p * N * N * a[g], i += p * E * a[g], f += p * N * s[g], u += p * N * N * s[g], x += p * E * s[g];
  }
  const b = l, T = h + c - l * l, _ = [
    [M, f],
    [i + m - 2 * l * M, x + u - 2 * l * f]
  ];
  return { M1: b, V: T, jac: _ };
}
function $t(t, e, n, o) {
  let r = o, a = ut(t, Math.exp(n), Math.exp(r));
  for (let s = 0; s < Le && a.jac; s += 1) {
    const l = a.M1 - e;
    if (Math.abs(l) <= 1e-13 * (1 + e)) break;
    const c = a.jac[0][1];
    let h = c < 0 ? -l / c : Math.sign(l);
    h = Math.max(-1, Math.min(1, h)), r = Math.max(-tt, Math.min(tt, r + h)), a = ut(t, Math.exp(n), Math.exp(r));
  }
  return { lb: r, m: a };
}
function dt(t, e, n, o, r, a, s) {
  const l = Math.log(n - r), c = [];
  let h = a - Math.log(o);
  const M = (u) => {
    const x = $t(t, e, u, h);
    h = x.lb;
    const b = x.m.V - r, T = [x.m.M1 - e, x.m.V - n], _ = Math.hypot(T[0], T[1]);
    return c.push({ iter: c.length, a: Math.exp(u), b: Math.exp(x.lb), M1: x.m.M1, V: x.m.V, residual: _, residMean: T[0], residVar: T[1], step: Number.NaN }), { la: u, lb: x.lb, M1: x.m.M1, V: x.m.V, F: T, res: _, g: b > 0 ? Math.log(b) - l : Number.NEGATIVE_INFINITY };
  };
  let m = M(a);
  if (m.g < 0) return { best: m, trace: c };
  let i = M(Math.min(j, a + Math.max(1, m.g)));
  for (; i.g > 0 && i.la < j; ) i = M(Math.min(j, i.la + Math.max(1, i.g)));
  let f = i.res < m.res ? i : m;
  if (i.g > 0) return { best: f, trace: c };
  for (let u = 0; u < Re && f.res > s / 10; u += 1) {
    let x = i.la - i.g * (i.la - m.la) / (i.g - m.g);
    (!(x > m.la && x < i.la) || !Number.isFinite(x)) && (x = (m.la + i.la) / 2);
    const b = M(x);
    if (b.res < f.res && (f = b), b.g > 0 ? m = b : i = b, i.la - m.la < 1e-12) break;
  }
  return { best: f, trace: c };
}
function Nn(t, e, n, o = {}) {
  const r = o.maxIter ?? 50, a = o.tolF ?? 1e-6, s = Ft(t, e), l = { a: Number.NaN, b: Number.NaN, iter: 0, resid: [Number.NaN, Number.NaN], residual: Number.NaN, trace: [], achieved: { M1: Number.NaN, V: Number.NaN }, method: "none" }, c = { a0: Number.NaN, b0: Number.NaN, projected: !1 };
  if (!(e > 1 && e < t) || !(n > 0 && n < s))
    return { ...l, status: "support", alphaStar: Number.NaN, minVar: Number.NaN, supportUpper: s, start: c };
  const { alphaStar: h, minVar: M } = _t(t, e);
  if (n <= M)
    return { ...l, status: "infeasible", alphaStar: h, minVar: M, supportUpper: s, start: c };
  const m = (I, d, w, C, z, G, S, B) => {
    const F = [w - e, C - n], R = Math.hypot(F[0], F[1]), D = R <= a ? I > L ? "point-mass" : "ok" : "approximate";
    return { a: I, b: d, iter: G, resid: F, residual: R, status: D, trace: z, alphaStar: h, minVar: M, supportUpper: s, achieved: { M1: w, V: C }, method: S, start: B };
  }, i = Math.log(L);
  if (n < 1.05 * M) {
    const I = $t(t, e, i, i - Math.log(h));
    if (n < I.m.V) {
      const d = dt(t, e, n, h, M, i, a), w = d.best;
      return m(Math.exp(w.la), Math.exp(w.lb), w.M1, w.V, d.trace, d.trace.length - 1, "profile", { a0: L, b0: Math.exp(I.lb), projected: !1 });
    }
  }
  let f = !1, u, x;
  if (o.start) [u, x] = o.start;
  else {
    const I = be(t, e, n);
    if (I.ok && n - (e - 1) >= 0.25 * (e - 1)) ({ a0: u, b0: x } = I);
    else {
      f = !0;
      const d = e - 1, w = Math.max(n - d, 0.25 * d);
      u = d * d / w, x = d * Math.log(t) / w;
    }
  }
  const b = { a0: u, b0: x, projected: f }, T = (I) => Math.max(-j, Math.min(j, I)), _ = (I) => Math.max(-tt, Math.min(tt, I));
  let g = [T(Math.log(u)), _(Math.log(x))];
  const A = (I) => {
    const d = ut(t, Math.exp(I[0]), Math.exp(I[1])), w = [d.M1 - e, d.V - n];
    return { ...d, F: w, r: Math.hypot(w[0], w[1]) };
  };
  let p = A(g);
  const N = [];
  let E = 0;
  for (; E < r; E += 1) {
    const I = { iter: E, a: Math.exp(g[0]), b: Math.exp(g[1]), M1: p.M1, V: p.V, residual: p.r, residMean: p.F[0], residVar: p.F[1], step: Number.NaN };
    if (N.push(I), p.r < Ge || !p.jac) break;
    const [[d, w], [C, z]] = p.jac, G = d * z - w * C;
    if (!Number.isFinite(G) || Math.abs(G) < 1e-300) break;
    let S = [-(z * p.F[0] - w * p.F[1]) / G, -(-C * p.F[0] + d * p.F[1]) / G];
    const B = Math.hypot(S[0], S[1]);
    B > It && (S = S.map((X) => X * It / B));
    let F = 1, R = null, D = g;
    for (; F > 1 / 1024; ) {
      D = [T(g[0] + F * S[0]), _(g[1] + F * S[1])];
      const X = A(D);
      if (X.r < p.r * (1 - 1e-4 * F)) {
        R = X;
        break;
      }
      F /= 2;
    }
    if (!R) break;
    I.step = F, g = D, p = R;
  }
  (N.length === 0 || N[N.length - 1].a !== Math.exp(g[0])) && N.push({ iter: E, a: Math.exp(g[0]), b: Math.exp(g[1]), M1: p.M1, V: p.V, residual: p.r, residMean: p.F[0], residVar: p.F[1], step: Number.NaN });
  const P = N.filter((I) => Number.isFinite(I.step)).length;
  if (p.r <= a) return m(Math.exp(g[0]), Math.exp(g[1]), p.M1, p.V, N, P, "newton", b);
  if (Math.exp(g[0]) >= L / 100) {
    const I = dt(t, e, n, h, M, Math.min(g[0], i), a);
    if (I.best.res < p.r) {
      const d = I.best;
      return m(Math.exp(d.la), Math.exp(d.lb), d.M1, d.V, [...N, ...I.trace], P + I.trace.length, "profile", b);
    }
  }
  return { a: Math.exp(g[0]), b: Math.exp(g[1]), iter: P, resid: p.F, residual: p.r, status: "no-convergence", trace: N, alphaStar: h, minVar: M, supportUpper: s, achieved: { M1: p.M1, V: p.V }, method: "newton", start: b };
}
const bn = "0.2.0";
export {
  ae as ALPHA_FLOOR,
  Ae as Crp,
  Rt as DEGENERATE_A,
  xt as DEMO_MEANS,
  at as DEMO_WEIGHTS,
  V as DORAZIO_TABLE,
  bn as DP_CORE_VERSION,
  Wt as FINITE_SUM_J_MAX,
  de as GEM_EPS,
  H as LIVE_J_MAX,
  Ct as MAJORITY_T,
  le as MIN_NODES,
  ie as NODE_SPACING,
  L as POINT_MASS_A,
  ke as SCAL_SHORTCUT_RATE,
  Se as SCAL_TARGETS,
  Ut as SEARCH_NODE_FACTOR,
  W as SSI_TARGETS,
  ge as VIF_BY_CONFIDENCE,
  me as W_DENSITY_MAX,
  be as a1Init,
  O as alphaGrid,
  nn as checkTarget,
  un as clusterMeans,
  U as condMean,
  wt as condMeanDigamma,
  Qt as condMeanSum,
  De as condPmf,
  Ye as condPmfConvolution,
  $ as condVar,
  Jt as condVarDigamma,
  Kt as condVarSum,
  Je as confidenceToVariance,
  cn as createGibbs,
  tn as cvToVariance,
  Mn as demoData,
  ee as dgammaLog,
  st as digamma,
  bt as doroDivergence,
  mn as doroKL,
  Mt as gammp,
  Vt as gammq,
  en as intervalToMoments,
  y as lgamma,
  Ht as logAddExp,
  Ce as logRising,
  At as logStirlingRow,
  Z as logSumExp,
  qt as lrgamma,
  Yt as makeRng,
  xn as maxCountVariance,
  Ke as meanRho,
  pe as meanRhoGivenAlpha,
  Pt as mixExpect,
  Me as mixMoments,
  Ue as mixPK1,
  ft as mixPmf,
  je as mixSummary,
  Gt as pgamma,
  qe as pgammaUpper,
  ot as pmfQuantile,
  te as pmfSummary,
  fe as prAlphaBelow,
  _t as profileBound,
  pt as qgamma,
  Ne as qnorm,
  on as rbeta,
  Ie as rbeta1,
  sn as rcrpTables,
  rn as rdirichlet,
  J as rgamma,
  an as rgem,
  it as rnorm,
  gn as scalShortcut,
  pn as scalSolve,
  Ve as scalTailK,
  ht as scalTails,
  hn as setAlpha,
  fn as ssiSolve,
  Fe as stepPoint,
  Ft as supportUpperVariance,
  ln as sweep,
  ct as trigamma,
  Nn as tsmmFit,
  ut as tsmmMoments,
  Qe as varRhoGivenAlpha,
  xe as vifToVariance,
  He as wmaxBounds,
  We as wmaxTail,
  Ze as wmaxTailGivenAlpha,
  Be as wsbCdf,
  ze as wsbDensity,
  Xe as wsbQuantile,
  Q as wsbTail,
  $e as wsbTailGivenAlpha
};
