'use strict';

var botUtilities = require('bot-utilities');
var candidates = require('./lib/candidates.js');
var program = require('commander');
var Twit = require('twit');
var _ = require('lodash');

_.mixin(botUtilities.lodashMixins);

program
  .command('tweet')
  .description('Generate and tweet an image')
  .option('-r, --random', 'only post a percentage of the time')
  .action(function (options) {
    if (options.random) {
      if (_.percentChance(98)) {
        console.log('Skipping...');

        process.exit(0);
      }
    }

    candidates(function (err, results) {
      if (err) {
        throw err;
      }

      var T = new Twit(botUtilities.getTwitterAuthFromEnv());

      T.post('statuses/update', {status: _.sample(results)},
          function (err, data, response) {
        if (err || response.statusCode !== 200) {
          console.log('Error sending tweet', err, response.statusCode);

          return;
        }
      });
    });
  });

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
