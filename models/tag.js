var mongoose = require('mongoose');
var Schema = mongoose.Schema;

/**
 * Tag Model
 */
module.exports = mongoose.model('Tag', new Schema({
  userId: Number,
  eventId: Number,
  name: String,
  timestamp: Number,
  x: Number,
  y: Number
}));
