<template>
  <div class="videos">
      <div class="remote">
        <video :src-object.prop.camel="remoteStream" autoplay playsinline></video>
        <div class="preview">
          <video :src-object.prop.camel="localStream" autoplay playsinline muted></video>
        </div>
        <div class="controls">
          <button class="btn" @click="toggleMic">{{ 
            micEnabled ? 'Mute mic' : 'Unmute mic'
          }}</button>
          <button class="btn" @click="endMeeting">End</button>
        </div>
      </div>
  </div>
</template>

<script setup>
import '~~/style.css'

import { ref } from 'vue' 
const localStream = ref(null);
const remoteStream = ref(null);
const micEnabled = ref(false);

const cProps = defineProps({
  offerId: null,
  callId: null
});

// Global State
let peerConnection = null;
const { $firestore: firestore } = useNuxtApp();

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};

async function toggleMic () {
  const audioTracks = localStream.value.getAudioTracks()
  if (audioTracks && audioTracks.length > 0) {
    audioTracks[0].enabled = !audioTracks[0].enabled;
    micEnabled.value = !!audioTracks[0].enabled;
  }
}

async function endMeeting () {
  if (localStream.value) {
    localStream.value.getTracks().forEach((track) => track.stop());
  }
  if (remoteStream.value) {
    remoteStream.value.getTracks().forEach((track) => track.stop());
  }
  setTimeout(() => {
    console.log('safe to destruct');
  }, 2000);
}

// 1. Setup media sources
async function startMedia () {
    localStream.value = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    remoteStream.value = new MediaStream();

    // Push tracks from local stream to peer connection
    localStream.value.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream.value);
    });

    // Pull tracks from remote stream, add to video stream
    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.value.addTrack(track);
        });
    };
};

// 2. Create an offer
async function makeOffer () {
    // Reference Firestore collections for signaling
    const callDoc = firestore.collection('calls').doc(cProps.offerId);
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');

    // Get candidates for caller, save to db
    peerConnection.onicecandidate = (event) => {
        event.candidate && offerCandidates.add(event.candidate.toJSON());
    };

    // Create offer
    const offerDescription = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offerDescription);

    const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
    };

    await callDoc.set({ offer });

    // Listen for remote answer
    callDoc.onSnapshot((snapshot) => {
        const data = snapshot.data();
        if (!peerConnection.currentRemoteDescription && data?.answer) {
            const answerDescription = new RTCSessionDescription(data.answer);
            peerConnection.setRemoteDescription(answerDescription);
        }
    });

    // When answered, add candidate to peer connection
    answerCandidates.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                peerConnection.addIceCandidate(candidate);
            }
        });
    });

    // hangupButton.disabled = false;
};

 // 3. Answer the call with the unique ID
  async function answerCall () {
    const callId = cProps.callId;
    console.log({ callId });
    const callDoc = firestore.collection('calls').doc(callId);
    const answerCandidates = callDoc.collection('answerCandidates');
    const offerCandidates = callDoc.collection('offerCandidates');

    peerConnection.onicecandidate = (event) => {
        event.candidate && answerCandidates.add(event.candidate.toJSON());
    };
    console.log(callDoc);
    
    const callData = (await callDoc.get()).data();
    console.log(callData);

    const offerDescription = callData.offer;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answerDescription);

    const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
    };

    await callDoc.update({ answer });

    offerCandidates.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            console.log(change);
            if (change.type === 'added') {
                let data = change.doc.data();
                peerConnection.addIceCandidate(new RTCIceCandidate(data));
            }
        });
    });
};

onMounted(() => {
  peerConnection = new RTCPeerConnection(servers)

  startMedia(peerConnection);
  setTimeout(() => {
    if (cProps.offerId) {
      makeOffer();
    } else if (cProps.callId) {
      answerCall();
    }
  }, 2000);
});

</script>