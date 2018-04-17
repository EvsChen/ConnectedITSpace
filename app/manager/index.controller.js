angular
  .module('app')
  .controller('Index.ManagerController', Controller);

function Controller(
  UserService, RoomService, RoomDataService, FlashService,
  $state, $log, $scope,
) {
  const vm = this;
  vm.user = null;
  initController();
  $scope.deleteRoom = function (_RoomId) {
    RoomService.Delete(_RoomId)
      .then(() => {
        $state.reload();
      })
      .catch((err) => {
        FlashService.Error(err);
      });
  };
  $scope.transTo = function (state, params = {}) {
    $state.go(state, params);
  };

  $(document).ready(() => {
    $('.middleadd2').click(() => {
      if ($('.triangle_display').css('display') == 'none') {
        $('.triangle_display').show();
      } else {
        $('.triangle_display').hide();
      }
    });
  });

  function initController() {
    // get current user
    UserService.GetCurrent().then((user) => {
      vm.user = user;
      RoomService.GetRoomList(vm.user.sub).then((roomList) => {
        $scope.roomList = roomList;
        roomList.forEach((ele, ind) => {
          RoomDataService.UpdateAllNum(ele._id)
            .then(({ totalNum }) => {
              // TODO: the update of total num should be finished at real time
              // i.e. a event should be triggered when the corresponding room gets updated
              $scope.roomList[ind].totalNum = totalNum;
            })
            .catch((err) => {
              FlashService.Error(err);
            });
        });
      });
    });
  }
}
