// import angular from 'angular';
// import moment from 'moment';
// import './app-content/app.css';

angular.module('app.directive', []);
angular.module('app', ['ui.router', 'app.directive'])
  .config(config)
  .run(run);

function config($stateProvider, $urlRouterProvider) {
  // default route
  $urlRouterProvider.otherwise('/');
  if (window.user.role == 1) {
    $urlRouterProvider.when('/', '/admin');
    $stateProvider
      .state('editManager', {
        url: '/admin/editManager',
        templateUrl: 'admin/editManager.html',
        controller: 'EditManager.AdminController',
        controllerAs: 'vm',
        data: {
          activeTab: 'new'
        },
      })
      .state('home', {
        url: '/admin',
        templateUrl: 'admin/index.html',
        controller: 'Index.AdminController',
        controllerAs: 'vm',
        data: {
          activeTab: 'home'
        },
      })
      .state('addManager', {
        url: '/admin/addManager',
        templateUrl: 'admin/addManager.html',
        controller: 'AddManager.AdminController',
        controllerAs: 'vm',
        data: {
          activeTab: 'addManager'
        },
      })
      .state('userManagement', {
        url: '/admin/userManagement',
        templateUrl: 'admin/userManagement.html',
        controller: 'UserManagement.AdminController',
        controllerAs: 'vm',
        data: {
          activeTab: 'userManagement'
        },
      });
  } else if (window.user.role == 2) {
    $urlRouterProvider.when('/', '/manager');
    $stateProvider
      .state('dbControl', {
        url: '/dbc',
        templateUrl: 'manager/dbc.html',
        controller: 'Dbc.ManagerController',
        controllerAs: 'vm',
        data: {
          activeTab: 'dbc'
        }
      })
      .state('home', {
        url: '/manager',
        templateUrl: 'manager/index.html',
        controller: 'Index.ManagerController',
        controllerAs: 'vm',
        data: {
          activeTab: 'home'
        },
      })
      .state('roomInfo', {
        url: '/manager/roomInfo/:roomId',
        templateUrl: 'manager/roomInfo.html',
        controller: 'RoomInfo.ManagerController',
        data: {
          activeTab: 'roomInfo'
        },
      })
      .state('addRoom', {
        url: '/manager/addRoom',
        templateUrl: 'manager/addRoom.html',
        controller: 'AddRoom.ManagerController',
        controllerAs: 'vm',
      })
      .state('editRoom', {
        url: '/manager/editRoom/:roomId',
        templateUrl: 'manager/editRoom.html',
        controller: 'EditRoom.ManagerController',
        controllerAs: 'vm',
        data: {
          activeTab: 'roomInfo'
        },
      });
  }
}

function run($http, $rootScope, $window) {
  // add JWT token as default auth header
  $http.defaults.headers.common.Authorization = `Bearer ${$window.jwtToken}`;
  // update active tab on state change
  $rootScope.$on('$stateChangeSuccess', (event, toState, toParams, fromState, fromParams) => {
    $rootScope.activeTab = toState.data.activeTab;
  });
  $http.user = $window.user;
  $rootScope.user = $window.user;
}

// manually bootstrap angular after the JWT token is retrieved from the server
$(() => {
  // get JWT token from server
  console.log('Manual function run');
  $.get('/app/user', (user) => {
    window.user = user;
    $('#userName').html(user.firstName);
  });
  $.get('/app/token', (token) => {
    window.jwtToken = token;
    angular.bootstrap(document, ['app']);
  });
});
