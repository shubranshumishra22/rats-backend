/**
 * Socket.IO Setup for Real-time Messaging
 * 
 * Why Socket.IO over Supabase Realtime:
 * 1. Full control over connection lifecycle
 * 2. Built-in rooms for conversation channels
 * 3. Better typing indicators and presence support
 * 4. Independent of database - more scalable
 * 5. Works with any database, not just Postgres
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const messageService = require('../services/message.service');
const prisma = require('../db/prisma');

let io = null;

/**
 * Initialize Socket.IO with the HTTP server
 */
function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: config.cors.origins,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, config.jwt.accessSecret);
      
      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, username: true, displayName: true },
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      console.error('[Socket] Auth error:', error.message);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.user.username} (${socket.id})`);

    // Join user's personal room for notifications
    socket.join(`user:${socket.user.id}`);

    // Join a conversation room
    socket.on('join:conversation', async (conversationId) => {
      try {
        // Verify user is part of this conversation
        const participant = await prisma.conversationParticipant.findUnique({
          where: {
            conversationId_userId: {
              conversationId,
              userId: socket.user.id,
            },
          },
        });

        if (!participant) {
          socket.emit('error', { message: 'Not authorized to join this conversation' });
          return;
        }

        socket.join(`conversation:${conversationId}`);
        console.log(`[Socket] ${socket.user.username} joined conversation:${conversationId}`);
      } catch (error) {
        console.error('[Socket] Error joining conversation:', error);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    // Leave a conversation room
    socket.on('leave:conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`[Socket] ${socket.user.username} left conversation:${conversationId}`);
    });

    // Send a message
    socket.on('message:send', async ({ conversationId, content }) => {
      try {
        const message = await messageService.sendMessage(
          socket.user.id,
          conversationId,
          content
        );

        // Broadcast to all participants in the conversation
        io.to(`conversation:${conversationId}`).emit('message:new', message);

        // Also notify the other user's personal room (for unread badges)
        const participants = await prisma.conversationParticipant.findMany({
          where: { conversationId },
          select: { userId: true },
        });

        participants.forEach((p) => {
          if (p.userId !== socket.user.id) {
            io.to(`user:${p.userId}`).emit('message:notification', {
              conversationId,
              message,
            });
          }
        });
      } catch (error) {
        console.error('[Socket] Error sending message:', error);
        socket.emit('error', { message: error.message || 'Failed to send message' });
      }
    });

    // Typing indicators
    socket.on('typing:start', (conversationId) => {
      socket.to(`conversation:${conversationId}`).emit('typing:update', {
        conversationId,
        userId: socket.user.id,
        username: socket.user.username,
        isTyping: true,
      });
    });

    socket.on('typing:stop', (conversationId) => {
      socket.to(`conversation:${conversationId}`).emit('typing:update', {
        conversationId,
        userId: socket.user.id,
        username: socket.user.username,
        isTyping: false,
      });
    });

    // Mark as read
    socket.on('message:read', async (conversationId) => {
      try {
        await messageService.markAsRead(socket.user.id, conversationId);
        
        // Notify other participants
        socket.to(`conversation:${conversationId}`).emit('message:read:update', {
          conversationId,
          userId: socket.user.id,
          readAt: new Date(),
        });
      } catch (error) {
        console.error('[Socket] Error marking as read:', error);
      }
    });

    // Disconnect
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] User disconnected: ${socket.user.username} (${reason})`);
    });
  });

  console.log('[Socket] Socket.IO initialized');
  return io;
}

/**
 * Get the Socket.IO instance
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}

module.exports = {
  initializeSocket,
  getIO,
};
