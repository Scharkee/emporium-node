var express = require('express');
var app=express();
var shortId 		= require('shortid');
var server=require('http').createServer(app);
var io = require('socket.io').listen(server);

app.set('port', 2333);

var clients=[];

var mysql = require('mysql');

var connectionpool = mysql.createPool({
    connectionlimit : 10,
    host: 'localhost',
    user: 'emporium-node',
    password: 'jIQJhLtZY87u4v0OgtcNIvBfixfHkq',
    database: 'emporium'
});

var allClients = [];
var user=[];

io.on("connection", function (socket) {
//sutvarkyt this shit
var currentUser;	    
var passStatus;
var keepalive;

var UserDollars;
var UserPlotSize;
var UserLastOnline;

allClients.push(socket);
console.log("Connection Up, client ID: "+ allClients.indexOf(socket));
socket.emit("connectedToNode");

	
    socket.on("CHECK_LOGIN", function (data) {

		socket[user.username]=data.Uname;//this shit here is kinda obnoxious, clean up blyet sometime.
     
		var userpass = data.Upass;

        console.log("user.username is "+ socket[user.username]);

		username = "'" + socket[user.username] + "'";
		var sqlq = 'SELECT password FROM users WHERE username = ' + username;
		

		connectionpool.getConnection(function (err, connection) {
		    // Use the connection
		    connection.query(sqlq, function (err, rows, fields) {
		  
		        if (err) throw err;

		        if(!rows.length){
		            console.log("user does not exist! ");
		        socket.emit("PASS_CHECK_CALLBACK", { passStatus: 2 });
		        } else if (userpass != rows[0].password) {//try again cyker
		      
		            console.log("passwords do not match!");
		            socket.emit("PASS_CHECK_CALLBACK", { passStatus: 0 });
		        }else if (userpass == rows[0].password) {//u in bro
		            console.log("passwords match!");
		      
		            socket.emit("PASS_CHECK_CALLBACK", { passStatus: 1 });

		        }
		        //TODO: dupe account function that callbacks  PASS_CHECK_CALLBACK as 3.
                //TODO: this shit with passStatus, should clean it up to be just 0, 1 or 2 or 3.
		        connection.release();
		    });
		});
		
    });

 

    socket.on("CREATE_USER", function (data) {

        var username = data.Uname;
        var userpass = data.Upass;
        var post = { username: username, password: userpass };

        console.log("creating new user for "+username)
       
            connectionpool.getConnection(function (err, connection) {
                // Use the connection
                connection.query('INSERT INTO users SET ?', post, function(err, result) {
		   
                    if (err) throw err;

                    // And done with the connection.
                    connection.release();

                });
            });


    });

    //GAME STAT RETRIEVAL CALLS

    socket.on("GET_STATS", function (data) {

        var username = data.Uname;


        connectionpool.getConnection(function (err, connection) {
            // Use the connection
            connection.query('SELECT * FROM stats WHERE username = ' + "'" + username + "'", function (err, rows,fields) {

                if (err) throw err;

                if (!rows.length) {//if DB finds no matches for username, create stats for that username.
                    var unix = Math.round(+new Date() / 1000);
                    console.log("Creating default user stats for: "+username);
                    socket.emit("RETRIEVE_STATS", { dollars: 100, plotsize: 3, lastonline: unix });


        
                    InsertDefaultStats(username, 100, unix, 3);
                    

                } else {//if DB finds matches for username, fuckeen get em.

                    socket.emit("RETRIEVE_STATS", { dollars: rows[0].dollars, plotsize: rows[0].plotsize, lastonline: rows[0].lastonline });
                    console.log(rows[0].lastonline);

                    UserDollars=rows[0].dollars;
                    UserPlotSize=rows[0].plotsize;
                    UserLastOnline=rows[0].lastonline;

                    console.log(rows);
                }
                connection.release();

            });
        });


    });

//make function that manually pings for response, if response arrives, push lastloggedin to server \/

    socket.on("AUTOSAVE_PUSH_LASTLOGGED", function(data){//upon verifying that client is still responding, this pushes the last online UNIX time to DB every ? seconds.

        var username = data.Uname;
        var unix = Math.round(+new Date() / 1000);

        connectionpool.getConnection(function (err, connection) {
        
        connection.query('INSERT INTO stats SET ?',post, function (err, rows, fields) {
            if (err) throw err;

            // And done with the connection.
            connection.release();

        });

        socket.emit("VERIFICATION", true); //TODO: if client receives verification false (or none at all,), show discrepency warning and shutt of game?
    });

         console.log("got lastlogged in check respornse from client, pushing to server ");
    });


///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////GAME FUNCTIONS/////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////



       socket.on("VERIFY_BUY_UPGRADE", function(data){//data includes what is being bought, and i get price from table from DB. ALSO load all prices from table from DB @ start of game.

         console.log("got autosave data from client, pushing to ");

    });

        socket.on("VERIFY_COLLECT_TILE", function(data){//data contains which tile is being collected, and need checks for everything else(fertilizer/booster or some shit idk(should be stored in TILE DB, and verified when fertilised))

         console.log("got autosave data from client, pushing to ");

    });

        socket.on("VERIFY_EXPAND_PLOTSIZE", function(data){//data doesnt contain enything. If enough money in DB, expand plotsize by 1. Prices of expansion go up very quickly too.

         console.log("got autosave data from client, pushing to ");

    });


        //TODO: socket.on that does misc stuff(fertilise shit, t.t idk)
        //TODO: each game command that comes here must emit VERIFICATION,true back to client + add checks for it in the client
        //TODO: version control? if somebody manages to DL the game and has older version then this could get fucked.
        //TODO: first recalculation of lost time when user was offline(using lastonline). And relaying that to the game.



 
    //on client disconnected
	   socket.on("disconnect", function (data) {

        console.log("user nr. "+ allClients.indexOf(socket)+" dc'd");

      var i = allClients.indexOf(socket);
      allClients.splice(i, 1);
		//TODO: maybe develop client tracking OR IP tracking. RIght now this is just list of clients.
    });




});//iserts default stats into DB when user first starts the game,
function InsertDefaultStats(username,dollars,lastonline,plotsize) {

    var post = { username: username, dollars:dollars,lastonline:lastonline,plotsize:plotsize };

    console.log("inserting default stats into DB: "+UserDollars+UserPlotSize+UserLastOnline);
    connectionpool.getConnection(function (err, connection) {
        // Use the connection
        connection.query('INSERT INTO stats SET ?',post, function (err, rows, fields) {
            if (err) throw err;
            connection.release();
        });
    });


}


server.listen(2333,function(){
    console.log("-----------SERVER STARTED------------");
});