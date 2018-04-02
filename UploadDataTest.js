require('rootpath')();
const UtilService = require('services/util.service');
const http = require('http');

const padLeft = UtilService.padLeft;
const crcEncrypt = UtilService.crcEncrypt;
function generateData(inNum, outNum) {
  const date = new Date();
  const year = padLeft((date.getYear() - 100).toString(16)).toUpperCase();
  const month = padLeft((date.getMonth() + 1).toString(16)).toUpperCase();
  const day = padLeft(date.getDate().toString(16)).toUpperCase();
  const hour = padLeft(date.getHours().toString(16)).toUpperCase();
  const min = padLeft(date.getMinutes().toString(16)).toUpperCase();
  const sec = padLeft(date.getSeconds().toString(16)).toUpperCase();
  const focus = '00';
  const inText = padLeft(inNum.toString(16)).toUpperCase().concat('000000');
  const outText = padLeft(outNum.toString(16)).toUpperCase().concat('000000');
  const resultString = year + month + day + hour + min + sec + focus + inText + outText;
  return resultString.concat(crcEncrypt(resultString));
}

const testData = {
  cmd: 'cache',
  flag: '3617',
  status: '0101C28F64A2007A0A0002009E46',
  data: [generateData(1, 2),
    generateData(2, 3)
  ],
  count: '0002',
  temp: 'C3B',
  Tend: 'nnnnnnnnnnnnnnnnnnT'
};

const postData = JSON.stringify(testData);
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/roomdata',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};
const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
  res.on('end', () => {
    console.log('No more data in response.');
    console.log(res.body);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

// write data to request body
req.write(postData);
req.end();
