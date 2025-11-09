const express = require('express');
const route = express.Router()
const parser = require('../middleware/upload');

const { login, signup, verifyEmail, googleAuth, resetOtp, resetPassword, sendOtpForResetPassword, verifyEmailForResetPassword, changePassword } = require('../controller/auth_controller')
const { updateProfileDetails } = require('../controller/profiel_controller');
const { updateUserPreference } = require('../controller/preference_controller');

// Auth Related Api's
route.post('/login', login);
route.post('/signup', signup);
route.post('/verifyOtpForSignup', verifyEmail);
route.post('/googleAuth', googleAuth);
route.post('/resetOtp', resetOtp);
route.post('/resetPassword', resetPassword);
route.post('/sendOtpForResetPassword', sendOtpForResetPassword);
route.post('/verifyEmailForResetPassword', verifyEmailForResetPassword);
route.put('/changePassword', changePassword);

// Profile Related Api's
route.put('/updateProfile', parser.single('profilePhotoUrl'), updateProfileDetails);

// Profile Preference Api's
route.put('/updateUserPreferences', parser.fields([{ name: "images", maxCount: 5 }]), updateUserPreference);

module.exports = route;