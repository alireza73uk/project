var express = require('express');
var HashMap= require('hashmap');
var Chance = require('chance');
var chance = new Chance();
var fs = require('fs');
var app = express();
const port = 3000;
var io = require('socket.io').listen(app.listen(port));
var users = new HashMap();
var callerActiveRoom = new HashMap();

app.get('/',function(req,res){
    res.writeHead(200,{"Content-Type":"text/html"});
    res.write(fs.readFileSync('./index.html'));
    res.end();
});

console.log('running at: '+port);

io.sockets.on("connection",function(socket){
    console.log(socket.id+' connected!');

    socket.on("Register_Name",function(data){
        
        if(users.has(data)){
            socket.emit("login","nak");
        }
        else{
            users.set(data,socket.id);
            socket.username = data;            
            socket.emit("login","ack");         
        }
    });
    //if username is available then tell the caller by User_Availability event
    //and tell the callee by Call_Incoming event
    socket.on("Check_User",function(data){
        if(users.has(data)){
            var calleeUserName = data;
            socket.emit("User_Availability","ack");
        }
        else{
            socket.emit("User_Availability","nak");
        }
    });

    socket.on("Caller_Ready",function(data){
        if(users.has(data)){
            console.log("caller ready: "+data+"with username of: "+socket.username);
            //creating random room number
            var randomRoom = chance.natural();
            while(callerActiveRoom.has(randomRoom)){
                randomRoom = chance.natural();
            }
            //adding it to map to know that its used
            callerActiveRoom.set(socket.username,randomRoom);
            socket.room = randomRoom;           
            socket.to(users.get(data)).emit("Call_Incoming",users.search(socket.id));
            socket.join(socket.room);
            console.log("room is: ",socket.room);                        
        }
        else{
            socket.emit("User_Availability","nak");
        }
    });

    socket.on("Callee_Ready",function(data){
        console.log("callee ready: "+data+"with username of: "+socket.username); 
        //getting callers room number and setting it then removing it from list
        socket.room = callerActiveRoom.get(data);
        callerActiveRoom.remove(data);

        var callersocketid = users.get(data);  
        socket.to(callersocketid).emit("Callee_Ready","");
        socket.join(socket.room);
    });
    //sending SDP offers and answers to room except sender
    socket.on("Offer_SDP",function(data){
        console.log("offer SDP");
        socket.to(socket.room).emit("Offer_SDP",data);                       
    });
    socket.on("Answer_SDP",function(data){
        console.log("answer SDP");            
        socket.to(socket.room).emit("Answer_SDP",data);                          
    });
    socket.on("IceCandidate",function(data){
        console.log("ICE from: "+users.search(socket.id));    
        socket.to(socket.room).emit("IceCandidate",data);                                
    });
    socket.on("IceCandidate_Removal",function(data){
        socket.to(socket.room).emit("IceCandidate_Removal",data);
    });
    socket.on("hangup",function(data){
        socket.to(socket.room).emit("hangup",data);
    });



});

io.sockets.on("disconnect",function(socket){
    users.remove(users.search(socket));
    console.log(socket.id+' disconnected!');
});