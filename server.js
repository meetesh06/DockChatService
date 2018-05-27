
const express = require('express')
const http = require('http')
const socketIO = require('socket.io')

// our localhost port
const port = 4001

const app = express()

// our server instance
const server = http.createServer(app)
const request = require('request');

// This creates our socket using the instance of the server
const io = socketIO(server)

const globalManagedMemory = {}; // this will store the bulletins

const SIZE_OF_CHANNEL = 250;

// This is what the socket.io syntax is like, we will work this later
io.on('connection', socket => {
  console.log('New client connected')
  
  socket.on('bulletin subscription', (userRequest) => {
    console.log(userRequest);
    let user_request = JSON.parse(userRequest);
    if(user_request.token && user_request.bulletins) {
      var options = {
        url: 'http://127.0.0.1:65534/verify-chat',
        headers: {
          'x-access-token': user_request.token
        }
      };
      request.post(options,
          function (error, response, body) {
            body = JSON.parse(body);
            if(body && body.error == false){
              socket.userEmail = body.data;
              let i = 0;
              let toSend = {};
              for(i=0;i<user_request.bulletins.length;i++) {
                socket.join(user_request.bulletins[i]);
                console.log(globalManagedMemory[user_request.bulletins[i]]);
                toSend[user_request.bulletins[i]] = globalManagedMemory[user_request.bulletins[i]] != undefined ? globalManagedMemory[user_request.bulletins[i]] : [];
              }
              io.to(socket.id).emit('am i connected', JSON.stringify({ error: false, data: toSend}) );
              console.log('handshake complete');
            } else {
              console.log('handshake failed', body);
            }
          }
      );
    }
    
  });

  socket.on('send to bulletin', (userRequest) => {
    let request = JSON.parse(userRequest);
    if(socket.rooms.hasOwnProperty(request.bulletin)) {
      console.log('can send: '+socket.userEmail);
      if (globalManagedMemory[request.bulletin] != undefined) {
        console.log('using existing memory instance');
        if(globalManagedMemory[request.bulletin].length >= SIZE_OF_CHANNEL ){
          globalManagedMemory[request.bulletin].shift();
          globalManagedMemory[request.bulletin].push({ email: socket.userEmail, message: request.message, timestamp: new Date()});
        } else {
          globalManagedMemory[request.bulletin].push({ email: socket.userEmail, message: request.message, timestamp: new Date()});
        }
      } else {
        console.log('creating new memory instance');
        globalManagedMemory[request.bulletin] = [];
        globalManagedMemory[request.bulletin].push({ email: socket.userEmail, message: request.message, timestamp: new Date()});
        // Object.seal(globalManagedMemory[request.bulletin]);
      }
      console.log('global memory ',globalManagedMemory[request.bulletin]);
      io.to(request.bulletin).emit('message in bulletin', { bulletin: request.bulletin, data: globalManagedMemory[request.bulletin]});
    } else {
      console.log('cannot send');
    }
  });

  socket.on('am i connected', () => {
    if(socket.userEmail != undefined) {
      io.to(socket.id).emit('am i connected', JSON.stringify({ error: false}) );
    } else {
      io.to(socket.id).emit('am i connected', JSON.stringify({ error: true, mssg: 'token was probably invalid' }) );
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  })
})

server.listen(port, () => console.log(`Listening on port ${port}`))