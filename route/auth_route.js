const express = require('express');
const route = express.Router()

const { login, signup, verifyEmail, googleAuth, resetOtp, resetPassword, sendOtpForResetPassword, verifyEmailForResetPassword, changePassword } = require('../controller/auth_controller')

route.post('/login', login);
route.post('/signup',signup);
route.post('/verifyOtpForSignup',verifyEmail);

module.exports = route;