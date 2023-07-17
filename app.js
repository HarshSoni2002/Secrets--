//jshint esversion:6
require("dotenv").config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");
// const encrypt = require("mongoose-encryption");
// var md5 = require("md5");
// const bcrypt = require("bcrypt");
// const saltRounds = 10;

const app = express();

// console.log(process.env.API_KEY);
// console.log(md5("123456"));

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose
  .connect("mongodb://127.0.0.1:27017/userDB", { useNewUrlParser: true })
  .then(() => {
    console.log("Connected to mongoDB");
  });

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String,
});

// userSchema.plugin(encrypt, {
//   secret: process.env.SECRET,
//   encryptedFields: ["password"],
// });

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
// used to serialize the user for the session
// passport.serializeUser(function (user, done) {
//   done(null, user.id);
//   // where is this user.id going? Are we supposed to access this anywhere?
// });

// used to deserialize the user
// passport.deserializeUser(function (id, done) {
//   // User.findById(id, function (err, user) {
//   //   done(err, user);
//   // });
//   User.findById(id)
//     .then((user) => {
//       done(user);
//     })
//     .catch((err) => {
//       console.log(err);
//     });
// });

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
      // userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile);
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

app.get("/", (req, res) => {
  res.render("home");
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/secrets");
  }
);

app.get("/login", (req, res) => {
  res.render("login");
});
app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/secrets", (req, res) => {
  User.find({ secret: { $ne: null } })
    .then((foundusers) => {
      if (foundusers) {
        res.render("secrets", { userWithSecrets: foundusers });
      }
    })
    .catch((err) => {
      console.log(err);
    });
});

app.get("/submit", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.post("/submit", (req, res) => {
  const submittedSecret = req.body.secret;

  User.findById(req.user.id)
    .then((founduser) => {
      if (founduser) {
        founduser.secret = submittedSecret;
        founduser.save().then(() => {
          res.redirect("/secrets");
        });
      }
    })
    .catch((err) => {
      console.log(err);
    });
});

app.get("/logout", (req, res) => {
  req.logout(req.user, (err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

// app.post("/register", (req, res) => {
//   bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
//     // Store hash in your password DB.
//     const newUser = new User({
//       email: req.body.username,
//       // password: req.body.password,
//       // password: md5(req.body.password),
//       password: hash,
//     });

//     newUser
//       .save()
//       .then(() => {
//         res.render("secrets");
//       })
//       .catch((err) => {
//         console.log(err);
//       });
//   });
// });

// app.post("/login", (req, res) => {
//   const username = req.body.username;
//   const password = req.body.password;
//   // const password = md5(req.body.password);
//   User.findOne({ email: username })
//     .then((founduser) => {
//       if (founduser) {
//         // if (founduser.password === password) {
//         //   res.render("secrets");
//         // }
//         bcrypt
//           .compare(password, founduser.password)
//           .then((result) => {
//             if (result == true) {
//               res.render("secrets");
//             }
//           })
//           .catch((err) => {
//             console.log(err);
//           });
//       }
//     })
//     .catch((err) => {
//       console.log(err);
//     });
// });

app.post("/register", (req, res) => {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/secrets");
        });
      }
    }
  );
});

app.post("/login", (req, res) => {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, (err) => {
    if (err) console.log(err);
    else {
      passport.authenticate("local")(req, res, () => {
        res.redirect("/secrets");
      });
    }
  });
});

app.listen(3000, () => {
  console.log("connected to server");
});
