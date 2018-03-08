/**
 * TODO Logging on the server
 */

var app = angular.module('trilaterationApp', []);
app.controller('mainController', function($scope, $timeout) {

    $scope.title = 'Trilateration';
    $scope.tags = [];

    $scope.updateData = function(data) {
        $timeout(function(){
            $scope.tags = data;
        }, 0);
    }

});