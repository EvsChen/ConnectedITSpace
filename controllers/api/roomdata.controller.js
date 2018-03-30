const express = require('express');
const RoomService = require('services/room.service');
const roomdataService = require('services/roomdata.service');
const crc = require('crc');

const router = express.Router();
const openTime = padLeft((0).toString(16).toUpperCase()) + padLeft((0).toString(16).toUpperCase());
const closeTime = padLeft((23).toString(16).toUpperCase()) + padLeft((0).toString(16).toUpperCase());
const recordPeriod = padLeft((0).toString(16).toUpperCase());// default 10, 0 for real-time
const uploadPeriod = padLeft((0).toString(16).toUpperCase());// default 120, 0 for real-time

router.get('/:RoomId', getByTimeRange);
router.get('/all/:RoomId', getAllById);
router.post('/', handlePost);

function getAllById(req, res) {
  if (req.params.RoomId) {
    const _RoomId = req.params.RoomId;
    roomdataService.getAllById(_RoomId)
      .then((roomdataList) => {
        if (roomdataList) {
          res.send(roomdataList);
        } else {
          res.sendStatus(404);
        }
      })
      .catch((err) => {
        res.status(400).send(err);
      });
  }
}

function getByTimeRange(req, res) {
  let query = req.query;
  if (req.params.RoomId) {
    if (query.startTime && query.endTime) {
      roomdataService.getByTimeRange(req.params.RoomId, parseInt(query.startTime), parseInt(query.endTime))
        .then((roomdataList) => {
          if (roomdataList) {
            res.send(roomdataList);
          }
          else {
            res.sendStatus(404);
          }
        })
        .catch((err) => {
          res.status(400).send(err);
        });
    }
  }
}

// This funtion converts "+0800" to milliseconds
function convertTimeZone(timeZone) {
  let sign = timeZone.charAt(0);
  if (sign == "+") {
    return parseInt(timeZone.slice(1, 3)) * 3600 * 1000 + parseInt(timeZone.slice(3, 5)) * 60 * 1000
  }
  else {
    return (parseInt(timeZone.slice(1, 3)) * 3600 * 1000 + parseInt(timeZone.slice(3, 5)) * 60 * 1000) * (-1);
  }
}

function handlePost(req, res) {
  console.log(req.body);
  let cmd = req.body.cmd;
  res.set('Content-Type', 'application/x-www-form-urlencoded');
  const flag = req.body.flag;
  const resFlag = flag.substr(2, 2) + flag.substr(0, 2);
  let cmdType;
  let SN;
  let timeDiff;
  let data;
  switch (cmd) {
    case 'getsetting':
      data = parseSetting(req.body.data);
      RoomService.GetRoomBySN(data.SN)
        .then((room) => {
          if (room.length === 0) {
            console.log('Invalid post: no existing room matches this SN ' + SN);
            res.status(400).send('Invalid post: no existing room matches this SN ' + SN);
            res.end();
          }
          else if (room.length > 1) {
            console.log('Invalid post: this SN ' + SN + 'matches too many rooms');
            res.status(400).send('Invalid post: this SN ' + SN + 'matches too many rooms');
            res.end();
          }
          else {
            data.timeZone = room[0].timeZone;
          }
          timeDiff = data.timeZone ? convertTimeZone(data.timeZone) : 0;
          data.timeCheck = Math.abs(new Date().getTime() + timeDiff - data.systemTime.getTime()) < 60000;
          if (data.crcCheck) {
            console.log('CrcCheck successful');
            if (data.timeCheck) {
              console.log('Time check successful');
              cmdType = '05'; // confirm parameters
            }
            else {
              console.log('Time check failed');
              cmdType = '04'; // reset parameters
            }
            const systemTimeWeek = genTimeString(new Date(new Date().getTime() + timeDiff)) + '00';
            const resultString = cmdType + resFlag + '000000000300'
              + recordPeriod + uploadPeriod
              + '0000000000000000000002000000000000000000000000000000000000000000'
              + systemTimeWeek + openTime + closeTime + '0000';
            res.status(200).send('result=' + resultString + crcEncrypt(resultString));
            res.end();
          }
        })
        .catch((err) => {
          res.status(400).send(err.name + ': ' + err.message);
          res.end();
        });
      break;
    case 'cache':
      data = parseData(req.body);
      SN = data.status.SN;
      RoomService.GetRoomBySN(SN)
        .then((room) => {
          data.timeZone = room[0].timeZone;
          let resType;
          if (data.err) {
            console.log(data.err);
            resType = '02';//data uploading check failed     
          }
          else {
            resType = '01';//data uploading check successful 
          }
          cmdType = '03';//check both system time and open/close time 
          timeDiff = data.timeZone ? convertTimeZone(data.timeZone) : 0;
          let systemTimeWeek = genTimeString(new Date(new Date().getTime() + timeDiff)) + '00';
          let resultString = resType + resFlag + cmdType + systemTimeWeek + openTime + closeTime;
          res.status(200).send('result=' + resultString + crcEncrypt(resultString));
          res.end();
        })
        .catch((err) => {
          res.status(400).send(err.name + ': ' + err.message);
          res.end();
        });
      break;
    default:
      break;
  }
}

function padLeft() {
  let string = arguments[0];
  if (arguments[1]) {
    let nOfBytes = arguments[1];
    return ('0000' + string).slice((-2) * nOfBytes);
  }
  return ('00' + string).slice(-2);
}

function crcEncrypt(resultString) {
  let buffer = new ArrayBuffer(resultString.length / 2);
  let v8 = new Int8Array(buffer);
  let resultArray = resultString.match(/[\w]{2}/g);
  for (var i = 0; i < resultArray.length; i++) {
    v8[i] = parseInt(resultArray[i], 16);
  }
  return padLeft(crc.crc16modbus(v8).toString(16).toUpperCase(), 2);
}

// this function is used to parse time string in the format 'yymmddhhmmss'
function parseTime(timeString) {
  let timeArray = timeString.match(/[\w]{2}/g).map(element => parseInt(element, 16));
  return new Date(2000 + timeArray[0], timeArray[1] - 1, timeArray[2], timeArray[3], timeArray[4], timeArray[5]);
}

function genTimeString(date) {
  const year = padLeft((date.getYear() - 100).toString(16)).toUpperCase();
  const month = padLeft((date.getMonth() + 1).toString(16)).toUpperCase();
  const day = padLeft(date.getDate().toString(16)).toUpperCase();
  const hour = padLeft(date.getHours().toString(16)).toUpperCase();
  const min = padLeft(date.getMinutes().toString(16)).toUpperCase();
  const sec = padLeft(date.getSeconds().toString(16)).toUpperCase();
  return year + month + day + hour + min + sec;
}

function parseSetting(data) {
  const resultObj = {
    SN: data.slice(0, 8).match(/[\w]{2}/g).reverse().join(''), // string
    cmdType: data.slice(8, 10), // string
    speed: data.slice(10, 12), // string
    recordCycle: parseInt(data.slice(12, 14), 16), // int
    uploadCycle: parseInt(data.slice(14, 16), 16), // int
    model: data.slice(34, 36), // string
    displayType: data.slice(36, 38), // string
    mac1: data.slice(38, 50).match(/[\w]{2}/g).join(':'), // string
    signal1: parseInt(data.slice(50, 52), 16), // int
    mac2: data.slice(52, 64).match(/[\w]{2}/g).join(':'), // string
    signal2: parseInt(data.slice(64, 66), 16), // int
    mac3: data.slice(66, 78).match(/[\w]{2}/g).join(':'), // string
    signal3: parseInt(data.slice(78, 80), 16), // int
    systemTime: parseTime(data.slice(80, 92)), // datetime
    systemWeek: parseInt(data.slice(92, 94), 16),
    openTime: padLeft(parseInt(data.slice(94, 96), 16)) + padLeft(parseInt(data.slice(96, 98), 16)),
    closeTime: padLeft(parseInt(data.slice(98, 100), 16)) + padLeft(parseInt(data.slice(100, 102), 16)),
    crc: data.slice(-4),
    crcCheck: crcEncrypt(data.slice(0, -4)) === data.slice(-4),
  };
  return resultObj;
}

function parseData(body) {
  const status = body.status;
  const data = typeof body.data == 'string' ? [body.data] : body.data;
  const resultObj = {};
  resultObj.data = [];
  if (status.length !== 28) {
    return { err: 'Status length is not valid' };
  }
  if (crcEncrypt(status.slice(0, -4)) !== status.slice(-4)) {
    return { err: `Status CrcCheck failed ${status}` };
  }

  for (let i = 0; i < data.length; i++) {
    const cur = data[i];
    if (cur.length !== 34) {
      return { err: `Data length is not valid ${data[i]}` };
    }
    if (cur.slice(-4) != crcEncrypt(cur.slice(0, -4))) {
      return { err: `Data CrcCheck failed ${cur}` };
    }
    const dataObj = {
      SN: status.slice(4, 12).match(/[\w]{2}/g).reverse().join(''),
      Time: parseTime(cur.slice(0, 12)), // datetime
      In: parseInt(cur.slice(14, 22).match(/[\w]{2}/g).reverse().join(''), 16),
      Out: parseInt(cur.slice(22, 30).match(/[\w]{2}/g).reverse().join(''), 16),
    };
    console.log(dataObj);
    roomdataService.add(dataObj)
      .then(() => { console.log('Add data successful'); })
      .catch((err) => { console.log(err); });
    resultObj.data.push(dataObj);
  }
  resultObj.status = {
    version: status.slice(0, 4),
    SN: status.slice(4, 12).match(/[\w]{2}/g).reverse().join(''),
    focus: status.slice(12, 14) === '00', // '00' for normal '01' for failure
    voltage: parseInt(status.slice(16, 18) + status.slice(14, 16), 16) / 1000,
    battery: parseInt(status.slice(18, 20), 16),
    charged: status.slice(-8, -4) === '0000',
  };
  return resultObj;
}

module.exports = router;
