const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require('dotenv').config();

console.log("==== Athaan Fi Beit Setup Check ====");

// Check folders
const folders = ["models", "public", "public/assets"];
folders.forEach(f => {
  if (fs.existsSync(path.join(__dirname, f))) {
    console.log(`[✔] Folder exists: ${f}`);
  } else {
    console.log(`[✖] Missing folder: ${f}`);
  }
});

// Check key files
const files = ["server.js", "models/User.js", "public/index.html", "package.json"];
files.forEach(f => {
  if (fs.existsSync(path.join(__dirname, f))) {
    console.log(`[✔] File exists: ${f}`);
  } else {
    console.log(`[✖] Missing file: ${f}`);
  }
});

// Check .env variables
const envVars = ["MONGO_URI", "EMAIL_USER", "EMAIL_PASS"];
envVars.forEach(v => {
  if (process.env[v]) {
    console.log(`[✔] Env var set: ${v}`);
  } else {
    console.log(`[✖] Env var missing: ${v}`);
  }
});

// Check MongoDB connection
if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).then(() => {
    console.log("[✔] MongoDB connection successful");
    mongoose.connection.close();
  }).catch(err => {
    console.log("[✖] MongoDB connection failed:", err.message);
  });
} else {
  console.log("[✖] Cannot test MongoDB connection without MONGO_URI");
}
