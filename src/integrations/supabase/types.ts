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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      cycles: {
        Row: {
          cycle_id: number
          cycle_number: number
          float_id: string
        }
        Insert: {
          cycle_id?: never
          cycle_number: number
          float_id: string
        }
        Update: {
          cycle_id?: never
          cycle_number?: number
          float_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycles_float_id_fkey"
            columns: ["float_id"]
            isOneToOne: false
            referencedRelation: "floats"
            referencedColumns: ["float_id"]
          },
        ]
      }
      floats: {
        Row: {
          created_at: string
          data_centre: string | null
          float_id: string
          pi_name: string | null
          platform_type: string | null
          project_name: string | null
          wmo_inst_type: string | null
        }
        Insert: {
          created_at?: string
          data_centre?: string | null
          float_id: string
          pi_name?: string | null
          platform_type?: string | null
          project_name?: string | null
          wmo_inst_type?: string | null
        }
        Update: {
          created_at?: string
          data_centre?: string | null
          float_id?: string
          pi_name?: string | null
          platform_type?: string | null
          project_name?: string | null
          wmo_inst_type?: string | null
        }
        Relationships: []
      }
      measurements: {
        Row: {
          is_adjusted: boolean
          level_index: number
          measurement_id: number
          pres_qc: number | null
          pressure: number
          profile_id: string
          psal_qc: number | null
          salinity: number | null
          temp_qc: number | null
          temperature: number | null
        }
        Insert: {
          is_adjusted: boolean
          level_index: number
          measurement_id?: never
          pres_qc?: number | null
          pressure: number
          profile_id: string
          psal_qc?: number | null
          salinity?: number | null
          temp_qc?: number | null
          temperature?: number | null
        }
        Update: {
          is_adjusted?: boolean
          level_index?: number
          measurement_id?: never
          pres_qc?: number | null
          pressure?: number
          profile_id?: string
          psal_qc?: number | null
          salinity?: number | null
          temp_qc?: number | null
          temperature?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "measurements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "map_profiles"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "measurements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          cycle_id: number
          data_mode: string
          data_source: string
          direction: string | null
          juld_qc: number | null
          latitude: number | null
          longitude: number | null
          position_qc: number | null
          profile_id: string
          profile_time: string | null
          source_file: string
          vertical_sampling_scheme: string | null
        }
        Insert: {
          created_at?: string
          cycle_id: number
          data_mode: string
          data_source: string
          direction?: string | null
          juld_qc?: number | null
          latitude?: number | null
          longitude?: number | null
          position_qc?: number | null
          profile_id: string
          profile_time?: string | null
          source_file: string
          vertical_sampling_scheme?: string | null
        }
        Update: {
          created_at?: string
          cycle_id?: number
          data_mode?: string
          data_source?: string
          direction?: string | null
          juld_qc?: number | null
          latitude?: number | null
          longitude?: number | null
          position_qc?: number | null
          profile_id?: string
          profile_time?: string | null
          source_file?: string
          vertical_sampling_scheme?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["cycle_id"]
          },
        ]
      }
      query_log: {
        Row: {
          answer: string | null
          answer_path: string | null
          attempts: Json | null
          created_at: string
          duration_ms: number | null
          error: string | null
          execution_path: string | null
          fallback_reason: string | null
          final_sql: string | null
          id: string
          model: string | null
          provenance: Json | null
          provenance_sql: string | null
          question: string
          resolved_terms: Json | null
          row_count: number | null
          status: string
        }
        Insert: {
          answer?: string | null
          answer_path?: string | null
          attempts?: Json | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          execution_path?: string | null
          fallback_reason?: string | null
          final_sql?: string | null
          id?: string
          model?: string | null
          provenance?: Json | null
          provenance_sql?: string | null
          question: string
          resolved_terms?: Json | null
          row_count?: number | null
          status?: string
        }
        Update: {
          answer?: string | null
          answer_path?: string | null
          attempts?: Json | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          execution_path?: string | null
          fallback_reason?: string | null
          final_sql?: string | null
          id?: string
          model?: string | null
          provenance?: Json | null
          provenance_sql?: string | null
          question?: string
          resolved_terms?: Json | null
          row_count?: number | null
          status?: string
        }
        Relationships: []
      }
      term_definitions: {
        Row: {
          category: string
          label: string
          phrases: string[]
          plain_language: string
          required_tables: string[]
          sql_condition: string
          term_id: string
          threshold_source: string | null
          updated_at: string
        }
        Insert: {
          category: string
          label: string
          phrases: string[]
          plain_language: string
          required_tables: string[]
          sql_condition: string
          term_id: string
          threshold_source?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          label?: string
          phrases?: string[]
          plain_language?: string
          required_tables?: string[]
          sql_condition?: string
          term_id?: string
          threshold_source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      map_profiles: {
        Row: {
          country: string | null
          cycle_number: number | null
          data_mode: string | null
          data_source: string | null
          direction: string | null
          float_id: string | null
          latitude: number | null
          longitude: number | null
          max_depth: number | null
          n_levels: number | null
          pi_name: string | null
          platform_type: string | null
          position_qc: number | null
          profile_id: string | null
          profile_time: string | null
          project_name: string | null
          source_file: string | null
          surface_salinity: number | null
          surface_temp: number | null
          wmo_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cycles_float_id_fkey"
            columns: ["float_id"]
            isOneToOne: false
            referencedRelation: "floats"
            referencedColumns: ["float_id"]
          },
          {
            foreignKeyName: "cycles_float_id_fkey"
            columns: ["wmo_number"]
            isOneToOne: false
            referencedRelation: "floats"
            referencedColumns: ["float_id"]
          },
        ]
      }
    }
    Functions: {
      floatchat_exec_select: {
        Args: { max_rows?: number; query: string }
        Returns: Json
      }
      floatchat_stats: { Args: never; Returns: Json }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
