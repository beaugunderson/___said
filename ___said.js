'use strict';

var candidates = require('./lib/candidates.js');
var program = require('commander');

program
  .command('candidates')
  .description('Generate and list candidates')
  .action(function () {
    candidates(function (err, results) {
      if (err) {
        throw err;
      }

      results.forEach(function (candidate) {
        console.log(candidate);
        console.log('--');
      });
    });
  });

program.parse(process.argv);
