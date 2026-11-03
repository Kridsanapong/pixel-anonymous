const socket = io();

let currentRoom = null;
let myAnonymousId = null;
let myAgentIndex = 0;
let agents = new Map(); // เก็บข้อมูล agents ทั้งหมด

// DOM Elements
const lobby = document.getElementById('lobby');
const chatRoom = document.getElementById('chatRoom');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const chatIdInput = document.getElementById('chatIdInput');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const userCount = document.getElementById('userCount');
const agentsContainer = document.getElementById('agentsContainer');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const keepMessagesBtn = document.getElementById('keepMessagesBtn');

// รับ anonymousId จาก server
socket.on('your-id', (id) => {
  myAnonymousId = id;
  console.log('🎮 My anonymous ID:', myAnonymousId);
});

// สร้างห้องใหม่
createRoomBtn.addEventListener('click', async () => {
  const response = await fetch('/create-room', { method: 'POST' });
  const data = await response.json();
  alert(`🏢 สร้างออฟฟิศสำเร็จ!\n\nรหัสห้อง: ${data.chatId}\n\nแชร์รหัสนี้ให้เพื่อนเพื่อเข้าห้อง\n(ห้องจะอยู่ 24 ชม.)`);
  joinRoom(data.chatId);
});

// เข้าห้อง
joinRoomBtn.addEventListener('click', () => {
  const chatId = chatIdInput.value.trim().toUpperCase();
  if (chatId.length !== 8) {
    alert('รหัสห้องต้องมี 8 ตัวอักษร');
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

// รับข้อความใหม่
socket.on('new-message', (message) => {
  displayMessage(message);
  animateAgentMessage(message);
});

// รับประวัติแชท
socket.on('chat-history', (messages) => {
  messagesContainer.innerHTML = '';
  messages.forEach(displayMessage);
});

// แสดงข้อความ
function displayMessage(message) {
  const messageEl = document.createElement('div');
  const isMine = message.sender === myAnonymousId;
  messageEl.className = `message ${isMine ? 'sent' : 'received'}`;
  messageEl.dataset.messageId = message.id;
  
  const senderEl = document.createElement('div');
  senderEl.className = 'message-sender';
  senderEl.textContent = isMine ? '🎮 คุณ' : `👾 ${message.sender}`;
  
  const contentEl = document.createElement('div');
  contentEl.className = 'message-content';
  contentEl.textContent = message.content;
  
  const timeEl = document.createElement('div');
  timeEl.className = 'message-time';
  timeEl.textContent = new Date(message.timestamp).toLocaleTimeString('th-TH');
  
  messageEl.appendChild(senderEl);
  messageEl.appendChild(contentEl);
  messageEl.appendChild(timeEl);
  
  messagesContainer.appendChild(messageEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ✅ Animate Pixel Agent
function animateAgentMessage(message) {
  const agentEl = document.querySelector(`[data-agent-id="${message.sender}"]`);
  if (!agentEl) return;
  
  // แสดง speech bubble
  const speechBubble = agentEl.querySelector('.agent-speech-bubble');
  speechBubble.textContent = message.content;
  speechBubble.classList.add('show');
  
  // เดินไปกลางห้อง
  agentEl.classList.add('agent-walking');
  const randomX = Math.random() * 60 + 20; // 20-80%
  const randomY = Math.random() * 60 + 20;
  agentEl.style.left = randomX + '%';
  agentEl.style.top = randomY + '%';
  
  // ซ่อน speech bubble หลัง 3 วินาที
  setTimeout(() => {
    speechBubble.classList.remove('show');
    agentEl.classList.remove('agent-walking');
  }, 3000);
}

// สร้าง/อัปเดต Agent
function updateAgents(userCount) {
  agentsContainer.innerHTML = '';
  agents.clear();
  
  // สร้าง agents ตามจำนวนผู้ใช้
  for (let i = 0; i < userCount; i++) {
    const agentId = `agent_${i}`;
    const agentEl = document.createElement('div');
    agentEl.className = `agent-character agent-${i % 6}`;
    agentEl.dataset.agentId = agentId;
    
    // สุ่มตำแหน่งเริ่มต้น
    const randomX = Math.random() * 70 + 10;
    const randomY = Math.random() * 70 + 10;
    agentEl.style.left = randomX + '%';
    agentEl.style.top = randomY + '%';
    
    // Speech bubble
    const speechBubble = document.createElement('div');
    speechBubble.className = 'agent-speech-bubble';
    agentEl.appendChild(speechBubble);
    
    // Pixel art body (simple square for now)
    const sprite = document.createElement('div');
    sprite.className = 'agent-sprite';
    agentEl.appendChild(sprite);
    
    agentsContainer.appendChild(agentEl);
    agents.set(agentId, agentEl);
    
    // Idle animation (สุ่มเดินไปมา)
    setInterval(() => {
      if (Math.random() > 0.7) { // 30% chance
        const newX = Math.random() * 70 + 10;
        const newY = Math.random() * 70 + 10;
        agentEl.style.left = newX + '%';
        agentEl.style.top = newY + '%';
      }
    }, 5000 + Math.random() * 5000);
  }
}

// จำนวนผู้ใช้
socket.on('user-count', (count) => {
  userCount.textContent = count;
  updateAgents(count);
});

// เก็บข้อความ
let keepMessages = false;
keepMessagesBtn.addEventListener('click', () => {
  keepMessages = !keepMessages;
  socket.emit('toggle-keep-messages', keepMessages);
  keepMessagesBtn.textContent = keepMessages ? '💾 เก็บแล้ว' : '💾 เก็บแชท';
  keepMessagesBtn.style.background = keepMessages ? '#00ff00' : '#e94560';
});

// ออกจากห้อง
leaveRoomBtn.addEventListener('click', () => {
  socket.emit('leave-room');
  chatRoom.classList.remove('active');
  lobby.classList.add('active');
  messagesContainer.innerHTML = '';
  agentsContainer.innerHTML = '';
  currentRoom = null;
  chatIdInput.value = '';
  keepMessages = false;
  keepMessagesBtn.textContent = '💾 เก็บแชท';
  keepMessagesBtn.style.background = '#e94560';
});

// ห้องถูกลบ
socket.on('room-deleted', () => {
  alert(' ห้องนี้หมดอายุแล้ว (24 ชม.)');
  chatRoom.classList.remove('active');
  lobby.classList.add('active');
  currentRoom = null;
  chatIdInput.value = '';
});

socket.on('error', (message) => {
  alert('❌ ' + message);
});