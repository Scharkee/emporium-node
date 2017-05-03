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

function UnixTime() {

var unix = Math.round(+new Date() / 1000);
return unix;
}




//exportinu kad gasleciau pasiekti main server.js

module.exports = {

ParseLogin:ParseLogin,
CreateUser:CreateUser,
GetStats:GetStats



};

