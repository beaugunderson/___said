'use strict';

var async = require('async');
var debug = require('debug')('candidates');
var fs = require('fs');
var newsText = require('news-text');
var sentence = require('sentence-tools');
var quote = require('quote-tools');
var _ = require('lodash');

var googleNews = new newsText.GoogleNews();
var simple = new newsText.Simple();

var TWEET_LENGTH = 140;
var EMOJI_LENGTH = 2;

var MAX_LENGTH = (TWEET_LENGTH - EMOJI_LENGTH) * 0.8;

var FEMALE_EMOJI = '👩';
var MALE_EMOJI = '👨';

var newsSites = _.keys(newsText.Simple.urls);

// Don't read too much into this list (-_-;)
var searchTerms = [
  '', // A blank search string for Google News gets the top stories
  'aids',
  'alligators',
  'cooking',
  'duck dynasty',
  'ebola',
  'feminism',
  'fishing',
  'football',
  'gardening',
  'healthcare',
  'hunting',
  'misandry',
  'misogyny',
  'queer',
  'science fiction',
  'sex',
  'silicon valley',
  'transgender'
];

function makeTweet(female, male) {
  return _.shuffle([
    FEMALE_EMOJI + ' ' + female,
    MALE_EMOJI + ' ' + male
  ]).join('\n');
}

function sentencesFromArticles(articles, cb) {
  articles = articles.map(sentence.normalizeQuotes);

  async.map(articles, sentence.tokenize, function (err, sentences) {
    cb(err, _.flatten(sentences));
  });
}

function isFemale(sentence) {
  return sentence.match(/\bshe said\b/i);
}

function isMale(sentence) {
  return sentence.match(/\bhe said\b/i);
}

function containsSaid(sentence) {
  return sentence.match(/said/i);
}

function goodLength(sentence) {
  return sentence.length >= 'I see'.length &&
         sentence.length <= MAX_LENGTH;
}

function pipeline(sentences) {
  debug('pipeline on %d sentences', sentences.length);

  fs.appendFileSync('sentences.txt', sentences.join('\n'));

  var results = _(sentences)
    .map(sentence.normalizeWhitespace)
    .map(sentence.trim)
    .map(quote.unquote)
    .compact()
    .pluck('unquoted')
    .map(sentence.trim)
    .map(sentence.compress)
    .map(sentence.capitalize)
    .filter(quote.evenQuotes)
    .filter(goodLength)
    .uniq()
    .value();

  fs.appendFileSync('sentences.txt', '\n\n');
  fs.appendFileSync('sentences.txt', results.join('\n'));
  fs.appendFileSync('sentences.txt', '\n------------\n');

  return results;
}

module.exports = function (usedQuotes, cbCandidates) {
  var femaleCandidates = [];
  var maleCandidates = [];

  function combinedCandidates() {
    var candidates = [];

    femaleCandidates.forEach(function (female) {
      maleCandidates.forEach(function (male) {
        var tweet = makeTweet(female, male);

        if (tweet.length <= TWEET_LENGTH) {
          candidates.push({
            tweet: tweet,
            quotes: [female, male]
          });
        }
      });
    });

    return candidates;
  }

  function printCandidate(candidate) {
    debug('\t%s', candidate);
  }

  function updateResults(female, male, cb) {
    debug('female candidates %d', female.length);
    female.forEach(printCandidate);

    debug('male candidates %d', male.length);
    male.forEach(printCandidate);

    femaleCandidates = _.uniq(femaleCandidates.concat(female));
    maleCandidates = _.uniq(maleCandidates.concat(male));

    setImmediate(cb);
  }

  function updateCandidates(sentences, cb) {
    sentences = sentences.filter(containsSaid);

    var femaleSentences = pipeline(sentences.filter(isFemale));
    var maleSentences = pipeline(sentences.filter(isMale));

    if (!usedQuotes) {
      return updateResults(femaleSentences, maleSentences, cb);
    }

    usedQuotes.without(femaleSentences, function (filteredFemaleSentences) {
      usedQuotes.without(maleSentences, function (filteredMaleSentences) {
        updateResults(filteredFemaleSentences, filteredMaleSentences, cb);
      });
    });
  }

  async.whilst(function () {
    var candidates = combinedCandidates();

    debug('female', femaleCandidates.length);
    debug('male', maleCandidates.length);
    debug('combined', candidates.length);

    return femaleCandidates.length < 15 ||
           maleCandidates.length < 15 ||
           candidates.length < 15;
  }, function (cbWhile) {
    if (_.random(1, 100) > 75 && searchTerms.length) {
      searchTerms = _.shuffle(searchTerms);

      var searchTerm = searchTerms.pop();

      debug('gathering articles for Google News term', searchTerm);

      async.seq(
        _.bind(googleNews.searchArticles, googleNews),
        sentencesFromArticles,
        updateCandidates
      )(searchTerm, cbWhile);
    } else if (newsSites.length) {
      newsSites = _.shuffle(newsSites);

      var siteName = newsSites.pop();
      var site = simple[siteName];

      debug('gathering articles for news site', siteName);

      async.seq(
        site,
        sentencesFromArticles,
        updateCandidates
      )(cbWhile);
    } else {
      throw new Error('Ran out of search terms and news sites');
    }
  }, function (err) {
    cbCandidates(err, combinedCandidates());
  });
};
