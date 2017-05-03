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





function ParseLogin (data,callback) {  

  // no default values in JS yet
  // make sure callback is initialized
  callback = callback || function () {}

  return new Promise(function (resolve, reject) {


  	    var userpass = CleanInput(data.Upass, 1);
        var username = CleanInput(data.Uname, 1);

        

        if (userpass !== data.Upass || username !== data.Uname) {
            //   socket.emit("DISCREPANCY", { reasonString: "Discrepancy detected in input. Please try again. Shutting off...", action: 1 });   gamealerts on login screen dont work i dont think;
        }else {//praleidziam

        }

        var passStatus;

        var sqlq = 'SELECT password FROM users WHERE username = ?';


        connectionpool.getConnection(function (err, connection) {
            // Use the connection
            connection.query(sqlq, username, function (err, rows, fields) {

                if (err){
                	reject(err);
                	connection.release();
                	return callback(err);
                }
                if (!rows.length) {
                    resolve({status:2});
                
                 //   socket.emit("PASS_CHECK_CALLBACK", { passStatus: 2 });
                } else {


                    var pass = rows[0].password;

                    bcrypt.compare(userpass, pass, function (err, res) {

                        if (res === true) {

                            resolve({status:1});
                         
                         //   socket.emit("PASS_CHECK_CALLBACK", { passStatus: 1 });

                        } else if (res === false) {

                        	resolve({status:0});
                        	


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

function CreateUser(data,callback){



	callback = callback || function () {};



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

function GetStats(data,callback){

  callback = callback || function () {}

  return new Promise(function (resolve, reject) {

  	var username = data.Uname;


    connectionpool.getConnection(function (err, connection) {
        // Use the connection
        connection.query('SELECT * FROM stats WHERE username = ?', username, function (err, rows, fields) {

            if (err){
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

function GetTileData(data,callback){

	callback = callback || function () {}

    return new Promise(function (resolve, reject) {


    var username = data.Uname;

    connectionpool_tiles.getConnection(function (err, connection) {


        connection.query('CREATE TABLE IF NOT EXISTS ?? ( `ID` INT(10) NOT NULL AUTO_INCREMENT , `NAME` VARCHAR(20) NOT NULL , `START_OF_GROWTH` VARCHAR(15) NOT NULL , `X` FLOAT(5) NOT NULL , `Z` FLOAT(5) NOT NULL , `FERTILISED_UNTIL` INT(10) NOT NULL ,`COUNT` INT(3) NOT NULL , `BUILDING_CURRENT_WORK_AMOUNT` INT(10) NOT NULL, `WORK_NAME` VARCHAR(20) NOT NULL, PRIMARY KEY (`ID`)) ENGINE = InnoDB;', data.Uname, function (err, rows, fields) {
            if (err){
                reject(err);
                connection.release();
                return callback(err);
            }
        });

        connection.query('SELECT * FROM ??', data.Uname, function (err, rows, fields) {
            if (err){
                reject(err);
                connection.release();
                return callback(err);
            }


        resolve( { rows });

        });
        connection.release();
        return callback(null);
    });


});

}

function GetTiles(data,callback){
	callback = callback || function () {}

    return new Promise(function (resolve, reject) {

    var username = data.Uname;


    connectionpool.getConnection(function (err, connection) {


        connection.query('SELECT * FROM buildings', function (err, rows, fields) {
            if (err){
                reject(err);
                connection.release();
                return callback(err);
            }


           resolve( { rows });

        });


        connection.release();
        return callback(null);

    });


    });

}

function GetInventory(data,callback){

	callback = callback || function () {}
    return new Promise(function (resolve, reject) {

    var username = data.Uname;


    connectionpool.getConnection(function (err, connection) {

        connection.query('SELECT * FROM inventories WHERE username = ?', username, function (err, rows, fields) {
            if (err){
                reject(err);
                connection.release();
                return callback(err);
            }



            if (!rows.length) { //neturetu ever buti iskviestas
                console.log("user does not have an inventory!");

                var post = { username: data.Uname };


                connection.query('INSERT INTO inventories SET ?', post, function (err, rows, fields) {
                if (err){
                    reject(err);
                    connection.release();
                    return callback(err);
                }   

                    connection.query('SELECT * FROM inventories WHERE username = ?', username, function (err, rows, fields) {
                    if (err){
                        reject(err);
                        connection.release();
                        return callback(err);
                    }

                    resolve( { rows });

                    });
                });

            } else {
            
                resolve( { rows });
            }


        });
        connection.release();
        return callback(null);

    });


    });


}


function HandleTilePurchase(data,callback){

	callback = callback || function () {}
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
                if (err){
                    reject(err);
                    connection.release();
                    return callback(err);
                }  


                DBdollars = rows[0].dollars;


            });

            connection.query('SELECT PRICE FROM buildings WHERE NAME = ?', buildingname, function (err, rows, fields) {
                if (err){
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
                        if (err){
                            reject(err);
                            connection.release();
                            return callback(err);
                        }  


                            var callbackData={status:1,data:{ TileName: buildingname, TileX: TileX, TileZ: TileZ, ID: rows.insertId }};
                            resolve(callbackData);

                        });

                    } else {//not enough dollars to buy boi

                        var missing = DBBuildingPrice - DBdollars;
                        var callbackData={status:2,data:{ missing: missing }};
                        resolve(callbackData);

                    }


                } else {//upgradinamas tile.

                    connectionT.query('SELECT * FROM ?? WHERE ID = ?', [username, Number(tileID)], function (err, rows, fields) {
                        if (err){
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
                                if (err){
                                    reject(err);
                                    connection.release();
                                   return callback(err);
                                }  
 
                                    var callbackData={status:3,data:{ tileID: Number(tileID) }};
                                    resolve(callbackData); 

                                 
                                });

                            } else {//not enough dollars to buy boi

                                var missing = DBBuildingPrice - DBdollars;
                                var callbackData={status:2,data:{ missing: missing }};
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

ParseLogin:ParseLogin,
CreateUser:CreateUser,
GetStats:GetStats,
GetTiles:GetTiles,
GetTileData:GetTileData,
GetInventory:GetInventory,
HandleTilePurchase:HandleTilePurchase
};

