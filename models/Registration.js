const mongoose = require("mongoose");

const RegistrationSchema = new mongoose.Schema(
  {
    studentName: String,
    registerNo: String,
    email: String,
    department: String,
    year: String,
    eventName: String,
    eventType: String,
    idCard: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Registration", RegistrationSchema);
