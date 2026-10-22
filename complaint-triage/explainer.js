/* Complaint Triage, animated: one complaint moving through the system.
   The same eight phases drive both modes: "watch" plays them in a loop, "step" runs one at a time.
   Plain JS, no libraries. Everything runs on a clock that can pause and change speed. */
(function () {
  'use strict';
  var fig = document.getElementById('ct-fig');
  if (!fig) return;
  var svg = fig.querySelector('svg');
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return svg.querySelector('#' + id); }

  /* ---- a clock that pauses: simulated ms, advanced only while playing ---- */
  var playing = false, speed = 1, simT = 0, lastReal = 0, gen = 0;
  var waits = [], dots = [];
  function frame(now) {
    var dt = lastReal ? Math.min(now - lastReal, 100) : 0;
    lastReal = now;
    if (playing) simT += dt * speed;
    for (var i = waits.length - 1; i >= 0; i--) {
      var w = waits[i];
      if (w.gen !== gen) { waits.splice(i, 1); continue; }
      if (simT >= w.at) { waits.splice(i, 1); w.resolve(); }
    }
    for (var j = dots.length - 1; j >= 0; j--) {
      var d = dots[j];
      if (d.gen !== gen) { d.el.remove(); dots.splice(j, 1); continue; }
      var p = d.dur ? Math.min(1, (simT - d.start) / d.dur) : 1;
      var pt = d.path.getPointAtLength((d.reverse ? 1 - p : p) * d.len);
      d.el.setAttribute('cx', pt.x); d.el.setAttribute('cy', pt.y);
      if (p >= 1) { d.el.remove(); dots.splice(j, 1); d.resolve(); }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function wait(ms) {
    var g = gen;
    return new Promise(function (r) { waits.push({ at: simT + (reduce ? 0 : ms), resolve: r, gen: g }); });
  }
  /* one dot = one message travelling along a link */
  function dot(id, kind, opts) {
    opts = opts || {};
    var path = $(id), len = path.getTotalLength(), g = gen;
    var el = document.createElementNS(NS, 'circle');
    el.setAttribute('r', 6.5);
    el.setAttribute('class', 'dot k-' + kind);
    var p0 = path.getPointAtLength(opts.reverse ? len : 0);
    el.setAttribute('cx', p0.x); el.setAttribute('cy', p0.y);
    $('dots').appendChild(el);
    return new Promise(function (r) {
      dots.push({ path: path, len: len, start: simT, dur: reduce ? 0 : (opts.dur || 700), el: el, resolve: r, reverse: !!opts.reverse, gen: g });
    });
  }
  function all(list) { return Promise.all(list); }

  /* ---- what the picture shows ---- */
  function t(name, text) {
    var els = svg.querySelectorAll('[data-t="' + name + '"]');
    for (var i = 0; i < els.length; i++) els[i].textContent = text;
  }
  function fill(n) {
    var s = svg.querySelectorAll('#queue .slot');
    for (var i = 0; i < s.length; i++) s[i].classList.toggle('on', i < n);
  }
  function flash(id, ms) {
    var e = $(id);
    if (!e) return;
    e.classList.add('hot');
    wait(ms || 800).then(function () { e.classList.remove('hot'); });
  }
  async function type(name, text) {
    for (var i = 1; i <= text.length; i++) { t(name, text.slice(0, i)); await wait(38); }
  }
  function apply(state) {
    if (!state) return;
    if (state.t) for (var k in state.t) t(k, state.t[k]);
    if ('fill' in state) fill(state.fill);
  }
  var START = { fill: 0, t: {
    f1: '', f2: '', f3: '', calls: '0', src: '0', cost: '$0.000', time: '0 s',
    rd: 'words → fields', ag: 'plan → act → check', steps: 'steps 0/8', cap: '$0.000 / $0.05',
    vf: 'checks sources', ticks: '', rv1: '', rv2: '', rv3: '', rvs: '',
    gs: 'your labels', ev: 'CI, every change', pv: 'version 1'
  } };

  /* ---- the eight phases: one idea each ---- */
  var P = [
    { title: 'A customer files a complaint', layer: null,
      text: 'Someone fills in a complaint form: the device, what happened, and how the patient is. In this project most complaints are public FDA reports, replayed as if they arrived today; a small form in the review app lets you type one in for a demo.',
      on: ['web', 'l-web-q', 'queue'],
      run: async function () {
        await type('f1', 'Insulin pump'); await type('f2', 'Stopped mid-dose'); await type('f3', 'Treated in hospital');
        flash('submit'); await wait(350); await dot('l-web-q', 'people'); fill(1); flash('queue');
      },
      end: { fill: 1, t: { f1: 'Insulin pump', f2: 'Stopped mid-dose', f3: 'Treated in hospital' } } },

    { title: 'It waits safely in a queue', layer: null,
      text: 'The form becomes a message in an Azure Service Bus queue. If a worker crashes, the message waits and is tried again. After too many failures it moves aside to a dead-letter queue, so nothing is lost.',
      on: ['queue', 'l-q-rd', 'reader'],
      run: async function () { await wait(900); fill(0); await dot('l-q-rd', 'azure'); flash('reader'); },
      end: { fill: 0 } },

    { title: 'The reader turns words into fields', layer: 'prompt',
      text: 'A small, cheap model reads the story and fills a strict form: device, problem, patient harm, software-related? Every AI call goes through one gateway that picks the model, caches answers and logs the cost.',
      on: ['reader', 'l-rd-gw', 'gateway', 'l-gw-fd', 'foundry', 'counters'],
      run: async function () {
        await dot('l-rd-gw', 'ai'); flash('gateway'); await dot('l-gw-fd', 'ai'); flash('foundry'); await wait(350);
        await dot('l-gw-fd', 'ai', { reverse: true }); await dot('l-rd-gw', 'ai', { reverse: true });
        t('rd', '3 fields ✓'); t('calls', '1'); t('cost', '$0.001'); t('time', '4 s'); flash('reader');
      },
      end: { t: { rd: '3 fields ✓', calls: '1', cost: '$0.001', time: '4 s' } } },

    { title: 'The agent looks things up (RAG)', layer: 'context',
      text: "The agent searches public evidence: similar past reports, recalls and FDA guidance. It finds passages by keywords and by meaning, and it's told to answer only from what it found; the verifier later checks that it did. That's retrieval-augmented generation (RAG).",
      on: ['l-rd-ag', 'agent', 'l-ag-mcp', 'mcp', 'l-mcp-s1', 'l-mcp-s2', 'l-mcp-s3', 's1', 's2', 's3', 'counters'],
      run: async function () {
        await dot('l-rd-ag', 'ai'); flash('agent'); await dot('l-ag-mcp', 'guard'); flash('mcp');
        await all([dot('l-mcp-s1', 'know'), dot('l-mcp-s2', 'know'), dot('l-mcp-s3', 'know')]);
        flash('s1'); flash('s2'); flash('s3'); await wait(400);
        await all([dot('l-mcp-s1', 'know', { reverse: true }), dot('l-mcp-s2', 'know', { reverse: true }), dot('l-mcp-s3', 'know', { reverse: true })]);
        await dot('l-ag-mcp', 'guard', { reverse: true }); t('src', '3'); t('time', '15 s');
      },
      end: { t: { src: '3', time: '15 s' } } },

    { title: 'The harness keeps it in bounds', layer: 'harness',
      text: "The code around the model is the harness. The tools are read-only, there's a limit on steps and on cost per complaint, and failed calls are retried. Then the agent drafts the record: the answers, the reason, and a source for every claim.",
      on: ['harness', 'agent', 'mcp', 'meter', 'l-ag-gw', 'gateway', 'l-gw-fd', 'foundry', 'counters'],
      run: async function () {
        t('steps', 'steps 1/8'); flash('meter');
        await dot('l-ag-gw', 'ai'); await dot('l-gw-fd', 'ai'); flash('foundry'); await wait(250);
        await dot('l-gw-fd', 'ai', { reverse: true }); await dot('l-ag-gw', 'ai', { reverse: true });
        t('steps', 'steps 4/8'); t('cap', '$0.003 / $0.05'); t('calls', '4'); t('cost', '$0.003'); t('time', '27 s');
        flash('meter'); t('ag', 'draft ready'); flash('agent');
      },
      end: { t: { steps: 'steps 4/8', cap: '$0.003 / $0.05', calls: '4', cost: '$0.003', time: '27 s', ag: 'draft ready' } } },

    { title: 'The verifier checks every source', layer: 'harness',
      text: "An independent check: does each cited passage really say what the draft claims? Here one doesn't, so the agent gets one retry with the reason. A second failure would send the case to a person marked “not verified”.",
      on: ['agent', 'l-ag-vf', 'verifier', 'l-vf-ag', 'retry', 'counters'],
      run: async function () {
        await dot('l-ag-vf', 'ai'); flash('verifier');
        t('ticks', '✓'); await wait(300); t('ticks', '✓ ✓'); await wait(300); t('ticks', '✓ ✓ ✗'); t('vf', '1 source fails');
        await wait(600); await dot('l-vf-ag', 'guard'); flash('agent'); t('ag', 'fixes 1 citation'); await wait(500);
        await dot('l-ag-vf', 'ai'); t('ticks', '✓ ✓ ✓'); t('vf', 'all sources hold'); flash('verifier');
        t('ag', 'draft ready'); t('calls', '6'); t('cost', '$0.004'); t('time', '36 s');
      },
      end: { t: { ticks: '✓ ✓ ✓', vf: 'all sources hold', ag: 'draft ready', calls: '6', cost: '$0.004', time: '36 s' } } },

    { title: 'A person approves or edits', layer: null,
      text: 'The reviewer gets a drafted, cited record instead of a blank page. They approve it or edit it. Nothing is closed without a person.',
      on: ['l-vf-rv', 'review'],
      run: async function () {
        await dot('l-vf-rv', 'guard'); flash('review');
        t('rv1', 'Adverse event: Yes'); await wait(300); t('rv2', 'Reportable: likely'); await wait(300);
        t('rv3', 'Sources: 3 ✓'); await wait(700); flash('approve'); t('rvs', 'Edited, then approved'); t('time', '41 s');
      },
      end: { t: { rv1: 'Adverse event: Yes', rv2: 'Reportable: likely', rv3: 'Sources: 3 ✓', rvs: 'Edited, then approved', time: '41 s' } } },

    { title: 'Every correction improves the next version', layer: 'loop',
      text: 'An edit becomes a candidate test case, tagged with its cause; once reviewed it joins the golden set. Any change to prompts or settings must pass the eval gate in CI before it ships. A nightly loop proposes one improvement at a time as a pull request, and a person decides.',
      on: ['review', 'l-rv-gs', 'golden', 'l-gs-ev', 'eval', 'l-ev-pr', 'prompts', 'l-pr-gw', 'nextv', 'gateway', 'loopgrp'],
      run: async function () {
        await dot('l-rv-gs', 'loop'); flash('golden'); t('gs', '+1 test case');
        await dot('l-gs-ev', 'loop'); flash('eval'); await wait(300); t('ev', 'passed ✓');
        await dot('l-ev-pr', 'loop'); t('pv', 'version 2'); flash('prompts');
        await dot('l-pr-gw', 'loop'); flash('gateway');
      },
      end: { t: { gs: '+1 test case', ev: 'passed ✓', pv: 'version 2' } } }
  ];

  /* ---- the words under the picture, the layer strip, focus ---- */
  var elNo = document.getElementById('ct-stepno'), elLayer = document.getElementById('ct-layer');
  var elTitle = document.getElementById('ct-title'), elText = document.getElementById('ct-text');
  var say = document.getElementById('ct-say');
  var layers = document.querySelectorAll('.ct-layers li');
  var pips = document.getElementById('ct-pips');
  var LAYER = { prompt: 'Prompt layer', context: 'Context layer', harness: 'Harness layer', loop: 'Loop layer' };
  P.forEach(function (_, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-label', 'Step ' + (i + 1)); b.title = P[i].title;
    b.addEventListener('click', function () { auto = false; playing = true; runFrom(i); });
    pips.appendChild(b);
  });
  var cur = 0;
  function show(i) {
    cur = i;
    var ph = P[i];
    elNo.textContent = 'Step ' + (i + 1) + ' of ' + P.length;
    elLayer.textContent = ph.layer ? LAYER[ph.layer] : '';
    elLayer.hidden = !ph.layer;
    elTitle.textContent = ph.title; elText.textContent = ph.text;
    for (var k = 0; k < layers.length; k++) layers[k].classList.toggle('on', layers[k].dataset.l === ph.layer);
    var on = {}; ph.on.forEach(function (id) { on[id] = true; });
    var nodes = svg.querySelectorAll('.n');
    for (var n = 0; n < nodes.length; n++) nodes[n].classList.toggle('dim', !on[nodes[n].id]);
    var pb = pips.children;
    for (var q = 0; q < pb.length; q++) { pb[q].classList.toggle('on', q === i); pb[q].classList.toggle('done', q < i); }
    follow(ph.on);
    syncButtons();
  }
  /* on a narrow screen the diagram scrolls sideways: bring the lit-up part into view */
  var sc = fig.querySelector('.ct-scroll');
  function follow(ids) {
    if (sc.scrollWidth <= sc.clientWidth + 4) return;
    var lo = Infinity, hi = -Infinity;
    ids.forEach(function (id) {
      var e = $(id);
      if (!e || !e.getBBox || id === 'counters' || id.indexOf('l-') === 0) return;
      var b = e.getBBox();
      lo = Math.min(lo, b.x); hi = Math.max(hi, b.x + b.width);
    });
    if (lo === Infinity) return;
    var scale = svg.getBoundingClientRect().width / 1000;
    var left = ((lo + hi) / 2) * scale - sc.clientWidth / 2;
    sc.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' });
  }
  function clearHot() {
    var h = svg.querySelectorAll('.hot');
    for (var i = 0; i < h.length; i++) h[i].classList.remove('hot');
  }

  /* ---- run phases: watch keeps going and loops; step stops after one ---- */
  var auto = !reduce;
  async function runFrom(k) {
    var g = ++gen;
    clearHot(); apply(START);
    for (var i = 0; i < k; i++) apply(P[i].end);
    say.setAttribute('aria-live', auto ? 'off' : 'polite');
    for (var j = k; j < P.length; j++) {
      show(j);
      await P[j].run();
      if (g !== gen) return;
      apply(P[j].end);
      if (!auto) { syncButtons(); return; }
      await wait(1500);
      if (g !== gen) return;
    }
    await wait(2500);
    if (g !== gen) return;
    runFrom(0);
  }

  /* ---- controls ---- */
  var bPlay = document.getElementById('ct-play'), bRestart = document.getElementById('ct-restart');
  var bBack = document.getElementById('ct-back'), bNext = document.getElementById('ct-next');
  var bSpeed = document.getElementById('ct-speed');
  function syncButtons() {
    var running = playing && auto;
    bPlay.textContent = running ? '❚❚ Pause' : '▶ Play';
    bPlay.setAttribute('aria-pressed', running ? 'true' : 'false');
    bBack.disabled = cur === 0;
    bNext.disabled = cur === P.length - 1 && !auto;
  }
  bPlay.addEventListener('click', function () {
    if (playing && auto) { playing = false; }
    else if (auto) { playing = true; }
    else { auto = true; playing = true; runFrom(cur); }
    syncButtons();
  });
  bRestart.addEventListener('click', function () { auto = true; playing = true; runFrom(0); });
  function step(d) {
    var to = Math.max(0, Math.min(P.length - 1, cur + d));
    auto = false; playing = true; runFrom(to);
  }
  bBack.addEventListener('click', function () { step(-1); });
  bNext.addEventListener('click', function () { step(+1); });
  var SPEEDS = [1, 2, 0.5];
  bSpeed.addEventListener('click', function () {
    speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    bSpeed.textContent = speed + '×';
  });
  fig.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { step(+1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
  });

  /* pause while the figure is off screen; resume when it comes back */
  var hiddenPause = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      var vis = es[0].isIntersecting;
      if (!vis && playing && auto) { playing = false; hiddenPause = true; syncButtons(); }
      else if (vis && hiddenPause) { playing = true; hiddenPause = false; syncButtons(); }
    }, { threshold: 0.15 }).observe(fig);
  }

  playing = true;
  runFrom(0);
})();
