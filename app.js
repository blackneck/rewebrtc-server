var express = require("express");
var app = express();
var serverPort = (process.env.PORT  || 4443);
var server = null;

server = require("http").createServer(app);

var io = require("socket.io")(server);

let socketIdToNames = {};
let babyInRoom = {};

server.listen(serverPort);

function socketIdsInRoom(roomId) {
  var socketIds = io.nsps["/"].adapter.rooms[roomId];
  if (socketIds) {
    var collection = [];
    for (var key in socketIds) {
      collection.push(key);
    }
    return collection;
  } else {
    return [];
  }
}

io.on("connection", function(socket) {
  console.log("Connection");
  socket.on("disconnect", function() {
    console.log("Disconnect");
    delete socketIdToNames[socket.id];
    if (socket.room) {
      var room = socket.room;
      io.to(room).emit("leave", socket.id);
      socket.leave(room);
    }
  });

  /**
   * Callback: list of {socketId, name: name of user}
   */
  socket.on("join", function(joinData, callback) {
    //Join room
    let roomId = joinData.roomId;
    let name = joinData.name;
    let socketId = joinData.socketId;
    socket.join(roomId);
    socket.room = roomId;
    socketIdToNames[socket.id] = name;
    if (name === "Baby") babyInRoom[roomId] = socketId;
    var socketIds = socketIdsInRoom(roomId);
    let friends = socketIds
      .map(socketId => {
        return {
          socketId: socketId,
          name: socketIdToNames[socketId]
        };
      })
      .filter(friend => friend.socketId != socket.id);
    callback(friends);
    //broadcast
    friends.forEach(friend => {
      io.sockets.connected[friend.socketId].emit("join", {
        socketId: socket.id,
        name
      });
    });
    console.log("Join: ", joinData, "baby in room: ", babyInRoom[roomId]);
  });

  socket.on("exchange", function(data) {
    console.log("exchange", data);
    data.from = socket.id;
    var to = io.sockets.connected[data.to];
    to.emit("exchange", data);
  });

  socket.on("count", function(roomId, callback) {
    var socketIds = socketIdsInRoom(roomId);
    callback(socketIds.length);
  });

  socket.on("toggleMic", function({ roomId }) {
    const to = io.sockets.connected[babyInRoom[roomId]];
    if (to) to.emit("toggleMicRequest");
  });
});
