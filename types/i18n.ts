export type Language = "en" | "vi" | "zh";

export interface LanguageOption {
  code: Language;
  label: string;
  nativeLabel: string;
  flag: string;
}

export interface TranslationKeys {
  home: string;
  settings: string;
  welcome: string;
  greeting: string;
  language: string;
  selectLanguage: string;
  save: string;
  cancel: string;
  changeLanguage: string;
  currentLanguage: string;
  next: string;
  skip: string;
  getStarted: string;
  settingsScreen: {
    account: {
      title: string;
      security: {
        title: string;
        subtitle: string;
      };
      privacy: {
        title: string;
        subtitle: string;
      };
    };
    preferences: {
      title: string;
      appearance: {
        title: string;
        subtitle: string;
      };
      language: {
        title: string;
        subtitle: string;
      };
    };
    data: {
      title: string;
      storage: {
        title: string;
        subtitle: string;
      };
      devices: {
        title: string;
        subtitle: string;
      };
    };
    profile: {
      loading: string;
      viewAndEdit: string;
    };
    signOut: {
      title: string;
      message: string;
      confirm: string;
    };
  };
  appearance: {
    light: {
      title: string;
      description: string;
    };
    dark: {
      title: string;
      description: string;
    };
    system: {
      title: string;
      description: string;
    };
    currentTheme: {
      title: string;
      followingDevice: string;
      usingMode: string;
    };
    chooseTheme: string;
    info: string;
  };
  languageScreen: {
    currentLanguage: {
      title: string;
      description: string;
    };
    availableLanguages: string;
    info: string;
  };
  sidebar: {
    menu: string;
    user: string;
    conversations: string;
    contacts: string;
    discover: string;
    blockedUsers: string;
    helpSupport: string;
    about: string;
  };
  loading: string;
  success: string;
  error: string;
  ok: string;
  camera: string;
  gallery: string;
  saving: string;
  profile: {
    screen: {
      title: string;
    };
    sections: {
      general: string;
      contact: string;
      personal: string;
      preferences: string;
      account: string;
    };
    labels: {
      fullName: string;
      username: string;
      bio: string;
      bioEmpty: string;
      gender: string;
      birthday: string;
      phone: string;
      email: string;
      location: string;
      website: string;
      status: string;
      active: string;
      theme: string;
      joined: string;
      verified: string;
      verifiedStatus: {
        yes: string;
        no: string;
      };
      notSet: string;
    };
    edit: {
      imagePicker: {
        title: string;
        message: string;
      };
      removePhoto: string;
      permission: {
        title: string;
        message: string;
      };
      imageUpdated: string;
      imageUpdateFailed: string;
      imagePickFailed: string;
      imageRemoved: string;
      imageRemoveFailed: string;
      title: string;
      sections: {
        basic: string;
        contact: string;
        personal: string;
      };
      placeholders: {
        fullName: string;
        username: string;
        bio: string;
        phone: string;
        location: string;
        website: string;
        gender: string;
        birthday: string;
        status: string;
      };
      validation: {
        title: string;
        message: string;
      };
      updateSuccess: string;
      updateFailed: string;
      unexpectedError: string;
      saveChanges: string;
      saving: string;
    };
  };
  tabs: {
    home: string;
    conversations: string;
    contacts: string;
    emotion: string;
    ai: string;
    setting: string;
  };
  friends: {
    title: string;
    searchPlaceholder: string;
    searching: string;
    noUsersFound: string;
    requests: {
      title: string;
      all: string;
      accepted: string;
      acceptFailed: string;
      declineTitle: string;
      declineMessage: string;
      decline: string;
      declineFailed: string;
    };
    myFriends: string;
    seeAll: string;
    addFriend: string;
    sent: string;
    friends: string;
    unknownError: string;
    menu: {
      title: string;
      viewProfile: string;
      message: string;
      unfriend: string;
      block: string;
    };
    blocked: {
      title: string;
      confirm: string;
      cancel: string;
      unblock: string;
      on: string;
      reason: string;
    };
    request: {
      message: string;
      accept: string;
      decline: string;
    };
    labels: {
      mutual: string;
    };
    unfriend: {
      title: string;
      message: string;
      confirm: string;
      success: string;
      failed: string;
    };
    block: {
      title: string;
      message: string;
      confirm: string;
      success: string;
      failed: string;
    };
    notifications: {
      requestReceived: string;
      requestAccepted: string;
      requestDeclined: string;
      requestCancelled: string;
      friendRemoved: string;
      friendOnline: string;
    };
  };
  blockedUsers: {
    title: string;
    empty: string;
    emptyDescription: string;
    unblockSuccess: string;
    unblockFailed: string;
  };
  publicProfile: {
    title: string;
    loading: string;
    notFound: string;
    notFoundDescription: string;
    tryAgain: string;
    information: string;
    location: string;
    website: string;
    status: string;
    friends: string;
    mutual: string;
    online: string;
    offline: string;
    recentlyOnline: string;
    hoursAgo: string;
    daysAgo: string;
    blocked: {
      title: string;
      message: string;
    };
    private: {
      title: string;
      message: string;
    };
    actions: {
      addFriend: string;
      message: string;
      requestSent: string;
      cancelRequest: string;
      unfriend: string;
      shareProfile: string;
      reportUser: string;
      blockUser: string;
      acceptRequest: string;
      declineRequest: string;
    };
    cancelRequest: {
      title: string;
      message: string;
      confirm: string;
      success: string;
      failed: string;
      notFound: string;
    };
    unfriend: {
      title: string;
      message: string;
      confirm: string;
      success: string;
      failed: string;
    };
    declineRequest: {
      title: string;
      message: string;
      confirm: string;
      success: string;
      failed: string;
    };
    block: {
      confirmTitle: string;
      confirmMessage: string;
      reasonTitle: string;
      reasonDescription: string;
      reasonPlaceholder: string;
      blocking: string;
      skip: string;
      block: string;
      success: string;
      failed: string;
      unexpectedError: string;
    };
    friendRequest: {
      success: string;
      failed: string;
      accepted: string;
      acceptFailed: string;
      declineInfo: string;
      notFound: string;
    };
    share: {
      info: string;
    };
    report: {
      success: string;
    };
  };
  emotion: {
    title: string;
    tabs: {
      history: string;
      stats: string;
    };
    empty: string;
    tryAgain: string;
    emotions: {
      joy: string;
      sadness: string;
      anger: string;
      fear: string;
      surprise: string;
      love: string;
      neutral: string;
    };
    stats: {
      overview: string;
      analyses: string;
      dominantEmotion: string;
      distribution: string;
      averageScores: string;
      byContext: string;
      confidence: string;
    };
    counselor: {
      title: string;
      analyzing: string;
      noData: string;
      acuteWarning: string;
      chatButton: string;
      emotionBalance: string;
      viewDetails: string;
      refresh: string;
      loading: string;
      recommendations: string;
      viewFull: string;
      more: string;
    };
    filter: {
      title: string;
      context: string;
      timeRange: string;
      days: string;
      clear: string;
      apply: string;
    };
    contexts: {
      message: string;
      voice_note: string;
      call: string;
      general: string;
    };
    delete: {
      confirmTitle: string;
      confirmMessage: string;
      success: string;
      failed: string;
    };
  };
  common: {
    cancel: string;
    delete: string;
    confirm: string;
    ok: string;
    save: string;
    loading: string;
    success: string;
    error: string;
    retry: string;
  };

  aiChat: {
    title: string;
    placeholder: string;
    typing: string;

    // ✅ NEW: Sidebar translations
    sidebar: {
      newChat: string;
      noChats: string;
      deleteConfirm: {
        title: string;
        message: string;
      };
    };

    // ✅ NEW: New Chat confirmation
    newChat: {
      confirm: {
        title: string;
        message: string;
      };
    };

    suggestions: {
      title: string;
      showSuggestions: string;
      startWith: string;
      count: string;
      smartTitle: string;
    };
    empty: {
      title: string;
      subtitle: string;
      emotionStatus: string;
      confidence: string;
    };
    emotions: {
      joy: string;
      sadness: string;
      anger: string;
      fear: string;
      surprise: string;
      neutral: string;
    };
    welcome: {
      intro: string;
      question: string;
    };
    refresh: string;
    send: string;
  };
  conversations: {
    title: string;
    searchPlaceholder: string;
    empty: {
      title: string;
      subtitle: string;
      startChatting: string;
    };
    error: {
      tryAgain: string;
    };
    newConversation: string;
    ai: {
      badge: string;
      recommendations: string;
    };
    floating: {
      sadness: string;
      anger: string;
      fear: string;
      joy: string;
      surprise: string;
      neutral: string;
      intensity: {
        very: string;
        somewhat: string;
        "": string;
      };
      suggestions: string;
      tapToView: string;
    };
    messageTypes: {
      noMessages: string;
      image: string;
      file: string;
      audio: string;
      video: string;
      voiceNote: string;
      location: string;
      message: string;
    };
    messagePrefix: {
      you: string;
      sender: string;
    };
    createModal: {
      title: string;
      cancel: string;
      create: string;
      creating: string;
      selected: string;
      groupName: string;
      groupDescription: string;
      searchPlaceholder: string;
      loading: string;
      noFriends: string;
      noFriendsSubtitle: string;
      noResults: string;
      noResultsSubtitle: string;
      retry: string;
      errors: {
        selectFriend: string;
        groupName: string;
        createFailed: string;
      };
    };
  };
  message: {
    title: string;
    loading: string;
    sending: string;
    failed: string;
    typing: string;
    online: string;
    offline: string;
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
    members: string;
    encryption: {
      initializing: string;
      enabled: string;
      notReady: string;
      waitMessage: string;
      retryDecryption: string;
      retryTitle: string;
      retryMessage: string;
      retrySuccess: string;
      retryFailed: string;
      fileDecryptionError: string;
      encryptingFiles: string;
      retry: string;
    };
    empty: {
      title: string;
      subtitle: string;
    };
    input: {
      placeholder: string;
      recording: string;
      uploading: string;
    };
    reply: {
      replyingTo: string;
      cancel: string;
    };
    actions: {
      reply: string;
      react: string;
      delete: string;
      edit: string;
      viewReads: string;
      deleteForMe: string;
      deleteForEveryone: string;
      deleteTitle: string;
      deleteMessage: string;
      leaveGroup: string;
      leaveGroupConfirm: string;
      leaveGroupSuccess: string;
      removeMember: string;
      removeMemberConfirm: string;
      remove: string;
      removeSuccess: string;
      transferAdmin: string;
      transferAdminConfirm: string;
      transfer: string;
      transferSuccess: string;
      deleteConversation: string;
      removeFromGroup: string;
    };
    edited: string;
    unknownUser: string;
    readBy: string;
    call: {
      video: {
        title: string;
        groupMessage: string;
        privateMessage: string;
        failed: string;
      };
      audio: {
        title: string;
        groupMessage: string;
        privateMessage: string;
        failed: string;
      };
      start: string;
      cancel: string;
    };
    attachment: {
      camera: string;
      takePhoto: string;
      recordVideo: string;
      permissionRequired: string;
      cameraPermission: string;
      micPermission: string;
      mediaPermission: string;
      pickFailed: string;
      recordingError: string;
      recordingFailed: string;
    };
    info: {
      title: string;
      unnamed: string;
      viewProfile: string;
      search: string;
      muteNotifications: string;
      addMembers: string;
      tabInfo: string;
      tabMembers: string;
      tabMedia: string;
      tabSearch: string;
      changeGroupAvatar: string;
      changeGroupName: string;
      notifications: string;
      pin: string;
      shareContact: string;
      loadingMembers: string;
      admin: string;
      you: string;
      messages: string;
      media: {
        image: string;
        video: string;
        file: string;
        audio: string;
      };
      noMedia: string;
      searchPlaceholder: string;
      noResults: string;
      searchMessages: string;
    };
    addMembers: {
      title: string;
      add: string;
      selected: string;
      searchPlaceholder: string;
      loading: string;
      alreadyInGroup: string;
      noFriendsFound: string;
      allInGroup: string;
      success: string;
      error: string;
    };
  };
  homeScreen: {
    title: string;
    welcome: string;
  };
  privacyScreen: {
    title: string;
    info: string;
    permissionsTitle: string;
    permissions: {
      camera: {
        title: string;
        subtitle: string;
      };
      microphone: {
        title: string;
        subtitle: string;
      };
      photos: {
        title: string;
        subtitle: string;
      };
      location: {
        title: string;
        subtitle: string;
      };
      notifications: {
        title: string;
        subtitle: string;
      };
    };
    status: {
      granted: string;
      denied: string;
      notRequested: string;
    };
    alert: {
      title: string;
      message: string;
      openSettings: string;
    };
    granted: {
      title: string;
      message: string;
      changeInSettings: string;
    };
    openSystemSettings: string;
  };
  onboarding: {
    language: {
      title: string;
      description: string;
      continue: string;
    };
    skip: string;
    next: string;
    getStarted: string;
    slide1: {
      title: string;
      description: string;
    };
    slide2: {
      title: string;
      description: string;
    };
    slide3: {
      title: string;
      description: string;
    };
  };
  auth: {
    signIn: {
      title: string;
      emailPlaceholder: string;
      passwordPlaceholder: string;
      forgotPassword: string;
      resetNow: string;
      signInButton: string;
      signingIn: string;
      noAccount: string;
      signUpLink: string;
      errors: {
        emailRequired: string;
        passwordRequired: string;
        signInFailed: string;
        incomplete: string;
        generic: string;
      };
    };
    signUp: {
      title: string;
      emailPlaceholder: string;
      passwordPlaceholder: string;
      passwordRequirement: string;
      continueButton: string;
      creatingAccount: string;
      haveAccount: string;
      signInLink: string;
      verifyEmail: {
        title: string;
        description: string;
        codePlaceholder: string;
        verifyButton: string;
        verifying: string;
        didntReceive: string;
        goBack: string;
      };
      errors: {
        emailRequired: string;
        passwordRequired: string;
        passwordLength: string;
        signUpFailed: string;
        codeRequired: string;
        verifyFailed: string;
        incomplete: string;
        generic: string;
      };
    };
    forgotPassword: {
      title: string;
      resetTitle: string;
      description: string;
      resetDescription: string;
      emailPlaceholder: string;
      codePlaceholder: string;
      newPasswordPlaceholder: string;
      confirmPasswordPlaceholder: string;
      sendCodeButton: string;
      sending: string;
      resetButton: string;
      resetting: string;
      didntReceive: string;
      resend: string;
      codeSentTo: string;
      requirements: {
        title: string;
        minLength: string;
        recommended: string;
      };
      alerts: {
        codeSent: {
          title: string;
          message: string;
        };
        success: {
          title: string;
          message: string;
        };
        resendSuccess: string;
      };
      errors: {
        emailRequired: string;
        emailInvalid: string;
        codeRequired: string;
        passwordRequired: string;
        passwordLength: string;
        passwordMismatch: string;
        sendFailed: string;
        resetFailed: string;
        incomplete: string;
        resendFailed: string;
      };
    };
  };
  securityScreen: {
    title: string;
    info: string;
    password: {
      title: string;
      change: string;
      subtitle: string;
    };
    changePassword: {
      title: string;
      info: string;
      labels: {
        current: string;
        new: string;
        confirm: string;
      };
      placeholders: {
        current: string;
        new: string;
        confirm: string;
      };
      requirements: {
        title: string;
        minLength: string;
        uppercase: string;
        lowercase: string;
        number: string;
      };
      validation: {
        currentRequired: string;
        newRequired: string;
        minLength: string;
        uppercase: string;
        lowercase: string;
        number: string;
        mismatch: string;
        same: string;
      };
      success: string;
      error: {
        generic: string;
        incorrectCurrent: string;
      };
      button: string;
    };
    sessions: {
      title: string;
      current: string;
      lastActive: string;
      justNow: string;
      minutesAgo: string;
      hoursAgo: string;
      daysAgo: string;
      signOut: string;
      signOutCurrent: {
        title: string;
        message: string;
      };
      signOutOther: {
        title: string;
        message: string;
      };
      signOutAll: {
        title: string;
        message: string;
        confirm: string;
        button: string;
      };
      noOtherSessions: {
        title: string;
        message: string;
      };
      signOutSuccess: string;
      signOutError: string;
      signOutAllSuccess: string;
      signOutAllError: string;
      noSessions: string;
      loadError: {
        title: string;
        message: string;
      };
    };
  };
  requests: {
    title: string;
    searchPlaceholder: string;
    count: string;
    resultsCount: string;
    empty: string;
    emptyDescription: string;
    noResults: string;
    noResultsDescription: string;
  };
  encryption: {
    initializing: string;
    backup: {
      title: string;
      description: string;
      passwordLabel: string;
      passwordPlaceholder: string;
      confirmPasswordLabel: string;
      confirmPasswordPlaceholder: string;
      requirements: string;
      minLength: string;
      hint: string;
      creating: string;
      createButton: string;
      skipButton: string;
      skipWarning: string;
      passwordTooShort: string;
      passwordMismatch: string;

      // ✅ NEW: For old users
      recommendTitle: string;
      recommendMessage: string;
      createNow: string;
      later: string;
      createForExistingTitle: string;
      createForExistingDescription: string;
      alreadyExists: string;
      created: string;
    };
    restore: {
      title: string;
      description: string;
      passwordLabel: string;
      passwordPlaceholder: string;
      info: string;
      restoring: string;
      restoreButton: string;
      startFreshButton: string;
      startFreshTitle: string;
      startFreshWarning: string;
      startFreshConfirm: string;
      passwordRequired: string;
      invalidPassword: string;
      success: string;
    };
  };
}

// Recursive type to generate all nested paths
type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${"" extends P ? "" : "."}${P}`
    : never
  : never;

type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ...0[]];

type Paths<T, D extends number = 10> = [D] extends [never]
  ? never
  : T extends object
    ? {
        [K in keyof T]-?: K extends string | number
          ? `${K}` | Join<K, Paths<T[K], Prev[D]>>
          : never;
      }[keyof T]
    : "";

// Type for all possible translation keys
export type TranslationKey = Paths<TranslationKeys>;
