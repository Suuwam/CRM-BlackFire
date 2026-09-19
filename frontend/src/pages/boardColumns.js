export function slugify(label) {
  return String(label).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 40);
}

// Stage ids are what tasks are filed under, so a stage that already exists keeps its id when
// renamed. New stages get a slug of their label, which is what makes a stage called "Done"
// behave as done everywhere (completion mail, dashboard counts) without a separate setting.
export function resolveColumnIds(draft, saved = []) {
  const existing = new Set(saved.map(c => c.id));
  const used = new Set();
  return draft.map((c, i) => {
    let id = existing.has(c.id) ? c.id : (slugify(c.label) || `stage${i + 1}`);
    while (used.has(id)) id += '2';
    used.add(id);
    return { id, label: String(c.label).trim() };
  });
}
