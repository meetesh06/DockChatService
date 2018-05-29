
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
const globalManagedMemory = {};
const SIZE_OF_CHANNEL = 250;

io.on('connection', socket => {
  if(!socket.isAuthorized) {
    
    io.to(socket.id).emit('feedback', JSON.stringify({ error: false, data: 500 }) );
  }

  socket.on('auth request', (userRequest) => {
    let user_request = {};
    try {
      user_request = JSON.parse(userRequest);
    } catch(e) {
      
      io.to(socket.id).emit('feedback', JSON.stringify({ error: true, mssg: 'invalid auth request' }) );
      socket.disconnect();
      return;
    }
    if(user_request.token && user_request.bulletins) {
      var options = {
        url: 'https://mycampusdock.com/verify-chat',
        headers: {
          'x-access-token': user_request.token
        }
      };
      request.post(options,
        function (error, response, body) {
          if(error) {
            io.to(socket.id).emit('feedback', JSON.stringify({ error: true, data: 'auth failed token error'}) );
            socket.disconnect();
          }
          
          body = JSON.parse(body);
          if(body && body.error == false){
            socket.userEmail = body.data;
            socket.userName = body.name;
            let i = 0;
            user_request.bulletins = user_request.bulletins.split(',');
            for(i=0;i<user_request.bulletins.length;i++) {
              socket.join(user_request.bulletins[i]);
            }
            
            io.to(socket.id).emit('feedback', JSON.stringify({ error: false, data: 101}) );
            socket.isAuthorized = true;
          } else {
            io.to(socket.id).emit('feedback', JSON.stringify({ error: true, mssg: 'auth failed'}) );
            socket.disconnect();
          }
        }
      );
    } else {
      io.to(socket.id).emit('feedback', JSON.stringify({ error: true, mssg: 'auth failed'}) );
      socket.disconnect();
    }
  });

  socket.on('subscribe to new', (userRequest) => {
    if(socket.isAuthorized) {
      socket.join(userRequest);
      io.to(socket.id).emit('feedback', JSON.stringify({ error: false, data: 103}) );
    } else {
      io.to(socket.id).emit('feedback', JSON.stringify({ error: true, mssg: 'auth failed'}) );
      socket.disconnect();
    }
  });

  socket.on('send to bulletin', (userRequest) => {
    let request = {};
    try {
      request = JSON.parse(userRequest);
    } catch(e) {
      
      io.to(socket.id).emit('feedback', JSON.stringify({ error: true, mssg: 'invalid auth request' }) );
      socket.disconnect();
      return;
    }
    
    if(socket.rooms.hasOwnProperty(request.bulletin)) {
      
      let now = new Date();
      if (globalManagedMemory[request.bulletin] != undefined) {
      
        if(globalManagedMemory[request.bulletin].length >= SIZE_OF_CHANNEL ){
          globalManagedMemory[request.bulletin].shift();
          globalManagedMemory[request.bulletin].push({ email: socket.userEmail, message: request.message, timestamp: now});
        } else {
          globalManagedMemory[request.bulletin].push({ email: socket.userEmail, message: request.message, timestamp: now});
        }
      } else {
      
        globalManagedMemory[request.bulletin] = [];
        globalManagedMemory[request.bulletin].push({ email: socket.userEmail, message: request.message, timestamp: now, name: socket.userName});
      }
      
      
      io.to(request.bulletin).emit('new_message_in_bulletin', JSON.stringify({ error: false, email: socket.userEmail, bulletin: request.bulletin, data: request.message, timestamp: now}));
    } else {
      
      io.to(socket.id).emit('feedback', JSON.stringify({ error: true, mssg: 'auth failed'}) );
      socket.disconnect();
    }
  });
  
  socket.on('synchronize', (userRequest) => {
    if(socket.isAuthorized) {
      
      if(socket.rooms.hasOwnProperty(userRequest)) {
        let toSend = { error: false, data: 105, payload: { bulletin_id: userRequest, messages: globalManagedMemory[userRequest] }};
      
        io.to(socket.id).emit('feedback', JSON.stringify(toSend) );
      } else {
        io.to(socket.id).emit('feedback', JSON.stringify({ error: true, mssg: 'auth failed bulletin not subscribed'}) );
        socket.disconnect();  
      }
    }
  });

  socket.on('disconnect', () => {
    
  })
})

server.listen(process.env.PORT || port, () => console.log(`Listening on port ${port}`))