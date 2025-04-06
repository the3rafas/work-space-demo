const express = require("express");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const app = express();
const PORT = 3000;

// Middleware to parse JSON requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set view engine to EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Get your local IP address dynamically
const { networkInterfaces } = require("os");

function getLocalIp() {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

const LOCAL_IP = getLocalIp();
const BASE_URL = `http://${LOCAL_IP}:${PORT}`;

// File path for attendance data
const ATTENDANCE_FILE = path.join(__dirname, "attendance.json");

// Initialize attendance file if it doesn't exist
if (!fs.existsSync(ATTENDANCE_FILE)) {
  fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify([], null, 2));
}

// Endpoint to create a code and return HTML view with QR code
app.post("/api/attendance", async (req, res) => {
  try {
    // Generate a random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date().toISOString();

    // Create QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(
      `${BASE_URL}/api/attendance/${code}`,
      {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      }
    );

    // Create attendance record
    const attendanceRecord = {
      code,
      qrCode: qrCodeDataUrl, // Store QR code data URL
      createdAt: now,
      updatedAt: now,
      ...req.body,
    };

    // Read existing data
    const attendanceData = JSON.parse(fs.readFileSync(ATTENDANCE_FILE, "utf8"));

    // Add new record
    attendanceData.push(attendanceRecord);

    // Save back to file
    fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(attendanceData, null, 2));

    // Render HTML view with the code and QR code
    res.render("codeView", {
      code,
      qrCode: qrCodeDataUrl,
      createdAt: attendanceRecord.createdAt,
      updatedAt: attendanceRecord.updatedAt,
    });
  } catch (error) {
    console.error("Error creating attendance:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Update attendance with checkout time
app.put("/api/attendance/:code", (req, res) => {
  try {
    const { code } = req.params;
    const now = new Date().toISOString();

    let attendanceData = JSON.parse(fs.readFileSync(ATTENDANCE_FILE, "utf8"));

    const recordIndex = attendanceData.findIndex(
      (record) => record.code === code
    );

    if (recordIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    // Update the record
    attendanceData[recordIndex] = {
      ...attendanceData[recordIndex],
      checkOut: now,
      updatedAt: now,
    };

    saveAttendanceData(attendanceData);

    res.json({
      success: true,
      message: "Checkout recorded successfully",
      data: attendanceData[recordIndex],
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
});

// Endpoint to get all attendance records
app.get("/api/attendance", (req, res) => {
  try {
    // Read data from file
    const attendanceData = JSON.parse(fs.readFileSync(ATTENDANCE_FILE, "utf8"));

    // Return all records
    res.json({
      success: true,
      data: attendanceData,
      count: attendanceData.length,
    });
  } catch (error) {
    console.error("Error fetching attendance:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
