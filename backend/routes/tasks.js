const router = require('express').Router();
const multer = require('multer');
const Task = require('../models/Task');
const User = require('../models/User');
const Board = require('../models/Board');
const { requireSessionUser } = require('../utils/session');
const { sendMail } = require('../utils/mailer');
const { rateLimit } = require('../utils/rateLimit');
const { recordActivity } = require('../utils/activity');
const { storeImage } = require('../utils/upload');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, prefix: 'tasks-write', message: 'Too many task updates. Please slow down.' });

// Build full assignees[] from request data (resolves user emails from DB if only IDs given)
async function normalizeAssignment(data, currentUser) {
  const assigneeId = data.assigneeId || null;
  let assigneeName  = data.assigneeName  || data.assignee || '';
  let assigneeEmail = data.assigneeEmail || '';

  const incoming = Array.isArray(data.assignees) ? data.assignees : [];

  // One query for every id we need, instead of one findById per assignee (N+1).
  const needed = [assigneeId, ...incoming.filter(a => a.userId && (!a.email || !a.name)).map(a => a.userId)]
    .filter(Boolean)
    .map(String);
  const byId = new Map();
  if (needed.length) {
    const found = await User.find({ _id: { $in: [...new Set(needed)] } }, 'name email').lean();
    for (const u of found) byId.set(String(u._id), u);
  }

  if (assigneeId) {
    const u = byId.get(String(assigneeId));
    if (u) { assigneeName = u.name; assigneeEmail = u.email; }
  }

  // Build assignees[] from incoming array or fall back to legacy single
  let assignees = [];
  if (incoming.length > 0) {
    assignees = incoming.map(a => {
      const u = a.userId ? byId.get(String(a.userId)) : null;
      return { userId: a.userId || null, name: u?.name || a.name || '', email: u?.email || a.email || '' };
    });
  } else if (assigneeName) {
    // Legacy compat — mirror single assignee into the array
    assignees = [{ userId: assigneeId || null, name: assigneeName, email: assigneeEmail }];
  }

  return {
    ...data,
    assigneeId,
    assignee: assigneeName,
    assigneeName,
    assigneeEmail,
    assignees,
    assignedById:    currentUser?._id  || null,
    assignedByName:  currentUser?.name || '',
    assignedByEmail: currentUser?.email || '',
  };
}

// task.project is a Board._id — 'board_1758…' for anything created in the app — so mail has
// to resolve the board's label or it shows that raw id.
async function projectLabel(id) {
  return (await Board.findById(id).lean())?.label || id;
}

// Send assignment notification to newly assigned people
async function maybeNotifyAssignment(task, previousAssignees = []) {
  const prevEmails = new Set(previousAssignees.map(a => a.email).filter(Boolean));
  const newAssignees = (task.assignees || []).filter(a => a.email && !prevEmails.has(a.email));
  if (!newAssignees.length) return;

  const project = await projectLabel(task.project);

  // Parallel: N recipients used to cost N sequential SMTP round-trips on the request path.
  await Promise.all(newAssignees.map(async assignee => {
    const subject = `New task assigned: ${task.title}`;
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:480px">
        <h2 style="margin:0 0 12px">New task assigned to you</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:5px 0;color:#555;width:100px">Task</td><td style="font-weight:600">${task.title}</td></tr>
          <tr><td style="padding:5px 0;color:#555">Project</td><td>${project}</td></tr>
          <tr><td style="padding:5px 0;color:#555">Assigned by</td><td>${task.assignedByName || 'System'}</td></tr>
          <tr><td style="padding:5px 0;color:#555">Priority</td><td style="text-transform:capitalize">${task.priority}</td></tr>
          <tr><td style="padding:5px 0;color:#555">Due date</td><td>${task.dueDate || 'Not set'}</td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#777">Replying to this mail is encouraged.</p>
      </div>`;
    try {
      await sendMail({
        to: assignee.email,
        subject,
        html,
        text: `New task assigned: ${task.title}\nAssigned by: ${task.assignedByName}\n\nReplying to this mail is encouraged.`,
      });
    }
    catch (e) { console.error('Assignment notify failed:', e.message); }
  }));
}

// Send done notification to all assignees + assigner (deduplicated)
async function notifyDone(task, movedBy) {
  const recipients = new Map(); // email -> name

  // All assignees
  for (const a of (task.assignees || [])) {
    if (a.email) recipients.set(a.email, a.name);
  }
  // Legacy single assignee
  if (task.assigneeEmail) recipients.set(task.assigneeEmail, task.assigneeName);
  // Assigner (if different)
  if (task.assignedByEmail) recipients.set(task.assignedByEmail, task.assignedByName);
  // Person who moved it
  if (movedBy?.email) recipients.set(movedBy.email, movedBy.name);

  if (!recipients.size) return;

  const allAssigneeNames = [...new Set([
    ...(task.assignees || []).map(a => a.name).filter(Boolean),
    task.assigneeName,
  ].filter(Boolean))].join(', ') || 'Team';

  const project = await projectLabel(task.project);

  await Promise.all([...recipients].map(async ([email, name]) => {
    const subject = `✅ Task completed: ${task.title}`;
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:480px">
        <h2 style="margin:0 0 4px;color:#16a34a">Task Completed</h2>
        <p style="margin:0 0 16px;color:#555;font-size:13px">Marked done by ${movedBy?.name || 'a team member'}.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:5px 0;color:#555;width:100px">Task</td><td style="font-weight:600">${task.title}</td></tr>
          <tr><td style="padding:5px 0;color:#555">Project</td><td>${project}</td></tr>
          <tr><td style="padding:5px 0;color:#555">Assigned to</td><td>${allAssigneeNames}</td></tr>
          ${task.dueDate ? `<tr><td style="padding:5px 0;color:#555">Due date</td><td>${task.dueDate}</td></tr>` : ''}
        </table>
      </div>`;
    try { await sendMail({ to: email, subject, html, text: `Task completed: ${task.title}\nMarked done by: ${movedBy?.name}` }); }
    catch (e) { console.error('Done notify failed:', e.message); }
  }));
}

// GET by project
router.get('/', requireSessionUser, async (req, res) => {
  try {
    const filter = {};
    if (req.query.project) filter.project = req.query.project;
    // lean(): plain objects straight to JSON, no Mongoose document wrapping per task.
    res.json(await Task.find(filter).sort({ column: 1, order: 1 }).lean());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireSessionUser, async (req, res) => {
  try {
    const payload = await normalizeAssignment(req.body, req.sessionUser);
    const task = await Task.create(payload);
    await Promise.all([maybeNotifyAssignment(task, []), recordActivity({
      action: 'created',
      targetType: 'task',
      targetId: task._id,
      targetName: task.title,
      project: task.project,
      actorId: req.sessionUser._id,
      actorName: req.sessionUser.name,
      assigneeId: task.assigneeId || null,
      assigneeName: task.assigneeName || '',
      assigneeEmail: task.assigneeEmail || '',
      toColumn: task.column,
      summary: `${req.sessionUser.name} created ${task.title}${task.assigneeName ? ` and assigned it to ${task.assigneeName}` : ''}`,
    })]);
    res.status(201).json(task);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', requireSessionUser, writeLimiter, async (req, res) => {
  try {
    const existing = await Task.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const payload = await normalizeAssignment(req.body, req.sessionUser);
    const updated = await Task.findByIdAndUpdate(req.params.id, payload, { new: true });
    await maybeNotifyAssignment(updated, existing.assignees || []);

    // Notify done if column changed to done
    if (payload.column === 'done' && existing.column !== 'done') {
      await notifyDone(updated, req.sessionUser);
    }

    await recordActivity({
      action: 'updated',
      targetType: 'task',
      targetId: updated._id,
      targetName: updated.title,
      project: updated.project,
      actorId: req.sessionUser._id,
      actorName: req.sessionUser.name,
      assigneeId: updated.assigneeId || null,
      assigneeName: updated.assigneeName || '',
      assigneeEmail: updated.assigneeEmail || '',
      fromColumn: existing.column,
      toColumn: updated.column,
      summary: `${req.sessionUser.name} updated ${updated.title}`,
    });
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Upload image for task/card
router.patch('/:id/image', requireSessionUser, writeLimiter, upload.single('image'), async (req, res) => {
  try {
    const image = await storeImage(req.file, { folder: 'crm_tasks' });
    const task = await Task.findByIdAndUpdate(req.params.id, { image }, { new: true });
    res.json(task);
  } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});

// PATCH move column
router.patch('/:id/move', requireSessionUser, writeLimiter, async (req, res) => {
  try {
    const { column } = req.body;
    const existing = await Task.findById(req.params.id);
    const updated = await Task.findByIdAndUpdate(req.params.id, { column }, { new: true });

    // Notify done
    if (column === 'done' && existing?.column !== 'done') {
      await notifyDone(updated, req.sessionUser);
    }

    await recordActivity({
      action: 'moved',
      targetType: 'task',
      targetId: updated._id,
      targetName: updated.title,
      project: updated.project,
      actorId: req.sessionUser._id,
      actorName: req.sessionUser.name,
      assigneeId: updated.assigneeId || null,
      assigneeName: updated.assigneeName || '',
      assigneeEmail: updated.assigneeEmail || '',
      fromColumn: existing?.column || '',
      toColumn: column,
      summary: `${req.sessionUser.name} moved ${updated.title} to ${column}`,
    });
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id', requireSessionUser, writeLimiter, async (req, res) => {
  try {
    const existing = await Task.findById(req.params.id);
    await Task.findByIdAndDelete(req.params.id);
    if (existing) {
      await recordActivity({
        action: 'deleted',
        targetType: 'task',
        targetId: existing._id,
        targetName: existing.title,
        project: existing.project,
        actorId: req.sessionUser._id,
        actorName: req.sessionUser.name,
        summary: `${req.sessionUser.name} deleted ${existing.title}`,
      });
    }
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST add comment to task
router.post('/:id/comments', requireSessionUser, writeLimiter, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Comment text required' });
    const comment = {
      text: text.trim(),
      authorName: req.sessionUser.name || 'Unknown',
      authorId: req.sessionUser._id || null,
      createdAt: new Date(),
    };
    const updated = await Task.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: comment } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Task not found' });
    await recordActivity({
      action: 'commented',
      targetType: 'task',
      targetId: updated._id,
      targetName: updated.title,
      project: updated.project,
      actorId: req.sessionUser._id,
      actorName: req.sessionUser.name,
      summary: `${req.sessionUser.name} commented on ${updated.title}`,
    });
    // Return the last comment that was just added
    res.status(201).json(updated.comments[updated.comments.length - 1]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE a comment from a task
router.delete('/:id/comments/:commentId', requireSessionUser, writeLimiter, async (req, res) => {
  try {
    const updated = await Task.findByIdAndUpdate(
      req.params.id,
      { $pull: { comments: { _id: req.params.commentId } } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Task not found' });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
