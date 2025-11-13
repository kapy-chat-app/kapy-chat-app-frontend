import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFriendsList, Friend } from '@/hooks/friend/useFriends';
import { useAuth } from '@clerk/clerk-expo';
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import SearchInput from '@/components/ui/SearchInput';
import Button from '@/components/ui/Button';

interface CreateConversationModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateConversation: (data: any) => Promise<void>;
}

interface FriendWithClerkId extends Friend {
  clerkId: string;
}

const CreateConversationModal: React.FC<CreateConversationModalProps> = ({
  visible,
  onClose,
  onCreateConversation,
}) => {
  const [selectedUsers, setSelectedUsers] = useState<FriendWithClerkId[]>([]);
  const [conversationType, setConversationType] = useState<'private' | 'group'>('private');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === 'dark';
  const { userId } = useAuth();
  
  const { friends, loading, error, loadFriends } = useFriendsList();

  useEffect(() => {
    if (visible) {
      loadFriends(1, '', 'all');
    }
  }, [visible]);

  useEffect(() => {
    if (visible && searchText.trim()) {
      const delaySearch = setTimeout(() => {
        loadFriends(1, searchText, 'all');
      }, 300);
      return () => clearTimeout(delaySearch);
    }
  }, [searchText, visible]);

  const handleUserToggle = (user: FriendWithClerkId) => {
    setSelectedUsers(prev => {
      const isSelected = prev.find(u => u.id === user.id);
      if (isSelected) {
        const newSelected = prev.filter(u => u.id !== user.id);
        if (newSelected.length === 1) {
          setConversationType('private');
        }
        return newSelected;
      } else {
        const newSelected = [...prev, user];
        if (newSelected.length > 1) {
          setConversationType('group');
        }
        return newSelected;
      }
    });
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert(t('error'), t('conversations.createModal.errors.selectFriend'));
      return;
    }
    
    if (conversationType === 'group' && !groupName.trim()) {
      Alert.alert(t('error'), t('conversations.createModal.errors.groupName'));
      return;
    }

    setIsCreating(true);
    
    try {
      const participantClerkIds = selectedUsers
        .map(u => u.clerkId)
        .filter(id => id);
      
      if (userId && !participantClerkIds.includes(userId)) {
        participantClerkIds.unshift(userId);
      }

      console.log('Creating conversation with participants:', participantClerkIds);
      
      const conversationData = {
        type: conversationType,
        participantIds: participantClerkIds,
        name: conversationType === 'group' ? groupName.trim() : undefined,
        description: conversationType === 'group' ? groupDescription.trim() : undefined,
      };

      await onCreateConversation(conversationData);
      handleClose();
    } catch (error) {
      console.error('Failed to create conversation:', error);
      Alert.alert(t('error'), t('conversations.createModal.errors.createFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setConversationType('private');
    setGroupName('');
    setGroupDescription('');
    setSearchText('');
    onClose();
  };

  const renderContact = ({ item }: { item: FriendWithClerkId }) => {
    const isSelected = selectedUsers.find(u => u.id === item.id);
    
    return (
      <TouchableOpacity
        onPress={() => handleUserToggle(item)}
        className={`flex-row items-center px-4 py-3 ${
          isSelected ? (isDark ? 'bg-orange-950' : 'bg-orange-50') : ''
        }`}
        activeOpacity={0.7}
      >
        <View className="relative">
          {item.avatar ? (
            <Image 
              source={{ uri: item.avatar }} 
              className="w-12 h-12 rounded-full"
            />
          ) : (
            <View className="w-12 h-12 rounded-full bg-orange-500 items-center justify-center">
              <Text className="text-white font-bold text-lg">
                {item.full_name?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
          )}
          
          {item.is_online && (
            <View className={`absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 ${isDark ? 'border-black' : 'border-white'}`} />
          )}
        </View>
        
        <View className="flex-1 ml-3">
          <Text className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
            {item.full_name}
          </Text>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            @{item.username}
          </Text>
        </View>
        
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color="#FF8C42" />
        )}
      </TouchableOpacity>
    );
  };

  const renderSelectedUser = ({ item }: { item: FriendWithClerkId }) => (
    <View className="mr-3 items-center">
      <View className="relative">
        {item.avatar ? (
          <Image 
            source={{ uri: item.avatar }} 
            className="w-14 h-14 rounded-full"
          />
        ) : (
          <View className="w-14 h-14 rounded-full bg-orange-500 items-center justify-center">
            <Text className="text-white font-bold">
              {item.full_name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
        )}
        
        <TouchableOpacity
          onPress={() => handleUserToggle(item)}
          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center"
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={14} color="white" />
        </TouchableOpacity>
      </View>
      
      <Text className={`text-xs mt-1 max-w-[60px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`} numberOfLines={1}>
        {item.full_name}
      </Text>
    </View>
  );

  const renderEmptyState = () => (
    <View className="flex-1 justify-center items-center py-12">
      <Ionicons
        name="people-outline"
        size={64}
        color={isDark ? '#666' : '#ccc'}
      />
      <Text className={`text-center mt-4 text-base ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        {searchText ? t('conversations.createModal.noResults') : t('conversations.createModal.noFriends')}
      </Text>
      <Text className={`text-center mt-2 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        {searchText ? t('conversations.createModal.noResultsSubtitle') : t('conversations.createModal.noFriendsSubtitle')}
      </Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-white'}`}>
        <View className={`flex-row items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <TouchableOpacity onPress={handleClose} disabled={isCreating}>
            <Text className="text-orange-500 text-base font-medium">{t('conversations.createModal.cancel')}</Text>
          </TouchableOpacity>
          
          <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
            {t('conversations.createModal.title')}
          </Text>
          
          <TouchableOpacity 
            onPress={handleCreate}
            disabled={selectedUsers.length === 0 || isCreating}
          >
            <Text className={`text-base font-medium ${
              selectedUsers.length > 0 && !isCreating ? 'text-orange-500' : 'text-gray-400'
            }`}>
              {isCreating ? t('conversations.createModal.creating') : t('conversations.createModal.create')}
            </Text>
          </TouchableOpacity>
        </View>

        {selectedUsers.length > 0 && (
          <View className={`px-4 py-3 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('conversations.createModal.selected')} ({selectedUsers.length})
            </Text>
            <FlatList
              horizontal
              data={selectedUsers}
              showsHorizontalScrollIndicator={false}
              renderItem={renderSelectedUser}
              keyExtractor={(item) => item.id}
            />
          </View>
        )}

        {conversationType === 'group' && (
          <View className={`px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              placeholder={t('conversations.createModal.groupName')}
              placeholderTextColor={isDark ? '#999' : '#666'}
              className={`border rounded-lg px-4 py-3 mb-3 ${
                isDark 
                  ? 'bg-gray-800 text-white border-gray-600' 
                  : 'bg-white text-black border-gray-300'
              }`}
            />
            <TextInput
              value={groupDescription}
              onChangeText={setGroupDescription}
              placeholder={t('conversations.createModal.groupDescription')}
              placeholderTextColor={isDark ? '#999' : '#666'}
              multiline
              numberOfLines={2}
              className={`border rounded-lg px-4 py-3 ${
                isDark 
                  ? 'bg-gray-800 text-white border-gray-600' 
                  : 'bg-white text-black border-gray-300'
              }`}
            />
          </View>
        )}

        <View className="px-4 py-3">
          <SearchInput
            placeholder={t('conversations.createModal.searchPlaceholder')}
            value={searchText}
            onSearch={setSearchText}
            onClear={() => setSearchText('')}
            autoFocus={false}
          />
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#FF8C42" />
            <Text className={`mt-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('conversations.createModal.loading')}
            </Text>
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center px-8">
            <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
            <Text className="text-red-500 text-center mt-4">{error}</Text>
            <Button
              title={t('conversations.createModal.retry')}
              onPress={() => loadFriends(1, searchText, 'all')}
              variant="primary"
              size="medium"
              style={{ marginTop: 16 }}
            />
          </View>
        ) : friends.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={friends}
            renderItem={renderContact}
            keyExtractor={(item) => item.id}
            className="flex-1"
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => (
              <View className={`h-px ml-16 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
            )}
          />
        )}
      </View>
    </Modal>
  );
};

export default CreateConversationModal;