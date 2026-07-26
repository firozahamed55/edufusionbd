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
      academic_calendar: {
        Row: {
          cal_date: string
          holiday_label: string | null
          id: string
          institution_id: string
          is_working_day: boolean
        }
        Insert: {
          cal_date: string
          holiday_label?: string | null
          id?: string
          institution_id: string
          is_working_day?: boolean
        }
        Update: {
          cal_date?: string
          holiday_label?: string | null
          id?: string
          institution_id?: string
          is_working_day?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "academic_calendar_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_calendar_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      academic_term: {
        Row: {
          academic_year_id: string
          created_at: string
          end_date: string | null
          id: string
          institution_id: string
          is_current: boolean
          name_bn: string | null
          name_en: string
          start_date: string | null
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          institution_id: string
          is_current?: boolean
          name_bn?: string | null
          name_en: string
          start_date?: string | null
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          institution_id?: string
          is_current?: boolean
          name_bn?: string | null
          name_en?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_term_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_term_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_term_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      academic_year: {
        Row: {
          created_at: string
          deleted_at: string | null
          end_date: string | null
          id: string
          institution_id: string
          is_current: boolean
          start_date: string | null
          year_label: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          institution_id: string
          is_current?: boolean
          start_date?: string | null
          year_label: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          institution_id?: string
          is_current?: boolean
          start_date?: string | null
          year_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_year_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_year_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      access_log: {
        Row: {
          action: string | null
          at: string
          id: string
          institution_id: string | null
          ip: unknown
          profile_id: string | null
          user_agent: string | null
        }
        Insert: {
          action?: string | null
          at?: string
          id?: string
          institution_id?: string | null
          ip?: unknown
          profile_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string | null
          at?: string
          id?: string
          institution_id?: string | null
          ip?: unknown
          profile_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_log_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_log_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "access_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      admit_card: {
        Row: {
          admit_card_batch_id: string
          center: string | null
          id: string
          seat_no: string | null
          student_id: string | null
        }
        Insert: {
          admit_card_batch_id: string
          center?: string | null
          id?: string
          seat_no?: string | null
          student_id?: string | null
        }
        Update: {
          admit_card_batch_id?: string
          center?: string | null
          id?: string
          seat_no?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admit_card_admit_card_batch_id_fkey"
            columns: ["admit_card_batch_id"]
            isOneToOne: false
            referencedRelation: "admit_card_batch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admit_card_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      admit_card_batch: {
        Row: {
          center: string | null
          class_id: string | null
          created_at: string
          exam_id: string | null
          id: string
          includes: Json
          institution_id: string
          issue_date: string | null
          roll_from: number | null
          roll_to: number | null
          section_id: string | null
        }
        Insert: {
          center?: string | null
          class_id?: string | null
          created_at?: string
          exam_id?: string | null
          id?: string
          includes?: Json
          institution_id: string
          issue_date?: string | null
          roll_from?: number | null
          roll_to?: number | null
          section_id?: string | null
        }
        Update: {
          center?: string | null
          class_id?: string | null
          created_at?: string
          exam_id?: string | null
          id?: string
          includes?: Json
          institution_id?: string
          issue_date?: string | null
          roll_from?: number | null
          roll_to?: number | null
          section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admit_card_batch_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admit_card_batch_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exam"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admit_card_batch_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admit_card_batch_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "admit_card_batch_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          att_date: string
          class_section_id: string
          context: Database["public"]["Enums"]["attendance_context"]
          created_at: string
          exam_id: string | null
          exam_key: string | null
          guardian_sms_sent: boolean
          id: string
          institution_id: string
          marked_by: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          att_date: string
          class_section_id: string
          context?: Database["public"]["Enums"]["attendance_context"]
          created_at?: string
          exam_id?: string | null
          exam_key?: string | null
          guardian_sms_sent?: boolean
          id?: string
          institution_id: string
          marked_by?: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          att_date?: string
          class_section_id?: string
          context?: Database["public"]["Enums"]["attendance_context"]
          created_at?: string
          exam_id?: string | null
          exam_key?: string | null
          guardian_sms_sent?: boolean
          id?: string
          institution_id?: string
          marked_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_section_id_fkey"
            columns: ["class_section_id"]
            isOneToOne: false
            referencedRelation: "class_section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exam"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          after: Json | null
          at: string
          before: Json | null
          changed_by: string | null
          entity: string
          entity_id: string | null
          id: string
          institution_id: string | null
        }
        Insert: {
          action: string
          after?: Json | null
          at?: string
          before?: Json | null
          changed_by?: string | null
          entity: string
          entity_id?: string | null
          id?: string
          institution_id?: string | null
        }
        Update: {
          action?: string
          after?: Json | null
          at?: string
          before?: Json | null
          changed_by?: string | null
          entity?: string
          entity_id?: string | null
          id?: string
          institution_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      certificate_template: {
        Row: {
          created_at: string
          format_config: Json
          id: string
          institution_id: string
          is_default: boolean
          type: string
        }
        Insert: {
          created_at?: string
          format_config?: Json
          id?: string
          institution_id: string
          is_default?: boolean
          type: string
        }
        Update: {
          created_at?: string
          format_config?: Json
          id?: string
          institution_id?: string
          is_default?: boolean
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_template_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_template_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      class: {
        Row: {
          created_at: string
          deleted_at: string | null
          grade_scheme_id: string | null
          id: string
          institution_id: string
          name_bn: string
          name_en: string
          numeric_level: number | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          grade_scheme_id?: string | null
          id?: string
          institution_id: string
          name_bn: string
          name_en: string
          numeric_level?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          grade_scheme_id?: string | null
          id?: string
          institution_id?: string
          name_bn?: string
          name_en?: string
          numeric_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "class_grade_scheme_id_fkey"
            columns: ["grade_scheme_id"]
            isOneToOne: false
            referencedRelation: "grade_scheme"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      class_section: {
        Row: {
          academic_year_id: string
          capacity: number | null
          class_id: string
          class_teacher_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          institution_id: string
          room_no: string | null
          section_id: string
          shift_id: string | null
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          capacity?: number | null
          class_id: string
          class_teacher_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          institution_id: string
          room_no?: string | null
          section_id: string
          shift_id?: string | null
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          capacity?: number | null
          class_id?: string
          class_teacher_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          institution_id?: string
          room_no?: string | null
          section_id?: string
          shift_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_section_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_section_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_section_class_teacher_id_fkey"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_section_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_section_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "class_section_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_section_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shift"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subject: {
        Row: {
          class_id: string
          full_marks: number | null
          id: string
          institution_id: string
          is_optional: boolean
          pass_marks: number | null
          subject_id: string
        }
        Insert: {
          class_id: string
          full_marks?: number | null
          id?: string
          institution_id: string
          is_optional?: boolean
          pass_marks?: number | null
          subject_id: string
        }
        Update: {
          class_id?: string
          full_marks?: number | null
          id?: string
          institution_id?: string
          is_optional?: boolean
          pass_marks?: number | null
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_subject_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subject_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subject_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "class_subject_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject"
            referencedColumns: ["id"]
          },
        ]
      }
      code_sequence: {
        Row: {
          entity: string
          institution_id: string
          next_val: number
        }
        Insert: {
          entity: string
          institution_id: string
          next_val?: number
        }
        Update: {
          entity?: string
          institution_id?: string
          next_val?: number
        }
        Relationships: [
          {
            foreignKeyName: "code_sequence_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "code_sequence_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      comment_config: {
        Row: {
          config: Json
          id: string
          institution_id: string
        }
        Insert: {
          config?: Json
          id?: string
          institution_id: string
        }
        Update: {
          config?: Json
          id?: string
          institution_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_config_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_config_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      department: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          institution_id: string
          name: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          institution_id: string
          name: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          institution_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      designation: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          institution_id: string
          name: string
          rank: number | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          institution_id: string
          name: string
          rank?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          institution_id?: string
          name?: string
          rank?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "designation_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designation_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      digital_transaction: {
        Row: {
          amount: number
          at: string
          fee_invoice_id: string | null
          gateway: string
          gateway_txn_id: string | null
          id: string
          institution_id: string
          status: string
          student_id: string | null
        }
        Insert: {
          amount: number
          at?: string
          fee_invoice_id?: string | null
          gateway: string
          gateway_txn_id?: string | null
          id?: string
          institution_id: string
          status?: string
          student_id?: string | null
        }
        Update: {
          amount?: number
          at?: string
          fee_invoice_id?: string | null
          gateway?: string
          gateway_txn_id?: string | null
          id?: string
          institution_id?: string
          status?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "digital_transaction_fee_invoice_id_fkey"
            columns: ["fee_invoice_id"]
            isOneToOne: false
            referencedRelation: "fee_invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_transaction_fee_invoice_id_fkey"
            columns: ["fee_invoice_id"]
            isOneToOne: false
            referencedRelation: "v_fee_invoice_balance"
            referencedColumns: ["fee_invoice_id"]
          },
          {
            foreignKeyName: "digital_transaction_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_transaction_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "digital_transaction_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      district: {
        Row: {
          created_at: string
          division_id: string
          id: string
          name_bn: string
          name_en: string
        }
        Insert: {
          created_at?: string
          division_id: string
          id?: string
          name_bn: string
          name_en: string
        }
        Update: {
          created_at?: string
          division_id?: string
          id?: string
          name_bn?: string
          name_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "district_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "division"
            referencedColumns: ["id"]
          },
        ]
      }
      division: {
        Row: {
          created_at: string
          id: string
          name_bn: string
          name_en: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_bn: string
          name_en: string
        }
        Update: {
          created_at?: string
          id?: string
          name_bn?: string
          name_en?: string
        }
        Relationships: []
      }
      education_board: {
        Row: {
          created_at: string
          id: string
          name: string
          short_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          short_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          short_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      enum_label: {
        Row: {
          enum_type: string
          id: string
          label_bn: string
          label_en: string
          token: string
        }
        Insert: {
          enum_type: string
          id?: string
          label_bn: string
          label_en: string
          token: string
        }
        Update: {
          enum_type?: string
          id?: string
          label_bn?: string
          label_en?: string
          token?: string
        }
        Relationships: []
      }
      exam: {
        Row: {
          academic_term_id: string | null
          academic_year_id: string
          created_at: string
          end_date: string | null
          grade_scheme_id: string | null
          id: string
          institution_id: string
          name: string
          start_date: string | null
          status: string
          type: string | null
          updated_at: string
        }
        Insert: {
          academic_term_id?: string | null
          academic_year_id: string
          created_at?: string
          end_date?: string | null
          grade_scheme_id?: string | null
          id?: string
          institution_id: string
          name: string
          start_date?: string | null
          status?: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          academic_term_id?: string | null
          academic_year_id?: string
          created_at?: string
          end_date?: string | null
          grade_scheme_id?: string | null
          id?: string
          institution_id?: string
          name?: string
          start_date?: string | null
          status?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_academic_term_id_fkey"
            columns: ["academic_term_id"]
            isOneToOne: false
            referencedRelation: "academic_term"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_grade_scheme_id_fkey"
            columns: ["grade_scheme_id"]
            isOneToOne: false
            referencedRelation: "grade_scheme"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      exam_date_config: {
        Row: {
          config: Json
          exam_id: string | null
          id: string
          institution_id: string
        }
        Insert: {
          config?: Json
          exam_id?: string | null
          id?: string
          institution_id: string
        }
        Update: {
          config?: Json
          exam_id?: string | null
          id?: string
          institution_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_date_config_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exam"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_date_config_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_date_config_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      exam_result: {
        Row: {
          created_at: string
          exam_id: string
          gpa: number | null
          grade: string | null
          id: string
          institution_id: string
          merit_rank: number | null
          result: string | null
          status: string
          student_id: string
          total_marks: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_id: string
          gpa?: number | null
          grade?: string | null
          id?: string
          institution_id: string
          merit_rank?: number | null
          result?: string | null
          status?: string
          student_id: string
          total_marks?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_id?: string
          gpa?: number | null
          grade?: string | null
          id?: string
          institution_id?: string
          merit_rank?: number | null
          result?: string | null
          status?: string
          student_id?: string
          total_marks?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_result_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exam"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_result_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_result_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "exam_result_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_subject: {
        Row: {
          class_id: string
          duration: number | null
          exam_date: string | null
          exam_id: string
          full_marks: number | null
          id: string
          pass_marks: number | null
          start_time: string | null
          subject_id: string
        }
        Insert: {
          class_id: string
          duration?: number | null
          exam_date?: string | null
          exam_id: string
          full_marks?: number | null
          id?: string
          pass_marks?: number | null
          start_time?: string | null
          subject_id: string
        }
        Update: {
          class_id?: string
          duration?: number | null
          exam_date?: string | null
          exam_id?: string
          full_marks?: number | null
          id?: string
          pass_marks?: number | null
          start_time?: string | null
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_subject_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_subject_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exam"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_subject_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject"
            referencedColumns: ["id"]
          },
        ]
      }
      export_log: {
        Row: {
          at: string
          file_id: string | null
          id: string
          institution_id: string
          kind: string | null
          params: Json | null
          profile_id: string | null
        }
        Insert: {
          at?: string
          file_id?: string | null
          id?: string
          institution_id: string
          kind?: string | null
          params?: Json | null
          profile_id?: string | null
        }
        Update: {
          at?: string
          file_id?: string | null
          id?: string
          institution_id?: string
          kind?: string | null
          params?: Json | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "export_log_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "file_object"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_log_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_log_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "export_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_head: {
        Row: {
          category: string
          created_at: string
          deleted_at: string | null
          id: string
          institution_id: string
          is_recurring: boolean
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          institution_id: string
          is_recurring?: boolean
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          institution_id?: string
          is_recurring?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_head_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_head_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      fee_invoice: {
        Row: {
          academic_term_id: string | null
          academic_year_id: string
          created_at: string
          deleted_at: string | null
          due_amount: number | null
          due_date: string | null
          id: string
          institution_id: string
          paid_amount: number
          period: string | null
          status: string
          student_id: string
          total_amount: number
          updated_at: string
          waiver_amount: number
        }
        Insert: {
          academic_term_id?: string | null
          academic_year_id: string
          created_at?: string
          deleted_at?: string | null
          due_amount?: number | null
          due_date?: string | null
          id?: string
          institution_id: string
          paid_amount?: number
          period?: string | null
          status?: string
          student_id: string
          total_amount?: number
          updated_at?: string
          waiver_amount?: number
        }
        Update: {
          academic_term_id?: string | null
          academic_year_id?: string
          created_at?: string
          deleted_at?: string | null
          due_amount?: number | null
          due_date?: string | null
          id?: string
          institution_id?: string
          paid_amount?: number
          period?: string | null
          status?: string
          student_id?: string
          total_amount?: number
          updated_at?: string
          waiver_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "fee_invoice_academic_term_id_fkey"
            columns: ["academic_term_id"]
            isOneToOne: false
            referencedRelation: "academic_term"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoice_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoice_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoice_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "fee_invoice_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_invoice_line: {
        Row: {
          amount: number
          fee_head_id: string
          fee_invoice_id: string
          id: string
          waiver: number
        }
        Insert: {
          amount?: number
          fee_head_id: string
          fee_invoice_id: string
          id?: string
          waiver?: number
        }
        Update: {
          amount?: number
          fee_head_id?: string
          fee_invoice_id?: string
          id?: string
          waiver?: number
        }
        Relationships: [
          {
            foreignKeyName: "fee_invoice_line_fee_head_id_fkey"
            columns: ["fee_head_id"]
            isOneToOne: false
            referencedRelation: "fee_head"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoice_line_fee_invoice_id_fkey"
            columns: ["fee_invoice_id"]
            isOneToOne: false
            referencedRelation: "fee_invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoice_line_fee_invoice_id_fkey"
            columns: ["fee_invoice_id"]
            isOneToOne: false
            referencedRelation: "v_fee_invoice_balance"
            referencedColumns: ["fee_invoice_id"]
          },
        ]
      }
      fee_mapping: {
        Row: {
          amount: number
          class_id: string
          created_at: string
          fee_head_id: string
          frequency: string
          id: string
          institution_id: string
          is_active: boolean
          student_category_id: string | null
        }
        Insert: {
          amount?: number
          class_id: string
          created_at?: string
          fee_head_id: string
          frequency: string
          id?: string
          institution_id: string
          is_active?: boolean
          student_category_id?: string | null
        }
        Update: {
          amount?: number
          class_id?: string
          created_at?: string
          fee_head_id?: string
          frequency?: string
          id?: string
          institution_id?: string
          is_active?: boolean
          student_category_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_mapping_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_mapping_fee_head_id_fkey"
            columns: ["fee_head_id"]
            isOneToOne: false
            referencedRelation: "fee_head"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_mapping_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_mapping_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "fee_mapping_student_category_id_fkey"
            columns: ["student_category_id"]
            isOneToOne: false
            referencedRelation: "student_category"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_payment: {
        Row: {
          account_id: string | null
          amount: number
          fee_invoice_id: string
          id: string
          institution_id: string
          method: string
          paid_at: string
          paid_by: string | null
          received_by: string | null
          sms_sent: boolean
          student_id: string | null
          txn_ref: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          fee_invoice_id: string
          id?: string
          institution_id: string
          method: string
          paid_at?: string
          paid_by?: string | null
          received_by?: string | null
          sms_sent?: boolean
          student_id?: string | null
          txn_ref?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          fee_invoice_id?: string
          id?: string
          institution_id?: string
          method?: string
          paid_at?: string
          paid_by?: string | null
          received_by?: string | null
          sms_sent?: boolean
          student_id?: string | null
          txn_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_payment_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payment_fee_invoice_id_fkey"
            columns: ["fee_invoice_id"]
            isOneToOne: false
            referencedRelation: "fee_invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payment_fee_invoice_id_fkey"
            columns: ["fee_invoice_id"]
            isOneToOne: false
            referencedRelation: "v_fee_invoice_balance"
            referencedColumns: ["fee_invoice_id"]
          },
          {
            foreignKeyName: "fee_payment_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payment_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "fee_payment_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payment_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      file_object: {
        Row: {
          bucket: string
          checksum: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          institution_id: string
          mime: string | null
          path: string
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          bucket: string
          checksum?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          institution_id: string
          mime?: string | null
          path: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          bucket?: string
          checksum?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          institution_id?: string
          mime?: string | null
          path?: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_object_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_object_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "file_object_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_account: {
        Row: {
          created_at: string
          id: string
          institution_id: string
          is_active: boolean
          name: string
          opening_balance: number
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id: string
          is_active?: boolean
          name: string
          opening_balance?: number
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string
          is_active?: boolean
          name?: string
          opening_balance?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_account_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_account_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      grade_scale: {
        Row: {
          gpa_point: number
          grade_letter: string
          grade_scheme_id: string
          id: string
          max_marks: number
          min_marks: number
        }
        Insert: {
          gpa_point: number
          grade_letter: string
          grade_scheme_id: string
          id?: string
          max_marks: number
          min_marks: number
        }
        Update: {
          gpa_point?: number
          grade_letter?: string
          grade_scheme_id?: string
          id?: string
          max_marks?: number
          min_marks?: number
        }
        Relationships: [
          {
            foreignKeyName: "grade_scale_grade_scheme_id_fkey"
            columns: ["grade_scheme_id"]
            isOneToOne: false
            referencedRelation: "grade_scheme"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_scheme: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          institution_id: string
          is_default: boolean
          name: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          institution_id: string
          is_default?: boolean
          name: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          institution_id?: string
          is_default?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_scheme_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_scheme_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      guardian: {
        Row: {
          alt_mobile: string | null
          created_at: string
          deleted_at: string | null
          id: string
          institution_id: string
          metadata: Json
          mobile: string | null
          monthly_income: number | null
          name: string
          nid: string | null
          occupation: string | null
          updated_at: string
        }
        Insert: {
          alt_mobile?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          institution_id: string
          metadata?: Json
          mobile?: string | null
          monthly_income?: number | null
          name: string
          nid?: string | null
          occupation?: string | null
          updated_at?: string
        }
        Update: {
          alt_mobile?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          institution_id?: string
          metadata?: Json
          mobile?: string | null
          monthly_income?: number | null
          name?: string
          nid?: string | null
          occupation?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      id_card_batch: {
        Row: {
          class_color: string | null
          class_id: string | null
          created_at: string
          id: string
          includes: Json
          institution_id: string
          roll_from: number | null
          roll_to: number | null
          section_id: string | null
          template: string | null
          valid_till: string | null
        }
        Insert: {
          class_color?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          includes?: Json
          institution_id: string
          roll_from?: number | null
          roll_to?: number | null
          section_id?: string | null
          template?: string | null
          valid_till?: string | null
        }
        Update: {
          class_color?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          includes?: Json
          institution_id?: string
          roll_from?: number | null
          roll_to?: number | null
          section_id?: string | null
          template?: string | null
          valid_till?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "id_card_batch_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "id_card_batch_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "id_card_batch_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "id_card_batch_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
        ]
      }
      institution: {
        Row: {
          address: string | null
          board_id: string | null
          created_at: string
          deleted_at: string | null
          eiin: string | null
          email: string | null
          established_year: number | null
          head_teacher_id: string | null
          id: string
          institution_type: string | null
          logo_file_id: string | null
          metadata: Json
          name_bn: string
          name_en: string
          phone: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          board_id?: string | null
          created_at?: string
          deleted_at?: string | null
          eiin?: string | null
          email?: string | null
          established_year?: number | null
          head_teacher_id?: string | null
          id?: string
          institution_type?: string | null
          logo_file_id?: string | null
          metadata?: Json
          name_bn: string
          name_en: string
          phone?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          board_id?: string | null
          created_at?: string
          deleted_at?: string | null
          eiin?: string | null
          email?: string | null
          established_year?: number | null
          head_teacher_id?: string | null
          id?: string
          institution_type?: string | null
          logo_file_id?: string | null
          metadata?: Json
          name_bn?: string
          name_en?: string
          phone?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institution_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "education_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_head_teacher_fk"
            columns: ["head_teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_logo_file_fk"
            columns: ["logo_file_id"]
            isOneToOne: false
            referencedRelation: "file_object"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_head: {
        Row: {
          created_at: string
          designation: string | null
          id: string
          institution_id: string
          name: string
          signature_file_id: string | null
        }
        Insert: {
          created_at?: string
          designation?: string | null
          id?: string
          institution_id: string
          name: string
          signature_file_id?: string | null
        }
        Update: {
          created_at?: string
          designation?: string | null
          id?: string
          institution_id?: string
          name?: string
          signature_file_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institution_head_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_head_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "institution_head_signature_file_id_fkey"
            columns: ["signature_file_id"]
            isOneToOne: false
            referencedRelation: "file_object"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entry: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          entry_date: string
          head: string | null
          id: string
          institution_id: string
          note: string | null
          source_id: string | null
          source_type: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          entry_date?: string
          head?: string | null
          id?: string
          institution_id: string
          note?: string | null
          source_id?: string | null
          source_type?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          direction?: Database["public"]["Enums"]["ledger_direction"]
          entry_date?: string
          head?: string | null
          id?: string
          institution_id?: string
          note?: string | null
          source_id?: string | null
          source_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entry_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entry_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entry_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      mark: {
        Row: {
          created_at: string
          entered_by: string | null
          exam_subject_id: string
          id: string
          institution_id: string
          is_absent: boolean
          marks_obtained: number | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entered_by?: string | null
          exam_subject_id: string
          id?: string
          institution_id: string
          is_absent?: boolean
          marks_obtained?: number | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entered_by?: string | null
          exam_subject_id?: string
          id?: string
          institution_id?: string
          is_absent?: boolean
          marks_obtained?: number | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mark_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mark_exam_subject_id_fkey"
            columns: ["exam_subject_id"]
            isOneToOne: false
            referencedRelation: "exam_subject"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mark_exam_subject_id_fkey"
            columns: ["exam_subject_id"]
            isOneToOne: false
            referencedRelation: "v_effective_subject_marks"
            referencedColumns: ["exam_subject_id"]
          },
          {
            foreignKeyName: "mark_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mark_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "mark_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      mark_config: {
        Row: {
          config: Json
          id: string
          institution_id: string
        }
        Insert: {
          config?: Json
          id?: string
          institution_id: string
        }
        Update: {
          config?: Json
          id?: string
          institution_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mark_config_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mark_config_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      marksheet_config: {
        Row: {
          class_id: string | null
          config: Json
          exam_id: string | null
          id: string
          institution_id: string
        }
        Insert: {
          class_id?: string | null
          config?: Json
          exam_id?: string | null
          id?: string
          institution_id: string
        }
        Update: {
          class_id?: string | null
          config?: Json
          exam_id?: string | null
          id?: string
          institution_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marksheet_config_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marksheet_config_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exam"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marksheet_config_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marksheet_config_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      migration_batch: {
        Row: {
          academic_year_id: string
          created_at: string
          created_by: string | null
          id: string
          institution_id: string
          source_class_section_id: string | null
          status: string
          target_class_section_id: string | null
          type: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id: string
          source_class_section_id?: string | null
          status?: string
          target_class_section_id?: string | null
          type?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          institution_id?: string
          source_class_section_id?: string | null
          status?: string
          target_class_section_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "migration_batch_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "migration_batch_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "migration_batch_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "migration_batch_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "migration_batch_source_class_section_id_fkey"
            columns: ["source_class_section_id"]
            isOneToOne: false
            referencedRelation: "class_section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "migration_batch_target_class_section_id_fkey"
            columns: ["target_class_section_id"]
            isOneToOne: false
            referencedRelation: "class_section"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_student: {
        Row: {
          id: string
          merit_rank: number | null
          migration_batch_id: string
          new_roll: number | null
          old_roll: number | null
          result: string | null
          source_enrollment_id: string | null
          student_id: string
          target_enrollment_id: string | null
        }
        Insert: {
          id?: string
          merit_rank?: number | null
          migration_batch_id: string
          new_roll?: number | null
          old_roll?: number | null
          result?: string | null
          source_enrollment_id?: string | null
          student_id: string
          target_enrollment_id?: string | null
        }
        Update: {
          id?: string
          merit_rank?: number | null
          migration_batch_id?: string
          new_roll?: number | null
          old_roll?: number | null
          result?: string | null
          source_enrollment_id?: string | null
          student_id?: string
          target_enrollment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "migration_student_migration_batch_id_fkey"
            columns: ["migration_batch_id"]
            isOneToOne: false
            referencedRelation: "migration_batch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "migration_student_source_enrollment_id_fkey"
            columns: ["source_enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "migration_student_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "migration_student_target_enrollment_id_fkey"
            columns: ["target_enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollment"
            referencedColumns: ["id"]
          },
        ]
      }
      notice: {
        Row: {
          audience: string | null
          body: string | null
          created_at: string
          created_by: string | null
          date_range: unknown
          event_date: string | null
          id: string
          institution_id: string
          is_archived: boolean
          status: string
          title: string
        }
        Insert: {
          audience?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          date_range?: unknown
          event_date?: string | null
          id?: string
          institution_id: string
          is_archived?: boolean
          status?: string
          title: string
        }
        Update: {
          audience?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          date_range?: unknown
          event_date?: string | null
          id?: string
          institution_id?: string
          is_archived?: boolean
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notice_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notice_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      notice_attachment: {
        Row: {
          file_id: string | null
          id: string
          notice_id: string
        }
        Insert: {
          file_id?: string | null
          id?: string
          notice_id: string
        }
        Update: {
          file_id?: string | null
          id?: string
          notice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_attachment_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "file_object"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notice_attachment_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notice"
            referencedColumns: ["id"]
          },
        ]
      }
      notification: {
        Row: {
          at: string
          id: string
          institution_id: string | null
          is_read: boolean
          message: string | null
          profile_id: string
          type: string | null
        }
        Insert: {
          at?: string
          id?: string
          institution_id?: string | null
          is_read?: boolean
          message?: string | null
          profile_id: string
          type?: string | null
        }
        Update: {
          at?: string
          id?: string
          institution_id?: string | null
          is_read?: boolean
          message?: string | null
          profile_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "notification_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      permission: {
        Row: {
          code: string
          id: string
          label: string
          module: string
        }
        Insert: {
          code: string
          id?: string
          label: string
          module: string
        }
        Update: {
          code?: string
          id?: string
          label?: string
          module?: string
        }
        Relationships: []
      }
      plan: {
        Row: {
          code: string
          created_at: string
          features: Json
          id: string
          is_active: boolean
          max_students: number | null
          name: string
          price_monthly: number
        }
        Insert: {
          code: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_students?: number | null
          name: string
          price_monthly?: number
        }
        Update: {
          code?: string
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          max_students?: number | null
          name?: string
          price_monthly?: number
        }
        Relationships: []
      }
      profile: {
        Row: {
          avatar_file_id: string | null
          created_at: string
          full_name: string | null
          id: string
          institution_id: string | null
          is_platform_admin: boolean
          last_login_at: string | null
          linked_guardian_id: string | null
          linked_student_id: string | null
          linked_teacher_id: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_file_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          institution_id?: string | null
          is_platform_admin?: boolean
          last_login_at?: string | null
          linked_guardian_id?: string | null
          linked_student_id?: string | null
          linked_teacher_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_file_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          institution_id?: string | null
          is_platform_admin?: boolean
          last_login_at?: string | null
          linked_guardian_id?: string | null
          linked_student_id?: string | null
          linked_teacher_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_avatar_file_fk"
            columns: ["avatar_file_id"]
            isOneToOne: false
            referencedRelation: "file_object"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "profile_linked_guardian_fk"
            columns: ["linked_guardian_id"]
            isOneToOne: false
            referencedRelation: "guardian"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_linked_student_fk"
            columns: ["linked_student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_linked_teacher_fk"
            columns: ["linked_teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher"
            referencedColumns: ["id"]
          },
        ]
      }
      result_approval: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          exam_id: string
          id: string
          status: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          exam_id: string
          id?: string
          status?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          exam_id?: string
          id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "result_approval_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_approval_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: true
            referencedRelation: "exam"
            referencedColumns: ["id"]
          },
        ]
      }
      result_sheet_export: {
        Row: {
          at: string
          class_id: string | null
          exam_id: string
          file_id: string | null
          format: string | null
          generated_by: string | null
          id: string
          institution_id: string
          section_id: string | null
        }
        Insert: {
          at?: string
          class_id?: string | null
          exam_id: string
          file_id?: string | null
          format?: string | null
          generated_by?: string | null
          id?: string
          institution_id: string
          section_id?: string | null
        }
        Update: {
          at?: string
          class_id?: string | null
          exam_id?: string
          file_id?: string | null
          format?: string | null
          generated_by?: string | null
          id?: string
          institution_id?: string
          section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "result_sheet_export_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_sheet_export_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exam"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_sheet_export_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "file_object"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_sheet_export_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_sheet_export_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_sheet_export_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "result_sheet_export_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "section"
            referencedColumns: ["id"]
          },
        ]
      }
      role: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          institution_id: string | null
          is_system: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          institution_id?: string | null
          is_system?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          institution_id?: string | null
          is_system?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      role_permission: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permission_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permission"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permission_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role"
            referencedColumns: ["id"]
          },
        ]
      }
      seat_plan: {
        Row: {
          arrangement: string | null
          exam_id: string | null
          id: string
          institution_id: string
          per_bench: number | null
          room_no: string | null
          seats_per_room: number | null
        }
        Insert: {
          arrangement?: string | null
          exam_id?: string | null
          id?: string
          institution_id: string
          per_bench?: number | null
          room_no?: string | null
          seats_per_room?: number | null
        }
        Update: {
          arrangement?: string | null
          exam_id?: string | null
          id?: string
          institution_id?: string
          per_bench?: number | null
          room_no?: string | null
          seats_per_room?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seat_plan_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exam"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_plan_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_plan_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      section: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          institution_id: string
          name: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          institution_id: string
          name: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          institution_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      setting: {
        Row: {
          id: string
          institution_id: string
          key: string
          scope: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          institution_id: string
          key: string
          scope?: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          institution_id?: string
          key?: string
          scope?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "setting_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setting_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      shift: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          institution_id: string
          name: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          institution_id: string
          name: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          institution_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      signature: {
        Row: {
          created_at: string
          holder_name: string | null
          id: string
          image_file_id: string | null
          institution_id: string
          role_label: string
        }
        Insert: {
          created_at?: string
          holder_name?: string | null
          id?: string
          image_file_id?: string | null
          institution_id: string
          role_label: string
        }
        Update: {
          created_at?: string
          holder_name?: string | null
          id?: string
          image_file_id?: string | null
          institution_id?: string
          role_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_image_file_id_fkey"
            columns: ["image_file_id"]
            isOneToOne: false
            referencedRelation: "file_object"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      sms_account: {
        Row: {
          balance: number
          id: string
          institution_id: string
          last_recharge_amount: number | null
          last_recharge_at: string | null
          masking_enabled: boolean
          per_sms_rate: number
        }
        Insert: {
          balance?: number
          id?: string
          institution_id: string
          last_recharge_amount?: number | null
          last_recharge_at?: string | null
          masking_enabled?: boolean
          per_sms_rate?: number
        }
        Update: {
          balance?: number
          id?: string
          institution_id?: string
          last_recharge_amount?: number | null
          last_recharge_at?: string | null
          masking_enabled?: boolean
          per_sms_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "sms_account_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_account_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      sms_campaign: {
        Row: {
          body: string | null
          created_at: string
          est_cost: number | null
          id: string
          institution_id: string
          language: Database["public"]["Enums"]["app_language"] | null
          recipient_count: number | null
          recipient_group: string | null
          recipient_type: string | null
          segment_count: number | null
          sent_at: string | null
          sent_by: string | null
          template_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          est_cost?: number | null
          id?: string
          institution_id: string
          language?: Database["public"]["Enums"]["app_language"] | null
          recipient_count?: number | null
          recipient_group?: string | null
          recipient_type?: string | null
          segment_count?: number | null
          sent_at?: string | null
          sent_by?: string | null
          template_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          est_cost?: number | null
          id?: string
          institution_id?: string
          language?: Database["public"]["Enums"]["app_language"] | null
          recipient_count?: number | null
          recipient_group?: string | null
          recipient_type?: string | null
          segment_count?: number | null
          sent_at?: string | null
          sent_by?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_campaign_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_campaign_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "sms_campaign_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_campaign_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sms_template"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_package: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          masking: boolean
          name: string
          price: number
          rate: number
          sms_qty: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          masking?: boolean
          name: string
          price?: number
          rate?: number
          sms_qty: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          masking?: boolean
          name?: string
          price?: number
          rate?: number
          sms_qty?: number
        }
        Relationships: []
      }
      sms_provider_account: {
        Row: {
          created_at: string
          credentials_ref: string | null
          id: string
          institution_id: string
          masking_enabled: boolean
          provider: string
          sender_id: string | null
        }
        Insert: {
          created_at?: string
          credentials_ref?: string | null
          id?: string
          institution_id: string
          masking_enabled?: boolean
          provider: string
          sender_id?: string | null
        }
        Update: {
          created_at?: string
          credentials_ref?: string | null
          id?: string
          institution_id?: string
          masking_enabled?: boolean
          provider?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_provider_account_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_provider_account_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      sms_recipient: {
        Row: {
          cost: number | null
          delivered_at: string | null
          error_code: string | null
          id: string
          profile_id: string | null
          provider_msg_id: string | null
          recipient_msisdn: string
          sms_campaign_id: string
          status: string
          student_id: string | null
        }
        Insert: {
          cost?: number | null
          delivered_at?: string | null
          error_code?: string | null
          id?: string
          profile_id?: string | null
          provider_msg_id?: string | null
          recipient_msisdn: string
          sms_campaign_id: string
          status?: string
          student_id?: string | null
        }
        Update: {
          cost?: number | null
          delivered_at?: string | null
          error_code?: string | null
          id?: string
          profile_id?: string | null
          provider_msg_id?: string | null
          recipient_msisdn?: string
          sms_campaign_id?: string
          status?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_recipient_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_recipient_sms_campaign_id_fkey"
            columns: ["sms_campaign_id"]
            isOneToOne: false
            referencedRelation: "sms_campaign"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_recipient_sms_campaign_id_fkey"
            columns: ["sms_campaign_id"]
            isOneToOne: false
            referencedRelation: "v_sms_campaign_summary"
            referencedColumns: ["sms_campaign_id"]
          },
          {
            foreignKeyName: "sms_recipient_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_template: {
        Row: {
          body: string
          category: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          institution_id: string
          name: string
          usage_count: number
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          institution_id: string
          name: string
          usage_count?: number
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          institution_id?: string
          name?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "sms_template_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_template_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      sms_transaction: {
        Row: {
          amount: number
          at: string
          id: string
          institution_id: string
          sms_account_id: string
          sms_added: number
          sms_package_id: string | null
        }
        Insert: {
          amount?: number
          at?: string
          id?: string
          institution_id: string
          sms_account_id: string
          sms_added?: number
          sms_package_id?: string | null
        }
        Update: {
          amount?: number
          at?: string
          id?: string
          institution_id?: string
          sms_account_id?: string
          sms_added?: number
          sms_package_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_transaction_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_transaction_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "sms_transaction_sms_account_id_fkey"
            columns: ["sms_account_id"]
            isOneToOne: false
            referencedRelation: "sms_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_transaction_sms_package_id_fkey"
            columns: ["sms_package_id"]
            isOneToOne: false
            referencedRelation: "sms_package"
            referencedColumns: ["id"]
          },
        ]
      }
      student: {
        Row: {
          admission_date: string | null
          birth_reg_no: string | null
          blood_group: Database["public"]["Enums"]["blood_group"] | null
          created_at: string
          created_by: string | null
          current_enrollment_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          dob: string
          gender: Database["public"]["Enums"]["gender"]
          id: string
          institution_id: string
          metadata: Json
          name_bn: string
          name_en: string
          nationality: string | null
          photo_file_id: string | null
          religion: Database["public"]["Enums"]["religion"] | null
          status: string
          student_category_id: string | null
          student_code: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admission_date?: string | null
          birth_reg_no?: string | null
          blood_group?: Database["public"]["Enums"]["blood_group"] | null
          created_at?: string
          created_by?: string | null
          current_enrollment_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dob: string
          gender: Database["public"]["Enums"]["gender"]
          id?: string
          institution_id: string
          metadata?: Json
          name_bn: string
          name_en: string
          nationality?: string | null
          photo_file_id?: string | null
          religion?: Database["public"]["Enums"]["religion"] | null
          status?: string
          student_category_id?: string | null
          student_code?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admission_date?: string | null
          birth_reg_no?: string | null
          blood_group?: Database["public"]["Enums"]["blood_group"] | null
          created_at?: string
          created_by?: string | null
          current_enrollment_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dob?: string
          gender?: Database["public"]["Enums"]["gender"]
          id?: string
          institution_id?: string
          metadata?: Json
          name_bn?: string
          name_en?: string
          nationality?: string | null
          photo_file_id?: string | null
          religion?: Database["public"]["Enums"]["religion"] | null
          status?: string
          student_category_id?: string | null
          student_code?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_current_enrollment_fk"
            columns: ["current_enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_photo_file_id_fkey"
            columns: ["photo_file_id"]
            isOneToOne: false
            referencedRelation: "file_object"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_student_category_id_fkey"
            columns: ["student_category_id"]
            isOneToOne: false
            referencedRelation: "student_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      student_address: {
        Row: {
          district_id: string | null
          division_id: string | null
          house_road: string | null
          id: string
          student_id: string
          type: string
          upazila_id: string | null
          village: string | null
        }
        Insert: {
          district_id?: string | null
          division_id?: string | null
          house_road?: string | null
          id?: string
          student_id: string
          type: string
          upazila_id?: string | null
          village?: string | null
        }
        Update: {
          district_id?: string | null
          division_id?: string | null
          house_road?: string | null
          id?: string
          student_id?: string
          type?: string
          upazila_id?: string | null
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_address_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "district"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_address_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "division"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_address_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_address_upazila_id_fkey"
            columns: ["upazila_id"]
            isOneToOne: false
            referencedRelation: "upazila"
            referencedColumns: ["id"]
          },
        ]
      }
      student_category: {
        Row: {
          basis: string
          created_at: string
          deleted_at: string | null
          discount_type: string
          discount_value: number
          id: string
          institution_id: string
          name: string
        }
        Insert: {
          basis?: string
          created_at?: string
          deleted_at?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          institution_id: string
          name: string
        }
        Update: {
          basis?: string
          created_at?: string
          deleted_at?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          institution_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_category_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_category_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      student_document: {
        Row: {
          created_at: string
          file_id: string | null
          id: string
          student_id: string
          type: string
        }
        Insert: {
          created_at?: string
          file_id?: string | null
          id?: string
          student_id: string
          type: string
        }
        Update: {
          created_at?: string
          file_id?: string | null
          id?: string
          student_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_document_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "file_object"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_document_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      student_enrollment: {
        Row: {
          academic_year_id: string
          class_section_id: string
          created_at: string
          deleted_at: string | null
          id: string
          institution_id: string
          promoted_from_id: string | null
          roll_no: number | null
          status: string
          student_id: string
        }
        Insert: {
          academic_year_id: string
          class_section_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          institution_id: string
          promoted_from_id?: string | null
          roll_no?: number | null
          status?: string
          student_id: string
        }
        Update: {
          academic_year_id?: string
          class_section_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          institution_id?: string
          promoted_from_id?: string | null
          roll_no?: number | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollment_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollment_class_section_id_fkey"
            columns: ["class_section_id"]
            isOneToOne: false
            referencedRelation: "class_section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollment_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollment_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "student_enrollment_promoted_from_id_fkey"
            columns: ["promoted_from_id"]
            isOneToOne: false
            referencedRelation: "student_enrollment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollment_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      student_guardian: {
        Row: {
          guardian_id: string
          is_primary_contact: boolean
          relationship: string
          student_id: string
        }
        Insert: {
          guardian_id: string
          is_primary_contact?: boolean
          relationship: string
          student_id: string
        }
        Update: {
          guardian_id?: string
          is_primary_contact?: boolean
          relationship?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_guardian_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardian"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_guardian_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      subject: {
        Row: {
          code: string | null
          created_at: string
          deleted_at: string | null
          full_marks: number | null
          id: string
          institution_id: string
          max_class_level: number | null
          min_class_level: number | null
          name_bn: string
          name_en: string
          pass_marks: number | null
          status: string
          type: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          deleted_at?: string | null
          full_marks?: number | null
          id?: string
          institution_id: string
          max_class_level?: number | null
          min_class_level?: number | null
          name_bn: string
          name_en: string
          pass_marks?: number | null
          status?: string
          type?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          deleted_at?: string | null
          full_marks?: number | null
          id?: string
          institution_id?: string
          max_class_level?: number | null
          min_class_level?: number | null
          name_bn?: string
          name_en?: string
          pass_marks?: number | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      subject_group: {
        Row: {
          created_at: string
          id: string
          institution_id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_group_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_group_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      subject_group_member: {
        Row: {
          subject_group_id: string
          subject_id: string
        }
        Insert: {
          subject_group_id: string
          subject_id: string
        }
        Update: {
          subject_group_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_group_member_subject_group_id_fkey"
            columns: ["subject_group_id"]
            isOneToOne: false
            referencedRelation: "subject_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_group_member_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          institution_id: string
          plan_id: string
          seats: number | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          institution_id: string
          plan_id: string
          seats?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          institution_id?: string
          plan_id?: string
          seats?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "subscription_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plan"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher: {
        Row: {
          alt_mobile: string | null
          blood_group: Database["public"]["Enums"]["blood_group"] | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          department_id: string | null
          designation_id: string | null
          dob: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_number: string | null
          emergency_contact_relation: string | null
          employee_code: string | null
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          experience_years: number | null
          gender: Database["public"]["Enums"]["gender"] | null
          highest_degree: string | null
          id: string
          institution_id: string
          joining_date: string | null
          main_subject_id: string | null
          metadata: Json
          mobile: string | null
          name_bn: string
          name_en: string
          nationality: string | null
          nid: string | null
          photo_file_id: string | null
          religion: Database["public"]["Enums"]["religion"] | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alt_mobile?: string | null
          blood_group?: Database["public"]["Enums"]["blood_group"] | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department_id?: string | null
          designation_id?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          emergency_contact_relation?: string | null
          employee_code?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          experience_years?: number | null
          gender?: Database["public"]["Enums"]["gender"] | null
          highest_degree?: string | null
          id?: string
          institution_id: string
          joining_date?: string | null
          main_subject_id?: string | null
          metadata?: Json
          mobile?: string | null
          name_bn: string
          name_en: string
          nationality?: string | null
          nid?: string | null
          photo_file_id?: string | null
          religion?: Database["public"]["Enums"]["religion"] | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alt_mobile?: string | null
          blood_group?: Database["public"]["Enums"]["blood_group"] | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department_id?: string | null
          designation_id?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          emergency_contact_relation?: string | null
          employee_code?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          experience_years?: number | null
          gender?: Database["public"]["Enums"]["gender"] | null
          highest_degree?: string | null
          id?: string
          institution_id?: string
          joining_date?: string | null
          main_subject_id?: string | null
          metadata?: Json
          mobile?: string | null
          name_bn?: string
          name_en?: string
          nationality?: string | null
          nid?: string | null
          photo_file_id?: string | null
          religion?: Database["public"]["Enums"]["religion"] | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "designation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "teacher_main_subject_id_fkey"
            columns: ["main_subject_id"]
            isOneToOne: false
            referencedRelation: "subject"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_photo_file_id_fkey"
            columns: ["photo_file_id"]
            isOneToOne: false
            referencedRelation: "file_object"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_address: {
        Row: {
          district_id: string | null
          division_id: string | null
          house_road: string | null
          id: string
          teacher_id: string
          type: string
          upazila_id: string | null
          village: string | null
        }
        Insert: {
          district_id?: string | null
          division_id?: string | null
          house_road?: string | null
          id?: string
          teacher_id: string
          type: string
          upazila_id?: string | null
          village?: string | null
        }
        Update: {
          district_id?: string | null
          division_id?: string | null
          house_road?: string | null
          id?: string
          teacher_id?: string
          type?: string
          upazila_id?: string | null
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_address_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "district"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_address_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "division"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_address_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_address_upazila_id_fkey"
            columns: ["upazila_id"]
            isOneToOne: false
            referencedRelation: "upazila"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_assignment: {
        Row: {
          class_section_id: string
          id: string
          institution_id: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          class_section_id: string
          id?: string
          institution_id: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          class_section_id?: string
          id?: string
          institution_id?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignment_class_section_id_fkey"
            columns: ["class_section_id"]
            isOneToOne: false
            referencedRelation: "class_section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignment_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignment_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "teacher_assignment_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignment_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_document: {
        Row: {
          created_at: string
          file_id: string | null
          id: string
          teacher_id: string
          type: string
        }
        Insert: {
          created_at?: string
          file_id?: string | null
          id?: string
          teacher_id: string
          type: string
        }
        Update: {
          created_at?: string
          file_id?: string | null
          id?: string
          teacher_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_document_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "file_object"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_document_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonial: {
        Row: {
          cert_no: string | null
          conduct: string | null
          created_at: string
          id: string
          institution_id: string
          issued_at: string | null
          language: Database["public"]["Enums"]["app_language"] | null
          parent_name: string | null
          permanent_address: string | null
          remarks: string | null
          session: string | null
          student_id: string
        }
        Insert: {
          cert_no?: string | null
          conduct?: string | null
          created_at?: string
          id?: string
          institution_id: string
          issued_at?: string | null
          language?: Database["public"]["Enums"]["app_language"] | null
          parent_name?: string | null
          permanent_address?: string | null
          remarks?: string | null
          session?: string | null
          student_id: string
        }
        Update: {
          cert_no?: string | null
          conduct?: string | null
          created_at?: string
          id?: string
          institution_id?: string
          issued_at?: string | null
          language?: Database["public"]["Enums"]["app_language"] | null
          parent_name?: string | null
          permanent_address?: string | null
          remarks?: string | null
          session?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonial_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonial_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "testimonial_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_period: {
        Row: {
          academic_year_id: string | null
          class_section_id: string
          day_of_week: number
          end_time: string | null
          id: string
          institution_id: string
          period_no: number
          room_no: string | null
          start_time: string | null
          subject_id: string | null
          teacher_id: string | null
        }
        Insert: {
          academic_year_id?: string | null
          class_section_id: string
          day_of_week: number
          end_time?: string | null
          id?: string
          institution_id: string
          period_no: number
          room_no?: string | null
          start_time?: string | null
          subject_id?: string | null
          teacher_id?: string | null
        }
        Update: {
          academic_year_id?: string | null
          class_section_id?: string
          day_of_week?: number
          end_time?: string | null
          id?: string
          institution_id?: string
          period_no?: number
          room_no?: string | null
          start_time?: string | null
          subject_id?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timetable_period_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_period_class_section_id_fkey"
            columns: ["class_section_id"]
            isOneToOne: false
            referencedRelation: "class_section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_period_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_period_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "timetable_period_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_period_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_certificate: {
        Row: {
          cert_no: string | null
          cert_type: string | null
          created_at: string
          id: string
          institution_id: string
          issue_date: string | null
          language: Database["public"]["Enums"]["app_language"] | null
          parent_name: string | null
          permanent_address: string | null
          reason: string | null
          session: string | null
          student_id: string
        }
        Insert: {
          cert_no?: string | null
          cert_type?: string | null
          created_at?: string
          id?: string
          institution_id: string
          issue_date?: string | null
          language?: Database["public"]["Enums"]["app_language"] | null
          parent_name?: string | null
          permanent_address?: string | null
          reason?: string | null
          session?: string | null
          student_id: string
        }
        Update: {
          cert_no?: string | null
          cert_type?: string | null
          created_at?: string
          id?: string
          institution_id?: string
          issue_date?: string | null
          language?: Database["public"]["Enums"]["app_language"] | null
          parent_name?: string | null
          permanent_address?: string | null
          reason?: string | null
          session?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_certificate_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_certificate_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "transfer_certificate_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      upazila: {
        Row: {
          created_at: string
          district_id: string
          id: string
          name_bn: string
          name_en: string
        }
        Insert: {
          created_at?: string
          district_id: string
          id?: string
          name_bn: string
          name_en: string
        }
        Update: {
          created_at?: string
          district_id?: string
          id?: string
          name_bn?: string
          name_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "upazila_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "district"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role: {
        Row: {
          institution_id: string | null
          profile_id: string
          role_id: string
        }
        Insert: {
          institution_id?: string | null
          profile_id: string
          role_id: string
        }
        Update: {
          institution_id?: string | null
          profile_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "user_role_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_attendance_daily_summary: {
        Row: {
          absent: number | null
          att_date: string | null
          class_section_id: string | null
          institution_id: string | null
          late: number | null
          on_leave: number | null
          present: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_section_id_fkey"
            columns: ["class_section_id"]
            isOneToOne: false
            referencedRelation: "class_section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      v_attendance_student_summary: {
        Row: {
          class_section_id: string | null
          institution_id: string | null
          present_days: number | null
          rate_pct: number | null
          student_id: string | null
          total_days: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_section_id_fkey"
            columns: ["class_section_id"]
            isOneToOne: false
            referencedRelation: "class_section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      v_attendance_trend: {
        Row: {
          absent: number | null
          class_section_id: string | null
          institution_id: string | null
          present: number | null
          total: number | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_section_id_fkey"
            columns: ["class_section_id"]
            isOneToOne: false
            referencedRelation: "class_section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      v_dashboard_kpi: {
        Row: {
          active_students: number | null
          active_teachers: number | null
          class_sections: number | null
          collected_this_month: number | null
          institution_id: string | null
          total_due: number | null
        }
        Insert: {
          active_students?: never
          active_teachers?: never
          class_sections?: never
          collected_this_month?: never
          institution_id?: string | null
          total_due?: never
        }
        Update: {
          active_students?: never
          active_teachers?: never
          class_sections?: never
          collected_this_month?: never
          institution_id?: string | null
          total_due?: never
        }
        Relationships: []
      }
      v_effective_subject_marks: {
        Row: {
          class_id: string | null
          exam_id: string | null
          exam_subject_id: string | null
          full_marks: number | null
          pass_marks: number | null
          subject_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_subject_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_subject_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exam"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_subject_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subject"
            referencedColumns: ["id"]
          },
        ]
      }
      v_family_children: {
        Row: {
          child_count: number | null
          guardian_id: string | null
          student_ids: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "student_guardian_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardian"
            referencedColumns: ["id"]
          },
        ]
      }
      v_fee_invoice_balance: {
        Row: {
          due_amount: number | null
          fee_invoice_id: string | null
          institution_id: string | null
          is_reconciled: boolean | null
          lines_total: number | null
          paid_amount: number | null
          payments_total: number | null
          student_id: string | null
          total_amount: number | null
          waiver_amount: number | null
        }
        Insert: {
          due_amount?: number | null
          fee_invoice_id?: string | null
          institution_id?: string | null
          is_reconciled?: never
          lines_total?: never
          paid_amount?: number | null
          payments_total?: never
          student_id?: string | null
          total_amount?: number | null
          waiver_amount?: number | null
        }
        Update: {
          due_amount?: number | null
          fee_invoice_id?: string | null
          institution_id?: string | null
          is_reconciled?: never
          lines_total?: never
          paid_amount?: number | null
          payments_total?: never
          student_id?: string | null
          total_amount?: number | null
          waiver_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_invoice_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoice_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
          {
            foreignKeyName: "fee_invoice_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
        ]
      }
      v_sms_campaign_summary: {
        Row: {
          delivered: number | null
          failed: number | null
          institution_id: string | null
          recipient_count: number | null
          recipient_type: string | null
          sent_at: string | null
          sms_campaign_id: string | null
          total_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_campaign_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_campaign_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
      v_student_demographics: {
        Row: {
          class_section_id: string | null
          cnt: number | null
          gender: Database["public"]["Enums"]["gender"] | null
          institution_id: string | null
          religion: Database["public"]["Enums"]["religion"] | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollment_class_section_id_fkey"
            columns: ["class_section_id"]
            isOneToOne: false
            referencedRelation: "class_section"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollment_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollment_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_kpi"
            referencedColumns: ["institution_id"]
          },
        ]
      }
    }
    Functions: {
      fn_attendance_summary: {
        Args: { p_class_section_id: string; p_from: string; p_to: string }
        Returns: Json
      }
      fn_collect_fee: { Args: { payload: Json }; Returns: string }
      fn_create_admit_batch: { Args: { payload: Json }; Returns: string }
      fn_create_id_card_batch: { Args: { payload: Json }; Returns: string }
      fn_create_testimonial: { Args: { payload: Json }; Returns: string }
      fn_create_transfer: { Args: { payload: Json }; Returns: string }
      fn_delete_certificate_template: {
        Args: { p_id: string }
        Returns: undefined
      }
      fn_delete_class: { Args: { p_id: string }; Returns: undefined }
      fn_delete_class_section: { Args: { p_id: string }; Returns: undefined }
      fn_delete_fee_invoice: { Args: { payload: Json }; Returns: number }
      fn_delete_fee_mapping: { Args: { p_id: string }; Returns: undefined }
      fn_delete_grade_scheme: { Args: { p_id: string }; Returns: undefined }
      fn_delete_notice: { Args: { p_id: string }; Returns: undefined }
      fn_delete_signature: { Args: { p_id: string }; Returns: undefined }
      fn_delete_sms_template: { Args: { p_id: string }; Returns: undefined }
      fn_delete_subject: { Args: { p_id: string }; Returns: undefined }
      fn_delete_subject_group: { Args: { p_id: string }; Returns: undefined }
      fn_digital_transaction_stats: { Args: never; Returns: Json }
      fn_fee_income_statement: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      fn_generate_code: { Args: { p_entity: string }; Returns: string }
      fn_mark_attendance: { Args: { payload: Json }; Returns: number }
      fn_process_exam_result: {
        Args: { p_exam_id: string }
        Returns: undefined
      }
      fn_purchase_sms_package: {
        Args: { p_package_id: string }
        Returns: string
      }
      fn_pushback_migration: { Args: { p_batch_id: string }; Returns: number }
      fn_record_file_upload: { Args: { payload: Json }; Returns: string }
      fn_register_student: { Args: { payload: Json }; Returns: string }
      fn_register_teacher: { Args: { payload: Json }; Returns: string }
      fn_run_migration: { Args: { payload: Json }; Returns: string }
      fn_save_exam_config: {
        Args: { p_kind: string; payload: Json }
        Returns: undefined
      }
      fn_save_marks: { Args: { payload: Json }; Returns: number }
      fn_save_setting: {
        Args: { p_key: string; p_scope: string; p_value: Json }
        Returns: undefined
      }
      fn_send_sms_campaign: { Args: { payload: Json }; Returns: string }
      fn_sms_campaign_totals: { Args: never; Returns: Json }
      fn_student_report_summary: {
        Args: { p_academic_year_id?: string }
        Returns: Json
      }
      fn_unpaid_by_institute: { Args: never; Returns: Json }
      fn_update_institution: { Args: { payload: Json }; Returns: undefined }
      fn_update_student_basic: { Args: { payload: Json }; Returns: string }
      fn_update_teacher: { Args: { payload: Json }; Returns: string }
      fn_upsert_certificate_template: {
        Args: { payload: Json }
        Returns: string
      }
      fn_upsert_class: { Args: { payload: Json }; Returns: string }
      fn_upsert_class_section: { Args: { payload: Json }; Returns: string }
      fn_upsert_exam: { Args: { payload: Json }; Returns: string }
      fn_upsert_fee_mapping: { Args: { payload: Json }; Returns: string }
      fn_upsert_grade_scheme: { Args: { payload: Json }; Returns: string }
      fn_upsert_notice: { Args: { payload: Json }; Returns: string }
      fn_upsert_signature: { Args: { payload: Json }; Returns: string }
      fn_upsert_sms_template: { Args: { payload: Json }; Returns: string }
      fn_upsert_subject: { Args: { payload: Json }; Returns: string }
      fn_upsert_subject_group: { Args: { payload: Json }; Returns: string }
    }
    Enums: {
      app_language: "bn" | "en"
      attendance_context: "daily" | "exam"
      attendance_status: "present" | "absent" | "late" | "leave" | "exam_absent"
      blood_group:
        | "a_pos"
        | "a_neg"
        | "b_pos"
        | "b_neg"
        | "ab_pos"
        | "ab_neg"
        | "o_pos"
        | "o_neg"
      employment_type: "permanent" | "part_time"
      gender: "male" | "female" | "other"
      ledger_direction: "debit" | "credit"
      religion: "islam" | "hindu" | "christian" | "buddhist" | "other"
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
      app_language: ["bn", "en"],
      attendance_context: ["daily", "exam"],
      attendance_status: ["present", "absent", "late", "leave", "exam_absent"],
      blood_group: [
        "a_pos",
        "a_neg",
        "b_pos",
        "b_neg",
        "ab_pos",
        "ab_neg",
        "o_pos",
        "o_neg",
      ],
      employment_type: ["permanent", "part_time"],
      gender: ["male", "female", "other"],
      ledger_direction: ["debit", "credit"],
      religion: ["islam", "hindu", "christian", "buddhist", "other"],
    },
  },
} as const
