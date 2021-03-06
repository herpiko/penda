'use strict';
var DatasetService = function($http, AuthService, host, $rootScope, Upload, localStorageService) {
  this.$http = $http;
  this.host = host;
  this.AuthService = AuthService;
  this.$rootScope = $rootScope;
  this.Upload = Upload;
  this.localStorageService = localStorageService;
  var self = this;
}

DatasetService.prototype.upload = function(file, obj) {
  var self = this;
  /* var payload = {} */
  /* console.log('----------------------'); */
  /* console.log(obj); */
  /* var keys = Object.keys(obj); */
  /* for (var i in keys) { */
  /*   payload[keys[i]] = obj[keys[i]]; */
  /* } */
  /* console.log(payload); */
  var payload = {
    data : JSON.stringify(angular.copy(obj)),
  }
  payload.file = file; 
  var path = self.host + '/api/upload';
  var headers;
  headers = {
    Authorization : self.localStorageService.get('token')
  }
  var req = {
    method: 'POST',
    data : payload,
    timeout : 300000,
    url: path,
    headers : headers
  }
  return self.Upload.upload(req);
}

DatasetService.prototype.list = function(option) {
  var self = this;
  var page = option.page || 1;
  var limit = option.limit || 10;
  var path = '/api/datasets';
  path += '?page=' + page;
  path += '&limit=' + limit;
  var keys = Object.keys(option);
  for (var i in keys) {
    if (keys[i] === 'page' || keys[i] === 'limit') {
      continue;
    }
    if (typeof keys[i] === 'string') {
      path += '&' + keys[i] + '=' + option[keys[i]];
    }
  }
  return self.$http({
    headers : {
      Authorization : self.localStorageService.get('token'),
    },
    method: 'GET',
    url : self.host + path,
  });
}

DatasetService.prototype.get = function(filename, option) {
  var self = this;
  option = option || {};
  var path = '/api/dataset/' + filename;
  if (option.sql) {
    path += '?sql=' + option.sql;
  }
  return self.$http({
    headers : {
      Authorization : self.localStorageService.get('token'),
    },
    method: 'GET',
    url : self.host + path,
  });
}

DatasetService.prototype.update = function(data) {
  var self = this;
  var path = '/api/dataset/' + data.filename;
  return self.$http({
    headers : {
      Authorization : self.localStorageService.get('token'),
    },
    method: 'POST',
    url : self.host + path,
    data : data
  })
}

DatasetService.prototype.delete = function(filename) {
  var self = this;
  var path = '/api/dataset/' + filename;
  return self.$http({
    headers : {
      Authorization : self.localStorageService.get('token'),
    },
    method: 'DELETE',
    url : self.host + path,
  });
}


DatasetService.inject = ['$http', 'AuthService', 'host', 'Upload', 'localStorageService']

angular.module('datasetService', [])
.service("DatasetService", DatasetService)

