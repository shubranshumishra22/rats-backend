/**
 * Message Service
 * Handles 1-to-1 real-time messaging between friends
 * 
 * Architecture Decision: Socket.IO over Supabase Realtime
 * - More control over connection lifecycle and rooms
 * - Better support for typing indicators and presence
 * - Works independently of database triggers
 * - Built-in reconnection handling
 */

const prisma = require('../db/prisma');
const { ForbiddenError, NotFoundError } = require('../errors');
const { getFriendIds } = require('./friend.service');

/**
 * Get or create a conversation between two users
 * Only allows conversations between friends
 */
const getOrCreateConversation = async (userId, otherUserId) => {
  // Verify they are friends
  const friendIds = await getFriendIds(userId);
  if (!friendIds.includes(otherUserId)) {
    throw new ForbiddenError('You can only message friends', 'NOT_FRIENDS');
  }

  // Check if conversation already exists
  const existingConversation = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: otherUserId } } },
      ],
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
      },
    },
  });

  if (existingConversation) {
    return formatConversation(existingConversation, userId);
  }

  // Create new conversation
  const conversation = await prisma.conversation.create({
    data: {
      participants: {
        create: [
          { userId },
          { userId: otherUserId },
        ],
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
      },
    },
  });

  return formatConversation(conversation, userId);
};

/**
 * Get all conversations for a user
 */
const getConversations = async (userId) => {
  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId } },
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return conversations.map((conv) => {
    const formatted = formatConversation(conv, userId);
    const lastMessage = conv.messages[0];
    
    // Get unread count
    const myParticipant = conv.participants.find((p) => p.userId === userId);
    
    return {
      ...formatted,
      lastMessage: lastMessage ? {
        id: lastMessage.id,
        content: lastMessage.content,
        senderId: lastMessage.senderId,
        createdAt: lastMessage.createdAt,
      } : null,
      lastReadAt: myParticipant?.lastReadAt,
    };
  });
};

/**
 * Get messages for a conversation with pagination
 */
const getMessages = async (userId, conversationId, options = {}) => {
  const { cursor, limit = 50 } = options;

  // Verify user is part of this conversation
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
  });

  if (!participant) {
    throw new ForbiddenError('You are not part of this conversation', 'NOT_PARTICIPANT');
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1, // Get one extra to check if there are more
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1, // Skip the cursor item
    }),
    include: {
      sender: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
    },
  });

  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, -1) : messages;

  return {
    messages: items.reverse(), // Return in chronological order
    nextCursor: hasMore ? items[0].id : null,
    hasMore,
  };
};

/**
 * Send a message
 */
const sendMessage = async (userId, conversationId, content) => {
  // Verify user is part of this conversation
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
  });

  if (!participant) {
    throw new ForbiddenError('You are not part of this conversation', 'NOT_PARTICIPANT');
  }

  // Create message and update conversation timestamp
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        content,
        conversationId,
        senderId: userId,
      },
      include: {
        sender: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);

  return message;
};

/**
 * Mark conversation as read
 */
const markAsRead = async (userId, conversationId) => {
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: { conversationId, userId },
    },
    data: { lastReadAt: new Date() },
  });
};

/**
 * Get unread message count for a user
 */
const getUnreadCount = async (userId) => {
  const participants = await prisma.conversationParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          messages: {
            where: {
              senderId: { not: userId },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  let unreadCount = 0;
  for (const p of participants) {
    const lastMessage = p.conversation.messages[0];
    if (lastMessage && lastMessage.createdAt > p.lastReadAt) {
      unreadCount++;
    }
  }

  return unreadCount;
};

// Helper to format conversation response
function formatConversation(conversation, currentUserId) {
  const otherParticipant = conversation.participants.find(
    (p) => p.userId !== currentUserId
  );

  return {
    id: conversation.id,
    otherUser: otherParticipant?.user,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

module.exports = {
  getOrCreateConversation,
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  getUnreadCount,
};
