angular
  .module('app')
  .controller('RoomInfo.ManagerController', ['UserService', 'RoomService', 'FlashService', 'RoomDataService',
    '$stateParams', '$scope', '$log', '$q', Controller]);

function Controller(
  UserService, RoomService, FlashService, RoomDataService,
  $stateParams, $scope, $log, $q,
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
  $scope.curNum = 0;
  $scope.formatDate = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const calDate = date.getDate();
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
    return `${year}/${month}/${calDate} ${weekday}`;
  };
  $scope.exportDate = {
    start: moment().subtract(7,'days'),
    end: moment()
  };
  $scope.exportToCSV = function () {
    function convertToHours(start, end, list) {
      const result = [];
      let oldDay = 0;
      while (start.diff(end) < 0) {
        start.add(1, 'h');
        const d = start.dayOfYear();
        if (start.hour() >= 8 && start.hour() < 18) {
          if (d !== oldDay) {
            oldDay = d;
            result.push({
              Date: start.format('YYYY-MM-DD'),
              Number: []
            });
          }
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
          result[result.length - 1].Number.push(In);
          result[result.length - 1].Number.push(Out);          
        }
      }
      return result;
    }
    const { start, end } = $scope.exportDate;
    RoomDataService.GetByTimeRange(roomId, start.valueOf(), end.valueOf())
      .then((dataList) => {
        let csvContent = 'data:text/csv;charset=utf-8,';
        csvContent += 'Date,';
        for (let i = 8; i < 18; i++) {
          csvContent += `${i}-${i + 1} In,`;
          csvContent += `${i}-${i + 1} Out,`;
        }
        csvContent += '\r\n';
        const dataListInHour = convertToHours(start, end, dataList);
        dataListInHour.forEach((ele) => {
          csvContent += `${ele.Date},`;
          csvContent += ele.Number.join(',');
          csvContent += '\r\n';
        });
        const uri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', uri);
        link.setAttribute('download', 'DataExport.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
      .catch((err) => {
        console.log(err);
      });
  };
  $scope.barPlotDate = moment().hour(0).minute(0).second(0)
    .millisecond(0);
  $scope.renderBarPlot = renderBarPlot;

  const initStyle = function () {
    if (typeof ($.fn.daterangepicker) === 'undefined') { return; }
    $('#single_cal3').daterangepicker({
      locale: {
        format: 'YYYY-MM-DD'
      },
      startDate: moment().format('YYYY-MM-DD'),
      singleDatePicker: true,
      singleClasses: 'picker_3'
    }, (start) => {
      $log.log(start);
      $scope.barPlotDate = start;
    });

    $('#reservation').daterangepicker({
      locale: {
        format: 'YYYY-MM-DD'
      },
      startDate: $scope.exportDate.start.format('YYYY-MM-DD'),
      endDate: $scope.exportDate.end.format('YYYY-MM-DD')
    }, (start, end) => {
      $scope.exportDate = { start, end };
    });
  };

  const initTime = function () {
    const deferred = $q.defer();
    RoomService.Get(roomId)
      .then((room) => {
        const timeZone = room.timeZone;
        $scope.avgNum = (room.avgNum === undefined) ? -1 : room.avgNum;
        $scope.totalNum = (room.totalNum === undefined) ? -1 : room.totalNum;
        $scope.curNum = (room.curNum === undefined) ? -1 : room.curNum;
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
        let lastTime = '';
        $.each(dataList, (index, element) => {
          if (element.Time !== lastTime) {
            total = total + element.In - element.Out;
          }
          lastTime = element.Time;
        });
        deferred.resolve(total);
      })
      .catch((err) => {
        FlashService.Error(`${err.name}:${err.message} ${err.stack}`);
        console.error(err);
        deferred.reject(err);
      });
    return deferred.promise;
  };

  initStyle();
  initTime()
    .then((t) => {
      timeDiff = t;
      const now = moment().valueOf();
      const zeroTime = moment()
        .hour(0)
        .minute(0)
        .second(0)
        .millisecond(0)
        .valueOf();
      renderBarPlot(zeroTime);
      renderTable(zeroTime);
      return initCount(zeroTime, now - period);
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
          FlashService.Error(`${err.name}:${err.message} ${err.stack}`);
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
  // TODO: wrap graph into a isolated directive
  function renderBarPlot(zeroTime) {
    const histoX = [];
    const inData = [];
    const outData = [];
    const totalData = [];
    const promArr = [];
    for (let i = 8; i < 18; i++) {
      histoX.push(`${i}:00 - ${i + 1}:00`);
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
          FlashService.Error(`${err.name}:${err.message} ${err.stack}`);
          console.error(err);
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

  function renderTable(zeroTime) {
    const startTime = zeroTime - 7 * oneDay;
    const resultData = [];
    const promArr = [];
    for (let i = 0; i < 7; i++) {
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
          FlashService.Error(`${err.name}:${err.message} ${err.stack}`);
        });
    }
    Promise.all(promArr).then(() => {
      resultData.sort((prev, next) => (prev.date - next.date));
      $scope.historyData = resultData;
    });
  }
}
