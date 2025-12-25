// lib/messaging.js - Fixed version
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
        (payload) => {
          callback('message', payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          callback('participant_update', payload.new);
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

  // Subscribe to user's conversations
  subscribeToUserConversations(userId, callback) {
    const channel = supabase.channel(`user-conversations:${userId}`);
    
    return channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        async (payload) => {
          // Check if user is in this conversation
          const { data } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('conversation_id', payload.new.id)
            .eq('user_id', userId)
            .single();

          if (data) {
            callback('conversation_update', payload.new);
          }
        }
      )
      .subscribe();
  }

  // Send typing indicator via presence
  async sendTypingIndicator(conversationId, userId, isTyping) {
    const channel = supabase.channel(`presence:${conversationId}`);
    
    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          userId,
          isTyping,
          timestamp: Date.now()
        });
      }
    });
  }

  // Cleanup
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
 // In lib/messaging.js, replace the getUserConversations function with this:

async getUserConversations(userId, limit = 50) {
  console.log('📞 [DEBUG] Calling getUserConversations for user:', userId);
  
  try {
    // FIRST: Get conversation IDs where user is a participant
    const { data: participantData, error: participantError } = await supabase
      .from('conversation_participants')
      .select('conversation_id, unread_count, last_read_at')
      .eq('user_id', userId);
    
    if (participantError) {
      console.error('❌ [DEBUG] Error getting participant data:', participantError);
      throw participantError;
    }
    
    if (!participantData || participantData.length === 0) {
      console.log('📞 [DEBUG] No conversations found for user');
      return [];
    }
    
    console.log('📞 [DEBUG] Participant data:', participantData);
    
    // Get conversation IDs
    const conversationIds = participantData.map(p => p.conversation_id);
    
    // SECOND: Get the actual conversations
    const { data: conversationsData, error: conversationsError } = await supabase
      .from('conversations')
      .select('*')
      .in('id', conversationIds)
      .order('updated_at', { ascending: false })
      .limit(limit);
    
    if (conversationsError) {
      console.error('❌ [DEBUG] Error getting conversations:', conversationsError);
      throw conversationsError;
    }
    
    console.log('📞 [DEBUG] Conversations data:', conversationsData);
    
    // THIRD: Combine data and get participants for each conversation
    const conversationsWithDetails = await Promise.all(
      conversationsData.map(async (conversation) => {
        // Find participant data for this conversation
        const participantInfo = participantData.find(p => p.conversation_id === conversation.id);
        
        // Get other participants
        const { data: otherParticipants } = await supabase
          .from('conversation_participants')
          .select(`
            users (
              id,
              firstname,
              surname,
              profile_picture_url,
              university
            )
          `)
          .eq('conversation_id', conversation.id)
          .neq('user_id', userId);
        
        // Get current user info
        const { data: currentUserData } = await supabase
          .from('users')
          .select('id, firstname, surname, profile_picture_url, university')
          .eq('id', userId)
          .single();
        
        return {
          ...conversation,
          unread_count: participantInfo?.unread_count || 0,
          last_read_at: participantInfo?.last_read_at,
          participants: [
            // Include current user
            { 
              ...currentUserData, 
              isCurrentUser: true 
            },
            // Include other participants
            ...(otherParticipants?.map(p => ({
              ...p.users,
              isCurrentUser: false
            })) || [])
          ]
        };
      })
    );
    
    console.log('✅ [DEBUG] Final conversationsWithDetails:', conversationsWithDetails);
    return conversationsWithDetails;
    
  } catch (error) {
    console.error('❌ [DEBUG] getUserConversations failed:', error);
    throw error;
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
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error getting messages:', error);
      throw error;
    }

    // Return in chronological order
    return data.reverse();
  },

  // Send message
  async sendMessage(conversationId, senderId, content, messageType = 'text', fileData = null) {
    const message = {
      conversation_id: conversationId,
      sender_id: senderId,
      content: content.trim(),
      message_type: messageType,
      created_at: new Date().toISOString()
    };

    if (fileData) {
      message.file_url = fileData.url;
      message.file_name = fileData.name;
      message.file_size = fileData.size;
    }

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

    return data;
  },

  // Mark messages as read
  async markAsRead(conversationId, userId, messageIds = []) {
    try {
      // Update participant's read status
      const { error: participantError } = await supabase
        .from('conversation_participants')
        .update({
          last_read_at: new Date().toISOString(),
          unread_count: 0
        })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (participantError) throw participantError;

      // Mark specific messages as read
      if (messageIds.length > 0) {
        const { error: messagesError } = await supabase.rpc('mark_messages_as_read', {
          p_conversation_id: conversationId,
          p_user_id: userId,
          p_message_ids: messageIds
        });

        if (messagesError) throw messagesError;
      }

      return true;
    } catch (error) {
      console.error('Error marking as read:', error);
      throw error;
    }
  },

  // Get or create 1-on-1 conversation
  async getOrCreateConversation(user1Id, user2Id) {
    try {
      const { data: conversationId, error } = await supabase.rpc('get_or_create_conversation', {
        user1_id: user1Id,
        user2_id: user2Id
      });

      if (error) throw error;
      return conversationId;
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
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
          firstname,
          surname,
          profile_picture_url,
          university
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
  }
};