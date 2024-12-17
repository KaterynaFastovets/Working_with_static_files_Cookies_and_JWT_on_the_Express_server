const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("./models/User"); 

dotenv.config();
const app = express();

// MongoDB
mongoose
  .connect(process.env.MONGO_DB)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Failed to connect to MongoDB", err));


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public"))); 

// pug
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

// favicon
app.use((req, res, next) => {
  if (req.path === "/favicon.ico") {
    res.sendFile(path.join(__dirname, "public", "favicon.ico"));
  } else {
    next();
  }
});

 // theme
app.get("/", (req, res) => {
  const theme = req.cookies.theme || "light"; 
  res.render("index", { theme });
});


app.post("/set-theme", (req, res) => {
  const { theme } = req.body;

  if (!theme) {
    return res.status(400).send("Theme is required");
  }


  res.cookie("theme", theme, { maxAge: 1 * 24 * 60 * 60 * 1000 }); 
  res.redirect("/");
});

  // register user
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!email || !username) {
    return res.status(400).send("Email and username are required");
  }


  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).send("Email already exists");
  }


  const existingUsername = await User.findOne({ username });
  if (existingUsername) {
    return res.status(400).send("Username already exists");
  }


  const hashedPassword = await bcrypt.hash(password, 10);


  const newUser = new User({ username, email, password: hashedPassword });
  await newUser.save();
  res.status(201).send("User registered successfully");
});


app.post("/login", async (req, res) => {
  const { username, password } = req.body;

 
  const user = await User.findOne({ username });
  if (!user) {
    return res.status(400).send("Invalid username or password");
  }

 
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(400).send("Invalid username or password");
  }

  // JWT token
  const token = jwt.sign(
    { userId: user._id, username: user.username },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );

  // cookies
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  res.status(200).send("Logged in successfully");
});

// Middleware 
const authenticateJWT = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(403).send("Access denied. No token provided.");
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).send("Invalid token.");
    }
    req.user = user;
    next();
  });
};


app.get("/dashboard", authenticateJWT, (req, res) => {
  res.send(`Welcome to your dashboard, ${req.user.username}!`);
});


app.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.status(200).send("Logged out successfully");
});


const morgan = require("morgan");
app.use(morgan("dev"));


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something went wrong!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
