const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/User');

const signToken = (user) =>
  jwt.sign(
    {
      userId: user.userId,
      phone: user.phone,
    },
    process.env.JWT_SECRET || 'dev_jwt_secret_change_me',
    { expiresIn: '7d' }
  );

const buildUserResponse = (user) => ({
  userId: user.userId,
  name: user.name,
  phone: user.phone,
  linkedBank: user.linkedBank,
  walletBalance: user.walletBalance,
});

const register = async (req, res) => {
  try {
    const { name, phone, password, linkedBank } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ message: 'name, phone, and password are required.' });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(409).json({ message: 'User with this phone already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const user = await User.create({
      userId,
      name,
      phone,
      password: hashedPassword,
      linkedBank: linkedBank || 'None',
    });

    const token = signToken(user);

    return res.status(201).json({
      message: 'Registration successful.',
      token,
      user: buildUserResponse(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to register user.',
      error: error.message,
    });
  }
};

const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'phone and password are required.' });
    }

    const user = await User.findOne({ phone });
    if (!user || !user.password) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = signToken(user);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: buildUserResponse(user),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to login.',
      error: error.message,
    });
  }
};

module.exports = {
  register,
  login,
};