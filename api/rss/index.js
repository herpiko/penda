var boom = require('boom');
var rssParser = require('rss-parser');
var moment = require('moment');
var Joi = require('joi');

var RSS = function(server, options, next) {
  this.server = server;
  this.options = options || {};
  this.registerEndPoints();
}

RSS.prototype.registerEndPoints = function() {
  var self = this;
  self.cache = {};
  self.server.route({
    method: 'GET',
    path: '/api/rss',
    config : {
      auth : false,
      tags : ['api'],
      description : 'RSS (public)',
      notes : 'This is a RSS helper to fetch RSS data and returns the converted-XML object. You need to describe the RSS url in the url query. This RSS result cached on one hour.',
      plugins : {
        'hapi-swagger' : {
          responses : {
            '200': {
              description : 'OK',
              schema : Joi.array().items({
                title : Joi.string(),
                link : Joi.string(),
                pubDate : Joi.string(),
                content : Joi.string(),
                contentSnippet : Joi.string(),
              })
            },
            '400' : {
              description : 'Bad request',
            },
            '500': {
              description : 'Internal server error',
            },
          }
        }
      },
      validate : {
        query : {
          url : Joi.string().required(),
        }
      }
    },
    handler: function(request, reply) {
      var now = moment();
      if (self.cache && self.cache.data && now.diff(self.cache.timestamp) < 3600000) {
        return reply(self.cache.data); 
      }
      rssParser.parseURL(request.query.url, function(err, parsed) {
				if (err) {
					return reply(err);
				}
        self.cache.timestamp = moment();
        self.cache.data = parsed.feed.entries;
				reply(parsed.feed.entries);
      })
    }
  });
}
exports.register = function(server, options, next) {
  new RSS(server, options, next);
  next();
};

exports.register.attributes = {
  pkg: require('./package.json')
};

