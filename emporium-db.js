var express = require('express');
var router = express.Router();
var Chance = require('chance');
var mysql = require('mysql');
var bcrypt = require('bcrypt');

//Cia defininami visi reikalingi MYSQL pools

var connectionpool = mysql.createPool({
    connectionlimit: 10,
    host: 'localhost',
    user: 'emporium-node',
    password: 'jIQJhLtZY87u4v0OgtcNIvBfixfHkq',
    database: 'emporium'
});

var connectionpool_tiles = mysql.createPool({
    connectionlimit: 10,
    host: 'localhost',
    user: 'emporium-node',
    password: 'jIQJhLtZY87u4v0OgtcNIvBfixfHkq',
    database: 'emporium_users'
});

//konstantos
const saltRounds = 10;





function ParseLogin(data, callback) {

    // no default values in JS yet
    // make sure callback is initialized
    callback = callback || function () { }

    return new Promise(function (resolve, reject) {


        var userpass = CleanInput(data.Upass, 1);
        var username = CleanInput(data.Uname, 1);



        if (userpass !== data.Upass || username !== data.Uname) {
            //   socket.emit("DISCREPANCY", { reasonString: "Discrepancy detected in input. Please try again. Shutting off...", action: 1 });   gamealerts on login screen dont work i dont think;
        } else {//praleidziam

        }

        var passStatus;

        var sqlq = 'SELECT password FROM users WHERE username = ?';


        connectionpool.getConnection(function (err, connection) {
            // Use the connection
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

                        if (res === true) {

                            resolve({ status: 1 });

                            //   socket.emit("PASS_CHECK_CALLBACK", { passStatus: 1 });

                        } else if (res === false) {

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

function CreateUser(data, callback) {



    callback = callback || function () { };



    var username = data.Uname;
    var userpass = data.Upass;



    bcrypt.hash(userpass, saltRounds, function (err, hash) {


        var post = { username: username, password: hash };

        console.log("creating new user for " + username);



        connectionpool.getConnection(function (err, connection) {

            connection.query('INSERT INTO users SET ?', post, function (err, result) {

                if (err) {
                    connection.release();
                    return callback(err);
                }

                // And done with the connection.


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
            // Use the connection
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


            connection.query('CREATE TABLE IF NOT EXISTS ?? ( `ID` INT(10) NOT NULL AUTO_INCREMENT , `NAME` VARCHAR(20) NOT NULL , `START_OF_GROWTH` VARCHAR(15) NOT NULL , `X` FLOAT(5) NOT NULL , `Z` FLOAT(5) NOT NULL , `FERTILISED_UNTIL` INT(10) NOT NULL ,`COUNT` INT(3) NOT NULL , `BUILDING_CURRENT_WORK_AMOUNT` INT(10) NOT NULL, `WORK_NAME` VARCHAR(20) NOT NULL, PRIMARY KEY (`ID`)) ENGINE = InnoDB;', data.Uname, function (err, rows, fields) {
                if (err) {
                    reject(err);
                    connection.release();
                    return callback(err);
                }
            });

            connection.query('SELECT * FROM ??', data.Uname, function (err, rows, fields) {
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

                connection.query('SELECT dollars FROM stats WHERE username = ?', username, function (err, rows, fields) {
                    if (err) {
                        reject(err);
                        connection.release();
                        return callback(err);
                    }


                    DBdollars = rows[0].dollars;


                });

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


                            connectionT.query('INSERT INTO ' + username + ' SET ?', post, function (err, rows, fields) {
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



                    connectionT.release();
                });

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

        var count;

        connectionpool.getConnection(function (err, connection) {



            connection.query('SELECT PRICE FROM buildings WHERE NAME = ?', buildingName, function (err, rows, fields) {
                if (err) {
                    reject(err);
                    connection.release();
                    return callback(err);
                }

                DBBuildingPrice = rows[0].PRICE;


                connectionpool_tiles.getConnection(function (err, connectionT) {  //completely new connection fron tile connection pool for inserting into the tile table. 


                    connectionT.query('SELECT * FROM ?? WHERE ID = ?', [username, SellTileID], function (err, rows, fields) {
                        if (err) {
                            reject(err);
                            connection.release();
                            return callback(err);
                        }


                        count = rows[0].COUNT;



                        connectionT.query('DELETE FROM ?? WHERE ID = ?', [username, SellTileID], function (err, rows, fields) {
                            if (err) {
                                reject(err);
                                connection.release();
                                return callback(err);
                            }


                            resolve({ addFunds: (DBBuildingPrice / 4) * count });

                            AddMoney((DBBuildingPrice / 4) * count, username); //sell rates subject to change. 25% atm, maybe too harsh IDK


                        });


                    });




                    connectionT.release();
                });

            });
            connection.release();
            return callback(null);
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
                    //send discrepency

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

        //ADAPT:  data.saleAmount - kiek produktu sugalvojo parduoti clientas (count). Kiek KIEKVIENO produkto parduota yra issaugota
        // data["sale1"], data["sale2"]. Situs assigninam loope cliente. Cia prasukamvieno loopa pagal ta kieki, ir kiekviena kart atimam is esanciu
        //database reiksmiu ir gautus rezultatus idedam i nauja object kuri pushinsiu idatabase kaip SET ?.
        //var data={var1:1, var2:2}  yra tas pats kaip var data; data["var1"]=1, data["var2"] = 2. Tokiu assignment ir paruosiam post i DB

        var salesNum = data.salesNum;
        var DBdollars;
        var rowsPricings;
        var post = {};
        var postMoney = {};



        connectionpool.getConnection(function (err, connection) {

            //waterfall this shit

            console.log(data);



            connection.query('SELECT * FROM prices', function (err, rowsP, fields) { //getting prices for adding money for the sales. Current pricings might be a lot of info. (check)
                if (err) {
                    reject(err);
                    connection.release();
                    return callback(err);
                }

                rowsPricings = rowsP;



                //waterfall this shit

                connection.query('SELECT * FROM stats WHERE username = ?', username, function (err, rowsM, fields) { //getting dollars for adding money later
                    if (err) {
                        reject(err);
                        connection.release();
                        return callback(err);
                    }

                    postMoney = rowsM[0];



                    //check if rowsPrices are still accessible here. Might be only available in the callback.

                    connection.query('SELECT * FROM inventories WHERE username = ?', username, function (err, rows, fields) {
                        if (err) {
                            reject(err);
                            connection.release();
                            return callback(err);
                        }


                        for (var i = 0; i < salesNum; i++) { //prasideda nuo 0



                            if (Number(rows[0][data[i + "name"]]) < Number(data[i + "amount"])) { // per mazai in database. Client praleido nors negali taip but. DISCREPENCY.


                                resolve({ call: "DISCREPANCY", content: { reasonString: "Produce amount discrepancy detected. Resynchronization is mandatory. Shutting off...", action: 1 } });

                            } else {// viskas probs OK, sale allowed.


                                post[data[i.toString() + "name"].toString()] = Number(rows[0][data[i + "name"]]) - Number(data[i + "amount"]); // naujas amountas paruosiamas postui i database. 

                                postMoney["dollars"] += data[i + "amount"] * findPrice(rowsPricings, data[i + "name"]); //RASTI PAGAL VARDA KAINA sitam objekte somehow. Multiplication dollars per KG. Tuos pacius pricings galima rodyti ir 
                                //paciam sale screen.( $/per kilograma)


                            }
                        }


                        connection.query('UPDATE inventories SET ? WHERE username = ?', [post, username], function (err, rows, fields) {
                            if (err) {
                                reject(err);
                                connection.release();
                                return callback(err);
                            }



                            connection.query('UPDATE stats SET ? WHERE username = ?', [postMoney, username], function (err, rowsM, fields) { //adding all the monay
                                if (err) {
                                    reject(err);
                                    connection.release();
                                    return callback(err);
                                }


                                resolve({ call: "SALE_VERIFICATION", content: postMoney });

                            });

                        });

                    });

                    //WATERFALL (cia final save functions jei viskas pavyko)



                    //WATERFALL (cia final save functions jei viskas pavyko)

                });


            });

            connection.release();
            return callback(null);
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



                                console.log(rows);
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

                connectionpool.getConnection(function (err, connection) {

                    connection.query('SELECT * FROM buildings WHERE NAME = ?', tileName, function (err, rows, fields) {

                        PressSpeed = rows[0].PROG_AMOUNT / 100;

                        PressProduceName = rows[0].TILEPRODUCENAME;
                        PressEfficiency = rows[0].TILEPRODUCERANDOM1 / 100;

                        console.log(tileWorkName + "_" + PressProduceName);


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



                                console.log(rows);
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


                resolve({call:"RECEIVE_PRICES",content:{rows}});



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



function InsertDefaultStats(username, dollars, lastonline, plotsize) {

    var post = { username: username, dollars: dollars, lastonline: lastonline, plotsize: plotsize };

    console.log("inserting default stats into DB");
    connectionpool.getConnection(function (err, connection) { // starting a stats table entry for new client
        // Use the connection
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
    CreateUser: CreateUser,
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
    HandlePriceRetrieval:HandlePriceRetrieval
};

