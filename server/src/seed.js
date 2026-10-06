import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from './models/User.js';
import { Message } from './models/Message.js';
import { Conversation } from './models/Conversation.js';

dotenv.config();

const sampleUsers = [
  {
    fullName: 'Alex Morgan',
    username: 'alexm',
    email: 'alex@example.com',
    password: 'password123',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    bio: 'Product Designer & UI lover 🎨 Always down for good coffee.',
    status: 'online',
  },
  {
    fullName: 'Sarah Chen',
    username: 'sarahc',
    email: 'sarah@example.com',
    password: 'password123',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    bio: 'Fullstack developer & Open source contributor 💻✨',
    status: 'online',
  },
  {
    fullName: 'David Miller',
    username: 'davidm',
    email: 'david@example.com',
    password: 'password123',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    bio: 'Architecting scalable clouds & dreaming in TypeScript ☁️',
    status: 'away',
  },
  {
    fullName: 'Elena Rostova',
    username: 'elenar',
    email: 'elena@example.com',
    password: 'password123',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    bio: 'Exploring machine learning & building thoughtful AI products 🤖',
    status: 'offline',
  },
  {
    fullName: 'Liam Patel',
    username: 'liamp',
    email: 'liam@example.com',
    password: 'password123',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    bio: 'Music producer by night, frontend wizard by day 🎧🎵',
    status: 'online',
  },
];

export const seedDatabase = async () => {
  try {
    await mongoose.connect(
      process.env.MONGO_URI
        || process.env.MONGODB_URI
        || 'mongodb://127.0.0.1:27017/chatapp'
    );
    console.log('🌱 Connected to MongoDB for seeding...');

    // Clear existing data
    await User.deleteMany({});
    await Message.deleteMany({});
    await Conversation.deleteMany({});
    console.log('🧹 Cleared existing users and messages');

    // Create users with hashed passwords
    const salt = await bcrypt.genSalt(10);
    const createdUsers = [];

    for (const u of sampleUsers) {
      const hashedPassword = await bcrypt.hash(u.password, salt);
      const newUser = await User.create({
        ...u,
        password: hashedPassword,
        lastSeen: new Date(),
      });
      createdUsers.push(newUser);
    }
    console.log(`✅ Created ${createdUsers.length} sample registered users`);

    // Create sample conversation between Alex and Sarah
    const alex = createdUsers[0];
    const sarah = createdUsers[1];
    const david = createdUsers[2];

    const messages = [
      {
        senderId: sarah._id,
        receiverId: alex._id,
        content: 'Hey Alex! Have you seen the new design update for PulseChat?',
        read: true,
        createdAt: new Date(Date.now() - 3600000 * 3),
      },
      {
        senderId: alex._id,
        receiverId: sarah._id,
        content: 'Hey Sarah! Yes, the glassmorphism look with glowing indicators is gorgeous! 😍',
        read: true,
        createdAt: new Date(Date.now() - 3600000 * 2),
      },
      {
        senderId: sarah._id,
        receiverId: alex._id,
        content: 'Totally agreed! The real-time messaging with Socket.io feels instant.',
        read: false,
        createdAt: new Date(Date.now() - 1800000),
      },
      {
        senderId: david._id,
        receiverId: alex._id,
        content: 'Hi Alex, ping me when you are ready to review the cloud architecture!',
        read: false,
        createdAt: new Date(Date.now() - 900000),
      },
    ];

    const createdMessages = await Message.insertMany(messages);

    // Create conversations
    await Conversation.create({
      participants: [alex._id, sarah._id],
      lastMessage: createdMessages[2]._id,
    });

    await Conversation.create({
      participants: [alex._id, david._id],
      lastMessage: createdMessages[3]._id,
    });

    console.log('✅ Seeded sample conversations and messages');
    console.log('🎉 Database seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();
