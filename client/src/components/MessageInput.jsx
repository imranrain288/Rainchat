import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { Send, Smile, Paperclip, X, FileText, Mic, Camera, CircleStop } from 'lucide-react';

const QUICK_EMOJIS = ['👋', '😊','😀',' 😢','😠',' 😮 ',' 😍 ', '🔥', '🚀', '❤️', '🎉', '👍', '✨', '💻', '🙌'];

const MAX_ATTACHMENT_SIZE = 8 * 1024 * 1024;
const MAX_RECORDING_MS = 120_000;
const ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const MessageInput = ({ replyTo, onClearReply }) => {
    const { sendMessage, sendTypingStatus, selectedUser } = useChat();
    const { user } = useAuth();
    const [content, setContent] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [imageError, setImageError] = useState('');
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    const textareaRef = useRef(null);
    const formRef = useRef(null);
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const recorderRef = useRef(null);
    const cameraStreamRef = useRef(null);
    const cameraVideoRef = useRef(null);
    const recordingTimeoutRef = useRef(null);
    const cancelRecordingRef = useRef(false);
    const previousConversationIdRef = useRef(selectedUser?._id);

    useEffect(() => () => {
        if (imagePreview) URL.revokeObjectURL(imagePreview);
    }, [imagePreview]);

    useEffect(() => {
        if (isCameraOpen && cameraVideoRef.current && cameraStreamRef.current) {
            cameraVideoRef.current.srcObject = cameraStreamRef.current;
        }
    }, [isCameraOpen]);

    useEffect(() => () => {
        cancelRecordingRef.current = true;
        cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
        if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    }, []);

    useEffect(() => {
        if (previousConversationIdRef.current === selectedUser?._id) return;
        previousConversationIdRef.current = selectedUser?._id;
        cancelRecordingRef.current = true;
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
        cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
        setIsCameraOpen(false);
        setImageFile(null);
        setImagePreview('');
        setContent('');
        setImageError('');
    }, [selectedUser?._id]);

    const stopCamera = () => {
        cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
        setIsCameraOpen(false);
    };

    const openCamera = async () => {
        setImageError('');
        try {
            cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' } },
                audio: false,
            });
            setIsCameraOpen(true);
        } catch (error) {
            setImageError(error.name === 'NotAllowedError' ? 'Allow camera access to capture a photo.' : 'Could not open the camera on this device.');
        }
    };

    const capturePhoto = () => {
        const video = cameraVideoRef.current;
        if (!video?.videoWidth || !video?.videoHeight) {
            setImageError('The camera is not ready yet.');
            return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
            if (!blob) {
                setImageError('Could not capture a photo.');
                return;
            }
            const photo = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
            setImageFile(photo);
            setImagePreview(URL.createObjectURL(photo));
            setImageError('');
            stopCamera();
        }, 'image/jpeg', 0.9);
    };

    const startVoiceRecording = async () => {
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
            setImageError('Voice recording is not supported by this browser.');
            return;
        }
        setImageError('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']
                .find((type) => MediaRecorder.isTypeSupported?.(type));
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            const chunks = [];
            cancelRecordingRef.current = false;
            recorderRef.current = recorder;
            recorder.ondataavailable = (event) => {
                if (event.data.size) chunks.push(event.data);
            };
            recorder.onerror = () => setImageError('Recording failed. Check your microphone and try again.');
            recorder.onstop = async () => {
                stream.getTracks().forEach((track) => track.stop());
                if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
                setIsRecording(false);
                if (cancelRecordingRef.current) return;
                const audioBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
                if (!audioBlob.size) return;
                if (audioBlob.size > MAX_ATTACHMENT_SIZE) {
                    setImageError('Voice messages must be 8 MB or smaller.');
                    return;
                }
                try {
                    setSending(true);
                    const audioData = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = () => reject(new Error('Could not read the voice recording.'));
                        reader.readAsDataURL(audioBlob);
                    });
                    await sendMessage(audioData, 'audio', replyTo, 'Voice message');
                    onClearReply?.();
                } catch (error) {
                    setImageError(error.message || 'Could not send the voice message.');
                } finally {
                    setSending(false);
                }
            };
            recorder.start();
            setIsRecording(true);
            recordingTimeoutRef.current = setTimeout(() => {
                if (recorder.state === 'recording') recorder.stop();
            }, MAX_RECORDING_MS);
        } catch (error) {
            setImageError(error.name === 'NotAllowedError' ? 'Allow microphone access to record a voice message.' : 'Could not start microphone recording.');
        }
    };

    const stopVoiceRecording = () => {
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    };

    // Auto-resize textarea height
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [content]);

    // Handle typing debounce
    const handleInputChange = (e) => {
        setContent(e.target.value);

        // Emit typing indicator
        sendTypingStatus(true);
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
            sendTypingStatus(false);
        }, 1500);
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        const textToSend = content.trim();
        if ((!textToSend && !imageFile) || sending) return;

        try {
            setSending(true);
            sendTypingStatus(false);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

            setIsEmojiPickerOpen(false);
            if (imageFile) {
                const attachmentData = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('Could not read that file.'));
                    reader.readAsDataURL(imageFile);
                });
                const messageType = imageFile.type.startsWith('image/') ? 'image' : 'document';
                await sendMessage(attachmentData, messageType, replyTo, imageFile.name);
            }
            if (textToSend) await sendMessage(textToSend, 'text', imageFile ? null : replyTo);

            setContent('');
            setImageFile(null);
            setImagePreview('');
            setImageError('');
            onClearReply?.();
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
        } catch (err) {
            console.error('Failed to submit message:', err);
            setImageError(err.message || 'Failed to send message.');
        } finally {
            setSending(false);
            textareaRef.current?.focus();
        }
    };

    // Modern Web Guidance: IME-safe Enter-to-Submit
    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();

            // Block submission if composing natively with IME or keyCode is 229
            if (event.isComposing || event.keyCode === 229) {
                return;
            }

            if (formRef.current) {
                formRef.current.requestSubmit();
            } else {
                handleSubmit();
            }
        }
    };

    const handleAddEmoji = (emoji) => {
        setContent((prev) => prev + emoji);
        setIsEmojiPickerOpen(false);
        textareaRef.current?.focus();
    };

    const handleImageSelect = (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        setImageError('');
        if (!file) return;
        const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type);
        if (!isImage && !ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
            setImageError('Choose a JPG, PNG, GIF, WebP, PDF, TXT, DOC, DOCX, XLS, or XLSX file.');
            setImageFile(null);
            setImagePreview('');
            return;
        }
        if (file.size > MAX_ATTACHMENT_SIZE) {
            setImageError('Files must be 8 MB or smaller.');
            setImageFile(null);
            setImagePreview('');
            return;
        }
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    return (
        <div className="chat-composer-container">
            {isCameraOpen && (
                <div className="camera-capture-backdrop" role="dialog" aria-modal="true" aria-label="Capture a photo">
                    <div className="camera-capture-panel">
                        <video ref={cameraVideoRef} autoPlay muted playsInline aria-label="Camera preview" />
                        <div className="camera-capture-actions">
                            <button type="button" className="composer-btn" onClick={stopCamera} aria-label="Close camera">Cancel</button>
                            <button type="button" className="camera-capture-button" onClick={capturePhoto} title="Capture photo" aria-label="Capture photo"><Camera size={20} /></button>
                        </div>
                    </div>
                </div>
            )}
            {(replyTo || imageFile || imageError) && (
                <div className="composer-context-bar">
                    {replyTo && (
                        <div className="composer-reply-context">
                            <span>Replying to {replyTo.senderId === user?._id ? 'your message' : 'their message'}</span>
                            <strong>{replyTo.messageType === 'image' ? 'Photo' : replyTo.messageType === 'document' ? 'Document' : replyTo.messageType === 'audio' ? 'Voice message' : replyTo.content}</strong>
                        </div>
                    )}
                    {imageFile && (
                        <div className="composer-image-preview">
                            {imageFile.type.startsWith('image/') ? <img src={imagePreview} alt="Selected image preview" /> : <FileText size={24} />}
                            <span>{imageFile.name}</span>
                            <button type="button" className="composer-btn" onClick={() => { setImageFile(null); setImagePreview(''); }} aria-label="Remove image">
                                <X size={16} />
                            </button>
                        </div>
                    )}
                    {imageError && <span className="composer-error" role="alert">{imageError}</span>}
                    {replyTo && (
                        <button type="button" className="composer-btn" onClick={onClearReply} aria-label="Cancel reply">
                            <X size={16} />
                        </button>
                    )}
                </div>
            )}

            {/* Quick Emoji Bar */}
            {isEmojiPickerOpen && (
                <div className="emoji-popup-bar">
                    {QUICK_EMOJIS.map((emoji, idx) => (
                        <button
                            key={idx}
                            type="button"
                            className="emoji-btn"
                            onClick={() => handleAddEmoji(emoji)}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            <form ref={formRef} onSubmit={handleSubmit} className="chat-composer-form">
                <div className="composer-actions-left">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={handleImageSelect}
                        hidden
                    />
                    <button
                        type="button"
                        className="composer-btn"
                        onClick={() => fileInputRef.current?.click()}
                        title="Attach image, GIF, or document"
                        aria-label="Attach image, GIF, or document"
                    >
                        <Paperclip size={20} />
                    </button>
                    <button type="button" className="composer-btn" onClick={openCamera} title="Capture photo with camera" aria-label="Capture photo with camera">
                        <Camera size={20} />
                    </button>
                    <button
                        type="button"
                        className="composer-btn"
                        onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                        title="Emoji picker"
                    >
                        <Smile size={20} />
                    </button>
                    <button
                        type="button"
                        className={`composer-btn ${isRecording ? 'recording' : ''}`}
                        onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                        disabled={sending}
                        title={isRecording ? 'Stop and send voice message' : 'Record voice message'}
                        aria-label={isRecording ? 'Stop and send voice message' : 'Record voice message'}
                        aria-pressed={isRecording}
                    >
                        {isRecording ? <CircleStop size={20} /> : <Mic size={20} />}
                    </button>
                </div>

                <label htmlFor="chat-message-input" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                    Type your message
                </label>
                <textarea
                    id="chat-message-input"
                    ref={textareaRef}
                    className="composer-textarea"
                    rows={1}
                    placeholder="Type a message... (Press Enter to send)"
                    value={content}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                />

                <button
                    type="submit"
                    className="send-msg-btn"
                    disabled={(!content.trim() && !imageFile) || sending}
                    title="Send message (Enter)"
                >
                    <Send size={18} />
                </button>
            </form>
        </div>
    );
};
