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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      dtc_records: {
        Row: {
          cleared_date: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          notes: string | null
          read_date: string
          severity: string | null
          status: string
          vehicle_id: string
        }
        Insert: {
          cleared_date?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          read_date?: string
          severity?: string | null
          status?: string
          vehicle_id: string
        }
        Update: {
          cleared_date?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          read_date?: string
          severity?: string | null
          status?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dtc_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_logs: {
        Row: {
          cost: number | null
          created_at: string
          date: string
          id: string
          mileage: number | null
          next_due_date: string | null
          next_due_mileage: number | null
          notes: string | null
          parts: Json | null
          service: string
          shop: string | null
          vehicle_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          date: string
          id?: string
          mileage?: number | null
          next_due_date?: string | null
          next_due_mileage?: number | null
          notes?: string | null
          parts?: Json | null
          service: string
          shop?: string | null
          vehicle_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          date?: string
          id?: string
          mileage?: number | null
          next_due_date?: string | null
          next_due_mileage?: number | null
          notes?: string | null
          parts?: Json | null
          service?: string
          shop?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_notes: {
        Row: {
          content: string
          created_at: string | null
          id: string
          project_id: string
          step_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          project_id: string
          step_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          project_id?: string
          step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_notes_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "project_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      project_parts: {
        Row: {
          actual_cost: number | null
          brand: string | null
          buy_url_amazon: string | null
          buy_url_rockauto: string | null
          estimated_cost: number | null
          have_it: boolean | null
          id: string
          name: string
          notes: string | null
          part_number: string | null
          project_id: string
          quantity: number | null
          sort_order: number | null
        }
        Insert: {
          actual_cost?: number | null
          brand?: string | null
          buy_url_amazon?: string | null
          buy_url_rockauto?: string | null
          estimated_cost?: number | null
          have_it?: boolean | null
          id?: string
          name: string
          notes?: string | null
          part_number?: string | null
          project_id: string
          quantity?: number | null
          sort_order?: number | null
        }
        Update: {
          actual_cost?: number | null
          brand?: string | null
          buy_url_amazon?: string | null
          buy_url_rockauto?: string | null
          estimated_cost?: number | null
          have_it?: boolean | null
          id?: string
          name?: string
          notes?: string | null
          part_number?: string | null
          project_id?: string
          quantity?: number | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_parts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_steps: {
        Row: {
          completed_at: string | null
          description: string
          estimated_minutes: number | null
          id: string
          notes: string | null
          photo_urls: string[] | null
          project_id: string
          safety_note: string | null
          sort_order: number | null
          status: string | null
          step_number: number
          sub_steps: string[] | null
          tip: string | null
          title: string
          torque_specs: Json | null
        }
        Insert: {
          completed_at?: string | null
          description: string
          estimated_minutes?: number | null
          id?: string
          notes?: string | null
          photo_urls?: string[] | null
          project_id: string
          safety_note?: string | null
          sort_order?: number | null
          status?: string | null
          step_number: number
          sub_steps?: string[] | null
          tip?: string | null
          title: string
          torque_specs?: Json | null
        }
        Update: {
          completed_at?: string | null
          description?: string
          estimated_minutes?: number | null
          id?: string
          notes?: string | null
          photo_urls?: string[] | null
          project_id?: string
          safety_note?: string | null
          sort_order?: number | null
          status?: string | null
          step_number?: number
          sub_steps?: string[] | null
          tip?: string | null
          title?: string
          torque_specs?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "project_steps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tools: {
        Row: {
          have_it: boolean | null
          id: string
          name: string
          project_id: string
          required: boolean | null
          sort_order: number | null
          spec: string | null
        }
        Insert: {
          have_it?: boolean | null
          id?: string
          name: string
          project_id: string
          required?: boolean | null
          sort_order?: number | null
          spec?: string | null
        }
        Update: {
          have_it?: boolean | null
          id?: string
          name?: string
          project_id?: string
          required?: boolean | null
          sort_order?: number | null
          spec?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_tools_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_minutes: number | null
          ai_generated: boolean | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          difficulty: string | null
          estimated_minutes: number | null
          id: string
          safety_warnings: string[] | null
          started_at: string | null
          status: string
          timer_running: boolean | null
          timer_started_at: string | null
          title: string
          updated_at: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          actual_minutes?: number | null
          ai_generated?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          estimated_minutes?: number | null
          id?: string
          safety_warnings?: string[] | null
          started_at?: string | null
          status?: string
          timer_running?: boolean | null
          timer_started_at?: string | null
          title: string
          updated_at?: string | null
          user_id: string
          vehicle_id: string
        }
        Update: {
          actual_minutes?: number | null
          ai_generated?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          estimated_minutes?: number | null
          id?: string
          safety_warnings?: string[] | null
          started_at?: string | null
          status?: string
          timer_running?: boolean | null
          timer_started_at?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_logs: {
        Row: {
          created_at: string
          date: string
          description: string | null
          difficulty: number | null
          diy_cost: number | null
          id: string
          labor_hours: number | null
          mileage: number | null
          notes: string | null
          parts: Json | null
          photo_urls: string[] | null
          shop_quote: number | null
          title: string
          total_cost: number | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          difficulty?: number | null
          diy_cost?: number | null
          id?: string
          labor_hours?: number | null
          mileage?: number | null
          notes?: string | null
          parts?: Json | null
          photo_urls?: string[] | null
          shop_quote?: number | null
          title: string
          total_cost?: number | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          difficulty?: number | null
          diy_cost?: number | null
          id?: string
          labor_hours?: number | null
          mileage?: number | null
          notes?: string | null
          parts?: Json | null
          photo_urls?: string[] | null
          shop_quote?: number | null
          title?: string
          total_cost?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_project_tasks: {
        Row: {
          actual_cost: number | null
          created_at: string
          description: string | null
          estimated_cost: number | null
          id: string
          notes: string | null
          parts: Json | null
          project_id: string
          sort_order: number | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          parts?: Json | null
          project_id: string
          sort_order?: number | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          parts?: Json | null
          project_id?: string
          sort_order?: number | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vehicle_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          priority: string | null
          status: string
          title: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          priority?: string | null
          status?: string
          title: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          priority?: string | null
          status?: string
          title?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_projects_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          body_style: string | null
          color: string | null
          created_at: string
          drivetrain: string | null
          engine: string | null
          id: string
          last_recall_check: string | null
          license_plate: string | null
          make: string
          mileage: number | null
          model: string
          nhtsa_data: Json | null
          nickname: string | null
          purchase_date: string | null
          recall_data: Json | null
          transmission: string | null
          trim: string | null
          updated_at: string
          user_id: string
          vin: string | null
          year: number
        }
        Insert: {
          body_style?: string | null
          color?: string | null
          created_at?: string
          drivetrain?: string | null
          engine?: string | null
          id?: string
          last_recall_check?: string | null
          license_plate?: string | null
          make: string
          mileage?: number | null
          model: string
          nhtsa_data?: Json | null
          nickname?: string | null
          purchase_date?: string | null
          recall_data?: Json | null
          transmission?: string | null
          trim?: string | null
          updated_at?: string
          user_id: string
          vin?: string | null
          year: number
        }
        Update: {
          body_style?: string | null
          color?: string | null
          created_at?: string
          drivetrain?: string | null
          engine?: string | null
          id?: string
          last_recall_check?: string | null
          license_plate?: string | null
          make?: string
          mileage?: number | null
          model?: string
          nhtsa_data?: Json | null
          nickname?: string | null
          purchase_date?: string | null
          recall_data?: Json | null
          transmission?: string | null
          trim?: string | null
          updated_at?: string
          user_id?: string
          vin?: string | null
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
