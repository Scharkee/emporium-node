var express = require('express');
var router = express.Router();
var Chance = require('chance');
var mysql = require('mysql');
var bcrypt = require('bcrypt');
var crypto = require('crypto');
var async = require('async');

//MYSQL reikalingi loginai

var connectionpool = mysql.createPool({
    connectionlimit: 100,
    host: 'localhost',
    user: 'emporium-node',
    password: 'jIQJhLtZY87u4v0OgtcNIvBfixfHkq',
    database: 'emporium'
});

var connectionpool_tiles = mysql.createPool({
    connectionlimit: 100,
    host: 'localhost',
    user: 'emporium-node',
    password: 'jIQJhLtZY87u4v0OgtcNIvBfixfHkq',
    database: 'emporium_users'
});

//salt roundai hashui
const saltRounds = 10;

function ParseLogin(data, callback) {
    // no default values in JS yet
    // make sure callback is initialized
    callback = callback || function () { }

    return new Promise(function (resolve, reject) {
        var username = CleanInput(data.Uname, 1);
        var userpass = data.Upass;

        if (userpass !== data.Upass || username !== data.Uname) {
            //   socket.emit("DISCREPANCY", { reasonString: "Discrepancy detected in input. Please try again. Shutting off...", action: 1 });   gamealerts on login screen dont work i dont think;
        } else {//praleidziam
        }

        var passStatus;

        var sqlq = 'SELECT password FROM users WHERE username = ?';

        connectionpool.getConnection(function (err, connection) {
            connection.query(sqlq, username, function (err, rows, fields) {
                if (err) {
                    reject(err);
                    connection.release();
                    return callback(err);
                }
                if (!rows.length) {
                    resolve({ status: 2 });

                    //   socket.emit("PASS_CHECK_CALLBACK", { passStatus: 2 });
                } else {
                    var pass = rows[0].password;

                    bcrypt.compare(userpass, pass, function (err, res) {
                        if (res === true) {//praleidziam
                            resolve({ status: 1 });

                            //   socket.emit("PASS_CHECK_CALLBACK", { passStatus: 1 });
                        } else if (res === false) { //negeras password
                            resolve({ status: 0 });

                            //  socket.emit("PASS_CHECK_CALLBACK", { passStatus: 0 });
                        }
                    });
                }

                //else if(userpass == rows[0].password && loggedIn= true (is vieno acc tik is vienos vietos galima prisijungti))

                //TODO: dupe account loggedin function that callbacks  PASS_CHECK_CALLBACK
            });
            connection.release();
            return callback(null);
        });
    })
}

function ParsePasswordResetRequest(data, callback) {
    callback = callback || function () { }

    return new Promise(function (resolve, reject) {
        var username = CleanInput(data.Uname, 1);
        var userpass = data.Upass;

        if (userpass !== data.Upass || username !== data.Uname) {
            //   socket.emit("DISCREPANCY", { reasonString: "Discrepancy detected in input. Please try again. Shutting off...", action: 1 });   gamealerts on login screen dont work i dont think;
        } else {//praleidziam
        }

        var passStatus;

        connectionpool.getConnection(function (err, connection) {
            connection.query('SELECT password FROM users WHERE username = ?', username, function (err, rows, fields) {
                if (err) {
                    reject(err);
                    connection.release();
                    return callback(err);
                }
                if (!rows.length) {
                    resolve({ status: 2 });

                    //   socket.emit("PASS_CHECK_CALLBACK", { passStatus: 2 });
                } else {
                    var pass = rows[0].password;

                    bcrypt.compare(userpass, pass, function (err, res) {
                        if (res === true) {//praleidziam
                            resolve({ status: 1 });

                            //   socket.emit("PASS_CHECK_CALLBACK", { passStatus: 1 });
                        } else if (res === false) { //negeras password
                            resolve({ status: 0 });

                            //  socket.emit("PASS_CHECK_CALLBACK", { passStatus: 0 });
                        }
                    });
                }

                //else if(userpass == rows[0].password && loggedIn= true (is vieno acc tik is vienos vietos galima prisijungti))

                //TODO: dupe account loggedin function that callbacks  PASS_CHECK_CALLBACK
            });
            connection.release();
            return callback(null);
        });
    });
}

function ForgotPass(data, callback) {
    // no default values in JS yet
    // make sure callback is initialized
    callback = callback || function () { }

    return new Promise(function (resolve, reject) {
        var email = data.Email;

        connectionpool.getConnection(function (err, connection) {
            connection.query('SELECT * FROM users WHERE email = ?', email, function (err, rows, fields) {
                if (err) {
                    reject(err);
                    connection.release();
                    return callback(err);
                }

                if (!rows.length) { //nera tokio acc; neresettinam psw
                    resolve({ call: "FORGOT_PASSWORD_STATUS", content: { status: 2 } });

                    //   socket.emit("PASS_CHECK_CALLBACK", { passStatus: 2 });
                } else {
                    async.waterfall([
                        function (done) {
                            crypto.randomBytes(20, function (err, buf) {
                                var token = buf.toString('hex');
                                done(err, token);
                            });
                        }, function (done) {
                            var post = { reset_token: token, reset_date: UnixTime() + 3600 };

                            connection.query('UPDATE users SET ? WHERE email = ?', [post, email], function (err, rows, fields) {
                                if (err) {
                                    reject(err);
                                    connection.release();
                                    return callback(err);
                                }
                            });
                        }], function (err) {
                            if (err) return next(err);
                        });

                    //TODO: send email to reset password;
                    //TODO: generate token for password reset, and allow accessing it via webhandler.js (GET)

                    resolve({ call: "FORGOT_PASSWORD_STATUS", content: { status: 1 } });
                }
            });
            connection.release();
            return callback(null);
        });
    })
}

function RegisterUser(data, callback) {
    callback = callback || function () { };

    var username = data.Uname;
    var userpass = data.Upass;
    var email = data.Email;

    console.log(username + " + " + userpass + " + " + email);

    bcrypt.hash(userpass, saltRounds, function (err, hash) {
        var post = { username: username, password: hash, email: email, email_confirmed: 0 };

        connectionpool.getConnection(function (err, connection) {
            connection.query('INSERT INTO users SET ?', post, function (err, result) {
                if (err) {
                    throw err;
                }

                //TODO: send out cohfirmation email to user w/ generated token.
                //If webhandler gets token assigned to user - set email_confirmed to true in DB
            });
            connection.release();
            return callback(null);
        });
    });
}

function GetStats(data, callback) {
    callback = callback || function () { }

    return new Promise(function (resolve, reject) {
        var username = data.Uname;

        connectionpool.getConnection(function (err, connection) {
            connection.query('SELECT * FROM stats WHERE username = ?', username, function (err, rows, fields) {
                if (err) {
                    reject(err);
                    connection.release();
                    return callback(err);
                }

                if (!rows.length) {//if DB finds no matches for username, create stats for that username.
                    console.log("Creating default user stats for: " + username);

                    resolve({ dollars: 100, plotsize: 3, lastonline: UnixTime(), firstPlay: true });

                    InsertDefaultStats(username, 100, UnixTime(), 3);
                } else {//if DB finds matches for username, persiunciam duomenis atgal i main JS faila.
                    var lastonlinestring = rows[0].lastonline.toString();

                    resolve({ dollars: rows[0].dollars, plotsize: rows[0].plotsize, lastonline: lastonlinestring, firstPlay: false });
                }
            });
            connection.release();
            return callback(null);
        });
    });
}

function GetTileData(data, callback) {
    callback = callback || function () { }

    return new Promise(function (resolve, reject) {
        var username = data.Uname;

        connectionpool_tiles.getConnection(function (err, connection) {
            async.waterfall([
                function (done) {
                    connection.query('CREATE TABLE IF NOT EXISTS ?? ( `ID` INT(10) NOT NULL AUTO_INCREMENT , `NAME` VARCHAR(20) NOT NULL , `START_OF_GROWTH` VARCHAR(15) NOT NULL , `X` FLOAT(5) NOT NULL , `Z` FLOAT(5) NOT NULL , `FERTILISED_UNTIL` INT(10) NOT NULL ,`COUNT` INT(3) NOT NULL , `BUILDING_CURRENT_WORK_AMOUNT` INT(10) NOT NULL, `WORK_NAME` VARCHAR(20) NOT NULL, PRIMARY KEY (`ID`)) ENGINE = InnoDB;', data.Uname, function (err, rows, fields) {
                        if (err) {
                            reject(err);
                            connection.release();
                            return callback(err);
                        }
                    });
                    done(null);
                }, function (done) {
                    connection.query('SELECT * FROM ??', data.Uname, function (err, rows, fields) {
                        if (err) {
                            reject(err);
                            connection.release();
                            return callback(err);
                        }

                        resolve({ rows });
                    });
                    done(null);
                }], function (err) {
                    if (err) return next(err);
                });

            connection.release();
            return callback(null);
        });
    });
}

function GetTransportQueues(data, callback) {
    callback = callback || function () { }

    return new Promise(function (resolve, reject) {
        var username = data.Uname;

        connectionpool_tiles.getConnection(function (err, connection) {
            async.waterfall([
                function (done) {
                    connection.query('CREATE TABLE IF NOT EXISTS ?? ( `ID` INT(10) NOT NULL AUTO_INCREMENT ,`DEST` VARCHAR(30) NOT NULL , `DATE` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `START_OF_TRANSPORTATION` INT(30) NOT NULL , `LENGTH_OF_TRANSPORTATION` INT(30) NOT NULL , `SALE` VARCHAR(1000) NOT NULL, `IndexInJobList` INT(5) NOT NULL  , PRIMARY KEY (`ID`)) ENGINE = InnoDB;', data.Uname + "_transport", function (err, rows, fields) {
                        if (err) {
                            reject(err);
                            connection.release();
                            return callback(err);
                        }
                    });

                    done(null);
                }, function (done) {
                    connection.query('SELECT * FROM ??', data.Uname + "_transport", function (err, rows, fields) {
                        if (err) {
                            reject(err);
                            connection.release();
                            return callback(err);
                        }

                        resolve({ call: "RECEIVE_TRANSPORT_QUEUE", content: { rows } });
                    });

                    done(null);
                }], function (err) {
                    if (err) return next(err);
                });

            connection.release();
            return callback(null);
        });
    });
}

function GetWorkers(data, callback) {
    callback = callback || function () { }

    return new Promise(function (resolve, reject) {
        var username = data.Uname;

        connectionpool_tiles.getConnection(function (err, connection) {
            async.waterfall([
                function (done) {
                    connection.query('CREATE TABLE IF NOT EXISTS ?? ( `ID` INT(10) NOT NULL AUTO_INCREMENT ,`SPEED` DECIMAL(10,2) NOT NULL ,`ASSIGNEDTILEID` INT(10) NOT NULL , `DATE` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`ID`)) ENGINE = InnoDB;', data.Uname + "_workers", function (err, rows, fields) {
                        if (err) {
                            reject(err);
                            connection.release();
                            return callback(err);
                        }
                    });

                    done(null);
                }, function (done) {
                    connection.query('SELECT * FROM ??', data.Uname + "_workers", function (err, rows, fields) {
                        if (err) {
                            reject(err);
                            connection.release();
                            return callback(err);
                        }

                        resolve({ call: "RECEIVE_WORKERS", content: { rows } });
                    });

                    done(null);
                }], function (err) {
                    if (err) return next(err);
                });

            connection.release();
            return callback(null);
        });
    });
}

function GetTiles(data, callback) {
    callback = callback || function () { }

    return new Promise(function (resolve, reject) {
        var username = data.Uname;

        connectionpool.getConnection(function (err, connection) {
            connection.query('SELECT * FROM buildings', function (err, rows, fields) {
                if (err) {
                    reject(err);
                    connection.release();
                    return callback(err);
                }

                resolve({ rows });
            });

            connection.release();
            return callback(null);
        });
    });
}

function GetInventory(data, callback) {
    callback = callback || function () { }
    return new Promise(function (resolve, reject) {
        var username = data.Uname;

        connectionpool.getConnection(function (err, connection) {
            connection.query('SELECT * FROM inventories WHERE username = ?', username, function (err, rows, fields) {
                if (err) {
                    reject(err);
                    connection.release();
                    return callback(err);
                }

                if (!rows.length) { //neturetu ever buti iskviestas
                    console.log("user does not have an inventory!");

                    var post = { username: data.Uname };

                    connection.query('INSERT INTO inventories SET ?', post, function (err, rows, fields) {
                        if (err) {
                            reject(err);
                            connection.release();
                            return callback(err);
                        }

                        connection.query('SELECT * FROM inventories WHERE username = ?', username, function (err, rows, fields) {
                            if (err) {
                                reject(err);
                                connection.release();
                                return callback(err);
                            }

                            resolve({ rows });
                        });
                    });
                } else {
                    resolve({ rows });
                }
            });
            connection.release();
            return callback(null);
        });
    });
}

function HandleTilePurchase(data, callback) {
    callback = callback || function () { }
    return new Promise(function (resolve, reject) {
        var username = data.Uname;
        var buildingname = data.BuildingName;
        var DBdollars;
        var DBBuildingPrice;
        var TileX = parseFloat(data.X);
        var TileZ = parseFloat(data.Z);
        var tilecount = data.TileCount;
        var tileID;
        var count = 1;

        try {
            tileID = data.tileID;
        } catch (err) {
            console.log("tile doesnt exist");
        }

        connectionpool.getConnection(function (err, connection) { //abu pools is karto uzvedam
            connectionpool_tiles.getConnection(function (err, connectionT) {
                async.waterfall([
    function (done) {
        connection.query('SELECT dollars FROM stats WHERE username = ?', username, function (err, rows, fields) {
            if (err) {
                reject(err);
                connection.release();
                return callback(err);
            }

            DBdollars = rows[0].dollars;
            done(err, DBdollars);
        });
    }, function (DBdollars, done) {
        connection.query('SELECT PRICE FROM buildings WHERE NAME = ?', buildingname, function (err, rows, fields) {
            if (err) {
                reject(err);
                connection.release();
                return callback(err);
            }

            DBBuildingPrice = rows[0].PRICE;

            if (tileID === undefined) {//tile nera.
                if (DBdollars >= DBBuildingPrice) {//tile bought cuz enough money.
                    TakeAwayMoney(DBdollars, DBBuildingPrice, username);

                    var post = { NAME: buildingname, START_OF_GROWTH: UnixTime(), X: TileX, Z: TileZ, FERTILISED_UNTIL: 0, BUILDING_CURRENT_WORK_AMOUNT: 0, COUNT: count };   // matched querry , match up with tile tables for inserting  bought tile into DB.

                    connectionT.query('INSERT INTO ?? SET ?', [username, post], function (err, rows, fields) {
                        if (err) {
                            reject(err);
                            connection.release();
                            return callback(err);
                        }

                        var callbackData = { call: "BUILD_TILE", content: { TileName: buildingname, TileX: TileX, TileZ: TileZ, ID: rows.insertId } };
                        resolve(callbackData);
                    });
                } else {//not enough dollars to buy boi
                    var missing = DBBuildingPrice - DBdollars;
                    var callbackData = { call: "NO_FUNDS", content: { missing: missing } };
                    resolve(callbackData);
                }
            } else {//upgradinamas tile.
                connectionT.query('SELECT * FROM ?? WHERE ID = ?', [username, Number(tileID)], function (err, rows, fields) {
                    if (err) {
                        reject(err);
                        connection.release();
                        return callback(err);
                    }

                    count = rows[0].COUNT;

                    if (count === 5) {
                        console.log("tile at max upgrades"); //neturetu sitas buti atsiustas EVER
                    } else {//proceed with the upgrade
                        console.log("upgrading");

                        count++;

                        if (DBdollars >= DBBuildingPrice) {//tile bought cuz enough money.
                            TakeAwayMoney(DBdollars, DBBuildingPrice, username);

                            var post = { COUNT: count };   // matched querry , match up with tile tables for inserting  bought tile into DB.

                            connectionT.query('UPDATE ?? SET ? WHERE ID = ?', [username, post, tileID], function (err, rows, fields) {
                                if (err) {
                                    reject(err);
                                    connection.release();
                                    return callback(err);
                                }

                                var callbackData = { call: "UPGRADE_TILE", content: { tileID: Number(tileID) } };
                                resolve(callbackData);
                            });
                        } else {//not enough dollars to buy boi
                            var missing = DBBuildingPrice - DBdollars;
                            var callbackData = { call: "NO_FUNDS", content: { missing: missing } };
                            resolve(callbackData);  //priimt sita cliente ir parodyt alerta, kad neuztenka pinigu (missing + kiek missina dollars)
                        }
                    }
                });
            }

            done(null);
        });
    }], function (err) {
        if (err) return next(err);
    });

                connectionT.release();
            });
            connection.release();
            return callback(null);
        });
    });
}

function HandleTileSale(data, callback) {
    callback = callback || function () { }
    return new Promise(function (resolve, reject) {
        var username = data.Uname;
        var SellTileID = parseInt(data.SellTileID);
        var buildingName = data.TileName;
        var DBBuildingPrice;
        var count;

        connectionpool.getConnection(function (err, connection) {
            connectionpool_tiles.getConnection(function (err, connectionT) {
                async.waterfall([
                 function (done) {
                     connection.query('SELECT PRICE FROM buildings WHERE NAME = ?', buildingName, function (err, rows, fields) {
                         if (err) {
                             reject(err);
                             connection.release();
                             return callback(err);
                         }

                         DBBuildingPrice = rows[0].PRICE;
                         done(err, DBBuildingPrice);
                     });
                 }, function (DBBuildingPrice, done) {
                     connectionT.query('SELECT * FROM ?? WHERE ID = ?', [username, SellTileID], function (err, rows, fields) {
                         if (err) {
                             reject(err);
                             connection.release();
                             return callback(err);
                         }

                         count = rows[0].COUNT;
                         done(err, count);
                     });
                 }, function (count, done) {
                     connectionT.query('DELETE FROM ?? WHERE ID = ?', [username, SellTileID], function (err, rows, fields) {
                         if (err) {
                             reject(err);
                             connection.release();
                             return callback(err);
                         }

                         resolve({ addFunds: (DBBuildingPrice / 4) * count });

                         AddMoney((DBBuildingPrice / 4) * count, username); //sell rates subject to change. 25% atm, maybe too harsh IDK

                         done(null);
                     });
                 }, function (count, done) {
                     connectionT.release();
                     connection.release();
                     return callback(null);
                     done(null);
                 }], function (err) {
                     if (err) return next(err);
                 });
            });
        });
    });
}

function HandleTileAssignWork(data, callback) {
    callback = callback || function () { }
    return new Promise(function (resolve, reject) {
        var username = data.Uname;
        var tileID = data.TileID;
        var assignedWorkName = data.WorkName;
        var assignedWorkAmmount = data.WorkAmount;
        var DBdollars;
        var DBBuildingPrice;

        connectionpool_tiles.getConnection(function (err, connectionT) {
            connectionT.query('SELECT * FROM ?? WHERE ID = ?', [username, Number(tileID)], function (err, rows, fields) {
                if (err) {
                    reject(err);
                    connection.release();
                    return callback(err);
                }

                tileCurrentWork = rows[0].BUILDING_CURRENT_WORK_AMOUNT;

                if (tileCurrentWork !== 0) { //hasnt finished work yet, but the call came trough. DISCREPENCY
                    resolve({ call: "DISCREPANCY", content: { reasonString: "Timing discrepancy detected. Resynchronization is mandatory. Shutting off...", action: 1 } });
                } else {
                    connectionpool.getConnection(function (err, connection) {
                        connection.query('SELECT * FROM inventories WHERE username = ?', username, function (err, rows, fields) {
                            if (err) {
                                reject(err);
                                connection.release();
                                return callback(err);
                            }

                            console.log("lookin to get some juice from " + assignedWorkName);

                            if (rows[0][assignedWorkName] >= assignedWorkAmmount) {
                                console.log(rows[0][assignedWorkName] + " is the name");

                                var post = { START_OF_GROWTH: UnixTime(), BUILDING_CURRENT_WORK_AMOUNT: assignedWorkAmmount, WORK_NAME: assignedWorkName };

                                connectionT.query('UPDATE ?? SET ? WHERE ID = ?', [username, post, tileID], function (err, rows, fields) { // reset tile growth time
                                    if (err) {
                                        reject(err);
                                        connection.release();
                                        return callback(err);
                                    }
                                });

                                TakeAwayItem(assignedWorkName, assignedWorkAmmount, username);

                                resolve({ tileID: tileID, unixBuffer: UnixTime().toString(), currentWorkName: assignedWorkName, currentWorkAmount: assignedWorkAmmount }); //cliente resettinamas tile growth.
                            } else {
                                resolve({ call: "DISCREPANCY", content: { reasonString: "Produce amount discrepancy detected. Resynchronization is mandatory. Shutting off...", action: 1 } });
                            }
                        });
                        connection.release();
                    });
                }
            });
            connectionT.release();
            return callback(null);
        });
    });
}

function HandleProduceSale(data, callback) {
    callback = callback || function () { }
    return new Promise(function (resolve, reject) {
        var username = data.Uname;

        var SaleID = data.ID;
        var DBdollars;
        var rowsPricings;
        var post = {};
        var postMoney = {};
        var saleDeser;
        var job;

        connectionpool.getConnection(function (err, connection) {
            connectionpool_tiles.getConnection(function (err, connectionT) {
                async.waterfall([function (done) {
                    connectionT.query('SELECT * FROM ?? WHERE ID=?', [username + "_transport", SaleID], function (err, rowse, fields) {
                        if (err) {
                            reject(err);
                            connectionT.release();
                            return callback(err);
                        } if (!rowse) {
                            resolve({ call: "DISCREPANCY", content: { reasonString: "Job discrepancy detected. Resynchronization is mandatory. Shutting off...", action: 1 } });
                        }
                        console.log(rowse[0]);
                        job = rowse[0];
                        var tempSaleString = job.SALE;
                        saleDeser = JSON.parse(tempSaleString);

                        if (job.LENGTH_OF_TRANSPORTATION + job.START_OF_TRANSPORTATION > UnixTime()) { //patikrinimas, ar ne per anskti atsiunte JOB finisheri
                            resolve({ call: "DISCREPANCY", content: { reasonString: "Job discrepancy detected. Resynchronization is mandatory. Shutting off...", action: 1 } });
                        }
                        done(null);
                    });
                }, function (done) {
                    connection.query('SELECT * FROM prices', function (err, rowsP, fields) { //getting prices for adding money for the sales. Current pricings might be a lot of info. (check)
                        if (err) {
                            reject(err);
                            connection.release();
                            return callback(err);
                        }

                        rowsPricings = rowsP;
                        done(null);
                    });
                }, function (done) {
                    connection.query('SELECT * FROM stats WHERE username = ?', username, function (err, rowsM, fields) { //getting dollars for adding money later
                        if (err) {
                            reject(err);
                            connection.release();
                            return callback(err);
                        }

                        postMoney = rowsM[0];
                        done(null);
                    });
                }, function (done) {
                    connection.query('SELECT * FROM inventories WHERE username = ?', username, function (err, rows, fields) {
                        if (err) {
                            reject(err);
                            connection.release();
                            return callback(err);
                        }

                        for (var i = 0; i < saleDeser.salesNum; i++) { //prasideda nuo 0
                            if (Number(rows[0][saleDeser[i + "name"]]) < Number(saleDeser[i + "amount"])) { // per mazai in database. Client praleido nors negali taip but. DISCREPENCY.
                                resolve({ call: "DISCREPANCY", content: { reasonString: "Produce amount discrepancy detected. Resynchronization is mandatory. Shutting off...", action: 1 } });
                                console.log("ok1");
                            } else {// viskas probs OK, sale allowed.
                                post[saleDeser[i.toString() + "name"].toString()] = Number(rows[0][saleDeser[i + "name"]]) - Number(saleDeser[i + "amount"]); // naujas amountas paruosiamas postui i database.

                                postMoney["dollars"] += saleDeser[i + "amount"] * findPrice(rowsPricings, saleDeser[i + "name"]); //RASTI PAGAL VARDA KAINA sitam objekte somehow. Multiplication dollars per KG. Tuos pacius pricings galima rodyti ir
                                //paciam sale screen.( $/per kilograma)
                            }
                        }

                        done(null);
                    });
                }, function (done) {
                    connection.query('UPDATE inventories SET ? WHERE username = ?', [post, username], function (err, rows, fields) {
                        if (err) {
                            reject(err);
                            connection.release();
                            return callback(err);
                        }

                        done(null);
                    });
                }, function (done) {
                    connection.query('UPDATE stats SET ? WHERE username = ?', [postMoney, username], function (err, rowsM, fields) { //adding all the monay
                        if (err) {
                            reject(err);
                            connection.release();
                            return callback(err);
                        }

                        resolve({ call: "SALE_VERIFICATION", content: postMoney });

                        connectionT.query('DELETE FROM ?? WHERE ID = ?', [username + "_transport", SaleID], function (err, rowse, fields) {
                            if (err) {
                                reject(err);
                                connectionT.release();
                                return callback(err);
                            }
                        });

                        connection.release();
                        connectionT.release();
                        return callback(null);
                        done(null);
                    });
                }], function (err) {
                    console.log(err);
                    if (err) return next(err);
                });
            });
        });
    });
}

function HandleProduceSaleJobAssignment(data, callback) {
    callback = callback || function () { }
    return new Promise(function (resolve, reject) {
        var username = data.Uname;
        var destination = data.Dest;
        var salesNum = data.salesNum;
        var post = {};
        var transport;
        var totalWeight = 0;
        var sale = "";
        var dataPre = data;

        sale = JSON.stringify(dataPre);

        connectionpool.getConnection(function (err, connection) {
            connectionpool_tiles.getConnection(function (err, connectionT) {
                async.waterfall([function (done) {
                    connection.query('SELECT * FROM inventories WHERE username = ?', username, function (err, rows, fields) {
                        if (err) {
                            reject(err);
                            connection.release();
                            return callback(err);
                        }

                        for (var i = 0; i < salesNum; i++) { //prasideda nuo 0
                            if (Number(rows[0][data[i + "name"]]) < Number(data[i + "amount"])) { // per mazai in database. Client praleido nors negali taip but. DISCREPENCY.
                                resolve({ call: "DISCREPANCY", content: { reasonString: "Produce amount discrepancy detected. Resynchronization is mandatory. Shutting off...", action: 1 } });
                            } else {// viskas probs OK, sale allowed.(eina checkas tik del discrepancy. Siaip nieks nevyksta)
                                totalWeight += Number(data[i + "amount"]);
                            }
                        }

                        // patvirtinamas tranportacijos budas + paiimamas speed;

                        getInfoAndVerifyTile(data.TransportID, data.Transport, username).then(function (rezz) {
                            if (!rezz.tile) { //nera transporto tile
                                transport[0].PROG_AMOUNT = 600;
                                transport.TILEPRODUCENAME = 30;
                            } else {
                                transport = rezz.tileInfo;
                            }

                            if (totalWeight > transport.TILEPRODUCENAME * data.count) { //per daugg prikrauta is client
                                console.log("lauziu1");
                                resolve({ call: "DISCREPANCY", content: { reasonString: "Transport discrepancy detected. Resynchronization is mandatory. Shutting off...", action: 1 } });
                            }
                            console.log("still alive");
                            post = { DEST: destination, START_OF_TRANSPORTATION: UnixTime(), LENGTH_OF_TRANSPORTATION: transport[0].PROG_AMOUNT, SALE: sale, IndexInJobList: data.IndexInJobList };

                            done(null);
                        }).catch(function (err) {
                            resolve({ call: "DISCREPANCY", content: { reasonString: "Transport discrepancy detected. Resynchronization is mandatory. Shutting off...", action: 1 } });
                        });
                    });
                }, function (done) { //pushinam ta sale orderi faaar awaay i DB.
                    connectionT.query('INSERT INTO ?? SET ?', [username + "_transport", post], function (err, rows, fields) {
                        if (err) {
                            reject(err);
                            connectionT.release();
                            return callback(err);
                        }
                        console.log("still alive");
                        post.ID = rows.insertId;

                        resolve({ call: "SALE_JOB_VERIFICATION", content: post });
                        done(null);
                    });
                }], function (err) {
                    //LEFTOFF: sitas VISADA trigerinasi, so idea why.
                    console.log(err);
                    if (err) return next(err);
                });
                connectionT.release();
            });

            connection.release();
        });
    });
}

function HandleWorkerAssignment(data, callback) {//TODO: Workeris uzsiundomas ant specifiskos tile pagal ID
    callback = callback || function () { }
    return new Promise(function (resolve, reject) {
        var post = {};
        var username = data.Uname;
        var assignedTileID = data.AssignedTileID;
        var workerID = data.WorkerID;

        connectionpool_tiles.getConnection(function (err, connectionT) {
            async.waterfall([function (done) { //paziurim ar workeris laisvas
                connectionT.query('SELECT * FROM ?? WHERE ID = ?', [username + "_transport", workerID], function (err, rows, fields) {
                    if (err) {
                        reject(err);
                        connectionT.release();
                        return callback(err);
                    }
                    post.WorkerID = rows.insertId;
                    post.TileID = assignedTileID;

                    resolve({ call: "WORKER_ASSIGNMENT_VERIFICATION", content: post });
                    done(null);
                });
            }], function (err) {
                //LEFTOFF: sitas VISADA trigerinasi, so idea why.
                console.log(err);
                if (err) return next(err);
            });
            connectionT.release();
        });
    });
}

function HandleWorkerUnAssignment(data, callback) { //TODO: Workeris paleidziamas (nebedirba ant tile) pagal ID
    callback = callback || function () { }
    return new Promise(function (resolve, reject) {
        var post = {};
        var username = data.Uname;
        var assignedTileID = data.AssignedTileID;
        var workerID = data.WorkerID;

        connectionpool_tiles.getConnection(function (err, connectionT) {
            async.waterfall([function (done) { //paziurim ar workeris laisvas
                connectionT.query('SELECT * FROM ?? WHERE ID = ?', [username + "_transport", workerID], function (err, rows, fields) {
                    if (err) {
                        reject(err);
                        connectionT.release();
                        return callback(err);
                    }
                    post.WorkerID = rows.insertId;
                    post.TileID = assignedTileID;

                    resolve({ call: "WORKER_ASSIGNMENT_VERIFICATION", content: post });
                    done(null);
                });
            }], function (err) {
                //LEFTOFF: sitas VISADA trigerinasi, so idea why.
                console.log(err);
                if (err) return next(err);
            });
            connectionT.release();
        });
    });
}

function HandleWorkerHired(data, callback) { //TODO: Workeris nusamdomas (INSERT)
    callback = callback || function () { }
    return new Promise(function (resolve, reject) {
        var post = {};
        var username = data.Uname;
        var assignedTileID = data.AssignedTileID;
        var workerID = data.WorkerID;

        connectionpool_tiles.getConnection(function (err, connectionT) {
            async.waterfall([function (done) { //paziurim ar workeris laisvas
                connectionT.query('SELECT * FROM ?? WHERE ID = ?', [username + "_transport", workerID], function (err, rows, fields) {
                    if (err) {
                        reject(err);
                        connectionT.release();
                        return callback(err);
                    }
                    post.WorkerID = rows.insertId;
                    post.TileID = assignedTileID;

                    resolve({ call: "WORKER_ASSIGNMENT_VERIFICATION", content: post });
                    done(null);
                });
            }], function (err) {
                //LEFTOFF: sitas VISADA trigerinasi, so idea why.
                console.log(err);
                if (err) return next(err);
            });
            connectionT.release();
        });
    });
}

function HandleWorkerFired(data, callback) { //TODO: Workeris atleidziamas (DROP)
    callback = callback || function () { }
    return new Promise(function (resolve, reject) {
        var post = {};
        var username = data.Uname;
        var assignedTileID = data.AssignedTileID;
        var workerID = data.WorkerID;

        connectionpool_tiles.getConnection(function (err, connectionT) {
            async.waterfall([function (done) { //paziurim ar workeris laisvas
                connectionT.query('SELECT * FROM ?? WHERE ID = ?', [username + "_transport", workerID], function (err, rows, fields) {
                    if (err) {
                        reject(err);
                        connectionT.release();
                        return callback(err);
                    }
                    post.WorkerID = rows.insertId;
                    post.TileID = assignedTileID;

                    resolve({ call: "WORKER_ASSIGNMENT_VERIFICATION", content: post });
                    done(null);
                });
            }], function (err) {
                //LEFTOFF: sitas VISADA trigerinasi, so idea why.
                console.log(err);
                if (err) return next(err);
            });
            connectionT.release();
        });
    });
}

function HandleTileCollect(data, callback) {
    var chance = new Chance();

    callback = callback || function () { }
    return new Promise(function (resolve, reject) {
        var username = data.Uname;
        var tileID = data.TileID;
        var tileProgAmount;
        var tileName;
        var tileGrowthStart;
        var singleUse;
        var tileCount;

        var tileProduceName;
        var tileProduceRandomRange1;
        var tileProduceRandomRange2;

        connectionpool_tiles.getConnection(function (err, connectionT) {
            connectionT.query('SELECT * FROM ?? WHERE ID = ?', [username, Number(tileID)], function (err, rows, fields) {
                if (err) {
                    reject(err);
                    connection.release();
                    return callback(err);
                }

                tileName = rows[0].NAME;
                tileGrowthStart = rows[0].START_OF_GROWTH;
                tileCount = rows[0].COUNT;

                connectionpool.getConnection(function (err, connection) {
                    connection.query('SELECT * FROM buildings WHERE NAME = ?', tileName, function (err, rows, fields) {
                        tileProgAmount = rows[0].PROG_AMOUNT;

                        tileProduceName = rows[0].TILEPRODUCENAME;
                        tileProduceRandomRange1 = rows[0].TILEPRODUCERANDOM1;
                        tileProduceRandomRange2 = rows[0].TILEPRODUCERANDOM2;
                        singleUse = rows[0].SINGLE_USE;

                        var prog = Number(tileGrowthStart) + tileProgAmount;   //FIXME: Number() because of varchar in MYSQL

                        if (UnixTime() >= prog) {//Resetting tile progress and adding items to inventory
                            var randProduce = chance.floating({ min: tileProduceRandomRange1, max: tileProduceRandomRange2 }).toFixed(2); //randomized produce kiekis

                            connection.query('SELECT * FROM inventories WHERE username = ?', username, function (err, rows, fields) { // prideti prie egzistuojanciu apelsinu
                                if (err) {
                                    reject(err);
                                    connection.release();
                                    return callback(err);
                                }

                                var newProduceAmount = rows[0][tileProduceName] + Number(randProduce) * tileCount;
                                var post = {};
                                post[tileProduceName] = newProduceAmount;

                                connection.query('UPDATE inventories SET ? WHERE username = ?', [post, username], function (err, rows, fields) { // prideti prie egzistuojanciu apelsinu
                                    if (err) {
                                        reject(err);
                                        connection.release();
                                        return callback(err);
                                    }
                                });

                                if (singleUse === 1) {
                                    connectionT.query('DELETE FROM ?? WHERE ID = ?', [username, tileID], function (err, rows, fields) {
                                        if (err) {
                                            reject(err);
                                            connection.release();
                                            return callback(err);
                                        }
                                    });
                                } else {
                                    resolve({ call: "RESET_TILE_GROWTH", content: { tileID: tileID, unixBuffer: UnixTime().toString(), currentProduceAmount: newProduceAmount, harvestAmount: Number(randProduce) * tileCount } });
                                }
                            });

                            connectionT.query('UPDATE ?? SET START_OF_GROWTH = ? WHERE ID = ?', [username, UnixTime(), tileID], function (err, rows, fields) { // prideti prie egzistuojanciu apelsinu
                                if (err) {
                                    reject(err);
                                    connection.release();
                                    return callback(err);
                                }
                            });
                        } else {
                            console.log("=====================harvest not allowed=======================");
                            //DISCREPENCY. Shouldnt be even able to call this function from client if the tile isnt grown.
                        }
                    });

                    connection.release();
                });
            });

            connectionT.release();
            return callback(null);
        });
    });
}

function HandlePressWorkCollection(data, callback) {
    callback = callback || function () { }
    return new Promise(function (resolve, reject) {
        var username = data.Uname;
        var tileID = data.TileID;
        var tileProgAmount;
        var tileName;
        var tileGrowthStart;
        var tileWorkAmount;

        connectionpool_tiles.getConnection(function (err, connectionT) {
            connectionT.query('SELECT * FROM ?? WHERE ID = ?', [username, Number(tileID)], function (err, rows, fields) {
                if (err) {
                    reject(err);
                    connection.release();
                    return callback(err);
                }

                tileName = rows[0].NAME;
                tileGrowthStart = rows[0].START_OF_GROWTH;
                tileWorkAmount = rows[0].BUILDING_CURRENT_WORK_AMOUNT;
                tileWorkName = rows[0].WORK_NAME;
                tileEfic = rows[0].EFIC;

                connectionpool.getConnection(function (err, connection) {
                    connection.query('SELECT * FROM buildings WHERE NAME = ?', tileName, function (err, rows, fields) {
                        PressSpeed = rows[0].PROG_AMOUNT / 100;

                        PressProduceName = rows[0].TILEPRODUCENAME;
                        PressEfficiency = tileEfic;

                        var prog = Number(tileGrowthStart) + tileWorkAmount * PressSpeed;   //FIXME: Number() because of varchar in MYSQL

                        if (UnixTime() >= prog) {
                            //Resetting tile progress and adding items to inventory

                            var JuiceProduceAmount = tileWorkAmount * PressEfficiency;

                            connection.query('SELECT * FROM inventories WHERE username = ?', username, function (err, rows, fields) { // prideti prie egzistuojanciu apelsinu
                                if (err) {
                                    reject(err);
                                    connection.release();
                                    return callback(err);
                                }

                                var newProduceAmount = rows[0][tileWorkName + "_" + PressProduceName] + Number(JuiceProduceAmount);

                                var post = {};
                                post[tileWorkName + "_" + PressProduceName] = newProduceAmount;

                                connection.query('UPDATE inventories SET ? WHERE username = ?', [post, username], function (err, rows, fields) { // prideti prie egzistuojanciu apelsinu
                                    if (err) {
                                        reject(err);
                                        connection.release();
                                        return callback(err);
                                    }
                                });

                                resolve({ call: "RESET_TILE_GROWTH", content: { tileID: tileID, unixBuffer: UnixTime(), currentProduceAmount: newProduceAmount } });
                            });
                            var post1 = { BUILDING_CURRENT_WORK_AMOUNT: 0, WORK_NAME: "", START_OF_GROWTH: 0 };

                            connectionT.query('UPDATE ?? SET ? WHERE ID = ?', [username, post1, tileID], function (err, rows, fields) { // resetinam progresa
                                if (err) {
                                    reject(err);
                                    connection.release();
                                    return callback(err);
                                }
                            });
                        } else {
                            console.log("=====================harvest not allowed=======================");
                            //DISCREPENCY. Shouldnt be even able to call this function from client if the tile isnt grown.
                        }
                    });
                    connection.release();
                });
            });

            connectionT.release();
            return callback(null);
        });
    });
}

function HandlePlotsizeExpansion(data, callback) {
    callback = callback || function () { }
    return new Promise(function (resolve, reject) {
        var username = data.Uname;
        var DBdollars;
        var currentPlotsize;

        connectionpool.getConnection(function (err, connection) {
            connection.query('SELECT * FROM stats WHERE username = ?', username, function (err, rows, fields) {
                if (err) {
                    reject(err);
                    connection.release();
                    return callback(err);
                }

                DBdollars = rows[0].dollars;
                currentPlotsize = rows[0].plotsize;
                console.log(DBdollars + " vs " + Math.pow(10, currentPlotsize));

                if (DBdollars >= Math.pow(10, currentPlotsize - 1)) { //uztenka praplesti plotui
                    post = { plotsize: currentPlotsize + 1, dollars: (DBdollars - Math.pow(10, currentPlotsize)) };

                    connection.query('UPDATE stats SET ? WHERE username = ?', [post, username], function (err, rows, fields) {
                        if (err) {
                            reject(err);
                            connection.release();
                            return callback(err);
                        }
                    });

                    resolve({ call: "UPDATE_PLOT_SIZE", content: { newplot: currentPlotsize + 1 } });
                } else {
                    var missing = Math.pow(10, currentPlotsize - 1) - DBdollars;
                    resolve({ call: "NO_FUNDS", content: { missing: missing } });
                }
            });

            connection.release();
            return callback(null);
        });
    });
}

function HandlePriceRetrieval(data, callback) {
    callback = callback || function () { }
    return new Promise(function (resolve, reject) {
        connectionpool.getConnection(function (err, connection) {
            connection.query('SELECT * FROM prices', function (err, rows, fields) {
                if (err) {
                    reject(err);
                    connection.release();
                    return callback(err);
                }

                resolve({ call: "RECEIVE_PRICES", content: { rows } });

                connection.release();
                return callback(null);
            });
        });
    });
}

function HandleBugReportSubmission(data, callback) {
    callback = callback || function () { }
    return new Promise(function (resolve, reject) {
        connectionpool.getConnection(function (err, connection) {
            post = { REPORT: data.report };

            connection.query('INSERT INTO bugreports SET ?', post, function (err, rows, fields) {
                if (err) {
                    reject(err);
                    connection.release();
                    return callback(err);
                }

                resolve({ call: "RECEIVED_BUGREPORT", content: { status: 1 } });

                connection.release();
                return callback(null);
            });
        });
    });
}

function CleanInput(a, mode) {
    switch (mode) {
        case 1:
            var b = a.replace(/[^a-zA-Z0-9]/gi, '');

            break;
        case 2: //kitas refinery mode
            var b = a.replace(/[^a-zA-Z0-9]/gi, '');
            break;

        case 3: // trecias refinery mode
            //code
            break;

        default:
            // ....
            break;
    }

    return b;
}

function InsertDefaultStats(username, dollars, lastonline, plotsize) {
    var post = { username: username, dollars: dollars, lastonline: lastonline, plotsize: plotsize };

    console.log("inserting default stats into DB");
    connectionpool.getConnection(function (err, connection) { // starting a stats table entry for new client
        connection.query('INSERT INTO stats SET ?', post, function (err, rows, fields) {
            if (err) throw err;
        });

        var postInventories = { username: username };

        //starting a inventories table entry for new client

        connection.query('INSERT INTO inventories SET ?', postInventories, function (err, rows, fields) {
            if (err) throw err;
        });
        connection.release();
    });
}

function TakeAwayMoney(money, lostmoney, username) {
    connectionpool.getConnection(function (err, connection) {
        var remaining = money - lostmoney;
        var post = { dollars: remaining };

        connection.query('UPDATE stats SET ? WHERE username = ? ', [post, username], function (err, rows, fields) {
            if (err) throw err;
        });
        connection.release();
    });
}

function AddMoney(addedmoney, username) {
    connectionpool.getConnection(function (err, connection) {
        connection.query('SELECT dollars FROM stats WHERE username = ?', username, function (err, rows, fields) {
            if (err) throw err;

            var DBdollars = rows[0].dollars;
            var newmoney = DBdollars + addedmoney;
            var post = { dollars: newmoney };

            connection.query('UPDATE stats SET ? WHERE username = ?', [post, username], function (err, rows, fields) {
                if (err) throw err;
            });
        });
        connection.release();
    });
}

function TakeAwayItem(item, amount, username) {
    connectionpool.getConnection(function (err, connection) {
        connection.query('SELECT * FROM inventories WHERE username = ?', username, function (err, rows, fields) {
            if (err) throw err;

            var remaining = rows[0][item] - amount;
            var post = {};
            post[item] = remaining;//FIXME

            console.log(post);

            connection.query('UPDATE inventories SET ? WHERE username = ?', [post, username], function (err, rows, fields) {
                if (err) throw err;
            });
        });

        connection.release();
    });
}

function findValue(o, value) {
    for (var prop in o) {
        if (o.hasOwnProperty(prop) && o[prop] === value) {
            return prop;
        }
    }
    return null;
}

function getInfoAndVerifyTile(ID, transport, username, callback) {
    callback = callback || function () { }
    return new Promise(function (resolve, reject) {
        var speed;
        var count;
        connectionpool_tiles.getConnection(function (err, connectionT) {
            connectionT.query('SELECT * FROM ?? WHERE NAME = ? AND ID = ?', [username, transport, ID], function (err, rowse, fields) {
                if (err) throw err;
                if (!rowse) {
                    resolve({ tile: rowse }); //grazinam, net jei ir tuscia
                } else {
                    connectionpool.getConnection(function (err, connection) {
                        connection.query('SELECT * FROM buildings WHERE NAME = ?', [transport], function (err, rows, fields) {
                            if (err) throw err;
                            if (!rows) {
                                reject(false);
                            } else {
                                console.log(rows);

                                resolve({ tile: rowse, tileInfo: rows });
                            }
                            connection.release();
                        });
                    });
                }
                connectionT.release();
                return callback(null);
            });
        });
    });
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

function UnixTime() {
    var unix = Math.round(+new Date() / 1000);
    return unix;
}

//exportinu kad galeciau pasiekti main server.js

module.exports = {
    ParseLogin: ParseLogin,
    GetStats: GetStats,
    GetTiles: GetTiles,
    GetTileData: GetTileData,
    GetInventory: GetInventory,
    HandleTilePurchase: HandleTilePurchase,
    HandleTileSale: HandleTileSale,
    HandleTileAssignWork: HandleTileAssignWork,
    HandleProduceSale: HandleProduceSale,
    HandleTileCollect: HandleTileCollect,
    HandlePressWorkCollection: HandlePressWorkCollection,
    HandlePlotsizeExpansion: HandlePlotsizeExpansion,
    HandlePriceRetrieval: HandlePriceRetrieval,
    HandleBugReportSubmission: HandleBugReportSubmission,
    RegisterUser: RegisterUser,
    ForgotPass: ForgotPass,
    ParsePasswordResetRequest: ParsePasswordResetRequest,
    GetTransportQueues: GetTransportQueues,
    HandleProduceSaleJobAssignment: HandleProduceSaleJobAssignment,
    HandleWorkerAssignment: HandleWorkerAssignment,
    HandleWorkerUnAssignment: HandleWorkerUnAssignment,
    HandleWorkerHired: HandleWorkerHired,
    HandleWorkerFired: HandleWorkerFired,
    GetWorkers: GetWorkers
};