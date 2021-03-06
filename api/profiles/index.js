var boom = require('boom');
var mongoose = require("mongoose");
var Joi = require("joi");
var _ = require("lodash");
var uuid = require("uuid");
var Grid = require("gridfs-stream");
var parse = require("mongoose-parse");
var moment = require('moment');
var config = require(__dirname + '/../../config.json');
var fs = require('fs');
Grid.mongo = mongoose.mongo;

// A user sync plugin could be added to /api. This is a flag to prevent user data modification if such plugin is being used.
var syncUser = false; 

var User = require("../00-user");

var profileSchema = {
  fullName : String,
  email : String,
  username : {
    type : String,
    unique : true
  },
  role : String,
  joinedSince : Date,
  activationCode : String,
  userId : String,
  avatar: mongoose.Schema.ObjectId,
}
var schema = {
  fullName : Joi.string().required(),
  username : Joi.string().required(),
  email : Joi.string().email().required(),
  password : Joi.string().required(),
}

var registerSchema = {
  fullName : Joi.string().required(),
  username : Joi.string().required(),
  email : Joi.string().email().required(),
  password : Joi.string().required(),
  repeatPassword : Joi.string().required(),
}

var updateSchema = {
  fullName : Joi.string().optional(),
  password : Joi.string().optional(),
  email : Joi.forbidden(),
  username : Joi.forbidden(),
}

var passwordSchema = {
  currentPassword : Joi.string().required(),
  password : Joi.string().required(),
}

var profileModel = function() {
  var registered = false;
  var m;
  try {
    m = mongoose.model("Profiles");
    registered = true;
  } catch(e) {
  }

  if (registered) return m;

  var s = new mongoose.Schema(profileSchema);
  m = mongoose.model("Profiles", s);
  return m;
}

var Profiles = function(server, options, next) {
  this.server = server;
  this.options = options || {};
  this.registerEndPoints();
}

Profiles.prototype.registerEndPoints = function() {
  var self = this;
  self.server.route({
    method: "GET",
    path: "/api/users",
    config : {
      auth : false
    },
    handler: function(request, reply) {
      self.list(request, reply);
    }
  });
  self.server.route({
    method: "POST",
    path: "/api/user-register",
    handler: function(request, reply) {
      self.register(request, reply);
    },
    config : {
      validate : {
        payload: Joi.object(registerSchema)
      }
    }
  });
  self.server.route({
    method: "POST",
    path: "/api/users",
    handler: function(request, reply) {
      self.register(request, reply);
    },
    config : {
      validate : {
        payload: Joi.object(schema)
      }
    }
  });
  self.server.route({
    method: "GET",
    path: "/api/users/confirm/{code}",
    config : {
      auth: false,
    },
    handler: function(request, reply) {
      self.confirm(request, reply);
    }
  });
  self.server.route({
    method: "POST",
    path: "/api/user/{id}",
    config : {
      validate : {
        payload: Joi.object(updateSchema)
      }
    },
    handler: function(request, reply) {
      self.update(request, reply);
    }
  });
  self.server.route({
    method: "POST",
    path: "/api/user/{id}/set-password",
    config : {
      validate : {
        payload: Joi.object(passwordSchema)
      }
    },
    handler: function(request, reply) {
      self.setPassword(request, reply);
    }
  });
  self.server.route({
    method: "GET",
    path: "/api/user/{id}",
    config : {
    },
    handler: function(request, reply) {
      self.get(request, reply);
    }
  });
  self.server.route({
    method: "DELETE",
    path: "/api/user/{id}",
    config : {
    },
    handler: function(request, reply) {
      self.delete(request, reply);
    }
  });
}

Profiles.prototype.list = function(request, reply) {
  var self = this;
  var defaultLimit = 10;
  var limit = request.query.limit || defaultLimit;
  limit = parseInt(limit);
  var page = request.query.page || 1;
  page--;
  page = parseInt(page);

  var q = {}
  var count;
  
  // count all record
  profileModel()
    .count(q)
    .exec(function(err, result){
    if (err) {
      return reply(err).statusCode = 400;
    }
    count = result;
    var query = profileModel()
      .find(q)
      .limit(limit)
      .skip(limit * page);
    query
      .lean()
      .exec(function(err, result) {
      if (err) {
        return reply(err).statusCode = 400;
      }
      var obj = {
        total : count,
        page : page++,
        limit : limit,
        data : result
      }
      reply(obj).type("application/json");
    });
  });
}

Profiles.prototype.register = function(request, reply) {
  var self = this;
  // Force to have 'user' role
  request.payload.role = 'user';
  request.payload.joinedSince = new Date();
  if (request.payload.password != request.payload.repeatPassword) {
    var err = new Error('Repeat password not matched');
    return reply(err).statusCode = 400;
  }
  profileModel()
    .findOne({userId: request.auth.credentials.userId})
    .exec(function(err, result) {
    if (err) {
      return reply(err).statusCode = 400;
    }
    if (result.role == "admin") {
      request.isActive = true;
      User.class.create(request, function(err, result) {
        if (err) {
          return reply(err).statusCode = 400;
        } else {
          request.payload.userId = result.id;
          self.realRegister(request, function(err, profile) {
            if (err) return reply(err).statusCode = 500;
            reply(profile);
          });
        }
      })
    } else {
      return reply({
        error: "Unauthorized",
        message: "Failed to register new user",
        statusCode: 401
      }).code(401);
    }
  })
}

Profiles.prototype.confirm = function(request, reply) {
  var self = this;
  profileModel().findOne({activationCode : request.params.code}, function(err, result) {
    if (err) {
      return reply(err).statusCode = 400;
    }
    if (!result) {
      return reply({
        error: "Not Found", 
        statusCode: 404, 
        message: "User profile was not found"
      }).code(400);
    }
    var email = result.email;
    User.class.activate(result.userId, function(err, result) {
      if (err) {
        return reply(err).statusCode = 400;
      }
      reply({success: true})
    });
  })

}

Profiles.prototype.update = function(request, reply) {
  var self = this;
  if (syncUser) {
    return reply(boom.methodNotAllowed());
  }
  if (request.auth.credentials.role!=='admin') {
    return reply(boom.methodNotAllowed());
  }
  var bogus = self.checkBogus(request.params.id);
  if (bogus.isBogus) {
    return reply(bogus.reply).statusCode = 404;
  }
  profileModel()
    .findOne({userId: request.auth.credentials.userId})
    .exec(function(err, result) {
    if (err) {
      return reply(err).statusCode = 400;
    }

    // This request could be done by the same user or the current logged user is an admin
    if (request.params.id == result._id
    || result.role === "admin") {
      if (_.isEmpty(request.payload)) {
        return reply({
          error: "Bad Request", 
          statusCode: 400, 
          message: "Payload should not be empty"
        }).code(400);
      }

      // The role modification of an user only could be done if the current logged user is an admin
      // TODO : 
      // role user : same id, 
      // role admin, same id, different id
      if (request.auth.credentials.role==="user" 
        && (
            (result.role != "admin" && request.payload.role)
            || request.params.id != result._id 
            || request.payload.role === "admin"
            || (result.role === "admin")
            || (request.params.id != result._id && result.role=="user")
          )
        ){
        return reply({
          error: "Unauthorized",
          message: "Failed to update user_",
          statusCode: 400
        }).code(400);
      }
      realUpdate(request, reply);
    } else {
      return reply({
        error: "Unauthorized",
        message: "Failed to update user",
        statusCode: 400
      }).code(400);
    }
  });
}

Profiles.prototype.setPassword = function(request, reply) {
  var self = this;
  if (syncUser) {
    return reply(boom.methodNotAllowed());
  }
  var bogus = self.checkBogus(request.params.id);
  if (bogus.isBogus) {
    return reply(bogus.reply).statusCode = 404;
  }
  profileModel()
    .findOne({userId: request.auth.credentials.userId})
    .exec(function(err, result) {
    if (err) {
      return reply(err).statusCode = 400;
    }

    // This request could be done by the same user or the current logged user is an admin
    if (request.params.id == result._id
    || result.role == "admin") {
      if (_.isEmpty(request.payload)) {
        return reply({
          error: "Bad Request", 
          statusCode: 400, 
          message: "Payload should not be empty"
        }).code(400);
      }

      profileModel()
      .findOne({_id:request.params.id})
      .lean()
      .exec(function(err, result) {
        if (err) {
          return reply(err);
        }
        if (!result) {
          return reply({
            error: "Not Found", 
            statusCode: 404, 
            message: "User profile was not found"
          }).code(400);
        }
        User.class.setPassword(result.userId, request.payload.currentPassword, request.payload.password, function(err, result) {
          if (err) {
            return reply(err);
          }
          reply({success : true})
        })
      });
    } else {
      return reply({
        error: "Bad Reqest",
        message: "Failed to update user",
        statusCode: 400
      }).code(400);
    }
  });
}

Profiles.prototype.get = function(request, reply) {
  var self = this;
  var bogus = self.checkBogus(request.params.id);
  if (bogus.isBogus) {
    return reply(bogus.reply).statusCode = 404;
  }
  profileModel()
    .findOne({_id:request.params.id})
    .exec(function(err, result) {
    if (err) {
      return reply(err).statusCode = 400;
    }
    if (!result) {
      return reply({
        error: "Not Found", 
        statusCode: 404, 
        message: "User profile was not found"
      }).code(400);
    }
    reply(result).type("application/json");
  });
}

Profiles.prototype.delete = function(request, reply) {
  var self = this;
  if (syncUser) {
    return reply(boom.methodNotAllowed());
  }
  var bogus = self.checkBogus(request.params.id);
  if (!request.auth && request.auth.credentials) {
    return reply(boom.unauthorized());
  }
  if (bogus.isBogus) {
    return reply(bogus.reply).statusCode = 404;
  }
  profileModel()
    .findOne({_id:request.params.id})
    .exec(function(err, result) {
    if (err) {
      return reply(err).statusCode = 400;
    }
    if (!result) {
      return reply({
        error: "Not Found", 
        statusCode: 404, 
        message: "User profile was not found"
      }).code(400);
    }
    if (!result.userId) {
      return realDelete(request, reply);
    }
    // Prevent self delete
    if (result.userId.toString() === request.auth.credentials.userId.toString()) {
      return reply({
        error: "Not Found", 
        statusCode: 404, 
        message: "Couldn't self delete."
      }).code(400);
    }
    User.class.remove(result.userId, function(err, result){
      if (err) {
        return reply(err).statusCode = 400;
      }
      realDelete(request, reply);
    })
  })
}


Profiles.prototype.checkBogus = function(id) {
  var bogus = false;
  try {
    id = mongoose.Types.ObjectId(id);
  } catch (err) {
    bogus = true;
  }
  var result = {
    isBogus: bogus,
    reply: !bogus? {} : {
      error: "Not Found",
      statusCode: 404,
      message: "User profile was not found",
      validation: {
        source: "DB",
        keys: ["id"]
      }
    }
  }
  return result;
}


Profiles.prototype.realRegister = function(request, cb) {
  var self = this;
  var newUser = profileModel();
  newUser.fullName = request.payload.fullName;
  newUser.username = request.payload.username;
  newUser.email = request.payload.email;
  newUser.role = request.payload.role;
  newUser.userId = request.payload.userId;
  newUser.gender = request.payload.gender;
  newUser.city = request.payload.city;
  newUser.joinedSince = request.payload.joinedSince;
  newUser.birthDate = moment(request.payload.birthDate);
  newUser.activationCode = uuid.v4();
  profileModel().create(newUser, function(err, result) {
    if (err) {
      return cb(parse(err));
    }
    var profile = {
      email : result.email,
      username : result.username,
      _id : result._id,
      fullName : result.fullName,
      role : result.role,
      userId: result.userId
    }
    cb(null, profile);
  })
}

// Privates

var realUpdate = function(request, reply) {
  var self = this;
  var options = {upsert: true};
  profileModel()
    .findOneAndUpdate(
    {_id:request.params.id}, 
    { $set : request.payload},
    function(err, result) {
    if (err) {
      return reply(err).statusCode = 400;
    }
    if (!result) {
      return reply({
        error: "Not Found", 
        statusCode: 404, 
        message: "User profile was not found"
      }).code(400);
    }
    profileModel()
      .findOne({_id:request.params.id})
      .exec(function(err, result) {
      if (err) {
        return reply(err).statusCode = 400;
      }
      var profile = {
        email : result.email,
        username : result.username,
        _id : result._id,
        fullName : result.fullName,
        role : result.role,
        userId: result.userId
      }
      if (!request.payload.password) {
        return reply(profile);
      }
      User.class.setPasswordRecovery(result.userId, request.payload.password, function(err, user) {
        if (err) {
          return reply(err).statusCode = 400;
        }
        reply(profile);
      })
    });
  });
}

var realDelete = function(request, reply) {
  var self = this;
  profileModel()
  .remove({_id:request.params.id}, function(err, result) {
    if (err) {
      return reply(err).statusCode = 400;
    }
    reply({success: true}).type("application/json").statusCode = 200;
  });
}

exports.register = function(server, options, next) {
  new Profiles(server, options, next);
  next();
};

exports.register.attributes = {
  pkg: require("./package.json")
};

exports.model = profileModel;
exports.class = Profiles.prototype;
exports.schema = profileSchema;
