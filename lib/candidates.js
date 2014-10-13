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

function clean(sentence) {
  // Collapse spaces
  return sentence.replace(/\s+/, ' ')
    .trim();
}

function singleQuotes(sentence) {
  var matches = sentence.match(/(^|[^\w])[']+|[']+([^\w]|$)/);

  if (matches) {
    return matches.length;
  }

  return 0;
}

function doubleQuotes(sentence) {
  var matches = sentence.match(/(^|[^\w])["]+|["]+([^\w]|$)/);

  if (matches) {
    return matches.length;
  }

  return 0;
}

function evenQuotes(sentence) {
  return singleQuotes(sentence) % 2 === 0 &&
         doubleQuotes(sentence) % 2 === 0;
}

function unquote(sentence) {
  var modified = sentence.replace(/,* *(she|he) *said.*$/i, '');

  // If the entire sentence is wrapped in '
  if (modified.match(/^'.*'$/)) {
    modified = modified.replace(/^'|'$/g, '');
  }

  // If the entire sentence is wrapped in "
  if (modified.match(/^".*"$/)) {
    modified = modified.replace(/^"|"$/g, '');
  }

  if (doubleQuotes(modified) === 1) {
    // Remove any trailing commas, quotes, and spaces
    modified = modified.replace(/^ *"* *| *"*,*"* *$/, '');
  }

  if (singleQuotes(modified) === 1) {
    modified = modified.replace(/^ *'* *| *'*,*'* *$/, '');
  }

  // Remove any trailing commas and spaces
  return modified.replace(/ *, *$/, '');
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

  function pipeline(sentences) {
    return sentences
      .map(clean)
      .map(unquote)
      .filter(evenQuotes)
      .filter(goodLength);
  }

  function updateCandidates(sentences, cb) {
    sentences = sentences.filter(containsSaid);

    debug('uncleaned', sentences);

    var femaleSentences = pipeline(sentences.filter(female));
    var maleSentences = pipeline(sentences.filter(male));

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
