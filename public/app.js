const socket = io();

let currentRoom = null;
let myAnonymousId = null;
let peerConnection = null;
let localStream = null;
let isCalling = false;

const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

// DOM Elements
const lobby = document.getElementById('lobby');
const chatRoom = document.getElementById('chatRoom');
const callScreen = document.getElementById('callScreen');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const chatIdInput = document.getElementById('chatIdInput');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const userCount = document.getElementById('userCount');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const callBtn = document.getElementById('callBtn');
const videoCallBtn = document.getElementById('videoCallBtn');
const keepMessagesBtn = document.getElementById('keepMessagesBtn');
const endCallBtn = document.getElementById('endCallBtn');
const muteBtn = document.getElementById('muteBtn');

// ✨ รับ anonymousId จาก server เมื่อเข้าห้อง
socket.on('your-id', (id) => {
  myAnonymousId = id;
  console.log('🎮 My anonymous ID:', myAnonymousId);
});

// สร้างห้องใหม่
createRoomBtn.addEventListener('click', async () => {
  const response = await fetch('/create-room', { method: 'POST' });
  const data = await response.json();
  alert(`สร้างห้องสำเร็จ!\n\n🎮 Chat ID: ${data.chatId}\n\nแชร์ ID นี้ให้เพื่อนเพื่อเข้าห้อง`);
  joinRoom(data.chatId);
});

// เข้าห้อง
joinRoomBtn.addEventListener('click', () => {
  const chatId = chatIdInput.value.trim().toUpperCase();
  if (chatId.length !== 8) {
    alert('Chat ID ต้องมี 8 ตัวอักษร');
    return;
  }
  joinRoom(chatId);
});

async function joinRoom(chatId) {
  const response = await fetch(`/check-room/${chatId}`);
  const data = await response.json();
  
  if (!data.exists) {
    alert('❌ ไม่พบห้องนี้');
    return;
  }
  
  currentRoom = chatId;
  roomIdDisplay.textContent = chatId;
  socket.emit('join-room', chatId);
  
  lobby.classList.remove('active');
  chatRoom.classList.add('active');
}

// ส่งข้อความ
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const content = messageInput.value.trim();
  if (!content) return;
  
  socket.emit('send-message', {
    type: 'text',
    content: content
  });
  
  messageInput.value = '';
}

// แนบไฟล์
attachBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  if (file.size > 10 * 1024 * 1024) {
    alert('❌ ไฟล์ใหญ่เกินไป (สูงสุด 10MB)');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (event) => {
    const base64 = event.target.result;
    const type = file.type.startsWith('image/') ? 'image' : 'video';
    
    socket.emit('send-message', {
      type: type,
      content: base64
    });
  };
  reader.readAsDataURL(file);
  
  // รีเซ็ต input เพื่อให้เลือกไฟล์เดิมได้อีก
  fileInput.value = '';
});

// รับข้อความใหม่
socket.on('new-message', (message) => {
  displayMessage(message);
});

// รับประวัติแชท
socket.on('chat-history', (messages) => {
  messagesContainer.innerHTML = '';
  messages.forEach(displayMessage);
});

// ✨ แสดงข้อความ - แยกฝั่งซ้าย-ขวาตาม sender
function displayMessage(message) {
  const messageEl = document.createElement('div');
  
  // ตรวจสอบว่าข้อความเป็นของเราหรือของคนอื่น
  const isMine = message.sender === myAnonymousId;
  messageEl.className = `message ${isMine ? 'sent' : 'received'}`;
  messageEl.dataset.messageId = message.id;
  
  // ชื่อผู้ส่ง
  const senderEl = document.createElement('div');
  senderEl.className = 'message-sender';
  senderEl.textContent = isMine ? '🎮 คุณ' : `👾 ${message.sender}`;
  
  // เนื้อหา
  const contentEl = document.createElement('div');
  contentEl.className = 'message-content';
  
  if (message.type === 'text') {
    contentEl.textContent = message.content;
  } else if (message.type === 'image') {
    const img = document.createElement('img');
    img.src = message.content;
    contentEl.appendChild(img);
  } else if (message.type === 'video') {
    const video = document.createElement('video');
    video.src = message.content;
    video.controls = true;
    contentEl.appendChild(video);
  }
  
  // เวลา
  const timeEl = document.createElement('div');
  timeEl.className = 'message-time';
  timeEl.textContent = new Date(message.timestamp).toLocaleTimeString('th-TH');
  
  messageEl.appendChild(senderEl);
  messageEl.appendChild(contentEl);
  messageEl.appendChild(timeEl);
  
  messagesContainer.appendChild(messageEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ลบข้อความ
socket.on('message-deleted', (messageId) => {
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (messageEl) messageEl.remove();
});

// จำนวนผู้ใช้
socket.on('user-count', (count) => {
  userCount.textContent = count;
});

socket.on('user-joined', (userId) => {
  console.log('👤 User joined:', userId);
});

socket.on('user-left', (userId) => {
  console.log('👋 User left:', userId);
});

// เก็บข้อความ
let keepMessages = false;
keepMessagesBtn.addEventListener('click', () => {
  keepMessages = !keepMessages;
  socket.emit('toggle-keep-messages', keepMessages);
  keepMessagesBtn.textContent = keepMessages ? '💾 เก็บแล้ว' : '💾 เก็บแชท';
  keepMessagesBtn.style.background = keepMessages ? '#00ff00' : '#e94560';
  keepMessagesBtn.style.color = keepMessages ? '#000' : '#fff';
});

// ✨ ออกจากห้อง - เคลียร์ Chat ID ด้วย
leaveRoomBtn.addEventListener('click', () => {
  socket.emit('leave-room');
  chatRoom.classList.remove('active');
  lobby.classList.add('active');
  messagesContainer.innerHTML = '';
  currentRoom = null;
  
  // ✨ เคลียร์ช่อง Chat ID
  chatIdInput.value = '';
  
  // รีเซ็ตโหมดเก็บข้อความ
  keepMessages = false;
  keepMessagesBtn.textContent = '💾 เก็บแชท';
  keepMessagesBtn.style.background = '#e94560';
  keepMessagesBtn.style.color = '#fff';
});

// โทร (Voice Call)
callBtn.addEventListener('click', () => startCall(false));
videoCallBtn.addEventListener('click', () => startCall(true));

async function startCall(withVideo) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo
    });
    
    document.getElementById('localVideo').srcObject = localStream;
    isCalling = true;
    chatRoom.classList.remove('active');
    callScreen.classList.add('active');
    
  } catch (error) {
    alert('❌ ไม่สามารถเข้าถึงกล้อง/ไมค์ได้');
    console.error(error);
  }
}

endCallBtn.addEventListener('click', () => {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  isCalling = false;
  callScreen.classList.remove('active');
  chatRoom.classList.add('active');
});

muteBtn.addEventListener('click', () => {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    muteBtn.textContent = audioTrack.enabled ? '🔇 Mute' : '🔊 Unmute';
  }
});

// ห้องถูกลบ
socket.on('room-deleted', () => {
  alert('🚪 ห้องนี้ถูกปิดแล้ว');
  chatRoom.classList.remove('active');
  lobby.classList.add('active');
  currentRoom = null;
  chatIdInput.value = ''; // ✨ เคลียร์ช่อง Chat ID
});

socket.on('error', (message) => {
  alert('❌ ' + message);
});