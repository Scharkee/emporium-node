var express = require('express');
var app = express();
var shortId = require('shortid');
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var Chance = require('chance');
var webhandler = require('./webhandler.js');

app.use('/webH', webhandler);

app.set('port', 2333);

var clients = [];
const saltRounds = 10;

var async = require('async');
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

    var chance = new Chance();


    currentConnections[socket.id] = { socket: socket, IP: socket.request.connection.remoteAddress };  //kind of a double registration. Mb bad.Kepps up the count though, which is nice.
    clientCount.push(socket);
    //registruojamas socket + user IP


    console.log("Connection Up, client ID: " + clientCount.indexOf(socket) + ", Connection IP: " + socket.request.connection.remoteAddress);

    socket.emit("connectedToNode", { ConnectedOnceNoDupeStatRequests: true });


    socket.on("CHECK_LOGIN", function (data) {

        var userpass = CleanInput(data.Upass, 1);
        var username = CleanInput(data.Uname, 1);
        UserUsername = username;

        if (userpass !== data.Upass || username !== data.Uname) {
            console.log("someone's injecting input or bug in InputField.");
            //   socket.emit("DISCREPANCY", { reasonString: "Discrepancy detected in input. Please try again. Shutting off...", action: 1 });   gamealerts on login screen dont work i dont think;
        }


        if (findValue(currentConnections[socket.id], username)) { //NEEDS TESTING.

            console.log("user already logged in from different computer!");

            socket.emit("PASS_CHECK_CALLBACK", { passStatus: 3 }); //DISCREPANCY CALL FOR THE CLIENT TO SHUT OFF. 

        } else {//let the login through


        }



        var passStatus;

        var sqlq = 'SELECT password FROM users WHERE username = ?';


        connectionpool.getConnection(function (err, connection) {
            // Use the connection
            connection.query(sqlq, username, function (err, rows, fields) {

                if (err) throw err;

                if (!rows.length) {
                    console.log("user does not exist! ");
                    socket.emit("PASS_CHECK_CALLBACK", { passStatus: 2 });
                } else {


                    var pass = rows[0].password;

                    bcrypt.compare(userpass, pass, function (err, res) {

                        if (res === true) {

                            console.log("Hash checks out! Password is correct!");
                            socket.emit("PASS_CHECK_CALLBACK", { passStatus: 1 });

                        } else if (res === false) {

                            console.log("Hash did not check out. Wrong password!");
                            socket.emit("PASS_CHECK_CALLBACK", { passStatus: 0 });

                        }
                    });

                }


                //else if(userpass == rows[0].password && loggedIn= true (is vieno acc tik is vienos vietos galima prisijungti))

                //TODO: dupe account loggedin function that callbacks  PASS_CHECK_CALLBACK

            });
            connection.release();
        });

    });


    socket.on("CREATE_USER", function (data) {

        var username = data.Uname;
        var userpass = data.Upass;



        bcrypt.hash(userpass, saltRounds, function (err, hash) {


            var post = { username: username, password: hash };

            console.log("creating new user for " + username);



            connectionpool.getConnection(function (err, connection) {

                connection.query('INSERT INTO users SET ?', post, function (err, result) {

                    if (err) throw err;

                    // And done with the connection.


                });
                connection.release();
            });

        });

    });

    //GAME STAT RETRIEVAL CALLS

    socket.on("GET_STATS", function (data) {

        var username = data.Uname;


        connectionpool.getConnection(function (err, connection) {
            // Use the connection
            connection.query('SELECT * FROM stats WHERE username = ?', username, function (err, rows, fields) {

                if (err) throw err;

                if (!rows.length) {//if DB finds no matches for username, create stats for that username.

                    console.log("Creating default user stats for: " + username);
                    socket.emit("RETRIEVE_STATS", { dollars: 100, plotsize: 3, lastonline: UnixTime(), firstPlay: true });

                    InsertDefaultStats(username, 100, UnixTime(), 3);


                } else {//if DB finds matches for username, fuckeen get em.

                    var lastonlinestring = rows[0].lastonline.toString();

                    socket.emit("RETRIEVE_STATS", { dollars: rows[0].dollars, plotsize: rows[0].plotsize, lastonline: lastonlinestring, firstPlay: false });



                    if (rows[0].accesslevel === 2) {   //moderator?



                    } else if (rows[0].accesslevel === 3) {
                        //admin
                        socket.emit("ENABLE_ADMIN_PANEL", true);   //TODO: follow this up in unity.

                    }


                }








            });
            connection.release();
        });


    });

    //make function that manually pings for response, if response arrives, push lastloggedin to server \/



    socket.on("GET_TILE_DATA", function (data) {//tile information function

        var username = data.Uname;

        connectionpool_tiles.getConnection(function (err, connection) {


            connection.query('CREATE TABLE IF NOT EXISTS ?? ( `ID` INT(10) NOT NULL AUTO_INCREMENT , `NAME` VARCHAR(20) NOT NULL , `START_OF_GROWTH` VARCHAR(15) NOT NULL , `X` FLOAT(5) NOT NULL , `Z` FLOAT(5) NOT NULL , `FERTILISED_UNTIL` INT(10) NOT NULL ,`COUNT` INT(3) NOT NULL , `BUILDING_CURRENT_WORK_AMOUNT` INT(10) NOT NULL, `WORK_NAME` VARCHAR(20) NOT NULL, PRIMARY KEY (`ID`)) ENGINE = InnoDB;', data.Uname, function (err, rows, fields) {
                if (err) throw err;
            });

            connection.query('SELECT * FROM ??', data.Uname, function (err, rows, fields) {
                if (err) throw err;


                socket.emit("RECEIVE_TILES", { rows });





            });
            connection.release();
        });
    });


    socket.on("GET_TILE_INFORMATION", function (data) {//tile information function

        var username = data.Uname;


        connectionpool.getConnection(function (err, connection) {


            connection.query('SELECT * FROM buildings', function (err, rows, fields) {
                if (err) throw err;


                socket.emit("RECEIVE_TILE_INFORMATION", { rows });




            });


            //ALSO GETS INVENTORY FOR PLAYER



            connection.query('SELECT * FROM inventories WHERE username = ?', username, function (err, rows, fields) {
                if (err) throw err;

                if (!rows.length) { //should never happen technically
                    console.log("user does not have an inventory!");

                    var post = { username: data.Uname };
                    connection.query('INSERT INTO inventories SET ?', post, function (err, rows, fields) {
                        if (err) throw err;

                        connection.query('SELECT * FROM inventories WHERE username = ?', username, function (err, rows, fields) {
                            if (err) throw err;

                            socket.emit("RECEIVE_INVENTORY", { rows });
                        });
                    });

                } else {

                    socket.emit("RECEIVE_INVENTORY", { rows });
                }






            });
            connection.release();

        });
    });



    socket.on("BUY_TILE", function (data) {//tile purchase function

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

        connectionpool.getConnection(function (err, connection) {
            connectionpool_tiles.getConnection(function (err, connectionT) {

                connection.query('SELECT dollars FROM stats WHERE username = ?', username, function (err, rows, fields) {
                    if (err) throw err;


                    DBdollars = rows[0].dollars;



                });

                connection.query('SELECT PRICE FROM buildings WHERE NAME = ?', buildingname, function (err, rows, fields) {
                    if (err) throw err;

                    DBBuildingPrice = rows[0].PRICE;



                    if (tileID === undefined) {//tile nera.

                        console.log("tile nera");

                        if (DBdollars >= DBBuildingPrice) {//tile bought cuz enough money.


                            TakeAwayMoney(DBdollars, DBBuildingPrice, username);

                            var post = { NAME: buildingname, START_OF_GROWTH: UnixTime(), X: TileX, Z: TileZ, FERTILISED_UNTIL: 0, BUILDING_CURRENT_WORK_AMOUNT: 0, COUNT: count };   // matched querry , match up with tile tables for inserting  bought tile into DB.
                            console.log(post);

                            connectionT.query('INSERT INTO ' + username + ' SET ?', post, function (err, rows, fields) {
                                if (err) throw err;



                                socket.emit("BUILD_TILE", { TileName: buildingname, TileX: TileX, TileZ: TileZ, ID: rows.insertId });


                            });

                        } else {//not enough dollars to buy boi

                            var missing = DBBuildingPrice - DBdollars;
                            socket.emit("NO_FUNDS", { missing: missing });   //priimt sita cliente ir parodyt alerta, kad neuztenka pinigu (missing + kiek missina dollars)

                        }


                    } else {//upgradinamas tile.
                        console.log(username + " is the username");


                        connectionT.query('SELECT * FROM ?? WHERE ID = ?', [username, Number(tileID)], function (err, rows, fields) {
                            if (err) throw err;

                            count = rows[0].COUNT;

                            if (count === 5) {
                                console.log("tile at max upgrades");

                            } else {//proceed with the upgrade
                                console.log("upgrading");


                                count++;


                                if (DBdollars >= DBBuildingPrice) {//tile bought cuz enough money.


                                    TakeAwayMoney(DBdollars, DBBuildingPrice, username);

                                    var post = { COUNT: count };   // matched querry , match up with tile tables for inserting  bought tile into DB.
                                    console.log(post);

                                    connectionT.query('UPDATE ?? SET ? WHERE ID = ?', [username, post, tileID], function (err, rows, fields) {
                                        if (err) throw err;

                                        console.log({ tileID: tileID });
                                        socket.emit("UPGRADE_TILE", { tileID: Number(tileID) });
                                        console.log(tileID);

                                    });

                                } else {//not enough dollars to buy boi

                                    var missing = DBBuildingPrice - DBdollars;
                                    socket.emit("NO_FUNDS", { missing: missing });   //priimt sita cliente ir parodyt alerta, kad neuztenka pinigu (missing + kiek missina dollars)

                                }
                            }

                        });

                    }



                    connectionT.release();
                });

            });
            connection.release();
        });
    });


    socket.on("SELL_TILE", function (data) {//tile purchase function

        var username = data.Uname;
        var SellTileID = parseInt(data.SellTileID);
        var buildingName = data.TileName;

        var count;

        connectionpool.getConnection(function (err, connection) {



            connection.query('SELECT PRICE FROM buildings WHERE NAME = ?', buildingName, function (err, rows, fields) {
                if (err) throw err;

                DBBuildingPrice = rows[0].PRICE;


                connectionpool_tiles.getConnection(function (err, connectionT) {  //completely new connection fron tile connection pool for inserting into the tile table. 


                    connectionT.query('SELECT * FROM ?? WHERE ID = ?', [username, SellTileID], function (err, rows, fields) {
                        if (err) throw err;


                        count = rows[0].COUNT;



                        connectionT.query('DELETE FROM ?? WHERE ID = ?', [username, SellTileID], function (err, rows, fields) {
                            if (err) throw err;


                            socket.emit("ADD_FUNDS", { addFunds: (DBBuildingPrice / 4) * count });
                            AddMoney((DBBuildingPrice / 4) * count, username); //sell rates subject to change. 25% atm, maybe too harsh IDK


                        });


                    });




                    connectionT.release();
                });

            });
            connection.release();
        });
    });





    socket.on("TILE_ASSIGN_WORK", function (data) {//tile purchase function


        var username = data.Uname;
        var tileID = data.TileID;
        var assignedWorkName = data.WorkName;
        var assignedWorkAmmount = data.WorkAmount;
        var DBdollars;
        var DBBuildingPrice;




        connectionpool_tiles.getConnection(function (err, connectionT) {


            connectionT.query('SELECT * FROM ?? WHERE ID = ?', [username, Number(tileID)], function (err, rows, fields) {
                if (err) throw err;


                tileCurrentWork = rows[0].BUILDING_CURRENT_WORK_AMOUNT;

                if (tileCurrentWork !== 0) { //hasnt finished work yet, but the call came trough. DISCREPENCY
                    //send discrepency

                } else {


                    connectionpool.getConnection(function (err, connection) {


                        connection.query('SELECT * FROM inventories WHERE username = ?', username, function (err, rows, fields) {
                            if (err) throw err;

                            console.log("lookin to get some juice from " + assignedWorkName);

                            if (rows[0][assignedWorkName] >= assignedWorkAmmount) {

                                console.log(rows[0][assignedWorkName]);

                                var post = { START_OF_GROWTH: UnixTime(), BUILDING_CURRENT_WORK_AMOUNT: assignedWorkAmmount, WORK_NAME: assignedWorkName };

                                connectionT.query('UPDATE ?? SET ? WHERE ID = ?', [username, post, tileID], function (err, rows, fields) { // reset tile growth time
                                    if (err) throw err;

                                });




                                TakeAwayItem(assignedWorkName, assignedWorkAmmount, username);



                                socket.emit("ASSIGN_TILE_WORK", { tileID: tileID, unixBuffer: UnixTime().toString(), currentWorkName: assignedWorkName, currentWorkAmount: assignedWorkAmmount }); //cliente resettinamas tile growth.

                            }
                        });
                        connection.release();
                    });
                }

            });
            connectionT.release();
        });

    });



    socket.on("VERIFY_SOLD_PRODUCE", function (data) {//tile purchase function


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
                if (err) throw err;

                rowsPricings = rowsP;



                //waterfall this shit

                connection.query('SELECT * FROM stats WHERE username = ?', username, function (err, rowsM, fields) { //getting dollars for adding money later
                    if (err) throw err;

                    postMoney = rowsM[0];



                    //check if rowsPrices are still accessible here. Might be only available in the callback.

                    connection.query('SELECT * FROM inventories WHERE username = ?', username, function (err, rows, fields) {
                        if (err) throw err;


                        for (var i = 0; i < salesNum; i++) { //prasideda nuo 0


                            console.log("lookin to sell " + data[i + "amount"] + " of " + data[i + "name"]);    //check if tis notation works 1name, 1amount, 2name, 2amount....

                            if (Number(rows[0][data[i + "name"]]) < Number(data[i + "amount"])) { // per mazai in database. Client praleido nors negali taip but. DISCREPENCY.

                                console.log(i + " " + data[i + "name"] + " " + data[i + "amount"]);


                                console.log(Number(rows[0][data[i + "name"]]) + "is less than" + Number(data[i + "amount"]));

                                socket.emit("DISCREPANCY", { reasonString: "Produce amount discrepancy detected. Resynchronization is mandatory. Shutting off...", action: 1 }); //implement into client

                            } else {// viskas probs OK, sale allowed.


                                post[data[i.toString() + "name"].toString()] = Number(rows[0][data[i + "name"]]) - Number(data[i + "amount"]); // naujas amountas paruosiamas postui i database. 

                                postMoney["dollars"] += data[i + "amount"] * findPrice(rowsPricings, data[i + "name"]); //RASTI PAGAL VARDA KAINA sitam objekte somehow. Multiplication dollars per KG. Tuos pacius pricings galima rodyti ir 
                                //paciam sale screen.( $/per kilograma)


                            }
                        }


                        connection.query('UPDATE inventories SET ? WHERE username = ?', [post, username], function (err, rows, fields) {
                            if (err) throw err;



                            connection.query('UPDATE stats SET ? WHERE username = ?', [postMoney, username], function (err, rowsM, fields) { //adding all the monay
                                if (err) throw err;

                                socket.emit("SALE_VERIFICATION", postMoney);

                            });

                        });

                    });

                    //WATERFALL (cia final save functions jei viskas pavyko)



                    //WATERFALL (cia final save functions jei viskas pavyko)

                });


            });






            connection.release();
        });

    });



    //FIXME: this shit here returns scientific number and not the real int.


    socket.on("GET_UNIX", function (data) {
        var unixBuffer = UnixTime(); //temp probably

        var unixJson = { unixBuffer: unixBuffer.toString() };

        socket.emit("RECEIVE_UNIX", unixJson);
    });

    socket.on("CLIENT_DATA", function (data) {

        currentConnections[socket.id].name = data.Uname;


    });




    socket.on("DISCONNECT", function (data) {

        socket.disconnect();
    });




    ////////////////////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////GAME FUNCTIONS/////////////////////////////////0_0///
    ////////////////////////////////////////////////////////////////////////////////////////////////////////


    socket.on("VERIFY_COLLECT_TILE", function (data) {


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
                if (err) throw err;

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
                                if (err) throw err;


                                console.log(rows);
                                var newProduceAmount = rows[0][tileProduceName] + Number(randProduce) * tileCount;
                                var post = {};
                                post[tileProduceName] = newProduceAmount;



                                connection.query('UPDATE inventories SET ? WHERE username = ?', [post, username], function (err, rows, fields) { // prideti prie egzistuojanciu apelsinu
                                    if (err) throw err;

                                });
                                console.log(newProduceAmount);

                                if (singleUse === 1) {

                                    connectionT.query('DELETE FROM ?? WHERE ID = ?', [username, tileID], function (err, rows, fields) {
                                        if (err) throw err;

                                    });

                                } else {
                                    socket.emit("RESET_TILE_GROWTH", { tileID: tileID, unixBuffer: UnixTime().toString(), currentProduceAmount: newProduceAmount, harvestAmount: Number(randProduce) * tileCount }); //cliente resettinamas tile growth.


                                }

                            });


                            connectionT.query('UPDATE ?? SET START_OF_GROWTH = ? WHERE ID = ?', [username, UnixTime(), tileID], function (err, rows, fields) { // prideti prie egzistuojanciu apelsinu
                                if (err) throw err;

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
        });




    });




    socket.on("VERIFY_COLLECT_PRESS_WORK", function (data) {

        //ALSO skaiciukas pakyla nuo medzio, kiek harvestinta KG vaisiu. 


        var username = data.Uname;
        var tileID = data.TileID;
        var tileProgAmount;
        var tileName;
        var tileGrowthStart;
        var tileWorkAmount;



        connectionpool_tiles.getConnection(function (err, connectionT) {

            connectionT.query('SELECT * FROM ?? WHERE ID = ?', [username, Number(tileID)], function (err, rows, fields) {
                if (err) throw err;

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
                                if (err) throw err;


                                console.log(rows);
                                var newProduceAmount = rows[0][tileWorkName + "_" + PressProduceName] + Number(JuiceProduceAmount);

                                var post = {};
                                post[tileWorkName + "_" + PressProduceName] = newProduceAmount;




                                connection.query('UPDATE inventories SET ? WHERE username = ?', [post, username], function (err, rows, fields) { // prideti prie egzistuojanciu apelsinu
                                    if (err) throw err;

                                });


                                socket.emit("RESET_TILE_GROWTH", { tileID: tileID, unixBuffer: UnixTime(), currentProduceAmount: newProduceAmount }); //cliente resettinamas tile growth.


                            });
                            var post1 = { BUILDING_CURRENT_WORK_AMOUNT: 0, WORK_NAME: "", START_OF_GROWTH: 0 };

                            connectionT.query('UPDATE ?? SET ? WHERE ID = ?', [username, post1, tileID], function (err, rows, fields) { // resetinam progresa
                                if (err) throw err;

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

        });




    });

    socket.on("VERIFY_EXPAND_PLOTSIZE", function (data) {//data doesnt contain enything. If enough money in DB, expand plotsize by 1. Prices of expansion go up very quickly too.

        console.log("Client No. " + clientCount.indexOf(socket) + " is upgrading his plotsize "); //add from what plotsize to what plotsize later



        var username = data.Uname;
        var DBdollars;
        var currentPlotsize;

        console.log(username);


        connectionpool.getConnection(function (err, connection) {

            connection.query('SELECT * FROM stats WHERE username = ?', username, function (err, rows, fields) {
                if (err) throw err;

                DBdollars = rows[0].dollars;
                currentPlotsize = rows[0].plotsize;
                console.log(DBdollars + " vs " + Math.pow(10, currentPlotsize));

                if (DBdollars >= Math.pow(10, currentPlotsize - 1)) { //uztenka praplesti plotui
                    post = { plotsize: currentPlotsize + 1 };
                    connection.query('UPDATE stats SET ? WHERE username = ?', [post, username], function (err, rows, fields) {
                        if (err) throw err;


                    });

                    socket.emit("UPDATE_PLOT_SIZE", { newplot: currentPlotsize + 1 });

                } else {
                    var missing = Math.pow(10, currentPlotsize - 1) - DBdollars;
                    socket.emit("NO_FUNDS", { missing: missing });



                }
            });


            connection.release();


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


        console.log("user  " + currentConnections[socket.id].name + " dc'd");

        if (currentConnections[socket.id].name) { //should push lastloggeds of anyONE connected. Kai neuzregisruojamas vardas(undefined), tai 
            //fake prisijugimas ir bandymas issaugot MYSQL uzlaus serveri. Nepushinam tada.

            UpdateLastloggedIn(currentConnections[socket.id].name);

        }

        clientCount.splice(clientCount.indexOf(socket), 1);  // reiketu consolidatint is dvieju lists into one
        delete currentConnections[socket.id];

    });




});//iserts default stats into DB when user first starts the game,




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


function UpdateLastloggedIn(username) {

    connectionpool.getConnection(function (err, connection) {

        var post = { lastonline: UnixTime() };
        connection.query('UPDATE stats SET ? WHERE username = ?', [post, username], function (err, rows, fields) {
            if (err) throw err;

        });

        connection.release();
    });
}


// check if enough isnt working FINDAWAY (escapes from callback hell)


function UnixTime() {

    var unix = Math.round(+new Date() / 1000);
    return unix;
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