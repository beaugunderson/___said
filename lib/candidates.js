'use strict';

var async = require('async');
var debug = require('debug')('___said');
var newsText = require('news-text');
var ParseEnglish = require('parse-english');
var Retext = require('retext');
var retextInspect = require('retext-inspect');
var retextVisit = require('retext-visit');
var _ = require('lodash');

var googleNews = new newsText.GoogleNews();

var retext = new Retext(new ParseEnglish())
  .use(retextInspect)
  .use(retextVisit);

function sentences(article, cb) {
  retext.parse(article, function (err, tree) {
    if (err) {
      return cb(err);
    }

    var sentences = [];

    tree.visitType(tree.SENTENCE_NODE, function (sentenceNode) {
      sentences.push(sentenceNode.toString());
    });

    cb(err, sentences);
  });
}

function sentencesFromArticles(articles, cb) {
  async.map(articles, sentences, function (err, sentences) {
    cb(err, _.flatten(sentences));
  });
}

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

var newsSites = _.clone(newsText.simple);

var TWEET_LENGTH = 140;
var EMOJI_LENGTH = 2;

var FEMALE_EMOJI = '👩';
var MALE_EMOJI = '👨';

var MAX_LENGTH = (TWEET_LENGTH - EMOJI_LENGTH) * 0.75;

function female(sentence) {
  return sentence.match(/\bshe said\b/i);
}

function male(sentence) {
  return sentence.match(/\bhe said\b/i);
}

function containsSaid(sentence) {
  return sentence.match(/said/i);
}

function goodLength(sentence) {
  return sentence.length >= '"OK", she said.'.length &&
         sentence.length <= MAX_LENGTH;
}

function unquote(sentence) {
  return sentence.replace(/^['"]*/, '')
                 .replace(/,*['"]*,* (she|he) said.*$/i, '');
}

function makeTweet(female, male) {
  return _.shuffle([
    FEMALE_EMOJI + ' ' + female,
    MALE_EMOJI + ' ' + male
  ]).join('\n');
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
          candidates.push(tweet);
        }
      });
    });

    return candidates;
  }

  function updateCandidates(sentences, cb) {
    sentences = sentences.filter(containsSaid);

    var femaleSentences = sentences.filter(male)
      .map(unquote)
      .filter(goodLength);

    var maleSentences = sentences.filter(female)
      .map(unquote)
      .filter(goodLength);

    debug('female', femaleSentences);
    debug('male', maleSentences);

    maleCandidates = _.uniq(maleCandidates.concat(maleSentences));
    femaleCandidates = _.uniq(femaleCandidates.concat(femaleSentences));

    cb();
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
    } else if (_.keys(newsSites.length)) {
      var siteName = _.sample(_.keys(newsSites));
      var site = newsSites[siteName];

      delete newsSites[siteName];

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
    cb(err, combinedCandidates());
  });
};
