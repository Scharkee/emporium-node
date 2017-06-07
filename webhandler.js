var express = require('express');
var router = express.Router();
var db = require('./emporium-db.js');
var formidable = require("formidable");
var path = require('path');

var exampleMixin = {
    methods: {
        hello: function () {
            console.log('Hello');
        }
    }
}

var switchMixin = {
    methods: {
        makeActive: function (item) {
            // When a model is changed, the view will be automatically updated.
            this.active = item;
        }
    },
}

var users = [];
var pageTitle = 'Whoa';
users.push({ name: 'tobi', age: 12 });
users.push({ name: 'loki', age: 14 });
users.push({ name: 'jane', age: 16 });

router.get('/pass_reset', function (req, res) {
    res.sendFile(path.join(__dirname, 'web/reset', 'reset.html'));
});

router.get('/s', function (req, res) {
    console.log("someone asked for S");
    res.sendFile(path.join(__dirname + '/web/s/1.html'));
});

router.get('/vue', function (req, res) {
    var scope = {
        el: '#main',
        data: {
            active: 'home'
        },
        vue: {
            head: {
                title: pageTitle,
                meta: [
                    { property: 'og:title', content: pageTitle },
                    { name: 'twitter:title', content: pageTitle }
                ],
                structuredData: {
                    "@context": "http://schema.org",
                    "@type": "Organization",
                    "url": "http://www.your-company-site.com",
                    "contactPoint": [{
                        "@type": "ContactPoint",
                        "telephone": "+1-401-555-1212",
                        "contactType": "customer service"
                    }]
                }
            },
            mixins: [exampleMixin, switchMixin],
        }
    };
    res.render('index', scope);
});

router.get('/users/:userName', function (req, res) {
    var user = users.filter(function (item) {
        return item.name === req.params.userName;
    })[0];
    res.render('user', {
        data: {
            title: 'Hello My Name is',
            user: user
        }
    });
});

router.get('/rst/:token', function (req, res) {
    db.ParsePasswordResetRequest(req).then(function (data) {
        var status = data.status;
    }).catch(function () {
        console.error("error caught @ password reset");
    });

    User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function (err, user) {
        if (!user) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/forgot');
        }
        res.render('reset', {
            user: req.user
        });
    });
});

function saveToDB(message) {
    console.log("saving " + message);
}

router.post('/', function (req, res) {
    res.send('POST route on webhandler.');
});
//export this router to use in our index.js
module.exports = router;