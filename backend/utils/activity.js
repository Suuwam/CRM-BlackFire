const Activity = require('../models/Activity');

async function recordActivity(entry) {
  try {
    await Activity.create(entry);
  } catch (error) {
    console.error('Activity log error:', error.message);
  }
}

module.exports = { recordActivity };