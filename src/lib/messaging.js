import { supabase } from './supabase';

// Realtime subscription manager
class MessagingRealtime {
  constructor() {
    this.subscriptions = new Map();
    this.typingStates = new Map();
  }

  // Subscribe to conversation messages
  subscribeToConversation(conversationId, callback) {
    if (this.subscriptions.has(conversationId)) {
      return this.subscriptions.get(conversationId);
    }

    const subscription = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload) => {
          // Fetch the complete message with user data
          const { data: messageWithUser } = await supabase
            .from('messages')
            .select(`
              *,
              users!messages_sender_id_fkey (
                id,
                firstname,
                surname,
                profile_picture_url
              )
            `)
            .eq('id', payload.new.id)
            .single();
            
          if (messageWithUser) {
            callback('message', messageWithUser);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to conversation:${conversationId}`);
        }
      });

    this.subscriptions.set(conversationId, subscription);
    return subscription;
  }

  unsubscribeFromConversation(conversationId) {
    const sub = this.subscriptions.get(conversationId);
    if (sub) {
      supabase.removeChannel(sub);
      this.subscriptions.delete(conversationId);
    }
  }

  cleanup() {
    this.subscriptions.forEach(sub => supabase.removeChannel(sub));
    this.subscriptions.clear();
  }
}

export const messagingRealtime = new MessagingRealtime();

// Message fetching utilities
export const messagingAPI = {
  // Get user's conversations
  async getUserConversations(userId, limit = 50) {
    try {
      // Get conversation IDs where user is a participant
      const { data: participantRecords, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, unread_count, last_read_at')
        .eq('user_id', userId);
      
      if (participantError) {
        console.error('Error getting participant records:', participantError);
        return [];
      }
      
      if (!participantRecords || participantRecords.length === 0) {
        return [];
      }
      
      const conversationIds = participantRecords.map(p => p.conversation_id);
      
      // Get conversations
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false })
        .limit(limit);
      
      if (convError) {
        console.error('Error getting conversations:', convError);
        return [];
      }
      
      // Enrich conversations with participants, last message, and unread counts
      const conversationsWithDetails = await Promise.all(
        conversations.map(async (conversation) => {
          const participantInfo = participantRecords.find(p => p.conversation_id === conversation.id);
          
          // Get all participants for this conversation
          const { data: participantsData } = await supabase
            .from('conversation_participants')
            .select(`
              users (
                id,
                email,
                firstname,
                surname,
                profile_picture_url,
                university,
                city
              )
            `)
            .eq('conversation_id', conversation.id);
          
          // Get the latest message for preview
          const { data: latestMessage } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('conversation_id', conversation.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          // Get other participants (excluding current user)
          const otherParticipants = participantsData
            ?.filter(p => p.users.id !== userId)
            .map(p => p.users) || [];
          
          // Get last message preview
          let lastMessagePreview = 'No messages yet';
          if (latestMessage?.content) {
            const preview = latestMessage.content.length > 50 
              ? latestMessage.content.substring(0, 47) + '...' 
              : latestMessage.content;
            lastMessagePreview = preview;
          }
          
          return {
            id: conversation.id,
            created_at: conversation.created_at,
            updated_at: conversation.updated_at,
            is_group: conversation.is_group,
            group_name: conversation.group_name,
            group_photo_url: conversation.group_photo_url,
            last_message_at: latestMessage?.created_at || conversation.created_at,
            last_message_preview: lastMessagePreview,
            unread_count: participantInfo?.unread_count || 0,
            last_read_at: participantInfo?.last_read_at,
            participants: otherParticipants
          };
        })
      );
      
      // Sort by last_message_at or updated_at (most recent first)
      return conversationsWithDetails.sort((a, b) => {
        const dateA = new Date(a.last_message_at || a.updated_at);
        const dateB = new Date(b.last_message_at || b.updated_at);
        return dateB - dateA;
      });
      
    } catch (error) {
      console.error('Error in getUserConversations:', error);
      return [];
    }
  },

  // Get conversation messages with pagination
  async getConversationMessages(conversationId, page = 0, pageSize = 50) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        users!messages_sender_id_fkey (
          id,
          firstname,
          surname,
          profile_picture_url
        )
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) {
      console.error('Error getting messages:', error);
      throw error;
    }

    return data || [];
  },

  // Send message
  async sendMessage(conversationId, senderId, content, messageType = 'text', fileData = null) {
    const message = {
      conversation_id: conversationId,
      sender_id: senderId,
      content: content.trim(),
      message_type: messageType,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (fileData) {
      message.file_url = fileData.url;
      message.file_name = fileData.name;
      message.file_size = fileData.size;
    }

    // Insert the message
    const { data, error } = await supabase
      .from('messages')
      .insert([message])
      .select(`
        *,
        users!messages_sender_id_fkey (
          id,
          firstname,
          surname,
          profile_picture_url
        )
      `)
      .single();

    if (error) {
      console.error('Error sending message:', error);
      throw error;
    }

    // Update conversation's updated_at and last_message_at
    try {
      await supabase
        .from('conversations')
        .update({ 
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversationId);
    } catch (updateError) {
      console.warn('Failed to update conversation timestamp:', updateError);
    }

    return data;
  },

  // Mark messages as read - FIXED (removed updated_at)
  async markAsRead(conversationId, userId) {
    try {
      // Reset unread count and update last_read_at
      const { error } = await supabase
        .from('conversation_participants')
        .update({
          last_read_at: new Date().toISOString(),
          unread_count: 0
        })
        .match({
          conversation_id: conversationId,
          user_id: userId
        });

      if (error) {
        console.error('Error marking as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error marking as read:', error);
      return false;
    }
  },

  // Get or create 1-on-1 conversation
  async getOrCreateConversation(user1Id, user2Id) {
    try {
      // First check if conversation already exists
      const existingConvId = await this.checkExistingConversation(user1Id, user2Id);
      if (existingConvId) {
        return existingConvId;
      }
      
      // Create new conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert([{
          is_group: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (convError) throw convError;
      
      // Add participants
      const participants = [
        { conversation_id: conversation.id, user_id: user1Id, joined_at: new Date().toISOString() },
        { conversation_id: conversation.id, user_id: user2Id, joined_at: new Date().toISOString() }
      ];
      
      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert(participants);
      
      if (partError) throw partError;
      
      return conversation.id;
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
      throw error;
    }
  },

  // Search users to message
  async searchUsersToMessage(currentUserId, searchQuery = '', limit = 20) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, firstname, surname, university, profile_picture_url, city')
        .neq('id', currentUserId)
        .or(`firstname.ilike.%${searchQuery}%,surname.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(limit);
      
      if (error) {
        console.error('Error searching users:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error in searchUsersToMessage:', error);
      return [];
    }
  },

  // Check if conversation already exists between two users
  async checkExistingConversation(user1Id, user2Id) {
    try {
      // Get conversations where user1 is a participant
      const { data: user1Conversations, error } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user1Id);
      
      if (error) throw error;
      
      if (!user1Conversations || user1Conversations.length === 0) {
        return null;
      }
      
      const conversationIds = user1Conversations.map(c => c.conversation_id);
      
      // Check each conversation
      for (const convId of conversationIds) {
        // Check if this is a group conversation
        const { data: conversation } = await supabase
          .from('conversations')
          .select('is_group')
          .eq('id', convId)
          .single();
        
        if (conversation?.is_group) continue;
        
        // Check if user2 is also in this conversation
        const { data: participant } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', convId)
          .eq('user_id', user2Id)
          .single();
        
        if (participant) {
          return convId;
        }
      }
      
      return null;
      
    } catch (error) {
      console.error('Error checking existing conversation:', error);
      return null;
    }
  },

  // Upload file
  async uploadFile(file, userId) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('message-attachments')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('message-attachments')
      .getPublicUrl(filePath);

    return {
      url: publicUrl,
      name: file.name,
      size: file.size,
      type: file.type
    };
  },

  // Create group chat
  async createGroupChat(userId, participantIds, groupName) {
    try {
      // Create group conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert([{
          is_group: true,
          group_name: groupName || `Group Chat`,
          group_photo_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (convError) throw convError;
      
      // Prepare participants (include creator)
      const allParticipantIds = [...new Set([userId, ...participantIds])];
      const participantRecords = allParticipantIds.map(pid => ({
        conversation_id: conversation.id,
        user_id: pid,
        joined_at: new Date().toISOString()
      }));
      
      // Add all participants
      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert(participantRecords);
      
      if (partError) throw partError;
      
      // Add welcome message
      const welcomeMessage = groupName 
        ? `Created group "${groupName}"`
        : 'Created group chat';
      
      await this.sendMessage(conversation.id, userId, welcomeMessage, 'system');
      
      return conversation.id;
    } catch (error) {
      console.error('Error creating group chat:', error);
      throw error;
    }
  },

  // Get conversation participants
  async getConversationParticipants(conversationId) {
    const { data, error } = await supabase
      .from('conversation_participants')
      .select(`
        users (
          id,
          email,
          firstname,
          surname,
          profile_picture_url,
          university,
          city
        ),
        last_read_at,
        joined_at
      `)
      .eq('conversation_id', conversationId);

    if (error) {
      console.error('Error getting participants:', error);
      throw error;
    }

    return data.map(item => ({
      ...item.users,
      last_read_at: item.last_read_at,
      joined_at: item.joined_at
    }));
  }
};