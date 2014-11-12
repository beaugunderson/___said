'use strict';

var async = require('async');
var debug = require('debug')('___said');
var newsText = require('news-text');
var path = require('path');
var ValueCache = require('level-cache-tools').ValueCache;
var _ = require('lodash');

var sentence = require('./sentence.js');

var googleNews = new newsText.GoogleNews();
var simple = new newsText.Simple();

var usedQuotes = new ValueCache(path.join(path.dirname(require.main.filename),
  'used-quotes'));

var TWEET_LENGTH = 140;

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
  async.map(articles, sentence.tokenize, function (err, sentences) {
    cb(err, _.flatten(sentences));
  });
}

function female(sentence) {
  return sentence.match(/\bshe said\b/i);
}

function male(sentence) {
  return sentence.match(/\bhe said\b/i);
}

function containsSaid(sentence) {
  return sentence.match(/said/i);
}


module.exports = function (cb) {
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

  function updateCandidates(sentences, cb) {
    sentences = sentences.filter(containsSaid);

    debug('uncleaned', sentences);

    var femaleSentences = sentence.pipeline(sentences.filter(female));
    var maleSentences = sentence.pipeline(sentences.filter(male));

    usedQuotes.without(femaleSentences, function (filteredFemaleSentences) {
      usedQuotes.without(maleSentences, function (filteredMaleSentences) {
        debug('female', filteredFemaleSentences);
        debug('male', filteredMaleSentences);

        femaleCandidates = _.uniq(femaleCandidates.concat(filteredFemaleSentences));
        maleCandidates = _.uniq(maleCandidates.concat(filteredMaleSentences));

        cb();
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
      _.shuffle(newsSites);

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
    debug('female candidates', femaleCandidates);
    debug('male candidates', maleCandidates);

    cb(err, combinedCandidates());
  });
};
