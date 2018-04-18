const express = require('express');
const userService = require('services/user.service');
const router = express.Router();

// routes
router.post('/authenticate', authenticateUser);
router.post('/register', registerUser);
router.get('/current', getCurrentUser);
router.get('/', getUserList);
router.put('/:_id', updateUser);
router.delete('/:_id', deleteUser);

module.exports = router;

function authenticateUser(req, res) {
  userService.authenticate(req.body.username, req.body.password)
    .then((token) => {
      if (token) {
        // authentication successful
        res.send({ token });
      } else {
        // authentication failed
        res.status(401).send('Username or password is incorrect');
      }
    })
    .catch((err) => {
      res.status(400).send(err);
    });
}

function registerUser(req, res) {
  userService.create(req.body)
    .then(() => {
      res.sendStatus(200);
    })
    .catch((err) => {
      res.status(400).send(err);
    });
}

function getCurrentUser(req, res) {
  res.send(req.session.user);
}

function getUserList(req, res) {
  userService.getAll()
    .then((userList) => {
      if (userList) {
        res.send(userList);
      } else {
        res.sendStatus(404);
      }
    })
    .catch((err) => {
      res.sendStatus(400).send(err);
    });
}

function updateUser(req, res) {
  const userId = req.user.sub;
  if (req.params._id !== userId) {
    // can only update own account
    return res.status(401).send('You can only update your own account');
  }
  userService.update(userId, req.body)
    .then(() => {
      res.sendStatus(200);
    })
    .catch(function (err) {
      res.status(400).send(err);
    });
}

function deleteUser(req, res) {
  userService.delete(req.params._id)
    .then(function () {
      res.sendStatus(200);
    })
    .catch(function (err) {
      res.status(400).send(err);
    });
}