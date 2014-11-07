'use strict';

var ParseEnglish = require('parse-english');
var Retext = require('retext');
var retextInspect = require('retext-inspect');
var retextVisit = require('retext-visit');

var TWEET_LENGTH = 140;
var EMOJI_LENGTH = 2;

var MAX_LENGTH = (TWEET_LENGTH - EMOJI_LENGTH) * 0.8;

var retext = new Retext(new ParseEnglish())
  .use(retextInspect)
  .use(retextVisit);

exports.tokenize = function (text, cb) {
  retext.parse(text, function (err, tree) {
    if (err) {
      return cb(err);
    }

    var results = [];

    tree.visitType(tree.SENTENCE_NODE, function (sentenceNode) {
      results.push(sentenceNode.toString());
    });

    cb(err, results);
  });
};

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

var unquote = exports.unquote = function (sentence) {
  var modified;

  // Compound quote
  if (sentence.match(/(she|he) +said,? *['"]/)) {
    modified = sentence.replace(/['"],* *(she|he) +said,? *['"]/i, ' ');
  } else {
    modified = sentence.replace(/,* *(she|he) +said[.,]?/i, '');
  }

  // Remove dangling punctation if it's the only thing past a quote
  modified = modified.replace(/(['"])[,. -]+$/, '$1');

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

  // Remove any leading or trailing commas and spaces
  return modified
    .replace(/^[, ]+/, '')
    .replace(/[, ]+$/, '');
};

var compress = exports.compress = function (sentence) {
  return sentence
    .replace(/[.]{2,3}/g, '…')
    .replace(/\.$/, '');
};

var capitalize = exports.capitalize = function (sentence) {
  return sentence.charAt(0).toUpperCase() + sentence.substring(1);
};

exports.pipeline = function (sentences) {
  return sentences
    .map(clean)
    .map(unquote)
    .map(compress)
    .map(capitalize)
    .filter(evenQuotes)
    .filter(goodLength);
};
