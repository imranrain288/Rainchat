import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
    {
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Conversation',
            default: null,
            index: true,
        },
        content: {
            type: String,
            required: [true, 'Message content cannot be empty'],
            trim: true,
        },
        messageType: {
            type: String,
            enum: ['text', 'image', 'document', 'audio', 'call', 'deleted', 'emoji'],
            default: 'text',
        },
        callType: {
            type: String,
            enum: ['audio', 'video'],
        },
        encryption: {
            version: Number,
            iv: String,
            keys: [{
                userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
                wrappedKey: { type: String, required: true },
            }],
        },
        attachmentName: {
            type: String,
            trim: true,
            maxlength: 255,
        },
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
            default: null,
        },
        edited: {
            type: Boolean,
            default: false,
        },
        favoritedBy: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        read: {
            type: Boolean,
            default: false,
        },
        readAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// Compound index for querying chat messages quickly between two users
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });

export const Message = mongoose.model('Message', messageSchema);
