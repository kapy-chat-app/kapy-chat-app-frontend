// components/Sidebar.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Modal,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { SignOutButton } from '@/components/ui/SignOutButton';

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const sidebarWidth = 280;

const Sidebar: React.FC<SidebarProps> = ({ isVisible, onClose }) => {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { user } = useUser();
  const slideAnim = useRef(new Animated.Value(-sidebarWidth)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = React.useState(false);

  // Handle modal visibility và animation
  useEffect(() => {
    if (isVisible) {
      setModalVisible(true);
      // Animate in - fast and smooth
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -sidebarWidth,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Ẩn modal sau khi animation hoàn thành
        setModalVisible(false);
      });
    }
  }, [isVisible]);

  const handleClose = () => {
    onClose();
  };

  const menuItems = [
    {
      title: 'Home',
      icon: 'home-outline',
      route: '/(tabs)/home',
    },
    {
      title: 'Conversations',
      icon: 'chatbubbles-outline',
      route: '/(tabs)/conversations',
    },
    {
      title: 'Contacts',
      icon: 'people-outline',
      route: '/(tabs)/contacts',
    },
    {
      title: 'Discover',
      icon: 'globe-outline',
      route: '/(tabs)/discover',
    },
    {
      title: 'Settings',
      icon: 'settings-outline',
      route: '/(tabs)/settings',
    },
  ];

  const handleNavigation = (route: string) => {
    router.push(route as any);
    handleClose();
  };

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.modalContainer}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View 
            style={[
              styles.backdrop,
              { opacity: opacityAnim }
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Sidebar */}
        <Animated.View
          style={[
            styles.sidebar,
            colorScheme === 'dark' ? styles.sidebarDark : styles.sidebarLight,
            { transform: [{ translateX: slideAnim }] }
          ]}
        >
          <SafeAreaView style={styles.sidebarContent} edges={['top', 'bottom']}>
            {/* Header Section */}
            <View style={[styles.header, colorScheme === 'dark' ? styles.headerDark : styles.headerLight]}>
              <View style={styles.headerTop}>
                <Text style={styles.headerTitle}>Menu</Text>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>
              </View>
              <View style={styles.userInfo}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={32} color="white" />
                </View>
                <View style={styles.userDetails}>
                  <Text style={styles.userName}>
                    {user?.firstName || 'User'}
                  </Text>
                  <Text style={styles.userEmail}>
                    {user?.emailAddresses[0]?.emailAddress || 'user@example.com'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Menu Items */}
            <View style={styles.menuContainer}>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.menuItem,
                    colorScheme === 'dark' ? styles.menuItemDark : styles.menuItemLight
                  ]}
                  onPress={() => handleNavigation(item.route)}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={item.icon as any} 
                    size={24} 
                    color="#FF8C42"
                  />
                  <Text style={[
                    styles.menuText,
                    colorScheme === 'dark' ? styles.menuTextDark : styles.menuTextLight
                  ]}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Spacer để đẩy bottom section xuống */}
            <View style={styles.spacer} />

            {/* Bottom Section */}
            <View style={styles.bottomSection}>
              {/* Additional Options */}
              <TouchableOpacity 
                style={[
                  styles.menuItem,
                  colorScheme === 'dark' ? styles.menuItemDark : styles.menuItemLight
                ]}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name="help-circle-outline" 
                  size={24} 
                  color={colorScheme === 'dark' ? '#8E8E93' : '#6B7280'} 
                />
                <Text style={[
                  styles.menuText,
                  colorScheme === 'dark' ? styles.subMenuTextDark : styles.subMenuTextLight
                ]}>
                  Help & Support
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.menuItem,
                  colorScheme === 'dark' ? styles.menuItemDark : styles.menuItemLight
                ]}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name="information-circle-outline" 
                  size={24} 
                  color={colorScheme === 'dark' ? '#8E8E93' : '#6B7280'} 
                />
                <Text style={[
                  styles.menuText,
                  colorScheme === 'dark' ? styles.subMenuTextDark : styles.subMenuTextLight
                ]}>
                  About
                </Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={[
                styles.divider,
                colorScheme === 'dark' ? styles.dividerDark : styles.dividerLight
              ]} />

              {/* Sign Out Section */}
              <View style={styles.signOutContainer}>
                <SignOutButton />
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: sidebarWidth,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 16,
  },
  sidebarLight: {
    backgroundColor: '#FFFFFF',
  },
  sidebarDark: {
    backgroundColor: '#000000',
  },
  sidebarContent: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  headerLight: {
    backgroundColor: '#FF8C42',
  },
  headerDark: {
    backgroundColor: '#FF8C42',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  userEmail: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  menuContainer: {
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  menuItemLight: {
    backgroundColor: 'transparent',
  },
  menuItemDark: {
    backgroundColor: 'transparent',
  },
  menuText: {
    marginLeft: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  menuTextLight: {
    color: '#1F2937',
  },
  menuTextDark: {
    color: '#E5E7EB',
  },
  subMenuTextLight: {
    color: '#6B7280',
  },
  subMenuTextDark: {
    color: '#9CA3AF',
  },
  spacer: {
    flex: 1,
  },
  bottomSection: {
    paddingBottom: 8,
  },
  divider: {
    height: 1,
    marginHorizontal: 24,
    marginVertical: 12,
  },
  dividerLight: {
    backgroundColor: '#E5E7EB',
  },
  dividerDark: {
    backgroundColor: '#374151',
  },
  signOutContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
});

export default Sidebar;