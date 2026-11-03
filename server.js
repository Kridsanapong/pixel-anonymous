const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static('public'));
app.use(express.json({ limit: '10mb' }));

// เก็บข้อมูลห้องแชทใน memory
const rooms = new Map();
const MAX_CHAT_DURATION = 72 * 60 * 60 * 1000; // 72 ชั่วโมง
const AUTO_DELETE_DURATION = 24 * 60 * 60 * 1000; // 24 ชั่วโมง

// สร้างห้องแชทใหม่
app.post('/create-room', (req, res) => {
  const chatId = uuidv4().substring(0, 8).toUpperCase();
  rooms.set(chatId, {
    id: chatId,
    createdAt: Date.now(),
    users: new Set(),
    messages: [],
    keepMessages: false
  });

  // ตั้งเวลาลบอัตโนมัติ (72 ชม.)
  setTimeout(() => {
    if (rooms.has(chatId)) {
      rooms.delete(chatId);
      io.to(chatId).emit('room-deleted');
    }
  }, MAX_CHAT_DURATION);

  res.json({ chatId });
});

// ตรวจสอบห้องแชท
app.get('/check-room/:chatId', (req, res) => {
  const room = rooms.get(req.params.chatId);
  res.json({ exists: !!room });
});

// Socket.io สำหรับ real-time chat
io.on('connection', (socket) => {
  let currentRoom = null;
  const anonymousId = `anon_${uuidv4().substring(0, 6)}`;

  socket.on('join-room', (chatId) => {
    const room = rooms.get(chatId);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }

    currentRoom = chatId;
    socket.join(chatId);
    room.users.add(socket.id);

    // ✨ ส่ง anonymousId กลับให้ client เพื่อให้แยกฝั่งข้อความได้
    socket.emit('your-id', anonymousId);

    // ส่งประวัติแชทให้ผู้ใช้ใหม่
    socket.emit('chat-history', room.messages);
    socket.emit('user-count', room.users.size);

    // แจ้งผู้ใช้คนอื่น
    socket.to(chatId).emit('user-joined', anonymousId);
    io.to(chatId).emit('user-count', room.users.size);
  });

  // รับข้อความ
  socket.on('send-message', (data) => {
    if (!currentRoom || !rooms.has(currentRoom)) return;

    const room = rooms.get(currentRoom);
    const message = {
      id: uuidv4(),
      sender: anonymousId,
      type: data.type,
      content: data.content,
      timestamp: Date.now()
    };

    room.messages.push(message);

    // ลบข้อความอัตโนมัติหลัง 24 ชม. (ถ้าไม่ได้เปิดโหมดเก็บ)
    if (!room.keepMessages) {
      setTimeout(() => {
        const idx = room.messages.findIndex(m => m.id === message.id);
        if (idx > -1) room.messages.splice(idx, 1);
        io.to(currentRoom).emit('message-deleted', message.id);
      }, AUTO_DELETE_DURATION);
    }

    io.to(currentRoom).emit('new-message', message);
  });

  // Toggle เก็บข้อความ
  socket.on('toggle-keep-messages', (keep) => {
    if (!currentRoom || !rooms.has(currentRoom)) return;
    rooms.get(currentRoom).keepMessages = keep;
  });

  // WebRTC signaling
  socket.on('webrtc-offer', (data) => {
    socket.to(data.target).emit('webrtc-offer', {
      offer: data.offer,
      sender: socket.id
    });
  });

  socket.on('webrtc-answer', (data) => {
    socket.to(data.target).emit('webrtc-answer', {
      answer: data.answer,
      sender: socket.id
    });
  });

  socket.on('webrtc-ice', (data) => {
    socket.to(data.target).emit('webrtc-ice', {
      candidate: data.candidate,
      sender: socket.id
    });
  });

  // ออกจากห้อง
  socket.on('leave-room', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      room.users.delete(socket.id);
      socket.to(currentRoom).emit('user-left', anonymousId);
      io.to(currentRoom).emit('user-count', room.users.size);

      // ลบห้องถ้าไม่มีคนแล้ว (รอ 5 วินาที)
      const roomId = currentRoom;
      setTimeout(() => {
        if (rooms.has(roomId) && rooms.get(roomId).users.size === 0) {
          rooms.delete(roomId);
        }
      }, 5000);
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      room.users.delete(socket.id);
      socket.to(currentRoom).emit('user-left', anonymousId);
      io.to(currentRoom).emit('user-count', room.users.size);

      const roomId = currentRoom;
      setTimeout(() => {
        if (rooms.has(roomId) && rooms.get(roomId).users.size === 0) {
          rooms.delete(roomId);
        }
      }, 5000);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Pixel Anonymous running on port ${PORT}`);
  console.log(`🌐 เปิดเบราว์เซอร์ที่: http://localhost:${PORT}`);
});