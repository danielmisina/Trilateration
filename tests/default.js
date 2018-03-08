TEST('controller.increment()', function() {
  FAIL(F.controller('measurements').functions.increment(1) !== 2);
});

TEST('controller.processData()', function() {
  FAIL(F.controller('measurements').processData('1;73472;2;1;2382\n' +
    '1;73632;3;1;3189\n' +
    '1;73793;2;3;1669\n' +
    '2;73888;1;129;708\n' +
    '2;73928;2;129;1951\n' +
    '2;73933;3;129;2748') !== true);
});
