/* eslint-disable import/no-unresolved */
/* eslint-disable react/no-unescaped-entities */
import { useSignIn } from '@clerk/clerk-expo'
import { Link, useRouter } from 'expo-router'
import { Text, TextInput, TouchableOpacity, View, Alert } from 'react-native'
import React, { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
export default function Page() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const router = useRouter()

  const [emailAddress, setEmailAddress] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Handle the submission of the sign-in form
  const onSignInPress = async () => {
    if (!isLoaded) return

    if (!emailAddress.trim()) {
      Alert.alert('Error', 'Please enter your email or phone number')
      return
    }

    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password')
      return
    }

    setIsLoading(true)

    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress.trim(),
        password,
      })

      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId })
        router.replace('/')
      } else {
        console.error(JSON.stringify(signInAttempt, null, 2))
        Alert.alert('Sign In Incomplete', 'Please complete additional steps required.')
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2))
      
      if (err.errors && err.errors.length > 0) {
        const errorMessage = err.errors[0].longMessage || err.errors[0].message
        Alert.alert('Sign In Failed', errorMessage)
      } else {
        Alert.alert('Error', 'Failed to sign in. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-gray-50 px-6 justify-center">
      {/* Title */}
      <Text className="text-4xl font-bold text-orange-500 text-center mb-12">
        Sign in
      </Text>

      {/* Form Container */}
      <View className="space-y-4">
        {/* Email/Phone Input */}
        <View className="relative">
          <View className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
            <Ionicons name="person-outline" size={20} color="#6B7280" />
          </View>
          <TextInput
            className="bg-white border border-gray-300 rounded-full py-4 pl-12 pr-4 text-base"
            autoCapitalize="none"
            keyboardType="email-address"
            value={emailAddress}
            placeholder="PhoneNumber or Email"
            placeholderTextColor="#9CA3AF"
            onChangeText={setEmailAddress}
            editable={!isLoading}
          />
        </View>

        {/* Password Input */}
        <View className="relative">
          <View className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
            <Ionicons name="lock-closed-outline" size={20} color="#6B7280" />
          </View>
          <TextInput
            className="bg-white border border-gray-300 rounded-full py-4 pl-12 pr-12 text-base"
            value={password}
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry={!isPasswordVisible}
            onChangeText={setPassword}
            editable={!isLoading}
          />
          <TouchableOpacity
            className="absolute right-4 top-1/2 -translate-y-1/2"
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          >
            <Ionicons 
              name={isPasswordVisible ? "eye-outline" : "eye-off-outline"} 
              size={20} 
              color="#6B7280" 
            />
          </TouchableOpacity>
        </View>

        {/* Forgot Password */}
        <View className="items-center mt-4">
          <TouchableOpacity>
            <Text className="text-gray-600 text-base">
              Forgot your password?{' '}
              <Text className="text-orange-500 font-semibold">Reset now</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sign In Button */}
        <View className="mt-8">
          <TouchableOpacity 
            className={`rounded-full py-4 px-8 items-center ${
              isLoading ? 'bg-orange-300' : 'bg-orange-500'
            }`}
            onPress={onSignInPress}
            disabled={isLoading}
          >
            <Text className="text-white text-lg font-semibold">
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign Up Link */}
      <View className="items-center mt-8">
        <Text className="text-gray-600 text-base">
          Don't have an account?{' '}
        </Text>
        <Link href="/sign-up" asChild>
          <TouchableOpacity className="mt-2">
            <Text className="text-orange-500 font-semibold text-base">
              Sign Up
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  )
}