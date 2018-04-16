// TODO: Add error log function
require('rootpath')();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const config = require('config.json');
const mongoExpressConfig = require('./mongo_express_config');
const path = require('path');
const mongoExpress = require('mongo-express/lib/middleware');
const DbService = require('services/db.service');

const app = express();
function unless(p, middleware) {
  return function (req, res, next) {
    if (p === req.path) {
      return next();
    }
    return middleware(req, res, next);
  };
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(unless('/api/roomdata', session({
  secret: config.secret,
  resave: false,
  saveUninitialized: true,
})));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/public/scripts', express.static(path.join(__dirname, 'node_modules')));
app.use('/mongo_express', mongoExpress(mongoExpressConfig));
// use JWT auth to secure the api
// app.use('/api', expressJwt({ secret: config.secret }).unless({
//   path: ['/api/users/authenticate', '/api/users/register']
// }));
app.use('/login', require('./controllers/login.controller'));
app.use('/register', require('./controllers/register.controller'));
app.use('/app', require('./controllers/app.controller'));
app.use('/api/users', require('./controllers/api/users.controller'));
app.use('/api/rooms', require('./controllers/api/rooms.controller'));
app.use('/api/roomdata', require('./controllers/api/roomdata.controller'));

function AppInitialize() {
  if (config.removeDuplicates) {
    DbService.removeDuplicates()
      .then(() => { console.log('remove duplicates successful'); })
      .catch((err) => { console.log(err); });
  }
  if (config.adjustTimeZone) {
    DbService.adjustTimeZone()
      .then(() => { console.log('Adjust time zone successfull'); })
      .catch((err) => { console.log(err); });
  }
}

// make '/app' default route
app.get('/', (req, res) => {
  res.redirect('/app');
  AppInitialize();
});
app.post('/', (req, res) => {
  console.log(req.body);
  return res.send('received post');
});
// start server
if (process.env.PORT) {
  const server = app.listen(process.env.PORT, () => {
    console.log(`Server listening at http://${server.address().address} ${server.address().port}`);
  });
} else {
  const server = app.listen(3000, '0.0.0.0', () => {
    console.log(`Server listening at http:// ${server.address().address}:${server.address().port}`);
  });
}
