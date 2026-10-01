import { Message } from '../models/Message.js';
import { Conversation } from '../models/Conversation.js';
import { getReceiverSocketId, io } from '../socket/socket.js';
import { User } from '../models/User.js';
import { sendOfflineMessageEmail } from '../services/email.service.js';

const emitToMessageParticipants = (message, event, payload) => {
  [message.senderId, message.receiverId].filter(Boolean).forEach((participantId) => {
    const socketId = getReceiverSocketId(participantId);
    if (socketId) io.to(socketId).emit(event, payload);
  });
  if (message.conversationId) {
    Conversation.findById(message.conversationId).then((conversation) => {
      conversation?.participants.forEach((participantId) => {
        const socketId = getReceiverSocketId(participantId);
        if (socketId) io.to(socketId).emit(event, payload);
      });
    }).catch((error) => console.error('Failed to notify group members:', error.message));
  }
};

const hasValidEncryption = (content, encryption, participantIds) => {
  if (typeof content !== 'string' || content.length > 12_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(content)) return false;
  if (encryption?.version !== 1 || typeof encryption.iv !== 'string' || !/^[A-Za-z0-9+/]{16}$/.test(encryption.iv)) return false;
  if (!Array.isArray(encryption.keys) || encryption.keys.length !== participantIds.length) return false;
  const requiredIds = new Set(participantIds.map((id) => id.toString()));
  for (const entry of encryption.keys) {
    if (typeof entry.userId !== 'string' && !entry.userId) return false;
    const userId = entry.userId.toString();
    if (!requiredIds.delete(userId) || typeof entry.wrappedKey !== 'string' || entry.wrappedKey.length > 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(entry.wrappedKey)) return false;
  }
  return requiredIds.size === 0;
};


// @desc Get all messages for a specific conversation
// @route GET /api/messages/:id
export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).populate('replyTo', 'content senderId messageType encryption callType').sort({ createdAt: 1 });

    // Mark unread messages sent by userToChatId as read
    const updateResult = await Message.updateMany(
      {
        senderId: userToChatId,
        receiverId: myId,
        read: false,
      },
      {
        $set: { read: true, readAt: new Date() },
      }
    );

    if (updateResult.modifiedCount > 0) {
      const senderSocketId = getReceiverSocketId(userToChatId);
      if (senderSocketId) {
        io.to(senderSocketId).emit('messagesReadNotification', {
          readBy: myId,
        });
      }
    }

    return res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error('Error in getMessages:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve messages.',
      error: error.message,
    });
  }
};

export const getGroupMessages = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, isGroup: true, participants: req.user._id });
    if (!conversation) return res.status(404).json({ success: false, message: 'Group not found.' });
    const messages = await Message.find({ conversationId: conversation._id })
      .populate('replyTo', 'content senderId messageType attachmentName encryption callType')
      .sort({ createdAt: 1 });
    return res.status(200).json({ success: true, messages });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve group messages.' });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { content, messageType = 'text', replyTo, attachmentName, encryption } = req.body;
    const conversation = await Conversation.findOne({ _id: req.params.id, isGroup: true, participants: req.user._id });
    if (!conversation) return res.status(404).json({ success: false, message: 'Group not found.' });
    if (typeof content !== 'string' || !content.trim()) return res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
    if (!['text', 'image', 'document', 'audio', 'emoji'].includes(messageType)) {
      return res.status(400).json({ success: false, message: 'Unsupported or invalid attachment.' });
    }
    if (!hasValidEncryption(content, encryption, conversation.participants)) {
      return res.status(400).json({ success: false, message: 'The encrypted message is invalid or missing a group member key.' });
    }
    let replyMessage = null;
    if (replyTo) {
      replyMessage = await Message.findOne({ _id: replyTo, conversationId: conversation._id });
      if (!replyMessage) return res.status(400).json({ success: false, message: 'The reply target is not in this group.' });
    }
    const newMessage = await Message.create({
      senderId: req.user._id,
      conversationId: conversation._id,
      content: content.trim(),
      messageType,
      encryption,
      attachmentName: messageType === 'document' ? String(attachmentName || 'Document').slice(0, 255) : undefined,
      replyTo: replyMessage?._id || null,
    });
    if (replyMessage) await newMessage.populate('replyTo', 'content senderId messageType attachmentName encryption callType');
    conversation.lastMessage = newMessage._id;
    conversation.hiddenFor = [];
    await conversation.save();
    const sender = await User.findById(req.user._id).select('fullName avatar');
    const messagePayload = { ...newMessage.toObject(), senderName: sender.fullName, senderAvatar: sender.avatar };
    conversation.participants.forEach((participantId) => {
      if (participantId.equals(req.user._id)) return;
      const socketId = getReceiverSocketId(participantId);
      if (socketId) io.to(socketId).emit('newMessage', messagePayload);
    });
    return res.status(201).json({ success: true, message: messagePayload });
  } catch (error) {
    console.error('Error sending group message:', error);
    return res.status(500).json({ success: false, message: 'Failed to send group message.' });
  }
};

export const getFavoriteMessages = async (req, res) => {
  try {
    const messages = await Message.find({ favoritedBy: req.user._id })
      .populate('senderId', 'fullName username avatar')
      .populate('receiverId', 'fullName username avatar')
      .populate('replyTo', 'content senderId messageType encryption callType')
      .sort({ updatedAt: -1 });

    return res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error('Error in getFavoriteMessages:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve favorites.' });
  }
};

// @desc Send a new message to a registered user
// @route POST /api/messages/send/:id
export const sendMessage = async (req, res) => {
  try {
    const { content, messageType = 'text', replyTo, attachmentName, callType, encryption } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    const [sender, receiver] = await Promise.all([
      User.findById(senderId).select('blockedUsers fullName'),
      User.findById(receiverId).select('email fullName blockedUsers'),
    ]);
    if (!receiver) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const senderBlockedReceiver = sender.blockedUsers.some((id) => id.equals(receiverId));
    const receiverBlockedSender = receiver.blockedUsers.some((id) => id.equals(senderId));
    if (senderBlockedReceiver || receiverBlockedSender) {
      return res.status(403).json({ success: false, message: 'Messages cannot be sent because one of you has blocked the other.' });
    }

    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content cannot be empty.',
      });
    }
    if (!['text', 'image', 'document', 'audio', 'call', 'emoji'].includes(messageType)) {
      return res.status(400).json({ success: false, message: 'Unsupported message type.' });
    }
    if (messageType === 'call' && !['audio', 'video'].includes(callType)) {
      return res.status(400).json({ success: false, message: 'Choose an audio or video call type.' });
    }
    if (!hasValidEncryption(content, encryption, [senderId, receiverId])) {
      return res.status(400).json({ success: false, message: 'The encrypted message is invalid or missing a participant key.' });
    }

    let replyMessage = null;
    if (replyTo) {
      replyMessage = await Message.findById(replyTo);
      const sameConversation = replyMessage && (
        (replyMessage.senderId.equals(senderId) && replyMessage.receiverId?.equals(receiverId)) ||
        (replyMessage.senderId.equals(receiverId) && replyMessage.receiverId?.equals(senderId))
      );
      if (!sameConversation) {
        return res.status(400).json({ success: false, message: 'The reply target is not in this conversation.' });
      }
    }

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
      });
    }
    conversation.hiddenFor.pull(senderId);
    conversation.hiddenFor.pull(receiverId);

    const newMessage = new Message({
      senderId,
      receiverId,
      content: content.trim(),
      messageType,
      callType: messageType === 'call' ? callType : undefined,
      encryption,
      attachmentName: messageType === 'document' ? String(attachmentName || 'Document').slice(0, 255) : undefined,
      replyTo: replyMessage?._id || null,
      read: false,
    });

    if (newMessage) {
      conversation.lastMessage = newMessage._id;
    }

    // Save both conversation and message in parallel
    await Promise.all([conversation.save(), newMessage.save()]);
    if (replyMessage) await newMessage.populate('replyTo', 'content senderId messageType encryption callType');

    // Real-time notification via Socket.io
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('newMessage', newMessage);
    } else {
      const emailText = messageType === 'image' ? 'You received a photo.' : messageType === 'audio' ? 'You received a voice message.' : messageType === 'document' ? 'You received a document.' : messageType === 'call' ? 'You received a missed call.' : 'You received an encrypted message.';
      sendOfflineMessageEmail({ recipient: receiver, senderName: sender.fullName, message: emailText })
        .catch((error) => console.error('Failed to send offline message email:', error.message));
    }

    return res.status(201).json({
      success: true,
      message: newMessage,
    });
  } catch (error) {
    console.error('Error in sendMessage:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message.',
      error: error.message,
    });
  }
};

// @desc Mark messages as read explicitly
// @route PUT /api/messages/read/:id
export const markMessagesAsRead = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    await Message.updateMany(
      {
        senderId: userToChatId,
        receiverId: myId,
        read: false,
      },
      {
        $set: { read: true, readAt: new Date() },
      }
    );

    const senderSocketId = getReceiverSocketId(userToChatId);
    if (senderSocketId) {
      io.to(senderSocketId).emit('messagesReadNotification', {
        readBy: myId,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Messages marked as read.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read.',
      error: error.message,
    });
  }
};
export const deleteConversation = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    await Message.deleteMany({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    let conversation = await Conversation.findOne({
      participants: { $all: [myId, userToChatId] },
    });
    if (!conversation) {
      conversation = await Conversation.create({ participants: [myId, userToChatId] });
    }
    conversation.lastMessage = null;
    conversation.hiddenFor.addToSet(myId);
    conversation.pinnedBy.pull(myId);
    await conversation.save();

    [myId, userToChatId].forEach((participantId) => {
      const socketId = getReceiverSocketId(participantId);
      if (socketId) {
        io.to(socketId).emit('chatHistoryDeleted', {
          actorId: myId.toString(),
          chatWithId: userToChatId.toString(),
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Conversation history deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete conversation.',
      error: error.message,
    });
  }
};
export const deleteMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const myId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.',
      });
    }

    if (message.senderId.toString() !== myId.toString()) {
      return res.status(401).json({
        success: false,
        message: 'You are not authorized to delete this message.',
      });
    }

    message.content = 'This message was deleted';
    message.messageType = 'deleted';
    message.callType = undefined;
    message.encryption = undefined;
    message.attachmentName = undefined;
    message.replyTo = null;
    message.favoritedBy = [];
    await message.save();
    emitToMessageParticipants(message, 'messageDeleted', { messageId, message });

    return res.status(200).json({
      success: true,
      message,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete message.',
      error: error.message,
    });
  }
};
export const clearChat = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    await Message.deleteMany({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    const conversation = await Conversation.findOne({
      participants: { $all: [myId, userToChatId] },
    });
    if (conversation) {
      conversation.lastMessage = null;
      await conversation.save();
    }

    [myId, userToChatId].forEach((participantId) => {
      const socketId = getReceiverSocketId(participantId);
      if (socketId) {
        io.to(socketId).emit('chatHistoryCleared', {
          chatWithId: participantId.equals(myId) ? userToChatId.toString() : myId.toString(),
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Chat cleared successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to clear chat.',
      error: error.message,
    });
  }
};
export const copyMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const myId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.',
      });
    }

    if (message.senderId.toString() !== myId.toString()) {
      return res.status(401).json({
        success: false,
        message: 'You are not authorized to copy this message.',
      });
    }

    await message.clone();

    return res.status(200).json({
      success: true,
      message: 'Message copied successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to copy message.',
      error: error.message,
    });
  }
};

export const pinMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const myId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.',
      });
    }

    if (message.senderId.toString() !== myId.toString()) {
      return res.status(401).json({
        success: false,
        message: 'You are not authorized to pin this message.',
      });
    }

    await message.updateOne({ pinned: !message.pinned });

    return res.status(200).json({
      success: true,
      message: `Message ${message.pinned ? 'unpinned' : 'pinned'} successfully.`,
      message: message,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to pin message.',
      error: error.message,
    });
  }
};
export const unpinMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const myId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.',
      });
    }

    if (message.senderId.toString() !== myId.toString()) {
      return res.status(401).json({
        success: false,
        message: 'You are not authorized to unpin this message.',
      });
    }

    await message.updateOne({ pinned: false });

    return res.status(200).json({
      success: true,
      message: 'Message unpinned successfully.',
      message: message,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to unpin message.',
      error: error.message,
    });
  }
};
export const editMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const myId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.',
      });
    }

    if (message.senderId.toString() !== myId.toString()) {
      return res.status(401).json({
        success: false,
        message: 'You are not authorized to edit this message.',
      });
    }

    if (typeof req.body.content !== 'string' || !req.body.content.trim()) {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
    }
    if (!['text', 'emoji'].includes(message.messageType)) {
      return res.status(400).json({ success: false, message: 'This message type cannot be edited.' });
    }

    const conversation = message.conversationId
      ? await Conversation.findOne({ _id: message.conversationId, participants: myId })
      : null;
    const participantIds = conversation?.participants || [message.senderId, message.receiverId].filter(Boolean);
    if (!hasValidEncryption(req.body.content, req.body.encryption, participantIds)) {
      return res.status(400).json({ success: false, message: 'The encrypted edit is invalid or missing a participant key.' });
    }

    message.content = req.body.content.trim();
    message.encryption = req.body.encryption;
    message.edited = true;
    await message.save();
    emitToMessageParticipants(message, 'messageUpdated', message);

    return res.status(200).json({
      success: true,
      message: message,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to edit message.',
      error: error.message,
    });
  }
};
export const toggleFavoriteMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const myId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.',
      });
    }

    const isFavorite = message.favoritedBy.some((userId) => userId.equals(myId));
    if (isFavorite) {
      message.favoritedBy.pull(myId);
    } else {
      message.favoritedBy.addToSet(myId);
    }
    await message.save();
    emitToMessageParticipants(message, 'messageUpdated', message);

    return res.status(200).json({
      success: true,
      message,
      isFavorite: !isFavorite,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update message favorite.',
      error: error.message,
    });
  }
};
