const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Socket running ✅");
});

const io = new Server(server, {
  cors: { origin: "*" },
  path: "/socket.io",
  transports: ["polling"],
});

let round = 1;

io.on("connection", (socket) => {

  socket.on("disconnect", () => {
  });

  function startGame() {
    const crashPoint = parseFloat((Math.random() * 5 + 1).toFixed(2));
    let multiplier = 1.0;


    socket.emit("prepareplane");

    setTimeout(() => {
      socket.emit("flyplane");

      const interval = setInterval(() => {
        multiplier += 0.01;

        socket.emit("crash-update", {
          crashpoint: parseFloat(multiplier.toFixed(2)),
        });

        socket.emit("working");

        if (multiplier >= crashPoint) {
          clearInterval(interval);

          socket.emit("crash-update", {
            crashpoint: crashPoint,
          });

          socket.emit("reset");

          round++;

          setTimeout(startGame, 3000);
        }
      }, 100);
    }, 2000);
  }

  startGame();
});

server.listen(PORT, () => {
  console.log("🔥 SERVER RUNNING ON PORT:", PORT);
});
