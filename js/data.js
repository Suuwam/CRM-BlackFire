// ─── Data Layer ────────────────────────────────────────────────────────────
const KEYS = {
  clients: 'crm_clients',
  events: 'crm_events',
  templates: 'crm_templates',
  sentEmails: 'crm_sent_emails',
  references: 'crm_references',
};

// ── Generic helpers ────────────────────────────────────────────────────────
function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}
function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Clients ────────────────────────────────────────────────────────────────
const Clients = {
  all: () => load(KEYS.clients),
  get: (id) => Clients.all().find(c => c.id === id),
  add(data) {
    const list = Clients.all();
    const c = { id: uid(), createdAt: new Date().toISOString(), ...data };
    list.push(c);
    save(KEYS.clients, list);
    return c;
  },
  update(id, data) {
    const list = Clients.all().map(c => c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c);
    save(KEYS.clients, list);
  },
  delete(id) {
    save(KEYS.clients, Clients.all().filter(c => c.id !== id));
  },
};

// ── Events ─────────────────────────────────────────────────────────────────
const Events = {
  all: () => load(KEYS.events),
  get: (id) => Events.all().find(e => e.id === id),
  forDate: (dateStr) => Events.all().filter(e => e.date === dateStr),
  forMonth: (year, month) => Events.all().filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === month;
  }),
  upcoming: (n = 5) => {
    const today = new Date().toISOString().slice(0, 10);
    return Events.all()
      .filter(e => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, n);
  },
  add(data) {
    const list = Events.all();
    const e = { id: uid(), createdAt: new Date().toISOString(), color: 'blue', ...data };
    list.push(e);
    save(KEYS.events, list);
    return e;
  },
  update(id, data) {
    const list = Events.all().map(e => e.id === id ? { ...e, ...data } : e);
    save(KEYS.events, list);
  },
  delete(id) {
    save(KEYS.events, Events.all().filter(e => e.id !== id));
  },
};

// ── Email Templates ────────────────────────────────────────────────────────
const Templates = {
  all: () => load(KEYS.templates),
  get: (id) => Templates.all().find(t => t.id === id),
  add(data) {
    const list = Templates.all();
    const t = { id: uid(), createdAt: new Date().toISOString(), ...data };
    list.push(t);
    save(KEYS.templates, list);
    return t;
  },
  update(id, data) {
    const list = Templates.all().map(t => t.id === id ? { ...t, ...data } : t);
    save(KEYS.templates, list);
  },
  delete(id) {
    save(KEYS.templates, Templates.all().filter(t => t.id !== id));
  },
};

// ── Sent Emails ────────────────────────────────────────────────────────────
const SentEmails = {
  all: () => load(KEYS.sentEmails),
  add(data) {
    const list = SentEmails.all();
    const e = { id: uid(), sentAt: new Date().toISOString(), ...data };
    list.push(e);
    save(KEYS.sentEmails, list);
    return e;
  },
};

// ── References ─────────────────────────────────────────────────────────────
const References = {
  all: () => load(KEYS.references),
  add(data) {
    const list = References.all();
    const r = { id: uid(), addedAt: new Date().toISOString(), ...data };
    list.push(r);
    save(KEYS.references, list);
    return r;
  },
  update(id, data) {
    const list = References.all().map(r => r.id === id ? { ...r, ...data } : r);
    save(KEYS.references, list);
  },
  delete(id) {
    save(KEYS.references, References.all().filter(r => r.id !== id));
  },
};

// ── Export / Import ────────────────────────────────────────────────────────
function exportData() {
  const snapshot = {};
  for (const [key, storageKey] of Object.entries(KEYS)) {
    snapshot[key] = load(storageKey);
  }
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crm-blackfire-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(jsonStr) {
  try {
    const snapshot = JSON.parse(jsonStr);
    for (const [key, storageKey] of Object.entries(KEYS)) {
      if (snapshot[key]) save(storageKey, snapshot[key]);
    }
    return true;
  } catch {
    return false;
  }
}

// ── Seed Data (runs only once) ─────────────────────────────────────────────
function seedIfEmpty() {
  if (Clients.all().length > 0) return;

  const c1 = Clients.add({ name: 'Priya Sharma', company: 'Anthem Studios', email: 'priya@anthemstudios.com', phone: '+977-9841-000001', status: 'Active', project: 'Brand Identity', notes: 'Prefers morning calls. Needs brand refresh before Q3 launch.' });
  const c2 = Clients.add({ name: 'Rohan Mehta', company: 'Neon Beats', email: 'rohan@neonbeats.io', phone: '+977-9841-000002', status: 'Active', project: 'Album Artwork', notes: 'Works remotely. Always pays on time.' });
  const c3 = Clients.add({ name: 'Sujata Rai', company: 'Echo Media', email: 'sujata@echomedia.com', phone: '+977-9841-000003', status: 'Prospect', project: 'Podcast Intro', notes: 'Met at Audio Summit. Follow up this week.' });
  const c4 = Clients.add({ name: 'Dev Karki', company: 'Pulse Entertainment', email: 'dev@pulseent.com', phone: '+977-9841-000004', status: 'Inactive', project: 'Event Visuals', notes: 'Project on hold pending budget approval.' });

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  Events.add({ title: 'Brand Strategy Call', date: today, time: '10:00', clientId: c1.id, notes: 'Discuss Q3 campaign direction', color: 'blue', status: 'scheduled' });
  Events.add({ title: 'Album Artwork Review', date: today, time: '14:00', clientId: c2.id, notes: 'Present 3 cover concepts', color: 'green', status: 'scheduled' });
  Events.add({ title: 'Podcast Intro Draft', date: tomorrow, time: '09:30', clientId: c3.id, notes: 'Send first demo tracks', color: 'amber', status: 'scheduled' });
  Events.add({ title: 'Follow-up: Pulse Ent.', date: dayAfter, time: '11:00', clientId: c4.id, notes: 'Budget discussion', color: 'gray', status: 'scheduled' });
  Events.add({ title: 'Final Delivery: Anthem', date: nextWeek, time: '16:00', clientId: c1.id, notes: 'Hand over all brand files', color: 'blue', status: 'scheduled' });

  Templates.add({
    name: 'Project Proposal',
    subject: 'Project Proposal for {{company}} — {{project}}',
    body: `Hi {{name}},

Thank you for connecting with us at Aawazz/Blackfire. We're excited about the opportunity to collaborate on {{project}}.

Based on our conversation, we've outlined an initial proposal tailored to {{company}}'s goals. Please find the key highlights below:

• Project Scope: {{project}}
• Estimated Timeline: 3–4 weeks
• Collaboration format: Weekly check-ins + async updates

We'd love to schedule a call to walk you through our process and answer any questions.

Looking forward to hearing from you!

Warm regards,
Aawazz / Blackfire Team`,
  });

  Templates.add({
    name: 'Follow-up',
    subject: 'Following up — {{project}} for {{company}}',
    body: `Hi {{name}},

Just following up on our previous conversation regarding {{project}}.

We wanted to check if you had any questions or needed any additional information from our side.

We're available for a quick call this week — feel free to suggest a time that works for you.

Best,
Aawazz / Blackfire Team`,
  });

  Templates.add({
    name: 'Project Completion',
    subject: '✅ {{project}} — Delivery Complete',
    body: `Hi {{name}},

We're thrilled to let you know that {{project}} is complete and ready for handover!

All deliverables have been prepared and are attached. A brief summary:
• Final files in requested formats
• Source files included
• Usage guide / notes enclosed

It has been a pleasure working with you and {{company}}. We hope to collaborate again in the future!

Warm regards,
Aawazz / Blackfire Team`,
  });

  References.add({ title: 'Behance — Audio Brand Inspiration', url: 'https://www.behance.net/search/projects?field=graphic_design&search=music+branding', tags: ['design', 'inspiration'], notes: 'Great visual references for music industry branding' });
  References.add({ title: 'Spotify Brand Guidelines', url: 'https://developer.spotify.com/documentation/design', tags: ['branding', 'guidelines'], notes: 'Benchmark for modern audio brand standards' });
  References.add({ title: 'Unsplash — Music Photography', url: 'https://unsplash.com/s/photos/music-studio', tags: ['photography', 'assets'], notes: 'Free hi-res studio and performance images' });
  References.add({ title: 'Google Fonts — Inter', url: 'https://fonts.google.com/specimen/Inter', tags: ['typography', 'tools'], notes: 'Primary font for CRM and client presentations' });
  References.add({ title: 'Adobe Color Wheel', url: 'https://color.adobe.com/create/color-wheel', tags: ['design', 'tools'], notes: 'Color palette generator for branding projects' });
}

window.CRM = { Clients, Events, Templates, SentEmails, References, exportData, importData, seedIfEmpty };
