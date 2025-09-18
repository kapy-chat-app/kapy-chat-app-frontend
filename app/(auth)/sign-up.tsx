/* eslint-disable react/no-unescaped-entities */
import * as React from 'react'
import { Text, TextInput, TouchableOpacity, View, Alert } from 'react-native'
import { useSignUp } from '@clerk/clerk-expo'
import { Link, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const router = useRouter()

  const [emailAddress, setEmailAddress] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [pendingVerification, setPendingVerification] = React.useState(false)
  const [code, setCode] = React.useState('')
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  // Handle submission of sign-up form
  const onSignUpPress = async () => {
    if (!isLoaded) return

    if (!emailAddress.trim()) {
      Alert.alert('Error', 'Please enter your email address')
      return
    }

    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password')
      return
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters')
      return
    }

    setIsLoading(true)

    try {
      // Start sign-up process using email and password provided
      await signUp.create({
        emailAddress: emailAddress.trim(),
        password,
      })

      // Send user an email with verification code
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })

      // Set 'pendingVerification' to true to display second form
      // and capture OTP code
      setPendingVerification(true)
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2))
      
      if (err.errors && err.errors.length > 0) {
        const errorMessage = err.errors[0].longMessage || err.errors[0].message
        Alert.alert('Sign Up Failed', errorMessage)
      } else {
        Alert.alert('Error', 'Failed to sign up. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Handle submission of verification form
  const onVerifyPress = async () => {
    if (!isLoaded) return

    if (!code.trim()) {
      Alert.alert('Error', 'Please enter the verification code')
      return
    }

    setIsLoading(true)

    try {
      // Use the code the user provided to attempt verification
      const signUpAttempt = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      })

      // If verification was completed, set the session to active
      // and redirect the user
      if (signUpAttempt.status === 'complete') {
        await setActive({ session: signUpAttempt.createdSessionId })
        router.replace('/')
      } else {
        // If the status is not complete, check why. User may need to
        // complete further steps.
        console.error(JSON.stringify(signUpAttempt, null, 2))
        Alert.alert('Verification Incomplete', 'Please complete additional steps required.')
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2))
      
      if (err.errors && err.errors.length > 0) {
        const errorMessage = err.errors[0].longMessage || err.errors[0].message
        Alert.alert('Verification Failed', errorMessage)
      } else {
        Alert.alert('Error', 'Failed to verify. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Verification Screen
  if (pendingVerification) {
    return (
      <View className="flex-1 bg-gray-50 px-6 justify-center">
        {/* Title */}
        <Text className="text-4xl font-bold text-orange-500 text-center mb-4">
          Verify Email
        </Text>
        
        {/* Subtitle */}
        <Text className="text-base text-gray-600 text-center mb-12">
          We've sent a verification code to {emailAddress}
        </Text>

        {/* Verification Code Input */}
        <View className="mb-6">
          <View className="relative">
            <View className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
              <Ionicons name="mail-outline" size={20} color="#6B7280" />
            </View>
            <TextInput
              className="bg-white border border-gray-300 rounded-full py-4 pl-12 pr-4 text-base text-center"
              value={code}
              placeholder="Enter verification code"
              placeholderTextColor="#9CA3AF"
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              editable={!isLoading}
            />
          </View>
        </View>

        {/* Verify Button */}
        <TouchableOpacity 
          className={`rounded-full py-4 px-8 items-center mb-6 ${
            isLoading ? 'bg-orange-300' : 'bg-orange-500'
          }`}
          onPress={onVerifyPress}
          disabled={isLoading}
        >
          <Text className="text-white text-lg font-semibold">
            {isLoading ? 'Verifying...' : 'Verify Email'}
          </Text>
        </TouchableOpacity>

        {/* Back to Sign Up */}
        <View className="items-center">
          <TouchableOpacity onPress={() => setPendingVerification(false)}>
            <Text className="text-gray-600 text-base">
              Didn't receive code?{' '}
              <Text className="text-orange-500 font-semibold">Go back</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // Sign Up Screen
  return (
    <View className="flex-1 bg-gray-50 px-6 justify-center">
      {/* Title */}
      <Text className="text-4xl font-bold text-orange-500 text-center mb-12">
        Sign up
      </Text>

      {/* Form Container */}
      <View className="space-y-4">
        {/* Email Input */}
        <View className="relative">
          <View className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
            <Ionicons name="mail-outline" size={20} color="#6B7280" />
          </View>
          <TextInput
            className="bg-white border border-gray-300 rounded-full py-4 pl-12 pr-4 text-base"
            autoCapitalize="none"
            keyboardType="email-address"
            value={emailAddress}
            placeholder="Enter your email"
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
            placeholder="Enter password"
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

        {/* Password Requirements */}
        <View className="px-4 mt-2">
          <Text className="text-sm text-gray-500">
            Password must be at least 8 characters
          </Text>
        </View>

        {/* Sign Up Button */}
        <View className="mt-8">
          <TouchableOpacity 
            className={`rounded-full py-4 px-8 items-center ${
              isLoading ? 'bg-orange-300' : 'bg-orange-500'
            }`}
            onPress={onSignUpPress}
            disabled={isLoading}
          >
            <Text className="text-white text-lg font-semibold">
              {isLoading ? 'Creating Account...' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign In Link */}
      <View className="items-center mt-8">
        <Text className="text-gray-600 text-base">
          Already have an account?{' '}
        </Text>
        <Link href="/sign-in" asChild>
          <TouchableOpacity className="mt-2">
            <Text className="text-orange-500 font-semibold text-base">
              Sign In
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  )
}