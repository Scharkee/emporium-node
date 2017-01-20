var express = require('express');
var app=express();
var shortId 		= require('shortid');
var server=require('http').createServer(app);
var io = require('socket.io').listen(server);

app.set('port', 2333);

var clients=[];
const saltRounds = 1;

var mysql = require('mysql');
var bcrypt = require('bcrypt');

var connectionpool = mysql.createPool({
    connectionlimit : 10,
    host: 'localhost',
    user: 'emporium-node',
    password: 'jIQJhLtZY87u4v0OgtcNIvBfixfHkq',
    database: 'emporium'
});

//TODO: DONT CHANGE LOCALHOSTS INTO MY IP, cnage unity SOCKET node server IP.

var connectionpool_tiles = mysql.createPool({//TODO: adapt this for connection for storin tile information for the second DB
    connectionlimit : 10,
    host: 'localhost',
    user: 'emporium-node',
    password: 'jIQJhLtZY87u4v0OgtcNIvBfixfHkq',
    database: 'emporium'
});

var clientCount = [];
var allClients = [];

var user=[];

io.on("connection", function (socket) {
//fix this shit, istrint shitty variables
var currentUser;	    

var UserDollars;
var UserPlotSize;
var UserLastOnline;



clientCount.push(socket);  
 //registruojamas socket + user IP


console.log("Connection Up, client ID: "+ clientCount.indexOf(socket)+", Connection IP: "+ socket.request.connection.remoteAddress);

socket.emit("connectedToNode", {ConnectedOnceNoDupeStatRequests: true});

	
    socket.on("CHECK_LOGIN", function (data) {




		var userpass = CleanInput(data.Upass,1);
		var username = CleanInput(data.Uname,1); //this shit here is kinda obnoxious, clean up blyet sometime.
		
        if(allClients.contains(username)){ //NEEDS TESTING.

            console.log("user already logged in from different computer!");

             socket.emit("PASS_CHECK_CALLBACK", { passStatus: 3 }); //DISCREPENCY CALL FOR THE CLIENT TO SHUT OFF. 



        }else{

            allClients.push([username,socket.request.connection.remoteAddress]); //adding username + IP to log list of users

        }
     
		var passStatus;

        console.log("user.username is "+ username);

		
		var sqlq = 'SELECT password FROM users WHERE username = ?';
		

		connectionpool.getConnection(function (err, connection) {
		    // Use the connection
		    connection.query(sqlq,username, function (err, rows, fields) {
		  
		        if (err) throw err;

		        if(!rows.length){
		            console.log("user does not exist! ");
		        socket.emit("PASS_CHECK_CALLBACK", { passStatus: 2 });
		        } else{


                    var pass = rows[0].password;

                    bcrypt.compare(userpass, pass , function(err, res){
             
                    if(res==true){
                        
                    console.log("Hash checks out! Password is correct!");
                    socket.emit("PASS_CHECK_CALLBACK", { passStatus: 1 });
                        
                    }else if (res==false){
                        
                    console.log("Hash did not check out. Wrong password!");
                    socket.emit("PASS_CHECK_CALLBACK", { passStatus: 0 });
                    
                    }
                });
                
                }
	
				
				//else if(userpass == rows[0].password && loggedIn= true (is vieno acc tik is vienos vietos galima prisijungti))
					
		        //TODO: dupe account loggedin function that callbacks  PASS_CHECK_CALLBACK as 3.
				
                
		        connection.release();
		    });
		});
		
    });

 
    socket.on("CREATE_USER", function (data) {

        var username = data.Uname;
        var userpass = data.Upass;
		
		
		
		bcrypt.hash(userpass,saltRounds,function(err,hash){ 
		
		
		var post = { username: username, password: hash };

        console.log("creating new user for "+username);

		
		
		connectionpool.getConnection(function (err, connection) {
                
                connection.query('INSERT INTO users SET ?', post, function(err, result) {
		   
                    if (err) throw err;

                    // And done with the connection.
                    connection.release();

                });
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

                    var lastonlinestring = rows[0].lastonline.toString();

                    socket.emit("RETRIEVE_STATS", { dollars: rows[0].dollars, plotsize: rows[0].plotsize, lastonline: lastonlinestring });
               
        
					
					if(rows[0].accesslevel==2)
					{   //moderator?
						
						
						
					}else if(rows[0].accesslevel==3){
						//admin
						 socket.emit("ENABLE_ADMIN_PANEL", true);   //TODO: follow this up in unity.
						
					}

                    console.log(rows);//delete this shit afterwards
                }
                connection.release();



                    setInterval(function(){

                            socket.emit("LASTONLINE_PING"); 
                             console.log("sending LASTONLINE_PING to client");
                              if(socket.disconnected){
                                console.log("client disconnected, not sending pings anymore."); //TODO: FIX THIS
                              }
                     
                           }, 20000);
   
            });
        });


    });

//make function that manually pings for response, if response arrives, push lastloggedin to server \/

    socket.on("AUTOSAVE_PUSH_LASTLOGGED", function(data){//upon verifying that client is still responding, this pushes the last online UNIX time to DB every ? seconds.

        var username = data.Uname;
        var unix = Math.round(+new Date() / 1000);

        connectionpool.getConnection(function (err, connection) {

             var sql = "UPDATE stats SET lastonline = ? WHERE username = ??"; // check if runs.
        
        connection.query(sql,unix,username, function (err, rows, fields) {
            if (err) throw err;

            // And done with the connection.
            connection.release();

        });
        console.log("got LASTONLINE_PING respornse from client, pushing to server ");

        socket.emit("VERIFICATION", {ver: true}); //TODO: if client receives verification false (or none at all,), show discrepency warning and shut off game?
    });


    });


////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////GAME FUNCTIONS/////////////////////////////////0_0///
////////////////////////////////////////////////////////////////////////////////////////////////////////



       socket.on("VERIFY_BUY_UPGRADE", function(data){//data includes what is being bought, and i get price from table from DB. ALSO load all prices from table from DB @ start of game.

         console.log("Client No. " + clientCount.indexOf(socket) +" is buying something"); //add upgrade name to console.log

    });

        socket.on("VERIFY_COLLECT_TILE", function(data){//data contains which tile is being collected, and need checks for everything else(fertilizer/booster or some shit idk(should be stored in TILE DB, and verified when fertilised))

         console.log("Client No. " + clientCount.indexOf(socket) +" is collecting ");//add tile name, but remove later, because 2much spam

    });

        socket.on("VERIFY_EXPAND_PLOTSIZE", function(data){//data doesnt contain enything. If enough money in DB, expand plotsize by 1. Prices of expansion go up very quickly too.

         console.log("Client No. " + clientCount.indexOf(socket) +" is upgrading his plotsize "); //add from what plotsize to what plotsize later

    });
	
	    socket.on("VERIFY_ACTION",function(data){// misc action verifyinimo funkcija.
			 //every misc action goes here by switch/case(fertilising, bleh bleh.)
			
			
			
			
	});

        socket.on("VERIFY_EXPAND_PLOTSIZE", function(data){//data doesnt contain enything. If enough money in DB, expand plotsize by 1. Prices of expansion go up very quickly too.

        //user asks for UnixTime
         var unix = Math.round(+new Date() / 1000);

         socket.emit("RECEIVE_UNIX", {unixTime: unix});


    });

        //GAME TODO's  
		
		//TODO: admin panel, maybe even new column in STATS(for admins), only show button for admin panel for admins.
        //TODO: in-game currency and plotsize adjustment buttons that emit verifications. Make them work and we got a noic working skeleton there.
		//TODO: establish lastlogged auto sender to start pushing unix times to DB
        //TODO: first recalculation of lost time when user was offline(using lastonline). And relaying that to the game. Place temporary text in game for how much time was lost(DEBUG)
		
		
		
		//cheateriu checkai
		
		//TODO: each game command that comes here must emit VERIFICATION,true back to client + add checks for it in the client, if returned FALSE or didnt return at all,
		//TODO: checks in each function for discrepancies, and if something doesnt match up, send VERIFICATION,false and stop connection(prolly not)? and DONT SAVE TO DB. 
		//TODO: resync function for when VERIFICATION is false. Send to client and change all values MB so no restart is needed. Also include resyncing screen for the time it takes to 
        //TODO: version control? if somebody manages to DL the game and has older version then this could get fucked.
		
		
		//NON-PRIORITY
		
		//TODO: set up login screen credits ALSO make simple socket.emit in the client for emitting feedback. Some new table in DB to store that.
		//TODO: music, and music-soundcloud hookup SUPERNON PRIORITY
		//TODO: effects for upgrading and buying towers + collecting stuff
		



 
    //on client disconnected
	   socket.on("disconnect", function (data) {

        console.log("user nr. "+ clientCount.indexOf(socket)+" dc'd");

        console.log("allcleints.users before : "+allClients);
      clientCount.splice(clientCount.indexOf(socket), 1);
    
      allClients.splice(allClients.indexOf(socket.request.connection.remoteAddress),1);  

    console.log("allcleints.users after : "+allClients);

    });




});//iserts default stats into DB when user first starts the game,
function InsertDefaultStats(username,dollars,lastonline,plotsize) {

    var post = { username: username, dollars:dollars,lastonline:lastonline,plotsize:plotsize };

    console.log("inserting default stats into DB");
    connectionpool.getConnection(function (err, connection) {
        // Use the connection
        connection.query('INSERT INTO stats SET ?',post, function (err, rows, fields) {
            if (err) throw err;
            connection.release();
        });
    });
 

}

function CleanInput(a,mode){
switch(mode) {
	case 1:
		var b = a.replace(/[^a-zA-Z0-9]/gi,'');
        console.log("Cleaner cleaned "+a+" into "+b);
		
		break;
    case 2: //kiti refinery modes
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




server.listen(2333,function(){
    console.log("-----------SERVER STARTED------------");
});

Array.prototype.contains = function(element){
    return this.indexOf(element) > -1;
};