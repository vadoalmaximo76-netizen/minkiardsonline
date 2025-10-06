import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../lib/socket';
import { useGameState } from '../lib/stores/useGameState';
import { Button } from './ui/button';
import { Mic, MicOff } from 'lucide-react';

interface PeerConnection {
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
};

export const VoiceChat: React.FC = () => {
  const { gameId, playerName } = useGameState();
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    if (!gameId || !playerName) return;

    const handleOffer = async (data: { fromPlayer: string; offer: RTCSessionDescriptionInit }) => {
      if (data.fromPlayer === playerName || !isActive) return;
      
      console.log(`🎤 Received offer from ${data.fromPlayer}`);

      let peerConnection = peerConnectionsRef.current.get(data.fromPlayer)?.connection;
      
      if (!peerConnection) {
        peerConnection = createPeerConnection(data.fromPlayer);
      }

      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('webrtc-answer', {
          gameId,
          targetPlayerId: data.fromPlayer,
          answer: answer,
          fromPlayer: playerName
        });
        
        console.log(`🎤 Sent answer to ${data.fromPlayer}`);
      } catch (error) {
        console.error('🎤 Error handling offer:', error);
      }
    };

    const handleAnswer = async (data: { fromPlayer: string; answer: RTCSessionDescriptionInit }) => {
      console.log(`🎤 Received answer from ${data.fromPlayer}`);

      const peerConnection = peerConnectionsRef.current.get(data.fromPlayer)?.connection;
      if (!peerConnection) {
        console.error(`🎤 No peer connection found for ${data.fromPlayer}`);
        return;
      }

      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log(`🎤 Set remote description for ${data.fromPlayer}`);
      } catch (error) {
        console.error('🎤 Error handling answer:', error);
      }
    };

    const handleIceCandidate = async (data: { fromPlayer: string; candidate: RTCIceCandidateInit }) => {
      console.log(`🎤 Received ICE candidate from ${data.fromPlayer}`);

      const peerConnection = peerConnectionsRef.current.get(data.fromPlayer)?.connection;
      if (!peerConnection) {
        console.error(`🎤 No peer connection found for ${data.fromPlayer}`);
        return;
      }

      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log(`🎤 Added ICE candidate from ${data.fromPlayer}`);
      } catch (error) {
        console.error('🎤 Error adding ICE candidate:', error);
      }
    };

    const handleUserJoin = async (data: { playerId: string }) => {
      if (data.playerId === playerName || !isActive) return;
      
      console.log(`🎤 User ${data.playerId} joined voice chat, creating offer...`);

      const peerConnection = createPeerConnection(data.playerId);

      try {
        const offer = await peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false
        });
        
        await peerConnection.setLocalDescription(offer);
        
        socket.emit('webrtc-offer', {
          gameId,
          targetPlayerId: data.playerId,
          offer: offer,
          fromPlayer: playerName
        });
        
        console.log(`🎤 Sent offer to ${data.playerId}`);
      } catch (error) {
        console.error('🎤 Error creating offer:', error);
      }
    };

    const handleUserLeave = (data: { playerId: string }) => {
      console.log(`🎤 User ${data.playerId} left voice chat`);

      const peer = peerConnectionsRef.current.get(data.playerId);
      if (peer) {
        peer.connection.close();
        peerConnectionsRef.current.delete(data.playerId);
      }

      const audioElement = audioElementsRef.current.get(data.playerId);
      if (audioElement) {
        audioElement.srcObject = null;
        audioElement.remove();
        audioElementsRef.current.delete(data.playerId);
      }
    };

    const handleExisting = async (data: { participants: string[] }) => {
      console.log(`🎤 Received existing users:`, data.participants);
      
      for (const participantId of data.participants) {
        if (participantId !== playerName) {
          await handleUserJoin({ playerId: participantId });
        }
      }
    };

    // Handle incoming WebRTC signaling events
    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('webrtc-ice-candidate', handleIceCandidate);
    socket.on('voice-chat-user-joined', handleUserJoin);
    socket.on('voice-chat-user-left', handleUserLeave);
    socket.on('voice-chat-existing-users', handleExisting);

    return () => {
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleIceCandidate);
      socket.off('voice-chat-user-joined', handleUserJoin);
      socket.off('voice-chat-user-left', handleUserLeave);
      socket.off('voice-chat-existing-users', handleExisting);
    };
  }, [gameId, playerName, isActive]);

  useEffect(() => {
    if (isActive && gameId && playerName) {
      socket.emit('voice-chat-join', { gameId, playerName });
      console.log('🎤 Emitted voice-chat-join after handlers registered');
    }
  }, [isActive, gameId, playerName]);

  const startVoiceChat = async () => {
    try {
      console.log('🎤 Starting voice chat...');
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false
      });

      localStreamRef.current = stream;
      setIsActive(true);
      
      console.log('🎤 Voice chat started successfully');
    } catch (error) {
      console.error('🎤 Error accessing microphone:', error);
      alert('Non è possibile accedere al microfono. Controlla i permessi del browser.');
    }
  };

  const stopVoiceChat = () => {
    console.log('🎤 Stopping voice chat...');

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach((peer, peerId) => {
      peer.connection.close();
    });
    peerConnectionsRef.current.clear();

    // Remove all audio elements
    audioElementsRef.current.forEach((audio) => {
      audio.srcObject = null;
      audio.remove();
    });
    audioElementsRef.current.clear();

    setIsActive(false);

    // Notify server that we left voice chat
    socket.emit('voice-chat-leave', { gameId, playerName });
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const createPeerConnection = (peerId: string): RTCPeerConnection => {
    console.log(`🎤 Creating peer connection for ${peerId}`);
    
    const peerConnection = new RTCPeerConnection(ICE_SERVERS);

    // Add local stream to connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🎤 Sending ICE candidate to ${peerId}`);
        socket.emit('webrtc-ice-candidate', {
          gameId,
          targetPlayerId: peerId,
          candidate: event.candidate,
          fromPlayer: playerName
        });
      }
    };

    // Handle incoming audio stream
    peerConnection.ontrack = (event) => {
      console.log(`🎤 Received audio stream from ${peerId}`);
      const remoteStream = event.streams[0];
      
      let audioElement = audioElementsRef.current.get(peerId);
      if (!audioElement) {
        audioElement = document.createElement('audio');
        audioElement.autoplay = true;
        audioElementsRef.current.set(peerId, audioElement);
      }
      audioElement.srcObject = remoteStream;
    };

    // Handle connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`🎤 ICE connection state with ${peerId}:`, peerConnection.iceConnectionState);
    };

    peerConnectionsRef.current.set(peerId, { connection: peerConnection });
    return peerConnection;
  };

  return (
    <div className="flex gap-2">
      {!isActive ? (
        <Button
          onClick={startVoiceChat}
          className="bg-green-600 hover:bg-green-700 text-white rounded-full p-2 landscape:p-3 md:p-3 shadow-lg hover:shadow-xl transition-all duration-200"
          title="Attiva Chat Vocale"
        >
          <Mic size={16} className="landscape:w-6 landscape:h-6 md:w-6 md:h-6" />
        </Button>
      ) : (
        <>
          <Button
            onClick={toggleMute}
            className={`${isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded-full p-2 landscape:p-3 md:p-3 shadow-lg hover:shadow-xl transition-all duration-200`}
            title={isMuted ? "Attiva Microfono" : "Disattiva Microfono"}
          >
            {isMuted ? <MicOff size={16} className="landscape:w-6 landscape:h-6 md:w-6 md:h-6" /> : <Mic size={16} className="landscape:w-6 landscape:h-6 md:w-6 md:h-6" />}
          </Button>
          <Button
            onClick={stopVoiceChat}
            className="bg-red-600 hover:bg-red-700 text-white text-xs landscape:text-sm md:text-sm px-2 landscape:px-3 md:px-3 py-1 landscape:py-2 md:py-2 rounded shadow-lg hover:shadow-xl transition-all duration-200"
            title="Disconnetti Chat Vocale"
          >
            Disconnetti
          </Button>
        </>
      )}
    </div>
  );
};
