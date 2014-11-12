'use strict';

var botUtilities = require('bot-utilities');
var candidates = require('./lib/candidates.js');
var program = require('commander');
var Twit = require('twit');
var ValueCache = require('level-cache-tools').ValueCache;
var _ = require('lodash');

var usedQuotes = new ValueCache('used-quotes');

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

      var chosen = _.sample(results);

      usedQuotes.putMulti(chosen.quotes, function (err) {
        if (err) {
          return console.log('Error storing quotes', err);
        }

        T.post('statuses/update', {status: chosen.tweet},
            function (err, data, response) {
          if (err || response.statusCode !== 200) {
            return console.log('Error sending tweet', err, response.statusCode);
          }
        });
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
