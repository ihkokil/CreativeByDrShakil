export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      User: {
        Row: {
          id: string
          email: string
          phone: string | null
          passwordHash: string | null
          fullName: string
          role: 'admin' | 'teacher' | 'student'
          bmdcNumber: string | null
          designation: string | null
          institution: string | null
          degrees: string | null
          profileImage: string | null
          emailVerified: boolean
          emailVerificationTokenHash: string | null
          emailVerificationExpires: string | null
          passwordResetTokenHash: string | null
          passwordResetExpires: string | null
          createdAt: string
          updatedAt: string
          canManagePayments: boolean
          isBanned: boolean
          telegramChatId: string | null
          image: string | null
          isSessionLockedExempt: boolean
        }
        Insert: Omit<Database['public']['Tables']['User']['Row'], 'createdAt' | 'updatedAt'> & {
          createdAt?: string
          updatedAt?: string
        }
        Update: Partial<Database['public']['Tables']['User']['Row']>
      }
      Course: {
        Row: {
          id: string
          slug: string | null
          title: string
          description: string
          overview: string | null
          categoryId: string | null
          price: number
          salePrice: number | null
          instructor: string
          language: string | null
          imageUrl: string | null
          duration: string
          courseStartDate: string | null
          learningOutcomes: string | null
          teacherId: string | null
          status: 'draft' | 'scheduled' | 'published' | 'archived'
          timezone: string
          releaseMode: 'fixed_interval' | 'groups_per_week' | 'day_of_week' | 'explicit_dates' | 'instant' | null
          releaseStartAt: string | null
          releaseIntervalDays: number | null
          releaseGroupsPerWeek: number | null
          releaseGroupDates: string | null
          curriculumJson: string | null
          publishedAt: string | null
          createdAt: string
          updatedAt: string
          isFeatured: boolean
          releaseDaysOfWeek: string | null
        }
        Insert: Omit<Database['public']['Tables']['Course']['Row'], 'createdAt' | 'updatedAt'> & {
          createdAt?: string
          updatedAt?: string
        }
        Update: Partial<Database['public']['Tables']['Course']['Row']>
      }
      LessonProgress: {
        Row: {
          id: string
          userId: string
          courseId: string
          lessonNodeId: string
          completedAt: string
          createdAt: string
          updatedAt: string
        }
        Insert: Omit<Database['public']['Tables']['LessonProgress']['Row'], 'createdAt' | 'updatedAt'> & {
          createdAt?: string
          updatedAt?: string
        }
        Update: Partial<Database['public']['Tables']['LessonProgress']['Row']>
      }
      StudentModuleAvailability: {
        Row: {
          id: string
          courseId: string
          userId: string
          lessonNodeId: string
          availabilityMode: string
          availableAt: string | null
          createdAt: string
          updatedAt: string
        }
        Insert: Omit<Database['public']['Tables']['StudentModuleAvailability']['Row'], 'createdAt' | 'updatedAt'> & {
          createdAt?: string
          updatedAt?: string
        }
        Update: Partial<Database['public']['Tables']['StudentModuleAvailability']['Row']>
      }
      CourseInstructor: {
        Row: {
          id: string
          courseId: string
          name: string
          designation: string | null
          sortOrder: number
          createdAt: string
          updatedAt: string
          imageUrl: string | null
        }
        Insert: Omit<Database['public']['Tables']['CourseInstructor']['Row'], 'createdAt' | 'updatedAt'> & {
          createdAt?: string
          updatedAt?: string
        }
        Update: Partial<Database['public']['Tables']['CourseInstructor']['Row']>
      }
      Order: {
        Row: {
          id: string
          userId: string
          courseId: string
          status: string
          totalAmount: number
          createdAt: string
          updatedAt: string
          enrolledAt: string | null
          expiresAt: string | null
        }
        Insert: Omit<Database['public']['Tables']['Order']['Row'], 'createdAt' | 'updatedAt'> & {
          createdAt?: string
          updatedAt?: string
        }
        Update: Partial<Database['public']['Tables']['Order']['Row']>
      }
      Payment: {
        Row: {
          id: string
          orderId: string
          phoneNumber: string
          transactionId: string
          amount: number
          status: string
          submittedAt: string
          approvedAt: string | null
        }
        Insert: Omit<Database['public']['Tables']['Payment']['Row'], 'submittedAt'> & {
          submittedAt?: string
        }
        Update: Partial<Database['public']['Tables']['Payment']['Row']>
      }
      PaymentConfig: {
        Row: {
          id: string
          provider: string
          sendMoneyNumber: string
          qrCodeUrl: string | null
          createdAt: string
          updatedAt: string
        }
        Insert: Omit<Database['public']['Tables']['PaymentConfig']['Row'], 'createdAt' | 'updatedAt'> & {
          createdAt?: string
          updatedAt?: string
        }
        Update: Partial<Database['public']['Tables']['PaymentConfig']['Row']>
      }
      ContactSubmission: {
        Row: {
          id: string
          fullName: string
          email: string
          phone: string
          issueType: 'query' | 'technical_assistance' | 'billing' | 'course_access' | 'other'
          subject: string
          message: string
          imageUrls: string | null
          status: 'open' | 'in_review' | 'responded' | 'closed'
          adminReply: string | null
          adminReplySentAt: string | null
          repliedByAdminId: string | null
          createdAt: string
          updatedAt: string
        }
        Insert: Omit<Database['public']['Tables']['ContactSubmission']['Row'], 'createdAt' | 'updatedAt'> & {
          createdAt?: string
          updatedAt?: string
        }
        Update: Partial<Database['public']['Tables']['ContactSubmission']['Row']>
      }
      DeviceSession: {
        Row: {
          id: string
          userId: string
          deviceType: 'desktop' | 'mobile' | 'tablet'
          browserName: string
          userAgent: string
          ipAddress: string
          isLocked: boolean
          loggedOutAt: string | null
          createdAt: string
          lastActivityAt: string
          deviceHash: string | null
          deviceLabel: string | null
          osInfo: string | null
          lockedByDeviceLabel: string | null
        }
        Insert: Omit<Database['public']['Tables']['DeviceSession']['Row'], 'createdAt' | 'lastActivityAt'> & {
          createdAt?: string
          lastActivityAt?: string
        }
        Update: Partial<Database['public']['Tables']['DeviceSession']['Row']>
      }
      SessionLockSettings: {
        Row: {
          id: string
          userId: string
          autoLockFirstBrowser: boolean
          createdAt: string
          updatedAt: string
        }
        Insert: Omit<Database['public']['Tables']['SessionLockSettings']['Row'], 'createdAt' | 'updatedAt'> & {
          createdAt?: string
          updatedAt?: string
        }
        Update: Partial<Database['public']['Tables']['SessionLockSettings']['Row']>
      }
      GlobalSessionLockSettings: {
        Row: {
          id: string
          autoLockFirstBrowser: boolean
          createdAt: string
          updatedAt: string
          allowDesktop: boolean
          allowTablet: boolean
          allowMobile: boolean
          maxConcurrentSessions: number
        }
        Insert: Omit<Database['public']['Tables']['GlobalSessionLockSettings']['Row'], 'createdAt' | 'updatedAt'> & {
          createdAt?: string
          updatedAt?: string
        }
        Update: Partial<Database['public']['Tables']['GlobalSessionLockSettings']['Row']>
      }
      VideoLibraryNode: {
        Row: {
          id: string
          title: string
          type: string
          url: string | null
          duration: string | null
          parentId: string | null
          attachments: Json | null
          sortOrder: number
          createdAt: string
          updatedAt: string
        }
        Insert: Omit<Database['public']['Tables']['VideoLibraryNode']['Row'], 'createdAt' | 'updatedAt'> & {
          createdAt?: string
          updatedAt?: string
        }
        Update: Partial<Database['public']['Tables']['VideoLibraryNode']['Row']>
      }
      Category: {
        Row: {
          id: string
          name: string
          displayName: string
          createdAt: string
          updatedAt: string
        }
        Insert: Omit<Database['public']['Tables']['Category']['Row'], 'createdAt' | 'updatedAt'> & {
          createdAt?: string
          updatedAt?: string
        }
        Update: Partial<Database['public']['Tables']['Category']['Row']>
      }
      EmailOtp: {
        Row: {
          id: string
          email: string
          otpHash: string
          expiresAt: string
          verified: boolean
          createdAt: string
        }
        Insert: Omit<Database['public']['Tables']['EmailOtp']['Row'], 'createdAt'> & {
          createdAt?: string
        }
        Update: Partial<Database['public']['Tables']['EmailOtp']['Row']>
      }
      Account: {
        Row: {
          id: string
          userId: string
          type: string
          provider: string
          providerAccountId: string
          refresh_token: string | null
          access_token: string | null
          expires_at: number | null
          token_type: string | null
          scope: string | null
          id_token: string | null
          session_state: string | null
        }
        Insert: Database['public']['Tables']['Account']['Row']
        Update: Partial<Database['public']['Tables']['Account']['Row']>
      }
      Session: {
        Row: {
          id: string
          sessionToken: string
          userId: string
          expires: string
        }
        Insert: Database['public']['Tables']['Session']['Row']
        Update: Partial<Database['public']['Tables']['Session']['Row']>
      }
      VerificationToken: {
        Row: {
          identifier: string
          token: string
          expires: string
        }
        Insert: Database['public']['Tables']['VerificationToken']['Row']
        Update: Partial<Database['public']['Tables']['VerificationToken']['Row']>
      }
    }
  }
}
