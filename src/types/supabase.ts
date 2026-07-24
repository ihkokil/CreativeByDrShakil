export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      Account: {
        Row: {
          access_token: string | null
          expires_at: number | null
          id: string
          id_token: string | null
          provider: string
          providerAccountId: string
          refresh_token: string | null
          scope: string | null
          session_state: string | null
          token_type: string | null
          type: string
          userId: string
        }
        Insert: {
          access_token?: string | null
          expires_at?: number | null
          id: string
          id_token?: string | null
          provider: string
          providerAccountId: string
          refresh_token?: string | null
          scope?: string | null
          session_state?: string | null
          token_type?: string | null
          type: string
          userId: string
        }
        Update: {
          access_token?: string | null
          expires_at?: number | null
          id?: string
          id_token?: string | null
          provider?: string
          providerAccountId?: string
          refresh_token?: string | null
          scope?: string | null
          session_state?: string | null
          token_type?: string | null
          type?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Account_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      AttemptAnswer: {
        Row: {
          attemptId: string
          createdAt: string
          id: string
          isCorrect: boolean
          questionId: string
          selectedOption: string | null
        }
        Insert: {
          attemptId: string
          createdAt?: string
          id: string
          isCorrect?: boolean
          questionId: string
          selectedOption?: string | null
        }
        Update: {
          attemptId?: string
          createdAt?: string
          id?: string
          isCorrect?: boolean
          questionId?: string
          selectedOption?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "AttemptAnswer_attemptId_fkey"
            columns: ["attemptId"]
            isOneToOne: false
            referencedRelation: "QuizAttempt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "AttemptAnswer_questionId_fkey"
            columns: ["questionId"]
            isOneToOne: false
            referencedRelation: "Question"
            referencedColumns: ["id"]
          },
        ]
      }
      Category: {
        Row: {
          createdAt: string
          displayName: string
          id: string
          name: string
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          displayName: string
          id: string
          name: string
          updatedAt: string
        }
        Update: {
          createdAt?: string
          displayName?: string
          id?: string
          name?: string
          updatedAt?: string
        }
        Relationships: []
      }
      ContactSubmission: {
        Row: {
          adminReply: string | null
          adminReplySentAt: string | null
          createdAt: string
          email: string
          fullName: string
          id: string
          imageUrls: string | null
          issueType: Database["public"]["Enums"]["ContactIssueType"]
          message: string
          phone: string
          repliedByAdminId: string | null
          status: Database["public"]["Enums"]["ContactSubmissionStatus"]
          subject: string
          updatedAt: string
        }
        Insert: {
          adminReply?: string | null
          adminReplySentAt?: string | null
          createdAt?: string
          email: string
          fullName: string
          id: string
          imageUrls?: string | null
          issueType: Database["public"]["Enums"]["ContactIssueType"]
          message: string
          phone: string
          repliedByAdminId?: string | null
          status?: Database["public"]["Enums"]["ContactSubmissionStatus"]
          subject: string
          updatedAt: string
        }
        Update: {
          adminReply?: string | null
          adminReplySentAt?: string | null
          createdAt?: string
          email?: string
          fullName?: string
          id?: string
          imageUrls?: string | null
          issueType?: Database["public"]["Enums"]["ContactIssueType"]
          message?: string
          phone?: string
          repliedByAdminId?: string | null
          status?: Database["public"]["Enums"]["ContactSubmissionStatus"]
          subject?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "ContactSubmission_repliedByAdminId_fkey"
            columns: ["repliedByAdminId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Course: {
        Row: {
          categoryId: string | null
          courseStartDate: string | null
          createdAt: string
          curriculumJson: string | null
          description: string
          duration: string
          id: string
          imageUrl: string | null
          instructor: string
          isFeatured: boolean
          language: string | null
          learningOutcomes: string | null
          overview: string | null
          price: number
          publishedAt: string | null
          releaseDaysOfWeek: string | null
          releaseGroupDates: string | null
          releaseGroupsPerWeek: number | null
          releaseIntervalDays: number | null
          releaseMode: Database["public"]["Enums"]["CourseReleaseMode"] | null
          releaseStartAt: string | null
          salePrice: number | null
          slug: string | null
          status: Database["public"]["Enums"]["CoursePublishStatus"]
          teacherId: string | null
          timezone: string
          title: string
          updatedAt: string
        }
        Insert: {
          categoryId?: string | null
          courseStartDate?: string | null
          createdAt?: string
          curriculumJson?: string | null
          description: string
          duration: string
          id: string
          imageUrl?: string | null
          instructor: string
          isFeatured?: boolean
          language?: string | null
          learningOutcomes?: string | null
          overview?: string | null
          price: number
          publishedAt?: string | null
          releaseDaysOfWeek?: string | null
          releaseGroupDates?: string | null
          releaseGroupsPerWeek?: number | null
          releaseIntervalDays?: number | null
          releaseMode?: Database["public"]["Enums"]["CourseReleaseMode"] | null
          releaseStartAt?: string | null
          salePrice?: number | null
          slug?: string | null
          status?: Database["public"]["Enums"]["CoursePublishStatus"]
          teacherId?: string | null
          timezone?: string
          title: string
          updatedAt: string
        }
        Update: {
          categoryId?: string | null
          courseStartDate?: string | null
          createdAt?: string
          curriculumJson?: string | null
          description?: string
          duration?: string
          id?: string
          imageUrl?: string | null
          instructor?: string
          isFeatured?: boolean
          language?: string | null
          learningOutcomes?: string | null
          overview?: string | null
          price?: number
          publishedAt?: string | null
          releaseDaysOfWeek?: string | null
          releaseGroupDates?: string | null
          releaseGroupsPerWeek?: number | null
          releaseIntervalDays?: number | null
          releaseMode?: Database["public"]["Enums"]["CourseReleaseMode"] | null
          releaseStartAt?: string | null
          salePrice?: number | null
          slug?: string | null
          status?: Database["public"]["Enums"]["CoursePublishStatus"]
          teacherId?: string | null
          timezone?: string
          title?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Course_categoryId_fkey"
            columns: ["categoryId"]
            isOneToOne: false
            referencedRelation: "Category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Course_teacherId_fkey"
            columns: ["teacherId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      CourseInstructor: {
        Row: {
          courseId: string
          createdAt: string
          designation: string | null
          id: string
          imageUrl: string | null
          name: string
          sortOrder: number
          updatedAt: string
        }
        Insert: {
          courseId: string
          createdAt?: string
          designation?: string | null
          id: string
          imageUrl?: string | null
          name: string
          sortOrder?: number
          updatedAt: string
        }
        Update: {
          courseId?: string
          createdAt?: string
          designation?: string | null
          id?: string
          imageUrl?: string | null
          name?: string
          sortOrder?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "CourseInstructor_courseId_fkey"
            columns: ["courseId"]
            isOneToOne: false
            referencedRelation: "Course"
            referencedColumns: ["id"]
          },
        ]
      }
      DeviceSession: {
        Row: {
          browserName: string
          createdAt: string
          deviceHash: string | null
          deviceLabel: string | null
          deviceType: Database["public"]["Enums"]["DeviceType"]
          id: string
          ipAddress: string
          isLocked: boolean
          lastActivityAt: string
          lockedByDeviceLabel: string | null
          loggedOutAt: string | null
          osInfo: string | null
          userAgent: string
          userId: string
        }
        Insert: {
          browserName: string
          createdAt?: string
          deviceHash?: string | null
          deviceLabel?: string | null
          deviceType: Database["public"]["Enums"]["DeviceType"]
          id: string
          ipAddress: string
          isLocked?: boolean
          lastActivityAt?: string
          lockedByDeviceLabel?: string | null
          loggedOutAt?: string | null
          osInfo?: string | null
          userAgent: string
          userId: string
        }
        Update: {
          browserName?: string
          createdAt?: string
          deviceHash?: string | null
          deviceLabel?: string | null
          deviceType?: Database["public"]["Enums"]["DeviceType"]
          id?: string
          ipAddress?: string
          isLocked?: boolean
          lastActivityAt?: string
          lockedByDeviceLabel?: string | null
          loggedOutAt?: string | null
          osInfo?: string | null
          userAgent?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "DeviceSession_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      EmailOtp: {
        Row: {
          createdAt: string
          email: string
          expiresAt: string
          id: string
          otpHash: string
          verified: boolean
        }
        Insert: {
          createdAt?: string
          email: string
          expiresAt: string
          id: string
          otpHash: string
          verified?: boolean
        }
        Update: {
          createdAt?: string
          email?: string
          expiresAt?: string
          id?: string
          otpHash?: string
          verified?: boolean
        }
        Relationships: []
      }
      GlobalSessionLockSettings: {
        Row: {
          allowDesktop: boolean
          allowMobile: boolean
          allowTablet: boolean
          autoLockFirstBrowser: boolean
          createdAt: string
          id: string
          maxConcurrentSessions: number
          updatedAt: string
        }
        Insert: {
          allowDesktop?: boolean
          allowMobile?: boolean
          allowTablet?: boolean
          autoLockFirstBrowser?: boolean
          createdAt?: string
          id?: string
          maxConcurrentSessions?: number
          updatedAt: string
        }
        Update: {
          allowDesktop?: boolean
          allowMobile?: boolean
          allowTablet?: boolean
          autoLockFirstBrowser?: boolean
          createdAt?: string
          id?: string
          maxConcurrentSessions?: number
          updatedAt?: string
        }
        Relationships: []
      }
      LessonProgress: {
        Row: {
          completedAt: string
          courseId: string
          createdAt: string
          id: string
          lessonNodeId: string
          updatedAt: string
          userId: string
        }
        Insert: {
          completedAt?: string
          courseId: string
          createdAt?: string
          id: string
          lessonNodeId: string
          updatedAt: string
          userId: string
        }
        Update: {
          completedAt?: string
          courseId?: string
          createdAt?: string
          id?: string
          lessonNodeId?: string
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "LessonProgress_courseId_fkey"
            columns: ["courseId"]
            isOneToOne: false
            referencedRelation: "Course"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "LessonProgress_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Order: {
        Row: {
          courseId: string
          createdAt: string
          enrolledAt: string | null
          expiresAt: string | null
          id: string
          status: string
          totalAmount: number
          updatedAt: string
          userId: string
        }
        Insert: {
          courseId: string
          createdAt?: string
          enrolledAt?: string | null
          expiresAt?: string | null
          id: string
          status?: string
          totalAmount: number
          updatedAt: string
          userId: string
        }
        Update: {
          courseId?: string
          createdAt?: string
          enrolledAt?: string | null
          expiresAt?: string | null
          id?: string
          status?: string
          totalAmount?: number
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Order_courseId_fkey"
            columns: ["courseId"]
            isOneToOne: false
            referencedRelation: "Course"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Order_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Payment: {
        Row: {
          amount: number
          approvedAt: string | null
          id: string
          orderId: string
          phoneNumber: string
          status: string
          submittedAt: string
          transactionId: string
        }
        Insert: {
          amount: number
          approvedAt?: string | null
          id: string
          orderId: string
          phoneNumber: string
          status?: string
          submittedAt?: string
          transactionId: string
        }
        Update: {
          amount?: number
          approvedAt?: string | null
          id?: string
          orderId?: string
          phoneNumber?: string
          status?: string
          submittedAt?: string
          transactionId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Payment_orderId_fkey"
            columns: ["orderId"]
            isOneToOne: false
            referencedRelation: "Order"
            referencedColumns: ["id"]
          },
        ]
      }
      PaymentConfig: {
        Row: {
          createdAt: string
          id: string
          provider: string
          qrCodeUrl: string | null
          sendMoneyNumber: string
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          id?: string
          provider?: string
          qrCodeUrl?: string | null
          sendMoneyNumber: string
          updatedAt: string
        }
        Update: {
          createdAt?: string
          id?: string
          provider?: string
          qrCodeUrl?: string | null
          sendMoneyNumber?: string
          updatedAt?: string
        }
        Relationships: []
      }
      Question: {
        Row: {
          correctOption: string
          createdAt: string
          explanation: string | null
          id: string
          optionA: string
          optionB: string
          optionC: string | null
          optionD: string | null
          optionE: string | null
          questionText: string
          questionType: Database["public"]["Enums"]["QuestionType"]
          quizId: string
          updatedAt: string
        }
        Insert: {
          correctOption: string
          createdAt?: string
          explanation?: string | null
          id: string
          optionA: string
          optionB: string
          optionC?: string | null
          optionD?: string | null
          optionE?: string | null
          questionText: string
          questionType: Database["public"]["Enums"]["QuestionType"]
          quizId: string
          updatedAt: string
        }
        Update: {
          correctOption?: string
          createdAt?: string
          explanation?: string | null
          id?: string
          optionA?: string
          optionB?: string
          optionC?: string | null
          optionD?: string | null
          optionE?: string | null
          questionText?: string
          questionType?: Database["public"]["Enums"]["QuestionType"]
          quizId?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Question_quizId_fkey"
            columns: ["quizId"]
            isOneToOne: false
            referencedRelation: "Quiz"
            referencedColumns: ["id"]
          },
        ]
      }
      Quiz: {
        Row: {
          allowMultipleAttempts: boolean
          allowNegativeMarking: boolean
          categoryId: string | null
          createdAt: string
          createdBy: string
          description: string | null
          durationMinutes: number
          endDatetime: string | null
          id: string
          instructions: string | null
          marksPerCorrect: number
          maxAttempts: number | null
          negativeValue: number
          numQuestionsToServe: number
          positionType: Database["public"]["Enums"]["QuizPositionType"]
          publishedAt: string | null
          shuffleOptions: boolean
          shuffleQuestions: boolean
          startDatetime: string | null
          status: Database["public"]["Enums"]["QuizStatus"]
          title: string
          updatedAt: string
        }
        Insert: {
          allowMultipleAttempts?: boolean
          allowNegativeMarking?: boolean
          categoryId?: string | null
          createdAt?: string
          createdBy: string
          description?: string | null
          durationMinutes: number
          endDatetime?: string | null
          id: string
          instructions?: string | null
          marksPerCorrect?: number
          maxAttempts?: number | null
          negativeValue?: number
          numQuestionsToServe: number
          positionType?: Database["public"]["Enums"]["QuizPositionType"]
          publishedAt?: string | null
          shuffleOptions?: boolean
          shuffleQuestions?: boolean
          startDatetime?: string | null
          status?: Database["public"]["Enums"]["QuizStatus"]
          title: string
          updatedAt: string
        }
        Update: {
          allowMultipleAttempts?: boolean
          allowNegativeMarking?: boolean
          categoryId?: string | null
          createdAt?: string
          createdBy?: string
          description?: string | null
          durationMinutes?: number
          endDatetime?: string | null
          id?: string
          instructions?: string | null
          marksPerCorrect?: number
          maxAttempts?: number | null
          negativeValue?: number
          numQuestionsToServe?: number
          positionType?: Database["public"]["Enums"]["QuizPositionType"]
          publishedAt?: string | null
          shuffleOptions?: boolean
          shuffleQuestions?: boolean
          startDatetime?: string | null
          status?: Database["public"]["Enums"]["QuizStatus"]
          title?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Quiz_categoryId_fkey"
            columns: ["categoryId"]
            isOneToOne: false
            referencedRelation: "QuizCategory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Quiz_createdBy_fkey"
            columns: ["createdBy"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      QuizAttempt: {
        Row: {
          attemptNumber: number
          correctCount: number
          createdAt: string
          id: string
          isAutoSubmitted: boolean
          negativeMarks: number
          netScore: number
          percentageScore: number
          quizId: string
          rank: number | null
          skippedCount: number
          startedAt: string
          status: Database["public"]["Enums"]["AttemptStatus"]
          studentId: string
          submittedAt: string | null
          timeTakenSeconds: number | null
          totalScore: number
          updatedAt: string
          wrongCount: number
        }
        Insert: {
          attemptNumber?: number
          correctCount?: number
          createdAt?: string
          id: string
          isAutoSubmitted?: boolean
          negativeMarks?: number
          netScore?: number
          percentageScore?: number
          quizId: string
          rank?: number | null
          skippedCount?: number
          startedAt?: string
          status?: Database["public"]["Enums"]["AttemptStatus"]
          studentId: string
          submittedAt?: string | null
          timeTakenSeconds?: number | null
          totalScore?: number
          updatedAt: string
          wrongCount?: number
        }
        Update: {
          attemptNumber?: number
          correctCount?: number
          createdAt?: string
          id?: string
          isAutoSubmitted?: boolean
          negativeMarks?: number
          netScore?: number
          percentageScore?: number
          quizId?: string
          rank?: number | null
          skippedCount?: number
          startedAt?: string
          status?: Database["public"]["Enums"]["AttemptStatus"]
          studentId?: string
          submittedAt?: string | null
          timeTakenSeconds?: number | null
          totalScore?: number
          updatedAt?: string
          wrongCount?: number
        }
        Relationships: [
          {
            foreignKeyName: "QuizAttempt_quizId_fkey"
            columns: ["quizId"]
            isOneToOne: false
            referencedRelation: "Quiz"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "QuizAttempt_studentId_fkey"
            columns: ["studentId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      QuizCategory: {
        Row: {
          createdAt: string
          description: string | null
          displayName: string
          id: string
          name: string
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          description?: string | null
          displayName: string
          id: string
          name: string
          updatedAt: string
        }
        Update: {
          createdAt?: string
          description?: string | null
          displayName?: string
          id?: string
          name?: string
          updatedAt?: string
        }
        Relationships: []
      }
      QuizQuestionMapping: {
        Row: {
          attemptId: string
          displayOrder: number
          id: string
          optionOrder: Json
          questionId: string
        }
        Insert: {
          attemptId: string
          displayOrder: number
          id: string
          optionOrder: Json
          questionId: string
        }
        Update: {
          attemptId?: string
          displayOrder?: number
          id?: string
          optionOrder?: Json
          questionId?: string
        }
        Relationships: [
          {
            foreignKeyName: "QuizQuestionMapping_attemptId_fkey"
            columns: ["attemptId"]
            isOneToOne: false
            referencedRelation: "QuizAttempt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "QuizQuestionMapping_questionId_fkey"
            columns: ["questionId"]
            isOneToOne: false
            referencedRelation: "Question"
            referencedColumns: ["id"]
          },
        ]
      }
      Session: {
        Row: {
          expires: string
          id: string
          sessionToken: string
          userId: string
        }
        Insert: {
          expires: string
          id: string
          sessionToken: string
          userId: string
        }
        Update: {
          expires?: string
          id?: string
          sessionToken?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Session_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      SessionLockSettings: {
        Row: {
          autoLockFirstBrowser: boolean
          createdAt: string
          id: string
          updatedAt: string
          userId: string
        }
        Insert: {
          autoLockFirstBrowser?: boolean
          createdAt?: string
          id: string
          updatedAt: string
          userId: string
        }
        Update: {
          autoLockFirstBrowser?: boolean
          createdAt?: string
          id?: string
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "SessionLockSettings_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      StudentModuleAvailability: {
        Row: {
          availabilityMode: string
          availableAt: string | null
          courseId: string
          createdAt: string
          id: string
          lessonNodeId: string
          updatedAt: string
          userId: string
        }
        Insert: {
          availabilityMode?: string
          availableAt?: string | null
          courseId: string
          createdAt?: string
          id: string
          lessonNodeId: string
          updatedAt: string
          userId: string
        }
        Update: {
          availabilityMode?: string
          availableAt?: string | null
          courseId?: string
          createdAt?: string
          id?: string
          lessonNodeId?: string
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "StudentModuleAvailability_courseId_fkey"
            columns: ["courseId"]
            isOneToOne: false
            referencedRelation: "Course"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "StudentModuleAvailability_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      User: {
        Row: {
          bmdcNumber: string | null
          canManagePayments: boolean
          createdAt: string
          degrees: string | null
          designation: string | null
          email: string
          emailVerificationExpires: string | null
          emailVerificationTokenHash: string | null
          emailVerified: boolean
          fullName: string
          id: string
          image: string | null
          institution: string | null
          isBanned: boolean
          isSessionLockedExempt: boolean
          passwordHash: string | null
          passwordResetExpires: string | null
          passwordResetTokenHash: string | null
          phone: string | null
          profileImage: string | null
          role: Database["public"]["Enums"]["UserRole"]
          telegramChatId: string | null
          updatedAt: string
        }
        Insert: {
          bmdcNumber?: string | null
          canManagePayments?: boolean
          createdAt?: string
          degrees?: string | null
          designation?: string | null
          email: string
          emailVerificationExpires?: string | null
          emailVerificationTokenHash?: string | null
          emailVerified?: boolean
          fullName: string
          id: string
          image?: string | null
          institution?: string | null
          isBanned?: boolean
          isSessionLockedExempt?: boolean
          passwordHash?: string | null
          passwordResetExpires?: string | null
          passwordResetTokenHash?: string | null
          phone?: string | null
          profileImage?: string | null
          role?: Database["public"]["Enums"]["UserRole"]
          telegramChatId?: string | null
          updatedAt: string
        }
        Update: {
          bmdcNumber?: string | null
          canManagePayments?: boolean
          createdAt?: string
          degrees?: string | null
          designation?: string | null
          email?: string
          emailVerificationExpires?: string | null
          emailVerificationTokenHash?: string | null
          emailVerified?: boolean
          fullName?: string
          id?: string
          image?: string | null
          institution?: string | null
          isBanned?: boolean
          isSessionLockedExempt?: boolean
          passwordHash?: string | null
          passwordResetExpires?: string | null
          passwordResetTokenHash?: string | null
          phone?: string | null
          profileImage?: string | null
          role?: Database["public"]["Enums"]["UserRole"]
          telegramChatId?: string | null
          updatedAt?: string
        }
        Relationships: []
      }
      VerificationToken: {
        Row: {
          expires: string
          identifier: string
          token: string
        }
        Insert: {
          expires: string
          identifier: string
          token: string
        }
        Update: {
          expires?: string
          identifier?: string
          token?: string
        }
        Relationships: []
      }
      VideoLibraryNode: {
        Row: {
          attachments: Json | null
          createdAt: string
          duration: string | null
          id: string
          parentId: string | null
          sortOrder: number
          title: string
          type: string
          updatedAt: string
          url: string | null
        }
        Insert: {
          attachments?: Json | null
          createdAt?: string
          duration?: string | null
          id: string
          parentId?: string | null
          sortOrder?: number
          title: string
          type: string
          updatedAt: string
          url?: string | null
        }
        Update: {
          attachments?: Json | null
          createdAt?: string
          duration?: string | null
          id?: string
          parentId?: string | null
          sortOrder?: number
          title?: string
          type?: string
          updatedAt?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "VideoLibraryNode_parentId_fkey"
            columns: ["parentId"]
            isOneToOne: false
            referencedRelation: "VideoLibraryNode"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_ban_user: {
        Args: { p_banned_by_label?: string; p_user_id: string }
        Returns: undefined
      }
      fn_create_device_session: {
        Args: {
          p_browser_name: string
          p_device_hash: string
          p_device_label: string
          p_device_type: string
          p_ip_address: string
          p_os_info: string
          p_user_agent: string
          p_user_id: string
        }
        Returns: Json
      }
      fn_logout_device_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
    }
    Enums: {
      AttemptStatus:
        | "in_progress"
        | "submitted"
        | "auto_submitted"
        | "abandoned"
      ContactIssueType:
        | "query"
        | "technical_assistance"
        | "billing"
        | "course_access"
        | "other"
      ContactSubmissionStatus: "open" | "in_review" | "responded" | "closed"
      CoursePublishStatus: "draft" | "scheduled" | "published" | "archived"
      CourseReleaseMode:
        | "fixed_interval"
        | "groups_per_week"
        | "day_of_week"
        | "explicit_dates"
        | "instant"
      DeviceType: "desktop" | "mobile" | "tablet"
      QuestionType: "mcq" | "true_false" | "sba"
      QuizPositionType: "best_attempt" | "last_attempt" | "first_attempt"
      QuizStatus: "draft" | "published" | "archived"
      UserRole: "admin" | "teacher" | "student"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      AttemptStatus: [
        "in_progress",
        "submitted",
        "auto_submitted",
        "abandoned",
      ],
      ContactIssueType: [
        "query",
        "technical_assistance",
        "billing",
        "course_access",
        "other",
      ],
      ContactSubmissionStatus: ["open", "in_review", "responded", "closed"],
      CoursePublishStatus: ["draft", "scheduled", "published", "archived"],
      CourseReleaseMode: [
        "fixed_interval",
        "groups_per_week",
        "day_of_week",
        "explicit_dates",
        "instant",
      ],
      DeviceType: ["desktop", "mobile", "tablet"],
      QuestionType: ["mcq", "true_false", "sba"],
      QuizPositionType: ["best_attempt", "last_attempt", "first_attempt"],
      QuizStatus: ["draft", "published", "archived"],
      UserRole: ["admin", "teacher", "student"],
    },
  },
} as const
