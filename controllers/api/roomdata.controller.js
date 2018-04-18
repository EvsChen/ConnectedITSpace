const express = require('express');
const moment = require('moment');
const RoomService = require('services/room.service');
const RoomDataService = require('services/roomdata.service');
const DbService = require('services/db.service');
const RawDataService = require('services/rawdata.service');
const UtilService = require('services/util.service');

const padLeft = UtilService.padLeft;
const router = express.Router();
// TODO: get open time and close time from the room setting
const openTime = padLeft((0).toString(16).toUpperCase()) +
  padLeft((0).toString(16).toUpperCase());
const closeTime = padLeft((23).toString(16).toUpperCase()) +
  padLeft((0).toString(16).toUpperCase());
const recordPeriod = padLeft((0).toString(16).toUpperCase()); // default 10, 0 for real-time
const uploadPeriod = padLeft((0).toString(16).toUpperCase()); // default 120, 0 for real-time

router.get('/:RoomId', getByTimeRange);
router.get('/adjust', adjustTimeZone);
router.get('/remove', removeDuplicates);
router.get('/all/:RoomId', getAllById);
router.get('/allnum/:RoomId', UpdateAllNum);
router.post('/', handlePost);
module.exports = router;


function removeDuplicates(req, res) {
  DbService.removeDuplicates()
    .then((result) => {
      res.status(200).send(result);
    })
    .catch((err) => {
      res.status(400).send(err);
    });
}

function adjustTimeZone(req, res) {
  DbService.adjustTimeZone()
    .then((result) => {
      res.status(200).send(result);
    })
    .catch((err) => {
      res.status(400).send(err);
    });
}

function UpdateAllNum(req, res) {
  if (req.params.RoomId) {
    const _id = req.params.RoomId;
    RoomDataService.UpdateAllNum(_id)
      .then((nums) => {
        res.status(200).send(nums);
      })
      .catch((err) => {
        res.status(400).send(err);
      });
  }
}

// Get all data of one room by the room id
function getAllById(req, res) {
  if (req.params.RoomId) {
    const _RoomId = req.params.RoomId;
    RoomDataService.getAllById(_RoomId)
      .then((roomdataList) => {
        if (roomdataList) {
          const filtered = roomdataList.filter((ele, ind, arr) => {
            if (ind === 0) { return true; }
            return (ele.Time.getTime() - arr[ind - 1].Time.getTime()) !== 0;
          });
          res.send(filtered);
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
  const query = req.query;
  if (req.params.RoomId) {
    if (query.startTime && query.endTime) {
      RoomDataService.getByTimeRange(
        req.params.RoomId,
        parseInt(query.startTime, 10), parseInt(query.endTime, 10)
      )
        .then((roomdataList) => {
          if (roomdataList) {
            const filtered = roomdataList.filter((ele, ind, arr) => {
              if (ind === 0) { return true; }
              return (ele.Time.getTime() - arr[ind - 1].Time.getTime()) !== 0;              
            });
            res.send(filtered);
          } else {
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
  const sign = timeZone.charAt(0);
  if (sign === '+') {
    return (parseInt(timeZone.slice(1, 3), 10) * 3600 * 1000 +
      parseInt(timeZone.slice(3, 5), 10) * 60 * 1000);
  }
  return (parseInt(timeZone.slice(1, 3), 10) * 3600 * 1000 +
    parseInt(timeZone.slice(3, 5), 10) * 60 * 1000) * (-1);
}

function handlePost(req, res) {
  res.set('Content-Type', 'application/x-www-form-urlencoded');
  const cmd = req.body.cmd;
  const flag = req.body.flag;
  const resFlag = flag.substr(2, 2) + flag.substr(0, 2);
  let cmdType;
  let timeDiff;
  let data;
  RawDataService.add(req.body);
  switch (cmd) {
    case 'getsetting': {
      if (typeof req.body.data === 'string') {
        data = parseSetting(req.body.data);
      }
      else {
        data = parseSetting(req.body.data[0]);
      }
      const SN = data.SN;
      RoomService.GetRoomBySN(SN)
        .then((room) => {
          if (room.length === 0) {
            console.log(`Invalid post: no existing room matches this SN ${SN}`);
            res.status(400).send(`Invalid post: no existing room matches this SN ${SN}`);
            res.end();
          } else if (room.length > 1) {
            console.log(`Invalid post: this SN ${SN} matches too many rooms`);
            res.status(400).send(`Invalid post: this SN ${SN} matches too many rooms`);
            res.end();
          } else {
            data.timeZone = room[0].timeZone;
          }
          timeDiff = data.timeZone ? convertTimeZone(data.timeZone) : 0;
          data.timeCheck = Math.abs(moment().valueOf() + timeDiff -
            data.systemTime.valueOf()) < 60000;
          if (data.crcCheck) {
            console.log('CrcCheck successful');
            if (data.timeCheck) {
              console.log('Time check successful');
              cmdType = '05'; // confirm parameters
            } else {
              console.log('Time check failed');
              cmdType = '04'; // reset parameters
            }
            const systemTimeWeek = genTimeString(new Date(moment().valueOf() + timeDiff)).concat('00');
            const resultString = `${cmdType}${resFlag}000000000300`
              .concat(recordPeriod).concat(uploadPeriod)
              .concat('0000000000000000000002000000000000000000000000000000000000000000')
              .concat(`${systemTimeWeek}${openTime}${closeTime}0000`);
            res.status(200).send(`result=${resultString}${UtilService.crcEncrypt(resultString)}`);
            res.end();
          }
        })
        .catch((err) => {
          res.status(400).send(`${err.name} : ${err.message}`);
          res.end();
        });
      break;
    }
    case 'cache': {
      const body = req.body;
      data = parseDataHeading(body);
      if (data.err) {
        res.status(400).send(data.err);
        res.end();
        break;
      }
      const dataList = (typeof body.data === 'string') ? [body.data] : body.data;
      const SN = data.status.SN;
      RoomService.GetRoomBySN(SN)
        .then((room) => {
          const timeZone = room[0].timeZone;
          const resType = '01'; // data uploading check successful
          cmdType = '03'; // check both system time and open/close time
          timeDiff = timeZone ? convertTimeZone(timeZone) : 0;
          for (let i = 0; i < dataList.length; i++) {
            const cur = dataList[i];
            if (cur.length !== 34) {
              res.sendStatus(400).send({
                err: `Data length is not valid ${data[i]}`
              });
              res.end();
            }
            if (cur.slice(-4) !== UtilService.crcEncrypt(cur.slice(0, -4))) {
              res.sendStatus(400).send({
                err: `Data CrcCheck failed ${cur}`
              });
            }
            const dataObj = {
              SN,
              Time: parseTime(cur.slice(0, 12), timeZone), // datetime
              In: parseInt(cur.slice(14, 22).match(/[\w]{2}/g).reverse().join(''), 16),
              Out: parseInt(cur.slice(22, 30).match(/[\w]{2}/g).reverse().join(''), 16),
            };
            RoomDataService.add(dataObj)
              .then(() => {
                console.log('Add data successful');
              })
              .catch((err) => {
                console.log(err);
              });
            console.log(dataObj);
          }
          const systemTimeWeek = genTimeString(new Date(Date.now() + timeDiff)).concat('00');
          const resultString = `${resType}${resFlag}${cmdType}${systemTimeWeek}${openTime}${closeTime}`;
          res.status(200).send(`result${resultString} ${UtilService.crcEncrypt(resultString)} `);
          res.end();
        })
        .catch((err) => {
          res.status(400).send(`${err.name} : ${err.message}`);
          res.end();
        });
      break;
    }
    default:
      break;
  }
}

// this function is used to parse time string in the format 'yymmddhhmmss'
function parseTime(...args) {
  const timeString = args[0];
  const timeArray = timeString.match(/[\w]{2}/g).map(element => parseInt(element, 16));
  timeArray[0] += 2000;
  if (args[1]) {
    return moment.utc(timeArray.join(' ').concat(' ').concat(args[1]), 'YYYY MM DD HH mm ss Z');
  }
  return moment.utc(timeArray.join(' '), 'YYYY MM DD HH mm ss');
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
    closeTime: (padLeft(parseInt(data.slice(98, 100), 16)) +
      padLeft(parseInt(data.slice(100, 102), 16))),
    crc: data.slice(-4),
    crcCheck: UtilService.crcEncrypt(data.slice(0, -4)) === data.slice(-4),
  };
  return resultObj;
}

function parseDataHeading(body) {
  const status = body.status;
  const resultObj = {};
  if (status.length !== 28) {
    return { err: 'Status length is not valid' };
  }
  if (UtilService.crcEncrypt(status.slice(0, -4)) !== status.slice(-4)) {
    return { err: `Status CrcCheck failed ${status}` };
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
