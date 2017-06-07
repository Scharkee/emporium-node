var express = require('express');
var app = express();
var shortId = require('shortid');
var path = require('path');
var Chance = require('chance');
var db = require('./emporium-db.js');
var web = require('./webhandler.js');
var async = require('async');
var expressVue = require('express-vue');

var io = require('socket.io');

// returns an instance of node-greenlock with additional helper methods
var lex = require('greenlock-express').create({
    // set to https://acme-v01.api.letsencrypt.org/directory in production
    server: 'https://acme-v01.api.letsencrypt.org/directory'

    // If you wish to replace the default plugins, you may do so here
    //
, challenges: { 'tls-sni-01': require('le-challenge-sni').create({ webrootPath: '~/tmp/acme-challenges' }) }
, store: require('le-store-certbot').create({ webrootPath: '~/tmp/acme-challenges' })

    // You probably wouldn't need to replace the default sni handler
    // See https://git.daplie.com/Daplie/le-sni-auto if you think you do
    //, sni: require('le-sni-auto').create({})

, approveDomains: approveDomains
});

function approveDomains(opts, certs, cb) {
    // This is where you check your database and associated
    // email addresses with domains and agreements and such

    // The domains being approved for the first time are listed in opts.domains
    // Certs being renewed are listed in certs.altnames
    if (certs) {
        opts.domains = ['www.scharkee.gq', 'scharkee.gq', 'padan.ga', 'www.padan.ga', 'www.gamtosau.ga', 'gamtosau.ga'];
    }
    else {
        opts.email = 'matas2k@gmail.com';
        opts.agreeTos = true;
    }

    // NOTE: you can also change other options such as `challengeType` and `challenge`
    // opts.challengeType = 'http-01';
    // opts.challenge = require('le-challenge-fs').create({});

    cb(null, { options: opts, certs: certs });
}

//pagrindinis app config

app.use(express.static(__dirname + '/web/main'));
app.use(web);

app.set('views', __dirname + '/vue/views');
//Optional if you want to specify the components directory separate to your views, and/or specify a custom layout.
app.set('vue', {
    //ComponentsDir is optional if you are storing your components in a different directory than your views
    componentsDir: __dirname + '/vue/views/components',
    //Default layout is optional it's a file and relative to the views path, it does not require a .vue extension.
    //If you want a custom layout set this to the location of your layout.vue file.
    defaultLayout: 'layout'
});
app.engine('vue', expressVue);
app.set('view engine', 'vue');

// handles acme-challenge and redirects to https
require('http').createServer(lex.middleware(require('redirect-https')())).listen(80, function () {
    console.log("============ Up and running =============");
    console.log("HTTP redirector: ", this.address());
});

// handles your app
var server = require('https').createServer(lex.httpsOptions, lex.middleware(app)).listen(443, function () {
    console.log("HTTPS: ", this.address());
});

var io = require('socket.io').listen(server);

var clients = [];

var mysql = require('mysql');
var bcrypt = require('bcrypt');

var clientCount = [];
var currentConnections = {};

io.on("connection", function (socket) {
    //TODO: broken, nes nebeiseina gaut IP.
    var tempIP = 12;

    //registruojamas socket + user IP
    currentConnections[socket.id] = { socket: socket, IP: socket.conn.transport.socket._socket.remoteAddress };  //kind of a double registration. Mb bad. Kepps up the count though, which is nice.
    clientCount.push(socket);

    console.log("Connection Up, client ID: " + clientCount.indexOf(socket) + ", Connection IP: " + socket.conn.transport.socket._socket.remoteAddress);
    socket.emit("connectedToNode", { ConnectedOnceNoDupeStatRequests: true });

    socket.on("CHECK_LOGIN", function (data) {
        var username = data.Uname;

        db.CheckForIPBan(socket.conn.transport.socket._socket.remoteAddress).then(function (banResult) {
            if (banResult.banned) { //useris turi bana, netikrinam logino. TODO: paflashint kad dar banned.
                socket.emit("PASS_CHECK_CALLBACK", { passStatus: 4 });
            } else { //bano nera, viskas tvarkoj vaziuojam toliau
                db.ParseLogin(data).then(function (data) {
                    var status = data.status;

                    if (status == 1) { //useris patvirtintas
                        if (checkForDuplicateUser(username)) { //patikra, ar nera jau uzregistruoto connectiono su tuo paciu username
                            console.log(username + " is already connected to node.");
                            socket.emit("PASS_CHECK_CALLBACK", { passStatus: 3 });
                            //TODO: flash dupe alert
                        } else {
                            //username registruojamas velesniam naudojimui.
                            console.log("hooking " + username + " to socket ID " + socket.id);
                            currentConnections[socket.id].username = username;
                            socket.emit("PASS_CHECK_CALLBACK", { passStatus: status });
                        }
                    }
                }).catch(function () {
                    console.error("error caught @ login check");
                });
            }
        }).catch(function () {
            console.error("error caught @ ban check");
        });
    });

    socket.on("REGISTER_USER", function (data) {
        db.RegisterUser(data);
    });

    //GAME STAT RETRIEVAL CALLS

    socket.on("GET_STATS", function (data) {
        if (VerifyUser(data.Uname, socket.id)) {
            db.GetStats(data).then(function (data) {
                socket.emit("RETRIEVE_STATS", data);
            }).catch(function () {
                console.error("error caught @ get stats");
            });
        } else {
            socket.emit("DISCREPANCY", { reason: 1, reasonString: "Desynchronization detected. Please log in again." }); //DISCREPANCY CALL FOR THE CLIENT TO SHUT OFF.
        }
    });

    //make function that manually pings for response, if response arrives, push lastloggedin to server \/

    socket.on("GET_TILE_DATA", function (data) {//tile information function
        if (VerifyUser(data.Uname, socket.id)) {
            db.GetTileData(data).then(function (data) {
                socket.emit("RECEIVE_TILES", data);
            }).catch(function () {
                console.error("error caught @ tiledata");
            });
        } else {
            socket.emit("DISCREPANCY", { reason: 1, reasonString: "Desynchronization detected. Please log in again." }); //DISCREPANCY CALL FOR THE CLIENT TO SHUT OFF.
        }
    });

    socket.on("GET_TILE_INFORMATION", function (data) {//tile information function
        if (VerifyUser(data.Uname, socket.id)) {
            db.GetTiles(data).then(function (data) {
                socket.emit("RECEIVE_TILE_INFORMATION", data);
            }).catch(function () {
                console.error("error caught @ tile info");
            });

            db.GetInventory(data).then(function (data) {
                socket.emit("RECEIVE_INVENTORY", data);
            }).catch(function () {
                console.error("error caught @ inventory info");
            });
        } else {
            socket.emit("DISCREPANCY", { reason: 1, reasonString: "Desynchronization detected. Please log in again." }); //DISCREPANCY CALL FOR THE CLIENT TO SHUT OFF.
        }
    });

    socket.on("FORGOT_PASS", function (data) {//tile purchase function
        if (VerifyUser(data.Uname, socket.id)) {
            db.ForgotPass(data).then(function (data) {
                socket.emit(data.call, data.content);
            }).catch(function () {
                console.error("error caught @ password reset");
            });
        } else {
            socket.emit("DISCREPANCY", { reason: 1, reasonString: "Desynchronization detected. Please log in again." }); //DISCREPANCY CALL FOR THE CLIENT TO SHUT OFF.
        }
    });

    socket.on("BUY_TILE", function (data) {//tile purchase function
        if (VerifyUser(data.Uname, socket.id)) {
            db.HandleTilePurchase(data).then(function (data) {
                socket.emit(data.call, data.content);
            }).catch(function () {
                console.error("error caught @ tile buy");
            });
        } else {
            socket.emit("DISCREPANCY", { reason: 1, reasonString: "Desynchronization detected. Please log in again." }); //DISCREPANCY CALL FOR THE CLIENT TO SHUT OFF.
        }
    });

    socket.on("SELL_TILE", function (data) {//tile purchase function
        if (VerifyUser(data.Uname, socket.id)) {
            db.HandleTileSale(data).then(function (data) {
                socket.emit("ADD_FUNDS", data);
            }).catch(function () {
                console.error("error caught @ tile sale");
            });
        } else {
            socket.emit("DISCREPANCY", { reason: 1, reasonString: "Desynchronization detected. Please log in again." }); //DISCREPANCY CALL FOR THE CLIENT TO SHUT OFF.
        }
    });

    socket.on("TILE_ASSIGN_WORK", function (data) {//tile purchase function
        if (VerifyUser(data.Uname, socket.id)) {
            db.HandleTileAssignWork(data).then(function (data) {
                socket.emit("ASSIGN_TILE_WORK", data);
            }).catch(function () {
                console.error("error caught @ tile work assignment");
            });
        } else {
            socket.emit("DISCREPANCY", { reason: 1, reasonString: "Desynchronization detected. Please log in again." }); //DISCREPANCY CALL FOR THE CLIENT TO SHUT OFF.
        }
    });

    socket.on("VERIFY_SOLD_PRODUCE", function (data) {//tile purchase function
        if (VerifyUser(data.Uname, socket.id)) {
            db.HandleProduceSale(data).then(function (data) {
                socket.emit(data.call, data.content);
            }).catch(function (err) {
                console.error(err);
            });
        } else {
            socket.emit("DISCREPANCY", { reason: 1, reasonString: "Desynchronization detected. Please log in again." }); //DISCREPANCY CALL FOR THE CLIENT TO SHUT OFF.
        }
    });

    socket.on("VERIFY_SOLD_PRODUCE_STORE", function (data) {//tile purchase function
        if (VerifyUser(data.Uname, socket.id)) {
            db.HandleProduceSaleJobAssignment(data).then(function (data) {
                socket.emit(data.call, data.content);
            }).catch(function (err) {
                console.error(err);
            });
        } else {
            socket.emit("DISCREPANCY", { reason: 1, reasonString: "Desynchronization detected. Please log in again." }); //DISCREPANCY CALL FOR THE CLIENT TO SHUT OFF.
        }
    });

    //FIXME: this shit here returns scientific number and not the real int.

    socket.on("GET_UNIX", function (data) {
        var unixBuffer = UnixTime(); //temp probably

        var unixJson = { unixBuffer: unixBuffer.toString() };

        socket.emit("RECEIVE_UNIX", unixJson);
    });

    socket.on("DISCONNECT", function (data) {
        socket.disconnect();
    });

    socket.on("VERIFY_COLLECT_TILE", function (data) {
        if (VerifyUser(data.Uname, socket.id)) {
            db.HandleTileCollect(data).then(function (data) {
                socket.emit(data.call, data.content);
            }).catch(function () {
                console.error("error caught @ tile collection");
            });
        } else {
            socket.emit("DISCREPANCY", { reason: 1, reasonString: "Desynchronization detected. Please log in again." }); //DISCREPANCY CALL FOR THE CLIENT TO SHUT OFF.
        }
    });

    socket.on("GET_TRANSPORT_QUEUES", function (data) {
        if (VerifyUser(data.Uname, socket.id)) {
            db.GetTransportQueues(data).then(function (data) {
                socket.emit(data.call, data.content);
            }).catch(function () {
                console.error("error caught @ transport queues");
            });
        } else {
            socket.emit("DISCREPANCY", { reason: 1, reasonString: "Desynchronization detected. Please log in again." }); //DISCREPANCY CALL FOR THE CLIENT TO SHUT OFF.
        }
    });

    socket.on("GET_WORKERS", function (data) {
        if (VerifyUser(data.Uname, socket.id)) {
            db.GetWorkers(data).then(function (data) {
                socket.emit(data.call, data.content);
            }).catch(function () {
                console.error("error caught @ worker getter");
            });
        } else {
            socket.emit("DISCREPANCY", { reason: 1, reasonString: "Desynchronization detected. Please log in again." }); //DISCREPANCY CALL FOR THE CLIENT TO SHUT OFF.
        }
    });

    socket.on("VERIFY_COLLECT_PRESS_WORK", function (data) {
        if (VerifyUser(data.Uname, socket.id)) {
            db.HandlePressWorkCollection(data).then(function (data) {
                socket.emit(data.call, data.content);
            }).catch(function () {
                console.error("error caught @ press work collection");
            });
        } else {
            socket.emit("DISCREPANCY", { reason: 1, reasonString: "Desynchronization detected. Please log in again." }); //DISCREPANCY CALL FOR THE CLIENT TO SHUT OFF.
        }
    });

    socket.on("VERIFY_EXPAND_PLOTSIZE", function (data) {//data doesnt contain enything. If enough money in DB, expand plotsize by 1. Prices of expansion go up very quickly too.
        if (VerifyUser(data.Uname, socket.id)) {
            db.HandlePlotsizeExpansion(data).then(function (data) {
                socket.emit(data.call, data.content);
            }).catch(function () {
                console.error("error caught @ plotsize expansion");
            });
        } else {
            socket.emit("DISCREPANCY", { reason: 1, reasonString: "Desynchronization detected. Please log in again." }); //DISCREPANCY CALL FOR THE CLIENT TO SHUT OFF.
        }
    });

    socket.on("GET_PRICES", function (data) {//data doesnt contain enything. If enough money in DB, expand plotsize by 1. Prices of expansion go up very quickly too.
        if (VerifyUser(data.Uname, socket.id)) {
            db.HandlePriceRetrieval(data).then(function (data) {
                socket.emit(data.call, data.content);
            }).catch(function () {
                console.error("error caught @ price retrieval");
            });
        } else {
            socket.emit("DISCREPANCY", { reason: 1, reasonString: "Desynchronization detected. Please log in again." }); //DISCREPANCY CALL FOR THE CLIENT TO SHUT OFF.
        }
    });

    socket.on("SUBMIT_BUGREPORT", function (data) {//data doesnt contain enything. If enough money in DB, expand plotsize by 1. Prices of expansion go up very quickly too.
        db.HandleBugReportSubmission(data).then(function (data) {
            socket.emit(data.call, data.content);
        }).catch(function () {
            console.error("error caught @ price retrieval");
        });
    });

    socket.on("VERIFY_ACTION", function (data) {// misc action verifyinimo funkcija.
        //every misc action goes here by switch/case(fertilising, bleh bleh.)
    });

    //GAME TODO's

    //cheateriu checkai
    //TODO: each game command that comes here must emit VERIFICATION,true back to client + add checks for it in the client, if returned FALSE or didnt return at all,
    //TODO: checks in each function for discrepancies, and if something doesnt match up, send VERIFICATION,false and stop connection(prolly not)? and DONT SAVE TO DB.
    //TODO: resync function for when VERIFICATION(or just discrepency) is false. Send to client and change all values MB so no restart is needed. Also include resyncing screen for the time it takes to
    //TODO: version control? if somebody manages to DL the game and has older version then this could get fucked.

    //NON-PRIORITY

    //TODO: set up login screen credits ALSO make simple socket.emit in the client for emitting feedback. Some new table in DB to store that.
    //TODO: music, and music-soundcloud hookup SUPERNON PRIORITY
    //TODO: effects for upgrading and buying towers + collecting stuff

    //on client disconnected
    socket.on("disconnect", function (data) {
        if (currentConnections[socket.id].username == null) {
            clientCount.splice(clientCount.indexOf(socket), 1);  // reiketu consolidatint is dvieju lists into one
        } else {
            console.log("user  " + currentConnections[socket.id].username + " dc'd");
            clientCount.splice(clientCount.indexOf(socket), 1);  // reiketu consolidatint is dvieju lists into one
            db.UpdateLastloggedIn(currentConnections[socket.id].username);

            delete currentConnections[socket.id];
        }
    });
});//iserts default stats into DB when user first starts the game,

// check if enough isnt working FINDAWAY (escapes from callback hell)

function UnixTime() {
    var unix = Math.round(+new Date() / 1000);
    return unix;
}

function VerifyUser(username, socketID) { //kvieciama per kiekviena client to server call
    if (currentConnections[socketID].username == null) {//nera net assigninto username, probably cheating/injecting. Ban 5 min (socketas neatlikes login/auth)
        return false;
    }
    if (currentConnections[socketID].username != username) { //client kreipiasi i serveri kitu username. (Definetely) injecting. Ban 15 min
        return false;
    } else {
        return true;
    }
}

function BanIP(ip, timeInSeconds) {
    db.BanIP(ip, timeInSeconds).then(function (data) {
    }).catch(function () {
        console.error("error caught @ banning");
    });
}

function CleanInput(a, mode) {
    switch (mode) {
        case 1:
            var b = a.replace(/[^a-zA-Z0-9]/gi, '');

            break;
        case 2: //kitas refinery mode
            //..code
            break;

        case 3: // trecias refinery mode
            //code
            break;

        default:
            // ....
            break;
    }

    return a;
}

function findValue(o, value) {
    for (var prop in o) {
        if (o.hasOwnProperty(prop) && o[prop] === value) {
            return prop;
        }
    }
    return null;
}

function checkForDuplicateUser(username) {
    var status = false; //no dupe

    Object.keys(currentConnections).forEach(function (key, index) {
        if (currentConnections[key].username == username) {
            status = true;
        }
    });

    return status;
}

function findPrice(rows, name) {
    var price;
    var current = 0;

    while (rows[current].NAME !== name) {
        current++;
    }

    price = rows[current].PRICE;

    return price;
}

Array.prototype.contains = function (element) {
    return this.indexOf(element) > -1;
};

//FIXME - fixes for non-working things
//MAKEME - make orders for non-existant things
//FINDAWAY - a workaround needs to be found