var User = function ($stateParams, $scope, $state, $window, $rootScope, AuthService, localStorageService, toastr, $location, ToastrService, $modal, $http, host, UserService){
  this.$stateParams = $stateParams;
  this.$scope = $scope;
  this.$state = $state;
  this.$window = $window;
  this.$rootScope = $rootScope;
  this.AuthService = AuthService;
  this.localStorageService = localStorageService
  this.toastr = toastr;
  this.ToastrService = ToastrService;
  this.$location = $location;
  this.$modal = $modal;
  this.$http = $http;
  this.host = host;
  this.UserService = UserService;
  
  var self = this;

  self.$window.scrollTo(0,0)

  // Handle main spinners in one place.
  self.$scope.spinner = {
  };

  // TODO this function costs too many request, please think for alternative solution 
  self.AuthService.checkToken({redirect:true})
 
  if (self.$stateParams.mode && self.$stateParams.mode !== 'list') {
    self.get(self.$stateParams.mode);
  } else {
    self.list();
  }
}

User.prototype.showUser = function(data) {
  var self = this;
  if (self.$rootScope.syncUser) {
    return;
  }
  self.$rootScope.currentItem = data;
  self.$rootScope.userModal = self.$modal.open({
    templateUrl : 'user/userModal.html',
    size: 'md',
    controller : 'UserCtrl as user'
  })
  self.$rootScope.userModal.result.then(function(){
  }, function(){
    self.$rootScope.currentItem = null;
    self.list();
  })
}

User.prototype.addUser = function() {
  var self = this;
  self.$rootScope.currentItem = {};
  self.$rootScope.userModal = self.$modal.open({
    templateUrl : 'user/userModal.html',
    size: 'md',
    controller : 'UserCtrl as user'
  })
  self.$rootScope.userModal.result.then(function(){
  }, function(){
    self.$rootScope.currentItem = null;
    self.list();
  })
}

User.prototype.list = function(option){
  var self = this;
  self.$scope.spinner.list = true;
  self.$scope.mode = 'list';
  var option = option || { page : 1 };
  self.UserService.list(option)
  .then(function(result){
    self.$scope.spinner.list = false;
    self.$scope.list = result.data;
  })
  .catch(function(result) {
    self.$scope.spinner.list = false;
    self.ToastrService.parse(result);
  })
}

User.prototype.get = function(id) {
  var self = this;
  self.$scope.spinner.user = true;
  self.$scope.mode = 'item';
  self.UserService.get(id)
  .then(function(result) {
    self.$rootScope.currentItem = result.data;
    self.$scope.spinner.user = false;
  })
  .catch(function(result) {
    self.$scope.spinner.user = false;
    self.ToastrService.parse(result);
  })
}

User.prototype.paginate = function() {
  var self = this;
  var opt = {
    page : self.$scope.list.page
  }
  self.list(opt);
}

User.prototype.create = function(data) {
  var self = this;
  var data = angular.copy(data);
  self.UserService.create(data)
  .then(function(result) {
    self.$rootScope.userModal.dismiss();
  })
  .catch(function(result) {
    self.ToastrService.parse(result);
  })
}

User.prototype.update = function(data) {
  var self = this;
  var data = angular.copy(data);
  self.UserService.update(data)
  .then(function(result) {
    self.$rootScope.userModal.dismiss();
  })
  .catch(function(result) {
    self.ToastrService.parse(result);
  })
}

User.prototype.changePassword = function(data) {
  var self = this;
  if (!data.currentPassword || !data.password || !data.repeatPassword) {
    return alert('Mohon lengkapi form isian.');
  }
  var obj = {
    currentPassword : data.currentPassword,
    password : data.password,
  }
  self.UserService.changePassword(obj)
  .then(function(result) {
    if (result.data && result.data.success) {
      self.ToastrService.changePasswordSuccess();
      self.$rootScope.changePasswordModal.dismiss();
    } else {
      self.$scope.currentItem = {}; 
      self.ToastrService.changePasswordFailed();
    }
  })
  .catch(function(result) {
    self.ToastrService.parse(result);
  })
}

User.prototype.delete = function(id) {
  var self = this;
  // Prevent self delete
  if (id.toString()===self.$rootScope.currentUserProfileId.toString()) {
    return;
  }
  self.UserService.delete(id)
  .then(function(result) {
    self.$rootScope.userModal.dismiss();
    self.list();
  })
  .catch(function(result) {
    self.ToastrService.parse(result);
  })
}

User.prototype.someFunc = function(params) {
  var self = this;
}

User.inject = [ '$stateParams', '$scope', '$state', '$window', '$rootScope', 'AuthService', 'localStorageService', 'toastr', '$location', 'ToastrService', '$modal', '$http', 'host' , 'UserService'];

angular.module('user',[])
.controller('UserCtrl', User)
;

