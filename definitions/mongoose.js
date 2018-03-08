var mongoose = require('mongoose');
mongoose.connect(CONFIG('database'), {
  useMongoClient: true
});
