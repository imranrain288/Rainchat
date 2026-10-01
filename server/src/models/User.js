import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: [true, 'Username is required'],
            unique: true,
            trim: true,
            minlength: [3, 'Username must be at least 3 characters'],
            lowercase: true,
        },
        fullName: {
            type: String,
            required: [true, 'Full name is required'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
        },
        encryptionPublicKey: {
            type: String,
            default: '',
            maxlength: 2048,
        },
        avatar: {
            type: String,
            default: '',
        },
        bio: {
            type: String,
            default: 'Hey there! I am using PulseChat.',
            maxlength: 120,
        },
        status: {
            type: String,
            enum: ['online', 'offline', 'away'],
            default: 'offline',
        },
        lastSeen: {
            type: Date,
            default: Date.now,
        },
        blockedUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
    },
    { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
