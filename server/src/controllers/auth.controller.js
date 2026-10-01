import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Message } from '../models/Message.js';
import { Conversation } from '../models/Conversation.js';
import { User } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_mern_messaging_2026_xyz!@#';

const createToken = (userId) =>
  jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });

const publicUser = (user) => {
  const userData = user.toObject();
  delete userData.password;
  delete userData.blockedUsers;
  return userData;
};

export const signup = async (req, res) => {
  try {
    const { fullName, username, email, password, avatar, bio } = req.body;
    if (!fullName?.trim() || !username?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({
      $or: [{ username: normalizedUsername }, { email: normalizedEmail }],
    });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Username or email is already in use.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      fullName: fullName.trim(),
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      avatar,
      bio,
    });

    return res.status(201).json({
      success: true,
      user: publicUser(user),
      token: createToken(user._id),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Username or email is already in use.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Error in signup:', error);
    return res.status(500).json({ success: false, message: 'Failed to create account.' });
  }
};

export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier?.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Username/email and password are required.' });
    }

    const normalizedIdentifier = identifier.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid username/email or password.' });
    }

    return res.status(200).json({
      success: true,
      user: publicUser(user),
      token: createToken(user._id),
    });
  } catch (error) {
    console.error('Error in login:', error);
    return res.status(500).json({ success: false, message: 'Failed to log in.' });
  }
};

export const getMe = (req, res) => {
  return res.status(200).json({ success: true, user: req.user });
};

export const updateProfile = async (req, res) => {
  try {
    const updates = {};
    for (const field of ['fullName', 'bio', 'avatar']) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (updates.fullName !== undefined) updates.fullName = updates.fullName.trim();
    if (!updates.fullName && updates.fullName !== undefined) {
      return res.status(400).json({ success: false, message: 'Full name cannot be empty.' });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select('-password');

    return res.status(200).json({ success: true, user });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Error in updateProfile:', error);
    return res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    await Message.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] });
    await Message.updateMany({ favoritedBy: userId }, { $pull: { favoritedBy: userId } });
    await Conversation.deleteMany({ participants: userId });
    await User.updateMany({ blockedUsers: userId }, { $pull: { blockedUsers: userId } });
    await user.deleteOne();

    return res.status(200).json({ success: true, message: 'Account deleted.' });
  } catch (error) {
    console.error('Error deleting account:', error);
    return res.status(500).json({ success: false, message: 'Could not delete the account.' });
  }
};
