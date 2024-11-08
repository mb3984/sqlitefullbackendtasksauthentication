const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose(); // Directly use sqlite3
const cors = require("cors");
const bcryptjs = require("bcryptjs");
const uuid = require("uuid");
const jwt = require("jsonwebtoken");
require("dotenv").config(); // Load environment variables

const dbPath = path.join(__dirname, "app.db");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(bodyParser.json());

let db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(`Error opening database: ${err.message}`);
    process.exit(1);
  }
  console.log("Connected to the SQLite database.");
});

// JWT Middleware
const authenticateToken = (req, res, next) => {
  console.log("Authentication middleware hit");

  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    console.log("Authorization header not provided");
    return res.status(401).send("Access Denied");
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : authHeader;

  jwt.verify(token, process.env.JWT_SECRET || "secretkey", (err, decoded) => {
    if (err) {
      console.log("JWT verification failed:", err);
      return res.status(403).send("Invalid Token");
    }

    console.log("Decoded token:", decoded);
    req.user = decoded;
    next();
  });
};

// Signup Route
app.post("/signup", async (req, res) => {
  console.log("Signup route hit");
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).send("Missing required fields");
  }

  try {
    const hashedPassword = await bcryptjs.hash(password, 10);
    const id = uuid.v4();

    // Check if user already exists
    db.get(
      "SELECT * FROM users WHERE name = ?",
      [name],
      async (err, dbUser) => {
        if (err) {
          console.error("Error during user lookup:", err.message);
          return res.status(500).send("Server error");
        }

        if (dbUser === undefined) {
          // Insert new user into the database
          const createUserQuery = `
          INSERT INTO users (id, name, email, password)
          VALUES (?, ?, ?, ?)`;
          db.run(createUserQuery, [id, name, email, hashedPassword], (err) => {
            if (err) {
              console.error("Error during user creation:", err.message);
              return res.status(500).send("Server error");
            }
            res.send("User created successfully");
            console.log("User created successfully");
          });
        } else {
          res.status(400).send("User already exists");
        }
      }
    );
  } catch (error) {
    console.error("Error during signup:", error.message);
    res.status(500).send("Server error");
  }
});

// Login Route
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    db.get(
      "SELECT * FROM users WHERE email = ?",
      [email],
      async (err, user) => {
        if (err) {
          console.error("Error during login:", err.message);
          return res.status(500).send("Server error");
        }

        if (!user) {
          return res.status(400).send("Email not found");
        }

        const isPasswordValid = await bcryptjs.compare(password, user.password);
        if (isPasswordValid) {
          const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET || "secretkey",
            {
              expiresIn: "1h",
            }
          );
          console.log("user login successfully");
          console.log(`token:${token}`);
          return res.status(200).json({ token });
        } else {
          return res.status(400).send("Invalid credentials");
        }
      }
    );
  } catch (error) {
    console.error("Error during login:", error.message);
    return res.status(500).send("Server error");
  }
});

// Update password route
app.post("/update-password", async (req, res) => {
  const { email, oldPassword, newPassword } = req.body;

  if (!email || !oldPassword || !newPassword) {
    return res.status(400).send("Missing required fields");
  }

  try {
    db.get(
      "SELECT * FROM users WHERE email = ?",
      [email],
      async (err, user) => {
        if (err) {
          console.error("Error during password update:", err.message);
          return res.status(500).send("Server error");
        }

        if (!user) {
          return res.status(400).send("User not found");
        }

        const isPasswordValid = await bcryptjs.compare(
          oldPassword,
          user.password
        );
        if (!isPasswordValid) {
          return res.status(400).send("Invalid current password");
        }

        const hashedPassword = await bcryptjs.hash(newPassword, 10);
        db.run(
          "UPDATE users SET password = ? WHERE email = ?",
          [hashedPassword, email],
          (err) => {
            if (err) {
              console.error("Error during password update:", err.message);
              return res.status(500).send("Server error");
            }

            console.log("Password updated successfully");
            return res.status(200).send("Password updated successfully");
          }
        );
      }
    );
  } catch (error) {
    console.error("Error during password update:", error.message);
    return res.status(500).send("Server error");
  }
});

// Task creation route
// Update task
app.put("/tasks/:id", authenticateToken, (req, res) => {
  const taskId = req.params.id;
  const { title, description, status } = req.body;

  // Validate status
  const validStatuses = ["pending", "in progress", "done", "completed"];
  if (!validStatuses.includes(status)) {
    return res.status(400).send("Invalid status value");
  }

  console.log("Updating task with ID:", taskId);
  console.log("Requesting user ID:", req.user.userId);

  // Check if task exists and belongs to the user
  db.get(
    `SELECT * FROM tasks WHERE id = ? AND user_id = ?`,
    [taskId, req.user.userId],
    (err, row) => {
      if (err) {
        console.error("Error retrieving task:", err.message);
        return res.status(500).send("Error retrieving task");
      }
      if (!row) {
        return res
          .status(404)
          .send("Task not found or you don't have permission");
      }

      // Update task
      db.run(
        `UPDATE tasks SET title = ?, description = ?, status = ? WHERE id = ? AND user_id = ?`,
        [title, description, status, taskId, req.user.userId],
        function (err) {
          if (err) {
            console.error("Error updating task:", err.message);
            return res.status(500).send("Error updating task");
          }
          if (this.changes === 0) {
            return res
              .status(404)
              .send("Task not found or you don't have permission");
          }
          res.status(200).send("Task updated successfully");
          console.log("Task updated successfully");
          console.log(`title: ${title}`);
          console.log(`description: ${description}`);
          console.log(`status: ${status}`);
        }
      );
    }
  );
});

// Get all tasks for the logged-in user
app.get("/tasks", authenticateToken, (req, res) => {
  db.all(
    "SELECT * FROM tasks WHERE user_id = ?",
    [req.user.userId],
    (err, rows) => {
      if (err) return res.status(500).send(err.message);
      res.status(200).json(rows);
      console.log(rows);
    }
  );
});

// Delete a task by taskId
app.delete("/tasks/:taskId", authenticateToken, (req, res) => {
  const { taskId } = req.params;

  db.run(
    "DELETE FROM tasks WHERE id = ? AND user_id = ?",
    [taskId, req.user.userId],
    (err) => {
      if (err) return res.status(500).send(err.message);
      res.status(200).send("Task deleted successfully");
      console.log(`taskId:${taskId}`);
      console.log("Task deleted successfully");
    }
  );
});

app.get("/", (req, res) => {
  res.send("Welcome to backend todo project!");
});

// Example API route
app.get("/api/tasks", (req, res) => {
  res.json({ tasks: [] });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
