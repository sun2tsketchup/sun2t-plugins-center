// One-time content fixes. Each step runs once per site (its id is remembered in
// data.migrations), so later edits made in the admin are never overwritten.
const STEPS = [
  {
    // "Đồ án AutoCAD" -> "Sản phẩm AutoCAD" (Thanh, 2026-11-26)
    id: 'works-name-san-pham',
    run(d) {
      let n = 0;
      (d.works || []).forEach(w => {
        if (typeof w.name === 'string' && /^\s*đồ án\b/i.test(w.name)) {
          w.name = w.name.replace(/^\s*đồ án\b/i, 'Sản phẩm');
          n++;
        }
      });
      return n;
    },
  },
  {
    // home page texts became editable in the admin: fill in the texts the page used to have
    id: 'home-texts',
    run(d) {
      const { TEXT_DEFAULTS, homeOrder } = require('./sections');
      d.settings = d.settings || {};
      if (!Array.isArray(d.settings.homeOrder)) d.settings.homeOrder = homeOrder(d.settings);
      if (!Array.isArray(d.banners)) d.banners = [];
      for (const [k, v] of Object.entries(TEXT_DEFAULTS)) if (d.settings[k] == null) d.settings[k] = v;
    },
  },
];

// Is any step still to run on this data?
function pending(d) {
  const done = new Set(d.migrations || []);
  return STEPS.some(s => !done.has(s.id));
}

// Apply the missing steps in place. Returns true if anything was recorded.
function migrate(d) {
  const done = new Set(d.migrations || []);
  let changed = false;
  STEPS.forEach(s => {
    if (done.has(s.id)) return;
    s.run(d);
    done.add(s.id);
    changed = true;
  });
  if (changed) d.migrations = [...done];
  return changed;
}

module.exports = { migrate, pending };
