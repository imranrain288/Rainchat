import { User } from '../models/User.js';
import { Message } from '../models/Message.js';
import { Conversation } from '../models/Conversation.js';
import { getReceiverSocketId, io } from '../socket/socket.js';

const getOrCreateConversation = async (userId, otherUserId) => {
  let conversation = await Conversation.findOne({
    participants: { $all: [userId, otherUserId], $size: 2 },
  });
  if (!conversation) {
    conversation = await Conversation.create({ participants: [userId, otherUserId] });
  }
  return conversation;
};

const getMessagePreview = (message) => {
  if (message.messageType === 'image') return 'Photo';
  if (message.messageType === 'document') return 'Document';
  if (message.messageType === 'audio') return 'Voice message';
  if (message.messageType === 'call') return `Missed ${message.callType} call`;
  if (message.messageType === 'deleted') return 'Message deleted';
  return message.encryption ? 'Encrypted message' : message.content;
};

// @desc Get all registered users for conversation list with last message snippet and unread count
// @route GET /api/users
export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { search } = req.query;

    let query = { _id: { $ne: loggedInUserId } };

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ fullName: searchRegex }, { username: searchRegex }, { email: searchRegex }];
    }

    const [registeredUsers, currentUser] = await Promise.all([
      User.find(query).select('-password').sort({ createdAt: -1 }),
      User.findById(loggedInUserId).select('blockedUsers'),
    ]);
    const conversations = await Conversation.find({ participants: loggedInUserId });
    const groupConversations = conversations.filter((conversation) => conversation.isGroup);
    const conversationsByUserId = new Map();
    conversations.forEach((conversation) => {
      if (conversation.isGroup) return;
      const otherUserId = conversation.participants.find((participantId) => !participantId.equals(loggedInUserId));
      if (otherUserId) conversationsByUserId.set(otherUserId.toString(), conversation);
    });

    // Enhance each registered user with their conversation context with the logged-in user
    const usersWithConversationMeta = await Promise.all(
      registeredUsers.map(async (user) => {
        const conversation = conversationsByUserId.get(user._id.toString());
        if (conversation?.hiddenFor.some((hiddenUserId) => hiddenUserId.equals(loggedInUserId))) {
          return null;
        }

        // Find latest message between logged-in user and this user
        const lastMessage = await Message.findOne({
          $or: [
            { senderId: loggedInUserId, receiverId: user._id },
            { senderId: user._id, receiverId: loggedInUserId },
          ],
        }).sort({ createdAt: -1 });

        // Count unread messages sent by this user to the logged-in user
        const unreadCount = await Message.countDocuments({
          senderId: user._id,
          receiverId: loggedInUserId,
          read: false,
        });

        const userData = user.toObject();
        const hasBlockedMe = userData.blockedUsers.some((blockedUserId) => blockedUserId.equals(loggedInUserId));
        delete userData.blockedUsers;

        return {
          ...userData,
          isBlockedByMe: currentUser.blockedUsers.some((blockedUserId) => blockedUserId.equals(user._id)),
          hasBlockedMe,
          isPinned: Boolean(conversation?.pinnedBy.some((pinnedUserId) => pinnedUserId.equals(loggedInUserId))),
          lastMessage: lastMessage
            ? {
              _id: lastMessage._id,
              content: getMessagePreview(lastMessage),
              senderId: lastMessage.senderId,
              createdAt: lastMessage.createdAt,
              read: lastMessage.read,
              messageType: lastMessage.messageType,
              callType: lastMessage.callType,
              edited: lastMessage.edited,
              favoritedBy: lastMessage.favoritedBy,
            }
            : null,
          unreadCount,
        };
      })
    );

    const visibleUsers = usersWithConversationMeta.filter(Boolean);
    const groupEntries = await Promise.all(groupConversations
      .filter((conversation) => !conversation.hiddenFor.some((hiddenUserId) => hiddenUserId.equals(loggedInUserId)))
      .map(async (conversation) => {
        const [group, lastMessage] = await Promise.all([
          Conversation.findById(conversation._id).populate('participants', 'fullName username avatar encryptionPublicKey'),
          Message.findOne({ conversationId: conversation._id }).sort({ createdAt: -1 }),
        ]);
        return {
          _id: conversation._id,
          isGroup: true,
          fullName: conversation.groupName,
          username: conversation.groupName,
          avatar: '',
          participants: group.participants,
          isPinned: conversation.pinnedBy.some((pinnedUserId) => pinnedUserId.equals(loggedInUserId)),
          lastMessage: lastMessage ? {
            _id: lastMessage._id,
            content: getMessagePreview(lastMessage),
            senderId: lastMessage.senderId,
            createdAt: lastMessage.createdAt,
            read: lastMessage.read,
            messageType: lastMessage.messageType,
            callType: lastMessage.callType,
            favoritedBy: lastMessage.favoritedBy,
          } : null,
          unreadCount: 0,
        };
      }));
    visibleUsers.push(...groupEntries);
    visibleUsers.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return Number(b.isPinned) - Number(a.isPinned);
      const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;

      if (timeA !== timeB) {
        return timeB - timeA;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return res.status(200).json({
      success: true,
      count: visibleUsers.length,
      users: visibleUsers,
    });
  } catch (error) {
    console.error('Error in getUsersForSidebar:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch registered users.',
      error: error.message,
    });
  }
};

export const createGroup = async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    const groupName = typeof name === 'string' ? name.trim() : '';
    const uniqueMemberIds = [...new Set([req.user._id.toString(), ...(Array.isArray(memberIds) ? memberIds : [])])];
    if (groupName.length < 2 || groupName.length > 80) {
      return res.status(400).json({ success: false, message: 'Group name must be between 2 and 80 characters.' });
    }
    if (uniqueMemberIds.length < 3) {
      return res.status(400).json({ success: false, message: 'Choose at least two other members.' });
    }
    const members = await User.find({ _id: { $in: uniqueMemberIds } }).select('fullName encryptionPublicKey');
    if (members.length !== uniqueMemberIds.length) {
      return res.status(400).json({ success: false, message: 'One or more selected members could not be found.' });
    }
    const membersMissingEncryption = members.filter((member) => !member.encryptionPublicKey);
    if (membersMissingEncryption.length) {
      const names = membersMissingEncryption.map((member) => member.fullName).join(', ');
      return res.status(400).json({
        success: false,
        message: `End-to-end encryption is not set up for ${names}. Ask them to sign in and retry.`,
      });
    }
    const conversation = await Conversation.create({
      participants: uniqueMemberIds,
      isGroup: true,
      groupName,
    });
    await conversation.populate('participants', 'fullName username avatar encryptionPublicKey');
    const group = {
      _id: conversation._id,
      isGroup: true,
      fullName: conversation.groupName,
      username: conversation.groupName,
      avatar: '',
      participants: conversation.participants,
      isPinned: false,
      lastMessage: null,
      unreadCount: 0,
    };
    conversation.participants.forEach((participant) => {
      if (participant._id.equals(req.user._id)) return;
      const socketId = getReceiverSocketId(participant._id);
      if (socketId) io.to(socketId).emit('groupCreated', group);
    });
    return res.status(201).json({ success: true, group });
  } catch (error) {
    console.error('Error creating group:', error);
    return res.status(500).json({ success: false, message: 'Failed to create group.' });
  }
};

export const getEncryptionPublicKey = async (req, res) => {
  const user = await User.findById(req.user._id).select('encryptionPublicKey');
  return res.status(200).json({ success: true, publicKey: user?.encryptionPublicKey || '' });
};

export const registerEncryptionPublicKey = async (req, res) => {
  const { publicKey } = req.body;
  if (typeof publicKey !== 'string' || publicKey.length > 2048 || !/^[A-Za-z0-9+/]+={0,2}$/.test(publicKey)) {
    return res.status(400).json({ success: false, message: 'Provide a valid public encryption key.' });
  }

  const user = await User.findById(req.user._id).select('encryptionPublicKey');
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  if (user.encryptionPublicKey) {
    if (user.encryptionPublicKey === publicKey) return res.status(200).json({ success: true, publicKey });
    return res.status(409).json({
      success: false,
      message: 'An encryption identity already exists for this account. Register from the device holding its private key.',
    });
  }

  const registeredUser = await User.findOneAndUpdate(
    { _id: req.user._id, $or: [{ encryptionPublicKey: '' }, { encryptionPublicKey: { $exists: false } }] },
    { $set: { encryptionPublicKey: publicKey } },
    { new: true },
  ).select('encryptionPublicKey');
  if (registeredUser) return res.status(201).json({ success: true, publicKey });

  const currentUser = await User.findById(req.user._id).select('encryptionPublicKey');
  if (currentUser?.encryptionPublicKey === publicKey) return res.status(200).json({ success: true, publicKey });
  return res.status(409).json({ success: false, message: 'An encryption identity was registered by another device.' });
};

export const resetEncryptionPublicKey = async (req, res) => {
  const { publicKey, confirmReset } = req.body;
  if (confirmReset !== true) {
    return res.status(400).json({ success: false, message: 'Confirm the encryption key reset.' });
  }
  if (typeof publicKey !== 'string' || publicKey.length > 2048 || !/^[A-Za-z0-9+/]+={0,2}$/.test(publicKey)) {
    return res.status(400).json({ success: false, message: 'Provide a valid public encryption key.' });
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { encryptionPublicKey: publicKey } },
    { new: true, runValidators: true },
  ).select('_id');
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  return res.status(200).json({ success: true, publicKey });
};

export const setUserBlocked = async (req, res) => {
  try {
    const { id: otherUserId } = req.params;
    const { blocked } = req.body;
    if (typeof blocked !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Provide a boolean blocked value.' });
    }
    if (otherUserId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot block yourself.' });
    }

    const otherUser = await User.findById(otherUserId);
    if (!otherUser) return res.status(404).json({ success: false, message: 'User not found.' });

    const currentUser = await User.findById(req.user._id).select('blockedUsers');
    if (blocked) currentUser.blockedUsers.addToSet(otherUserId);
    else currentUser.blockedUsers.pull(otherUserId);
    await currentUser.save();

    const otherUserSocketId = getReceiverSocketId(otherUserId);
    if (otherUserSocketId) {
      io.to(otherUserSocketId).emit('userBlockStatusUpdated', {
        userId: req.user._id.toString(),
        blocked,
      });
    }
    return res.status(200).json({ success: true, isBlockedByMe: blocked });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ success: false, message: 'User not found.' });
    console.error('Error updating user block status:', error);
    return res.status(500).json({ success: false, message: 'Failed to update block status.' });
  }
};

export const toggleConversationPin = async (req, res) => {
  try {
    const userId = req.user._id;
    const otherUserId = req.params.id;
    let conversation = await Conversation.findOne({ _id: otherUserId, isGroup: true, participants: userId });
    if (!conversation) {
      if (!(await User.exists({ _id: otherUserId }))) return res.status(404).json({ success: false, message: 'Conversation not found.' });
      conversation = await getOrCreateConversation(userId, otherUserId);
    }
    const isPinned = conversation.pinnedBy.some((pinnedUserId) => pinnedUserId.equals(userId));
    if (isPinned) conversation.pinnedBy.pull(userId);
    else conversation.pinnedBy.addToSet(userId);
    await conversation.save();

    const socketId = getReceiverSocketId(userId);
    if (socketId) io.to(socketId).emit('conversationPinUpdated', { userId: otherUserId.toString(), isPinned: !isPinned });
    return res.status(200).json({ success: true, isPinned: !isPinned });
  } catch (error) {
    console.error('Error in toggleConversationPin:', error);
    return res.status(500).json({ success: false, message: 'Failed to update pinned conversation.' });
  }
};

export const removeConversationFromList = async (req, res) => {
  try {
    const userId = req.user._id;
    const otherUserId = req.params.id;
    let conversation = await Conversation.findOne({ _id: otherUserId, isGroup: true, participants: userId });
    if (!conversation) {
      if (!(await User.exists({ _id: otherUserId }))) return res.status(404).json({ success: false, message: 'Conversation not found.' });
      conversation = await getOrCreateConversation(userId, otherUserId);
    }
    conversation.hiddenFor.addToSet(userId);
    conversation.pinnedBy.pull(userId);
    await conversation.save();

    const socketId = getReceiverSocketId(userId);
    if (socketId) io.to(socketId).emit('conversationRemovedFromList', { userId: otherUserId.toString() });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in removeConversationFromList:', error);
    return res.status(500).json({ success: false, message: 'Failed to remove conversation.' });
  }
};

// @desc Get individual user profile
// @route GET /api/users/:id
export const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password -blockedUsers');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.status(200).json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching user profile.' });
  }
};
