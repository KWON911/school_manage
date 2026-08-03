const googleCalendar = require('../google-calendar.js');

module.exports = function callback(req, res) {
  req.query = { ...(req.query ?? {}), action: 'callback' };
  return googleCalendar(req, res);
};
