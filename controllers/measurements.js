var Tag = require('../models/tag');

var lateration      = require("lateration");
var moment          = require('moment');
var distance        = require('euclidean-distance');
var superspeed      = require('superspeed');
var fs              = require('fs');

var Circle          = lateration.Circle;
var Vector          = lateration.Vector;
var laterate        = lateration.laterate;

/**
 * Measurements.
 * @type {Array}
 */
var Measurements = [], Tags = [];

/**
 * Measurement Model.
 * @param type
 * @param timestamp
 * @param senzorId1
 * @param senzorId2
 * @param distance
 * @constructor
 */
function Measurement(type, timestamp, senzorId1, senzorId2, distance) {
  this.type = parseInt(type);
  this.timestamp = timestamp;
  this.senzors = [parseInt(senzorId1), parseInt(senzorId2)];
  this.distance = parseFloat(distance);
}

/**
 * Tag Helper.
 * @param x
 * @param y
 * @constructor
 */
function _Tag(name, x, y, timestamp, anchor1, anchor2, anchor3, isValid) {
  this.name = name;
  this.x = x;
  this.y = y;
  this.speed = null;
  this.distance = null;
  this.timestamp = timestamp;
  this.anchor1 = anchor1;
  this.anchor2 = anchor2;
  this.anchor3 = anchor3;
  this.valid = typeof isValid  !== 'undefined' ? isValid : true;
}

exports.install = function() {
  // Sets cors for this API
  F.cors('/measurements/*', ['get', 'post'], true);

  // Upload
  F.route('/measurements/upload', process_measurements, ['upload'], 5000); // 5000 kB

  // Download
  F.route('/measurements/download', function() {
    this.file('data/measurements.log', 'measurements.log');
  })
};


exports.functions = {
  increment: function(num) {
    return num + 1;
  }
};


/**
 * Process data trigger.
 */
function process_measurements() {
  var self = this;

  fs.readFile(self.files[0].path, "UTF8", function (err, data) {

    if (err) throw err;

    // Main function for processing data
    processData(data);

    // Measure distances & speed
    // measureTags();

    // Save .log file to public/data folder
    createLogFile();

    // Response object
    self.json(Tags);

  });

  // Reset variables
  Measurements = [];
  Tags = [];
}

/** Helper Functions */

/**
 * Create .log file in public/data folder.
 */
function createLogFile() {

  console.log('LENGTH', Tags);

  var result = '';
  for (var i = 0; i < Tags.length; i++) {
    var tag = Tags[i];

    if (tag.x === false || tag.y === false) continue;

    result += tag.name + ';' + tag.x + ';' + tag.y + ';';

    // If not last item, create new row
    if (i < Tags.length - 1) result += '\r\n';
  }

  fs.writeFile("public/data/measurements.log", result, function(err) {
    if (err) {
      console.log(err);
    } else {
      console.log(moment().format(), "Measurements Log: The file was saved!");
    }
  });
}

/**
 * Parse measurement string to objects.
 * @param data
 */
function processData(data) {
  try {
    data = data.split('\n');

    var group = [], counter = 0;

    for (var i = 0; i < data.length; i++) {

      // Trim specific characters
      data[i] = data[i].replace('\r', '');

      var inputData = data[i].split(';');

      // Group every 6 items
      if (counter == 6) {
        counter = 0; // Reset counter
        Measurements.push(group); // Push group to measurements
        group = []; // Reset group
      }

      // Add measurement to group
      group.push(new Measurement(inputData[0], moment(parseInt(inputData[1])).valueOf(), inputData[2], inputData[3], inputData[4]));
      counter++;
    }

    Measurements.push(group); // Push the last group to measurements array

    calculateTrilateration();

  } catch(e) {
    return false;
  }

  return true;
}

/**
 * Measure distance & speed of the Tags
 */
function measureTags() {
  // Loop starts with 2nd Tag
  for (var i = 1; i < Tags.length; i++) {
    var timeDiff =  moment(Tags[i].timestamp).diff(moment(Tags[i-1].timestamp));
    Tags[i].distance = getDistance(Tags[i], Tags[i-1]);
    Tags[i].speed = getSpeed(timeDiff, Tags[i].distance);
    Tags[i].travelTime = timeDiff;
  }
}

/**
 * Calculate position of the Tags from Measurements Array.
 */
function calculateTrilateration() {
  for (var i = 0; i < Measurements.length; i++)
    calcTagPosition(Measurements[i]);
}

/**
 * Get position of the Tag.
 * @param group
 */
function calcTagPosition(group) {
  try {
    var anchor1 = group[0],
      anchor2 = group[1],
      anchor3 = group[2];

    // Get Tag name
    var name = group[3] && group[3].senzors[1] ? group[3] && group[3].senzors[1] : null;

    // Define distances to tag
    anchor1.toTag = group[3].distance;
    anchor2.toTag = group[4].distance;
    anchor3.toTag = group[5].distance;

    // Anchor #1 position
    anchor1.x = 0;
    anchor1.y = 0;

    // Anchor #2 position
    anchor2.x = anchor1.distance;
    anchor2.y = 0;

    // Anchor #3 position
    var intersect = intersection(anchor1.x, anchor1.y, anchor2.distance, anchor2.x, anchor2.y, anchor3.distance);
    anchor3.x = intersect[0];
    anchor3.y = intersect[2];

    // The beacons
    var beacons = [
      new Circle(new Vector(anchor1.x, anchor1.y), anchor1.toTag),
      new Circle(new Vector(anchor2.x, anchor2.y), anchor2.toTag),
      new Circle(new Vector(anchor3.x, anchor3.y), anchor3.toTag)
    ];

    // Laterating & defining anchor points
    var tagPosition = laterate(beacons),
      a1 = { x: anchor1.x, y: anchor1.y },
      a2 = { x: anchor2.x, y: anchor2.y },
      a3 = { x: anchor3.x, y: anchor3.y };

    if (!tagPosition) {
      tagPosition = {
        x: false,
        y: false,
        isValid: false
      }
    } else tagPosition.isValid = true;

    // Push new Tag object to array
    Tags.push(new _Tag(name, tagPosition.x, tagPosition.y, anchor1.timestamp, a1, a2, a3, tagPosition.isValid));

    // Create a new Tag record
    var tagModel = new Tag({
      userId: 1,
      eventId: 1,
      name: name,
      timestamp: anchor1.timestamp,
      x: tagPosition.x,
      y: tagPosition.y
    });

    // Save
    tagModel.save(function (err) {
      if (err) console.log(err);
    });
  } catch(err) {
    console.log(err);
  }
}

/**
 * Obtain position of the last anchor.
 * (Based on intersection of two circles)
 * @param x0
 * @param y0
 * @param r0
 * @param x1
 * @param y1
 * @param r1
 * @returns {*}
 */
function intersection(x0, y0, r0, x1, y1, r1) {
  var a, dx, dy, d, h, rx, ry;
  var x2, y2;

  /* dx and dy are the vertical and horizontal distances between
   * the circle centers.
   */
  dx = x1 - x0;
  dy = y1 - y0;

  /* Determine the straight-line distance between the centers. */
  d = Math.sqrt((dy*dy) + (dx*dx));

  /* Check for solvability. */
  if (d > (r0 + r1)) {
    /* no solution. circles do not intersect. */
    return false;
  }
  if (d < Math.abs(r0 - r1)) {
    /* no solution. one circle is contained in the other */
    return false;
  }

  /* 'point 2' is the point where the line through the circle
   * intersection points crosses the line between the circle
   * centers.
   */

  /* Determine the distance from point 0 to point 2. */
  a = ((r0*r0) - (r1*r1) + (d*d)) / (2.0 * d) ;

  /* Determine the coordinates of point 2. */
  x2 = x0 + (dx * a/d);
  y2 = y0 + (dy * a/d);

  /* Determine the distance from point 2 to either of the
   * intersection points.
   */
  h = Math.sqrt((r0*r0) - (a*a));

  /* Now determine the offsets of the intersection points from
   * point 2.
   */
  rx = -dy * (h/d);
  ry = dx * (h/d);

  /* Determine the absolute intersection points. */
  var xi = x2 + rx;
  var xi_prime = x2 - rx;
  var yi = y2 + ry;
  var yi_prime = y2 - ry;

  return [xi, xi_prime, yi, yi_prime];
}

/**
 * Measure distance between the Tags.
 * @param tag1
 * @param tag2
 */
function getDistance(tag1, tag2) {
  return distance([tag1.x, tag1.y], [tag2.x, tag2.y])
}

/**
 * Calculate speed of the Tag.
 * @param time
 * @param distance
 * @returns float (e.g.: 1.38 [m/s])
 */
function getSpeed(time, distance) {
  return superspeed({
    time: time,
    distance: distance,
    timeDivider: 1000,
    distanceDivider: 1
  });
}
