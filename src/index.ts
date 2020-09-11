import express from "express";
import http from "http";
import socketIO from "socket.io";
import debug from "debug";

const serverDebug = debug("server");
const ioDebug = debug("io");
const socketDebug = debug("socket");

const app = express();
const port = process.env.PORT || 8080; // default port to listen

const server = http.createServer(app);

server.listen(port, () => {
  serverDebug(`listening on port: ${port}`);
});

const io = socketIO(server, {
  handlePreflightRequest: function (_server, _req, res) {
    var headers = {
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": "true",
    };
    res.writeHead(200, headers);
    res.end();
  },
});

// Use redis
const redisAdapter = require('socket.io-redis');
io.adapter(redisAdapter({ host: 'localhost', port: 6379 }));

const redis = require('redis');
const client = redis.createClient({ host: 'localhost', port: 6379 }); 

io.on("connection", (socket) => {
  ioDebug("connection established!");
  io.to(`${socket.id}`).emit("init-room");
  socket.on("join-room", (roomID) => {
    socketDebug(`${socket.id} has joined ${roomID}`);
    socket.join(roomID);
    if (io.sockets.adapter.rooms[roomID].length <= 1) {
      io.to(`${socket.id}`).emit("first-in-room");
      client.get(roomID, (err: any, value: any) => {
        if(err) {
          serverDebug(err);
        }
        if (value) {
          io.to(`${socket.id}`).emit("client-load", value);
        }
      });
    } else {
      socket.broadcast.to(roomID).emit("new-user", socket.id);
    }
    io.in(roomID).emit(
      "room-user-change",
      Object.keys(io.sockets.adapter.rooms[roomID].sockets)
    );
  });

  socket.on(
    "server-broadcast",
    (roomID: string, encryptedData: ArrayBuffer, iv: Uint8Array) => {
      socketDebug(`${socket.id} sends permanent update to ${roomID}`);
      //  JSON.stringify({'data': new TextDecoder("utf-8").decode(encryptedData), 'v': new TextDecoder("utf-8").decode(iv)}));
      socket.broadcast.to(roomID).emit("client-broadcast", encryptedData, iv);
    }
  );

  socket.on(
    "server-save",
    (roomID: string, data: string) => {
      client.set(roomID, data, ()=>{});
    }
  );
     
  socket.on(
    "server-volatile-broadcast",
    (roomID: string, encryptedData: ArrayBuffer, iv: Uint8Array) => {
      socketDebug(`${socket.id} sends volatile update to ${roomID}`);
      socket.volatile.broadcast
        .to(roomID)
        .emit("client-broadcast", encryptedData, iv);
    }
  );

  socket.on("disconnecting", () => {
    const rooms = io.sockets.adapter.rooms;
    for (const roomID in socket.rooms) {
      const clients = Object.keys(rooms[roomID].sockets).filter(
        (id) => id !== socket.id
      );
      if (clients.length > 0) {
        socket.broadcast.to(roomID).emit("room-user-change", clients);
      }
    }
  });

  socket.on("disconnect", () => {
    socket.removeAllListeners();
  });
});
