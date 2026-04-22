const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// ✅ GLOBAL CORS (IMPORTANT)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// ✅ TEST ROUTE
app.get("/", (req, res) => {
  console.log("HTTP / HIT");
  res.send("Socket running ✅");
});

// ✅ SOCKET INIT
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  path: "/socket.io",
  transports: ["polling"], // htaccess safe
});

// 🔥 ENGINE HEADERS FIX (VERY IMPORTANT FOR CORS)
io.engine.on("headers", (headers, req) => {
  headers["Access-Control-Allow-Origin"] = "*";
  headers["Access-Control-Allow-Credentials"] = "true";
});

// 🔥 ERROR LOG
io.engine.on("connection_error", (err) => {
  console.log("❌ CONNECTION ERROR:");
  console.log(err);
});

// 🔥 REQUEST LOG
io.engine.on("initial_headers", (headers, req) => {
  console.log("📡 REQUEST:", req.url);
});

let round = 1;

io.on("connection", (socket) => {
  console.log("✅ USER CONNECTED:", socket.id);
  console.log("👉 transport:", socket.conn.transport.name);

  socket.on("disconnect", (reason) => {
    console.log("❌ DISCONNECTED:", reason);
  });

  function startGame() {
    const crashPoint = (Math.random() * 5 + 1).toFixed(2);
    let multiplier = 1.0;

    console.log("🚀 START ROUND:", round, "CRASH AT:", crashPoint);

    // ✅ START EVENT
    socket.emit("start", {
      id: round,
    });

    const interval = setInterval(() => {
      multiplier += 0.1;

      socket.emit("crash", {
        id: round,
        crashpoint: multiplier.toFixed(2),
      });

      if (multiplier >= crashPoint) {
        clearInterval(interval);

        console.log("💥 CRASHED AT:", crashPoint);

        socket.emit("crash", {
          id: round,
          crashpoint: crashPoint,
          status: "crashed",
        });

        round++;

        setTimeout(startGame, 3000);
      }
    }, 500);
  }

  startGame();
});

// 🚀 START SERVER
server.listen(PORT, () => {
  console.log("🔥 SERVER RUNNING ON PORT:", PORT);
});