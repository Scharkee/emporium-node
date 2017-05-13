var express = require('express');
var router = express.Router();
var db = require('./emporium-db.js');
var formidable = require("formidable");

router.get('/pass_reset', function(req, res){

    res.send('GET route on webhandler.');
});

router.get('/rst/:token', function(req, res) {

	db.ParsePasswordResetRequest(req).then(function (data) {
            var status = data.status;
        }).catch(function () {
            console.error("error caught @ password reset");
      });



  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot');
    }
    res.render('reset', {
      user: req.user
    });
  });
});

router.post('/', function(req, res){

    res.send('POST route on webhandler.');
});
//export this router to use in our index.js
module.exports = router;