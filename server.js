const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

const io = new Server(server, {
  cors: { origin: "*" },
  transports: ["websocket"],
});

let currentPeriod;
let isFlying = false;
let activeBets = {};
const API = "https://jalwagame5.shop/jet/trova/src/api/api_crash.php";

function getNextPeriod() {
  return Date.now();
}

async function getCrashFromAPI() {
  try {
    const res = await axios.get(API, {
      params: { action: "get" }
    });
    return res.data.crashpoint;
  } catch (err) {
    console.log("❌ GET API ERROR:", err.message);
    return null;
  }
}
function generateCrashPoint() {
  const houseEdge = 0.05; // 5%
  let u = Math.random();

  // avoid division by zero edge case
  if (u === 1) u = 0.999999;

  let crash = (1 - houseEdge) / (1 - u);

  // optional: max cap (UI stable rakhne ke liye)
  if (crash > 1000) crash = 1000;

  return Number(crash.toFixed(2));
}
async function resetCrashAPI() {
  try {
    await axios.get(API, {
      params: { action: "reset" }
    });
  } catch (err) {
    console.log("❌ RESET ERROR:", err.message);
  }
}

async function setCrashAPI(value) {
  try {
    await axios.post(
      API + "?action=set",
      new URLSearchParams({
        crashpoint: value,
        key: "SECRET123"
      })
    );
  } catch (err) {
    console.log("❌ SET ERROR:", err.message);
  }
}

// 🎮 GAME LOOP
async function startGame() {
  currentPeriod = getNextPeriod();

  // ✅ 1. Crash value API se lo
  const dbCrash = await getCrashFromAPI();

 const crashPoint =
  dbCrash !== null
    ? Number(parseFloat(dbCrash).toFixed(2))
    : generateCrashPoint();

  console.log("🚀 ROUND:", currentPeriod, "CRASH:", crashPoint);

  // 🟢 STEP 1: UI prepare
  io.emit("prepareplane");


    // 🟢 STEP 2: betting phase
    io.emit("working");

      // 🟢 STEP 3: plane fly
      console.log("✈️ flyplane emit");
      io.emit("flyplane");
isFlying = true;
      let startTime = Date.now();

      function runCrashLoop() {
        let elapsed = (Date.now() - startTime) / 1000;

        // 🔥 smooth multiplier
        let multiplier = Number((Math.exp(0.15 * elapsed)).toFixed(2));
        

        io.emit("crash-update",multiplier);

        if (multiplier >= crashPoint) {
          finishGame();
          return;
        }

        setTimeout(runCrashLoop, 100);
      }

      async function finishGame() {
        isFlying = false;
for (let user in activeBets) {

  if (!activeBets[user].cashedOut) {

    console.log("❌ AUTO LOSE:", user);

    try {
      await axios.post(
        "https://jalwagame5.shop/jet/trova/src/api/bet?action=cashout&server=Crash",
        {
          username: user,
          amount: 0,        // ❌ loss
          multiplier: 0,    // ❌ no win
          period: currentPeriod
        }
      );
    } catch (err) {
      console.log("❌ AUTO LOSS ERROR:", err.message);
    }
  }
}
        const finalCrash = Number(crashPoint.toFixed(2));

        console.log("💥 CRASH:", finalCrash);

        // ✅ SAVE RESULT API
        try {
          await axios.post(
            "https://jalwagame5.shop/jet/trova/src/api/bet",
            new URLSearchParams({
              crashpoint: finalCrash,
              id: currentPeriod,
              time: new Date().toISOString(),
            }),
            { params: { action: "savecrash" } }
          );
        } catch (err) {
          console.log("❌ SAVE ERROR:", err.message);
        }

        // ✅ RESET API
        try {
          await resetCrashAPI();
        } catch (err) {
          console.log("❌ RESET ERROR:", err.message);
        }
       
          io.emit("reset");
            setTimeout(() =>{}, 2000);
         
            io.emit("removecrash");

            // 🔁 NEXT ROUND
            setTimeout(startGame, 4000);

          
activeBets = {};
       
      }

      runCrashLoop();
}
// 🔌 SOCKET
io.on("connection", (socket) => {
  console.log("✅ CONNECTED:", socket.id);

  socket.on("userid", (userId) => {
    socket.userId = userId;
  });

  socket.on("newBet", async (username, amount) => {
    const fixedAmount = Number(parseFloat(amount).toFixed(2));
    if (!fixedAmount || fixedAmount <= 0) return;
 // 🔥 yaha add karo
  activeBets[username] = {
    amount: fixedAmount,
    cashedOut: false
  };

  console.log("🟢 Bet added:", username, activeBets[username]);
    try {
      await axios.post(
        "https://jalwagame5.shop/jet/trova/src/api/bet?action=bet&server=Crash",
        new URLSearchParams({
          username,
          period: currentPeriod,
          ans: "manual",
          amount: fixedAmount,
        })
      );
    } catch (err) {
      console.log("❌ BET ERROR:", err.message);
    }
  });

  socket.on("addWin", async (username, amount, multiplier) => {
    if (!isFlying) return;           // game crash ho chuka
if (!amount || amount <= 0) return;  // invalid amount
if (activeBets[username]) {
    activeBets[username].cashedOut = true;
  }
    const fixedMultiplier = Number(multiplier.toFixed(2));
    const fixedAmount = Number(parseFloat(amount).toFixed(2));

    try {
      await axios.post(
        "https://jalwagame5.shop/jet/trova/src/api/bet",
        {
          username,
          amount: fixedAmount,
          multiplier: fixedMultiplier,
          period: currentPeriod,
        },
        {
          params: {
            action: "cashout",
            server: "Crash",
          },
        }
      );
    } catch (err) {
      console.log("❌ CASHOUT ERROR:", err.message);
    }
  });

  socket.on("adminCrash", async (data) => {
    if (!data || data.key !== "SECRET123") return;

    const value = Number(parseFloat(data.value).toFixed(2));
    if (!value || value < 1) return;

    await setCrashAPI(value);

    console.log("🛠 ADMIN SET:", value);

    socket.emit("adminAck", { status: "ok", value });
  });

  socket.on("disconnect", () => {
    console.log("❌ DISCONNECTED:", socket.id);
  });
});

// ▶️ START
startGame();

server.listen(PORT, () => {
  console.log("🔥 SERVER RUNNING:", PORT);
});
