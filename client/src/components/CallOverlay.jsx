import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, LockKeyhole } from 'lucide-react';
import { useCall } from '../context/CallContext';

export const CallOverlay = () => {
  const {
    call,
    localStream,
    remoteStream,
    callError,
    clearCallError,
    isMuted,
    cameraEnabled,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useCall();
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream, remoteStream, call?.callType]);

  if (callError && !call) {
    return (
      <div className="call-error-toast" role="status">
        <span>{callError}</span>
        <button type="button" onClick={clearCallError} aria-label="Dismiss call message">×</button>
      </div>
    );
  }
  if (!call) return null;

  const isIncoming = call.direction === 'incoming';
  const isVideo = call.callType === 'video';

  return (
    <section className={`call-overlay ${isVideo && !isIncoming ? 'video-call' : ''}`} role="dialog" aria-modal="true" aria-label={`${isIncoming ? 'Incoming' : 'Active'} ${call.callType} call`}>
      {isVideo && !isIncoming && (
        <>
          <video ref={remoteVideoRef} className="call-remote-video" autoPlay playsInline />
          <video ref={localVideoRef} className="call-local-video" autoPlay muted playsInline />
        </>
      )}
      {!isVideo && <audio ref={remoteAudioRef} autoPlay />}
      <div className="call-overlay-content">
        <div className="call-avatar-mark">{call.displayName.slice(0, 1).toUpperCase()}</div>
        <h2>{call.displayName}</h2>
        <p>{isIncoming ? `Incoming ${call.callType} call` : call.status === 'connected' ? 'Connected' : call.status === 'ringing' ? 'Ringing…' : 'Connecting…'}</p>
        <span className="call-security-label"><LockKeyhole size={13} /> End-to-end encrypted</span>
        {isIncoming ? (
          <div className="call-controls">
            <button type="button" className="call-control decline" onClick={declineCall} title="Decline call" aria-label="Decline call"><PhoneOff size={20} /></button>
            <button type="button" className="call-control accept" onClick={acceptCall} title="Answer call" aria-label="Answer call"><Phone size={20} /></button>
          </div>
        ) : (
          <div className="call-controls">
            <button type="button" className="call-control" onClick={toggleMute} title={isMuted ? 'Unmute microphone' : 'Mute microphone'} aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}>{isMuted ? <MicOff size={20} /> : <Mic size={20} />}</button>
            {isVideo && <button type="button" className="call-control" onClick={toggleCamera} title={cameraEnabled ? 'Turn camera off' : 'Turn camera on'} aria-label={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}>{cameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}</button>}
            <button type="button" className="call-control decline" onClick={endCall} title="End call" aria-label="End call"><PhoneOff size={20} /></button>
          </div>
        )}
      </div>
    </section>
  );
};