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
    database: 'managend'
});

io.set('heartbeat timeout', 4000); //atitaikyt situs or mb not
io.set('heartbeat interval', 2000);


io.on("connection", function (socket) {
//sutvarkyt this shit
var currentUser;	    
var passStatus;
var keepalive;

console.log("Connection Up");
socket.emit("connectedToNode");

	
    socket.on("CHECK_LOGIN", function (data) {

   

		var username=data.Uname;
		var userpass = data.Upass;

		username = "'" + username + "'";
		var sqlq = 'SELECT password FROM users WHERE username = ' + username;
		
	


		connectionpool.getConnection(function (err, connection) {
		    // Use the connection
		    connection.query(sqlq, function (err, rows, fields) {
		   
		        if (err) throw err;



		        if(!rows.length){
		            console.log("user does not exist! ");
		        socket.emit("PASS_CHECK_CALLBACK", { passStatus: 2 });


		        } else if (userpass != rows[0].password) {
		      
		            console.log("passwords do not match!");
		            socket.emit("PASS_CHECK_CALLBACK", { passStatus: 0 });
		        }else if (userpass == rows[0].password) {
		            console.log("passwords match!");
		            passStatus="pooopeper";
		            socket.emit("PASS_CHECK_CALLBACK", { passStatus: 1 });

		        }
		        //TODO: dupe account function that callbacks  PASS_CHECK_CALLBACK as 3.


		  
		        // And done with the connection.
		        connection.release();

		        // Don't use the connection here, it has been returned to the pool.
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

                if (!rows.length) {
                    var unix = Math.round(+new Date() / 1000);
                    console.log("Creating default user stats for: "+username);
                    socket.emit("RETRIEVE_STATS", { dollars: 100, plotsize: 3, lastonline: unix });

                    

                    InsertDefaultStats(username, 100, unix, 3);
                    



                } else {

                    socket.emit("RETRIEVE_STATS", { dollars: rows[0].dollars, plotsize: rows[0].plotsize, lastonline: rows[0].lastonline });
                    console.log(rows[0].lastonline);

                    console.log(rows);
                }
				
			

                setInterval(function () {
                    console.log("sending autosave ping to client ID: " + socket.id);
                    io.to(socket.id).emit('AUTOSAVER_PING');
					
					if(!socket.connected){
						//stop autoupdates, save info. 
						console.log("autosave detected disconnect, saving data and shutting off.");
						
					}
                    //set some kind of wait timer, and if no reply from client, then discard connection and retrieve stats again when they login again.
                    
                }, 20000);

                // And done with the connection.
                connection.release();

            });
        });


    });

    socket.on("AUTOSAVE_VERIFY", function (data) {

        console.log("got autosave data from client, checking if matches stored data.");
		//tik is sitos funkcijos ggali issisaugoti i database. 






    });
	
	   socket.on("disconnect", function (data) {

        console.log("client dc'd");
		//tik is sitos funkcijos ggali issisaugoti i database. 






    });




});


function InsertDefaultStats(username,dollars,lastonline,plotsize) {

    var post = { username: username, dollars:dollars,lastonline:lastonline,plotsize:plotsize };


    connectionpool.getConnection(function (err, connection) {
        // Use the connection
        connection.query('INSERT INTO stats SET ?',post, function (err, rows, fields) {

            if (err) throw err;

            // And done with the connection.
            connection.release();

        });
    });





}


server.listen(2333,function(){
	
    console.log("-------SERVER STARTED-------");
    
});