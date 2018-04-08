angular
  .module('app')
  .controller('RoomInfo.ManagerController', Controller);

function Controller(
  UserService, RoomService, FlashService, RoomDataService,
  $stateParams, $scope, $log, $q, $document
) {
  const vm = this;
  vm.user = null;
  UserService.GetCurrent().then((user) => {
    vm.user = user;
  });
  const roomId = $stateParams.roomId;
  const period = 3000;
  const delay = 10000;
  const oneMinute = 60 * 1000;
  const oneHour = 60 * oneMinute;
  const oneDay = 24 * oneHour;
  let timeDiff = 0;
  $scope.avgNum = 0;
  $scope.totalNum = 0;
  $scope.formatDate = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const calDate = date.getDate();
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
    return `${year}/${month}/${calDate} ${weekday}`;
  };

  $scope.exportToCSV = function () {
    function convertToHours(start, end, list) {
      const result = [];
      while (start.diff(end) < 0) {
        start.add(1, 'h');
        if (start.hour() > 8 && start.hour() < 18) {
          let In = 0;
          let Out = 0;
          const tStart = start.valueOf();
          const tEnd = tStart + oneHour;
          const filteredList = list.filter((ele) => {
            const t = Date.parse(ele.Time);
            return t > tStart && t < tEnd;
          });
          if (filteredList.length > 0) {
            filteredList.forEach((ele) => {
              In += ele.In;
              Out += ele.Out;
            });
          }
          result.push({
            Time: start.format('YYYYMMDD,HH:mm'),
            In,
            Out
          });
        }
      }
      return result;
    }
    if ($scope.exportDate) {
      const { start, end } = $scope.exportDate;
      RoomDataService.GetByTimeRange(roomId, start.valueOf(), end.valueOf())
        .then((dataList) => {
          if (!dataList.length) { return; }
          let csvContent = 'data:text/csv;charset=utf-8,';
          csvContent += 'Date,Time,In,Out\r\n';
          const dataListInHour = convertToHours(start, end, dataList);
          dataListInHour.forEach((ele) => {
            csvContent += `${ele.Time},${ele.In},${ele.Out} \r\n`;
          });
          const uri = encodeURI(csvContent);
          const link = document.createElement('a');
          link.setAttribute('href', uri);
          link.setAttribute('download', 'DataExport.csv');
          document.body.appendChild(link); // Required for FF
          link.click();
          document.body.removeChild(link); 
        });
    } else {
      $log.log('Please choose date');
    }
  };

  const initStyle = function () {
    if (typeof ($.fn.daterangepicker) === 'undefined') { return; }
    $('#single_cal3').daterangepicker({
      singleDatePicker: true,
      singleClasses: 'picker_3'
    }, (start, end, label) => {
      console.log(start.toISOString(), end.toISOString(), label);
    });

    $('#reservation').daterangepicker({
      locale: {
        format: 'YYYY-MM-DD'
      },
      startDate: '2018-01-01',
      endDate: '2018-04-30'
    }, (start, end) => {
      $scope.exportDate = { start, end };
      console.log(start.diff(end, 'days'));
      console.log(start.toISOString(), end.toISOString());
    });
  };

  const initTime = function () {
    const deferred = $q.defer();
    RoomService.Get(roomId)
      .then((room) => {
        $log.log(room);
        const timeZone = room.timeZone;
        $scope.avgNum = (room.avgNum === undefined) ? -1 : room.avgNum;
        $scope.totalNum = (room.totalNum === undefined) ? -1 : room.totalNum;
        const sign = timeZone.charAt(0);
        if (sign === '+') {
          timeDiff = (parseInt(timeZone.slice(1, 3), 10) * 3600 * 1000
            + parseInt(timeZone.slice(3, 5), 10) * 60 * 1000);
        } else {
          timeDiff = ((parseInt(timeZone.slice(1, 3), 10) * 3600 * 1000
          + parseInt(timeZone.slice(3, 5), 10) * 60 * 1000) * (-1));
        }
        deferred.resolve(timeDiff);
      })
      .catch((err) => {
        $log.error(err);
        deferred.reject();
      });
    return deferred.promise;
  };

  const initCount = function (startTime, endTime) {
    const deferred = $q.defer();
    let total = 0;
    RoomDataService.GetByTimeRange(roomId, startTime, endTime)
      .then((dataList) => {
        $log.log('Init data list');
        let lastTime = '';
        $.each(dataList, (index, element) => {
          if (element.Time !== lastTime) {
            total = total + element.In - element.Out;
          }
          lastTime = element.Time;
        });
        $log.log(`Init count is ${total}`);
        deferred.resolve(total);
      })
      .catch((err) => {
        FlashService.Error(err);
        deferred.reject(err);
      });
    return deferred.promise;
  };

  initStyle();
  initTime()
    .then((t) => {
      timeDiff = t;
      const now = Date.now();
      const today = new Date(now);
      today.setHours(0);
      today.setMinutes(0);
      today.setSeconds(0);
      today.setMilliseconds(0);
      const zeroTime = Date.parse(today);
      renderToday(zeroTime);
      renderHistory(zeroTime);
      return initCount(Date.parse(today), now - period);
    })
    .then((total) => {
      renderRealTime(total);
    });

  function renderRealTime(initTotal) {
    let total = initTotal;
    const data = [];
    const realTimeOption = {
      tooltip: {
        trigger: 'axis',
        formatter(params) {
          return `${params[0].value[0].toLocaleTimeString('en-GB')} : ${params[0].value[1]}`;
        },
        axisPointer: {
          animation: false,
        },
      },
      xAxis: {
        type: 'time',
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        splitLine: {
          show: false,
        },
      },
      series: [{
        type: 'line',
        showSymbol: false,
        hoverAnimation: false,
        data,
      }],
    };
    const realTime = echarts.init(document.getElementById('real-time'));
    realTime.setOption(realTimeOption);
    const interval = setInterval(updateRealTime, period);
    $scope.$on('$destroy', () => {
      // Make sure that the interval is destroyed too
      clearInterval(interval);
    });

    function updateRealTime() {
      const curTime = Date.now();
      RoomDataService.GetByTimeRange(roomId, curTime - period - delay, curTime - delay)
        .then((dataList) => {
          let lastTime = '';
          $.each(dataList, (index, element) => {
            if (element.Time !== lastTime) {
              total = total + element.In - element.Out;
            }
            lastTime = element.Time;
          });
        })
        .catch((err) => {
          FlashService.Error(err);
          $log.log(err);
        });
      data.push({
        name: new Date(curTime - delay).toString(),
        value: [new Date(curTime - delay), total],
      });
      $('#totalPeople').text(total.toString());
      realTime.setOption({
        series: [{
          data,
        }],
      });
    }
  }
// TODO: render graph into a isolate directive
  function renderToday(zeroTime) {
    const histoX = [];
    const inData = [];
    const outData = [];
    const totalData = [];
    const promArr = [];
    for (let i = 8; i < 18; i++) {
      histoX.push(`${i}:00 - ${i + 1}:00`);
      $log.log(`Start time is ${new Date(zeroTime + (i * oneHour))}`);
      $log.log(`End time is ${new Date(zeroTime + ((i + 1) * oneHour))}`);
      promArr[i - 8] = RoomDataService.GetByTimeRange(
        roomId,
        zeroTime + (i * oneHour), zeroTime + ((i + 1) * oneHour)
      )
        .then((dataList) => {
          let inSum = 0;
          let outSum = 0;
          let lastTime = '';
          $.each(dataList, (index, element) => {
            if (element.Time !== lastTime) {
              inSum += element.In;
              outSum += element.Out;
            }
            lastTime = element.Time;
          });
          inData[i - 8] = inSum;
          outData[i - 8] = outSum;
          totalData[i - 8] = inSum - outSum;
        })
        .catch((err) => {
          $log.error(err);
          FlashService.Error(err);
        });
    }
    const historyOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { // 坐标轴指示器，坐标轴触发有效
          type: 'shadow', // 默认为直线，可选为：'line' | 'shadow'
        },
      },
      legend: {
        data: ['In', 'Out', 'Total'],
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: [{
        type: 'category',
        axisTick: { show: false },
        data: histoX
      }],
      yAxis: [{ type: 'value' }],
    };
    const history = echarts.init(document.getElementById('history'));
    Promise.all(promArr).then(() => {
      history.setOption(historyOption);
      history.setOption({
        series: [{
          name: 'In',
          type: 'bar',
          stack: '总量',
          label: {
            normal: {
              show: true,
            },
          },
          data: inData,
        },
        {
          name: 'Out',
          type: 'bar',
          stack: '总量',
          label: {
            normal: {
              show: true,
              position: 'bottom',
            },
          },
          data: outData,
        },
        {
          name: 'Total',
          type: 'line',
          data: totalData,
        },
        ],
      });
    });
  }

  function renderHistory(zeroTime) {
    const startTime = zeroTime - 7 * oneDay;
    const resultData = [];
    const promArr = [];
    for (let i = 0; i < 7; i++) {
      $log.log(`Start date is ${new Date(startTime + (i * oneDay) - timeDiff)}`);
      $log.log(`End date is ${new Date(startTime + ((i + 1) * oneDay) - timeDiff)}`);
      promArr[i] = RoomDataService.GetByTimeRange(
        roomId,
        startTime + (i * oneDay), startTime + ((i + 1) * oneDay)
      )
        .then((dataList) => {
          let inSum = 0;
          let outSum = 0;
          let lastTime = '';
          $.each(dataList, (index, element) => {
            if (element.Time !== lastTime) {
              inSum += element.In;
              outSum += element.Out;
            }
            lastTime = element.Time;
          });
          resultData.push({
            date: new Date(startTime + (i * oneDay) - timeDiff),
            in: inSum,
            out: outSum,
            total: inSum - outSum,
          });
        })
        .catch((err) => {
          $log.error(err);
          FlashService.Error(err);
        });
    }
    Promise.all(promArr).then(() => {
      resultData.sort((prev, next) => (prev.date - next.date));
      $scope.historyData = resultData;
    });
  }
}
