'use strict';

var botUtilities = require('bot-utilities');
var candidates = require('./lib/candidates.js');
var domain = require('domain');
var exit = require('exit');
var lockFile = require('lockfile');
var program = require('commander');
var Twit = require('twit');
var ValueCache = require('level-cache-tools').ValueCache;
var _ = require('lodash');

_.mixin(botUtilities.lodashMixins);

program
  .command('tweet')
  .description('Generate and tweet an image')
  .option('-r, --random', 'only post a percentage of the time')
  .action(botUtilities.randomCommand(function () {
    lockFile.lock('___said.lock', function (err) {
      if (err) {
        console.error('Error: ___said is locked');

        exit(1);
      }

      var usedQuotes = new ValueCache('used-quotes');

      var d = domain.create();

      function errorCleanUp(err) {
        if (err) {
          console.log('Error:', err);
        }

        lockFile.unlock('___said.lock', function (err) {
          if (err) {
            console.log('Error unlocking ___said.lock:', err);
          }

          usedQuotes.close(function (err) {
            if (err) {
              console.log('Error closing usedQuotes', err);
            }

            exit(1);
          });
        });
      }

      d.on('error', errorCleanUp);

      process.on('SIGTERM', function () {
        console.log('Terminating...');

        errorCleanUp();
      });

      process.on('SIGINT', function () {
        console.log('Aborting...');

        errorCleanUp();
      });

      d.run(function () {
        candidates(usedQuotes, function (err, results) {
          if (err) {
            throw err;
          }

          var T = new Twit(botUtilities.getTwitterAuthFromEnv());

          var chosen = _.sample(results);

          usedQuotes.putMulti(chosen.quotes, function (err) {
            if (err) {
              return console.log('Error storing quotes', err);
            }

            usedQuotes.close(function (err) {
              if (err) {
                return console.log('Error closing used-quotes', err);
              }

              T.post('statuses/update', {status: chosen.tweet},
                  function (err, data, response) {
                if (err || response.statusCode !== 200) {
                  return console.log('Error sending tweet', err,
                                     response.statusCode);
                }
              });
            });
          });
        });
      });
    });
  }));

program
  .command('candidates')
  .description('Generate and list candidates')
  .action(function () {
    candidates(null, function (err, results) {
      if (err) {
        throw err;
      }

      results.forEach(function (candidate) {
        console.log(candidate.tweet);
        console.log('--');
      });
    });
  });

program.parse(process.argv);
