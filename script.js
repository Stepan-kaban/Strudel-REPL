// --- AUDIO EFFECTS ONLY ---

// extra-resonant lowpass in 0..1
register('rlpf', (x, pat) => pat.lpf(pure(x).mul(12).pow(4)))

// extra-resonant highpass in 0..1
register('rhpf', (x, pat) => pat.hpf(pure(x).mul(12).pow(4)))

// tb303 style acid filter envelope
register('acidenv', (x, pat) =>
  pat.rlpf(.25)
     .lpenv(x * 9)
     .lps(.2)
     .lpd(.15)
)

// fill gaps → makes sustained notes
register('fill', function (pat) {
  return new Pattern(function (state) {
    const look = 1;
    const haps = pat.query(
      state.withSpan(span => new TimeSpan(span.begin.sub(look), span.end.add(look)))
    );

    const onsets = haps.map(h => h.whole.begin)
      .sort((a,b)=>a.compare(b))
      .filter((x,i,arr)=> i == arr.length-1 || x.ne(arr[i+1]));

    const newHaps = [];
    for (const hap of haps) {
      if (hap.part.begin.gte(state.span.end)) continue;

      const next = onsets.find(on => on.gte(hap.whole.end));
      if (next.lte(state.span.begin)) continue;

      const whole = new TimeSpan(hap.whole.begin, next);
      const part  = new TimeSpan(hap.part.begin.max(state.span.begin), next.min(state.span.end));

      newHaps.push(new Hap(whole, part, hap.value, hap.context, hap.stateful));
    }
    return newHaps;
  });
});

// trance-gate effect (rhythmic chopping)
register('trancegate', (density, seed, length, x) =>
  x.struct(rand.mul(density).round().seg(16).rib(seed, length))
   .fill()
   .clip(.7)
)

// quantize notes to nearest pitch in scale
register('grab', (scale, pat) => {
  scale = (Array.isArray(scale) ? scale : [scale]).flatMap(v =>
    typeof v === 'number' ? v : noteToMidi(v) - 48
  );

  return pat.withHap(hap => {
    const isObj = typeof hap.value === 'object';
    let note = isObj ? hap.value.n : hap.value;

    if (typeof note === 'string') note = noteToMidi(note);
    if (isObj) delete hap.value.n;

    const oct = (note / 12) >> 0;
    const base = note - oct * 12;

    const nearest = scale.reduce(
      (p, c) => Math.abs(c - base) < Math.abs(p - base) ? c : p
    );

    const final = nearest + oct * 12;

    return hap.withValue(() => isObj ? { ...hap.value, note: final } : final);
  });
});

// velocity structure (vel affects volume)
register('vstruct', (ipat, pat) =>
  ipat.outerBind(vel =>
    pat.keepif.out(Math.ceil(vel)).velocity(vel)
  ),
  false
)

// simple acid sound preset
register('acid', pat =>
  pat.s('supersaw')
     .detune(.5)
     .unison(1)
     .lpf(100)
     .lpsustain(0.2)
     .lpd(.2)
     .lpenv(2)
     .lpq(12)
)

// multi-orbit stereo/quad panning
register('mpan', (orbits, amount, pat) => {
  const index = Math.round(amount * (orbits.length - 1))
  const orbit = orbits[index]
  const pamt = (amount * orbits.length) % 1
  return pat.orbit(orbit).pan(pamt)
})
