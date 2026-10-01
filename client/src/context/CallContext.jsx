import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useChat } from './ChatContext';
import { useSocket } from './SocketContext';
import { useEncryption } from './EncryptionContext';

const CallContext = createContext(null);

const createCallId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const supportsCallEncryption = () => (
  typeof TransformStream === 'function' &&
  Boolean(globalThis.crypto?.subtle) &&
  typeof RTCRtpSender !== 'undefined' &&
  typeof RTCRtpReceiver !== 'undefined' &&
  typeof RTCRtpSender.prototype.createEncodedStreams === 'function' &&
  typeof RTCRtpReceiver.prototype.createEncodedStreams === 'function'
);

const attachFrameEncryption = (endpoint, mediaKey, direction) => {
  const { readable, writable } = endpoint.createEncodedStreams();
  const transform = new TransformStream({
    async transform(frame, controller) {
      try {
        const frameData = new Uint8Array(frame.data);
        if (direction === 'encrypt') {
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, mediaKey, frameData);
          const encryptedFrame = new Uint8Array(iv.length + ciphertext.byteLength);
          encryptedFrame.set(iv, 0);
          encryptedFrame.set(new Uint8Array(ciphertext), iv.length);
          frame.data = encryptedFrame.buffer;
        } else {
          if (frameData.length < 28) return;
          const iv = frameData.subarray(0, 12);
          const ciphertext = frameData.subarray(12);
          frame.data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, mediaKey, ciphertext);
        }
        controller.enqueue(frame);
      } catch {
        // Drop frames that fail authentication rather than passing ciphertext to a decoder.
      }
    },
  });
  readable.pipeThrough(transform).pipeTo(writable).catch(() => {});
};

export const CallProvider = ({ children }) => {
  const { socket, onlineUsers } = useSocket();
  const { user } = useAuth();
  const { users, recordMissedCall } = useChat();
  const { createCallKey, unwrapCallKey } = useEncryption();
  const [call, setCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callError, setCallError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const callRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const earlyCandidatesRef = useRef(new Map());
  const ringTimeoutRef = useRef(null);

  const clearCall = useCallback((notify = false, eventName = 'call:end') => {
    const activeCall = callRef.current;
    if (notify && activeCall && socket) {
      socket.emit(eventName, { to: activeCall.peerId, callId: activeCall.callId });
    }
    peerRef.current?.close();
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    ringTimeoutRef.current = null;
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
    earlyCandidatesRef.current.clear();
    callRef.current = null;
    setCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setCameraEnabled(true);
  }, [socket]);

  const makePeerConnection = useCallback((activeCall, stream, mediaKey) => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      encodedInsertableStreams: true,
    });
    peerRef.current = peer;
    stream.getTracks().forEach((track) => {
      const sender = peer.addTrack(track, stream);
      attachFrameEncryption(sender, mediaKey, 'encrypt');
    });
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit('call:ice-candidate', {
          to: activeCall.peerId,
          callId: activeCall.callId,
          candidate: event.candidate,
        });
      }
    };
    peer.ontrack = (event) => {
      attachFrameEncryption(event.receiver, mediaKey, 'decrypt');
      setRemoteStream(event.streams[0]);
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
        setCall((current) => current?.callId === activeCall.callId ? { ...current, status: 'connected' } : current);
      } else if (peer.connectionState === 'failed') {
        setCallError('The call could not connect. Check your network and try again.');
        clearCall(true);
      }
    };
    return peer;
  }, [clearCall, socket]);

  const startCall = useCallback(async (target, callType = 'audio') => {
    if (!target?._id || target.isGroup || callRef.current) return;
    setCallError('');
    if (!onlineUsers.includes(target._id)) {
      try {
        await recordMissedCall(target._id, callType);
        setCallError(`${target.fullName} is offline. The missed call was added to this conversation.`);
      } catch (error) {
        setCallError(error.message || 'Could not record the missed call.');
      }
      return;
    }
    try {
      if (!supportsCallEncryption()) {
        throw new Error('This browser does not support end-to-end encrypted calls. Use a current Chrome, Edge, or Firefox release.');
      }
      const { mediaKey, wrappedMediaKey } = await createCallKey(target.encryptionPublicKey);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video' ? { facingMode: 'user' } : false,
      });
      const nextCall = {
        callId: createCallId(),
        peerId: target._id,
        displayName: target.fullName,
        callType,
        direction: 'outgoing',
        status: 'ringing',
      };
      callRef.current = nextCall;
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCall(nextCall);
      const peer = makePeerConnection(nextCall, stream, mediaKey);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket?.emit('call:offer', { to: target._id, callId: nextCall.callId, callType, offer, wrappedMediaKey });
      ringTimeoutRef.current = setTimeout(async () => {
        if (callRef.current?.callId !== nextCall.callId) return;
        clearCall(true);
        try {
          await recordMissedCall(target._id, callType);
          setCallError(`No answer from ${target.fullName}. The missed call was added to this conversation.`);
        } catch (error) {
          setCallError(error.message || 'Could not record the missed call.');
        }
      }, 30_000);
    } catch (error) {
      clearCall(false);
      setCallError(error.name === 'NotAllowedError'
        ? 'Allow microphone and camera access to start a call.'
        : error.message || 'Could not start the call.');
    }
  }, [clearCall, createCallKey, makePeerConnection, onlineUsers, recordMissedCall, socket]);

  const acceptCall = useCallback(async () => {
    const incomingCall = callRef.current;
    if (!incomingCall || incomingCall.direction !== 'incoming') return;
    setCallError('');
    try {
      if (!supportsCallEncryption()) {
        throw new Error('This browser does not support end-to-end encrypted calls. Use a current Chrome, Edge, or Firefox release.');
      }
      const mediaKey = await unwrapCallKey(incomingCall.wrappedMediaKey);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.callType === 'video' ? { facingMode: 'user' } : false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      const peer = makePeerConnection(incomingCall, stream, mediaKey);
      await peer.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      for (const candidate of pendingCandidatesRef.current) await peer.addIceCandidate(candidate);
      pendingCandidatesRef.current = [];
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      const connectedCall = { ...incomingCall, direction: 'active', status: 'connecting' };
      callRef.current = connectedCall;
      setCall(connectedCall);
      socket?.emit('call:answer', { to: incomingCall.peerId, callId: incomingCall.callId, answer });
    } catch (error) {
      socket?.emit('call:decline', { to: incomingCall.peerId, callId: incomingCall.callId });
      clearCall(false);
      setCallError(error.name === 'NotAllowedError'
        ? 'Allow microphone and camera access to answer.'
        : error.message || 'Could not answer the call.');
    }
  }, [clearCall, makePeerConnection, socket, unwrapCallKey]);

  const declineCall = useCallback(() => clearCall(true, 'call:decline'), [clearCall]);
  const endCall = useCallback(() => clearCall(true), [clearCall]);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !nextMuted; });
    setIsMuted(nextMuted);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const nextEnabled = !cameraEnabled;
    localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = nextEnabled; });
    setCameraEnabled(nextEnabled);
  }, [cameraEnabled]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleOffer = ({ from, callId, callType, offer, wrappedMediaKey }) => {
      if (typeof wrappedMediaKey !== 'string' || wrappedMediaKey.length > 1024) {
        socket.emit('call:decline', { to: from, callId });
        setCallError('This call is missing its end-to-end encryption key.');
        return;
      }
      if (callRef.current) {
        socket.emit('call:busy', { to: from, callId });
        return;
      }
      const earlyCandidates = earlyCandidatesRef.current.get(callId);
      const target = users.find((entry) => entry._id === from);
      const incomingCall = {
        callId,
        peerId: from,
        displayName: target?.fullName || 'RainChat user',
        callType,
        direction: 'incoming',
        status: 'incoming',
        offer,
        wrappedMediaKey,
      };
      pendingCandidatesRef.current = earlyCandidates?.from === from ? earlyCandidates.candidates : [];
      earlyCandidatesRef.current.delete(callId);
      callRef.current = incomingCall;
      setCall(incomingCall);
    };
    const handleAnswer = async ({ from, callId, answer }) => {
      if (callRef.current?.callId !== callId || callRef.current.peerId !== from || !peerRef.current) return;
      try {
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        for (const candidate of pendingCandidatesRef.current) await peerRef.current.addIceCandidate(candidate);
        pendingCandidatesRef.current = [];
        setCall((current) => current?.callId === callId ? { ...current, status: 'connecting' } : current);
      } catch (error) {
        setCallError(error.message || 'Could not establish the call.');
        clearCall(true);
      }
    };
    const handleCandidate = async ({ from, callId, candidate }) => {
      if (!candidate) return;
      if (!callRef.current) {
        const queued = earlyCandidatesRef.current.get(callId);
        if (queued && queued.from !== from) return;
        if (!queued && earlyCandidatesRef.current.size >= 8) {
          earlyCandidatesRef.current.delete(earlyCandidatesRef.current.keys().next().value);
        }
        if (!queued || queued.candidates.length < 32) {
          earlyCandidatesRef.current.set(callId, {
            from,
            candidates: [...(queued?.candidates || []), new RTCIceCandidate(candidate)],
          });
        }
        return;
      }
      if (callRef.current.callId !== callId || callRef.current.peerId !== from) return;
      if (peerRef.current?.remoteDescription) {
        try {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('Could not add call network candidate:', error);
        }
      } else {
        pendingCandidatesRef.current.push(new RTCIceCandidate(candidate));
      }
    };
    const handleDecline = ({ from, callId }) => {
      if (callRef.current?.callId !== callId || callRef.current.peerId !== from) return;
      clearCall(false);
      setCallError('The call was declined.');
    };
    const handleEnd = ({ from, callId }) => {
      if (callRef.current?.callId !== callId || callRef.current.peerId !== from) return;
      clearCall(false);
    };
    const handleUnavailable = ({ callId }) => {
      if (callRef.current?.callId !== callId) return;
      const missedCall = callRef.current;
      clearCall(false);
      recordMissedCall(missedCall.peerId, missedCall.callType)
        .then(() => setCallError('That user is offline. The missed call was added to this conversation.'))
        .catch((error) => setCallError(error.message || 'Could not record the missed call.'));
    };
    const handleBusy = ({ from, callId }) => {
      if (callRef.current?.callId !== callId || callRef.current.peerId !== from) return;
      clearCall(false);
      setCallError('That user is already on another call.');
    };

    socket.on('call:offer', handleOffer);
    socket.on('call:answer', handleAnswer);
    socket.on('call:ice-candidate', handleCandidate);
    socket.on('call:decline', handleDecline);
    socket.on('call:end', handleEnd);
    socket.on('call:unavailable', handleUnavailable);
    socket.on('call:busy', handleBusy);
    return () => {
      socket.off('call:offer', handleOffer);
      socket.off('call:answer', handleAnswer);
      socket.off('call:ice-candidate', handleCandidate);
      socket.off('call:decline', handleDecline);
      socket.off('call:end', handleEnd);
      socket.off('call:unavailable', handleUnavailable);
      socket.off('call:busy', handleBusy);
    };
  }, [socket, users, clearCall, recordMissedCall]);

  useEffect(() => () => clearCall(false), [clearCall, user?._id]);

  return (
    <CallContext.Provider value={{ call, localStream, remoteStream, callError, clearCallError: () => setCallError(''), isMuted, cameraEnabled, startCall, acceptCall, declineCall, endCall, toggleMute, toggleCamera }}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within a CallProvider');
  return context;
};