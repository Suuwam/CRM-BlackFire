const Activity = require('../models/Activity');
const { pushActivity } = require('./push');

async function recordActivity(entry) {
  try {
    await Activity.create(entry);
  } catch (error) {
    console.error('Activity log error:', error.message);
  }
  await pushActivity(entry);
}

module.exports = { recordActivity };
