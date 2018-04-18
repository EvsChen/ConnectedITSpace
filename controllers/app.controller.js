const express = require('express');

const router = express.Router();
// use session auth to secure the angular app files
router.use('/', (req, res, next) => {
  if (req.path !== '/login' && !req.session.token) {
    return res.redirect('/login?returnUrl='.concat(encodeURIComponent('/app'.concat(req.path))));
  }
  next();
});

// make JWT token available to angular app
router.get('/token', (req, res) => {
  res.send(req.session.token);
});

router.get('/user', (req, res) => {
  res.send(req.session.user);
})

// serve angular app files from the '/app' route
router.use('/', express.static('app'));
module.exports = router;
