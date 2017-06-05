var express = require('express');
var app = express();
var shortId = require('shortid');
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var Chance = require('chance');
var db = require('./emporium-db.js');
var web = require('./webhandler.js');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var async = require('async');

app.set('port', 2333);

app.use(web);

var clients = [];

var mysql = require('mysql');
var bcrypt = require('bcrypt');

var connectionpool = mysql.createPool({
    connectionlimit: 10,
    host: 'localhost',
    user: 'emporium-node',
    password: 'jIQJhLtZY87u4v0OgtcNIvBfixfHkq',
    database: 'emporium'
});

//TODO: DONT CHANGE LOCALHOSTS INTO MY IP, change unity SOCKET node server IP.

var connectionpool_tiles = mysql.createPool({
    connectionlimit: 10,
    host: 'localhost',
    user: 'emporium-node',
    password: 'jIQJhLtZY87u4v0OgtcNIvBfixfHkq',
    database: 'emporium_users'
});

var clientCount = [];
var currentConnections = {};

io.on("connection", function (socket) {
    //fix this shit, istrint shitty variables
    var currentUser;

    var UserUsername;
    var UserDollars;
    var UserPlotSize;
    var UserLastOnline;

    //registruojamas socket + user IP
    currentConnections[socket.id] = { socket: socket, IP: socket.request.connection.remoteAddress };  //kind of a double registration. Mb bad. Kepps up the count though, which is nice.
    clientCount.push(socket);

    console.log("Connection Up, client ID: " + clientCount.indexOf(socket) + ", Connection IP: " + socket.request.connection.remoteAddress);

    socket.emit("connectedToNode", { ConnectedOnceNoDupeStatRequests: true });

    socket.on("CHECK_LOGIN", function (data) {
        var username = data.Uname;

        db.CheckForIPBan(socket.request.connection.remoteAddress).then(function (data) {
            if (data.banned) { //useris turi bana, netikrinam logino. TODO: paflashint kad dar banned.
            } else { //bano nera, viskas tvarkoj vaziuojam toliau
                db.ParseLogin(data).then(function (data) {
                    var status = data.status;

                    socket.emit("PASS_CHECK_CALLBACK", { passStatus: status });

                    if (status == 1) { //useris patvirtintas
                        if (findValue(currentConnections, username)) { //patikra, ar nera jau uzregistruoto connectiono su tuo paciu username
                            socket.emit("DISCREPANCY", { reason: 1, reasonString: "User already logged in from another device!" }); //DISCREPANCY CALL FOR THE CLIENT TO SHUT OFF.
                            socket.disconnect();
                        } else {
                            //username registruojamas velesniam naudojimui.
                            console.log("hooking " + username + " to socket ID " + socket.id);
                            currentConnections[socket.id].username = username;
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
        //halp or fix later
        try {
            console.log("user  " + currentConnections[socket.id].username + " dc'd");
            clientCount.splice(clientCount.indexOf(socket), 1);  // reiketu consolidatint is dvieju lists into one
            delete currentConnections[socket.id];

            UpdateLastloggedIn(currentConnections[socket.id].name);
        } catch (err) {
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

function findPrice(rows, name) {
    var price;
    var current = 0;

    while (rows[current].NAME !== name) {
        current++;
    }

    price = rows[current].PRICE;

    return price;
}

server.listen(2333, function () {
    console.log("-----------SERVER STARTED------------");
});

Array.prototype.contains = function (element) {
    return this.indexOf(element) > -1;
};

//FIXME - fixes for non-working things
//MAKEME - make orders for non-existant things
//FINDAWAY - a workaround needs to be found