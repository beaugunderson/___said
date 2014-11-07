'use strict';

require('chai').should();

var sentence = require('../lib/sentence.js');

describe('sentence', function () {
  describe('unquote', function () {
    var sentences = [[
      '"I don\'t know," he said, "maybe it\'s fate."',
      'I don\'t know, maybe it\'s fate.'
    ], [
      '"blah bleh", she said, "bluh bloh".',
      'blah bleh bluh bloh'
    ], [
      '"Blah blah blah", he said.',
      'Blah blah blah'
    ]];

    sentences.forEach(function (pair) {
      it('should unquote ' + pair[0], function () {
        sentence.unquote(pair[0]).should.equal(pair[1]);
      });
    });
  });
});
