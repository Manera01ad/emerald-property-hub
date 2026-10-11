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
      app_settings: {
        Row: {
          key: string
          label: string | null
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          label?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          label?: string | null
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          agreement_terms: string | null
          commission_pct: number | null
          created_at: string
          deal_value: number | null
          enquiry_id: string | null
          expected_amount: number
          fixed_amount: number | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          paid_amount: number
          paid_date: string | null
          partner_id: string | null
          property_id: string | null
          receipt_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agreement_terms?: string | null
          commission_pct?: number | null
          created_at?: string
          deal_value?: number | null
          enquiry_id?: string | null
          expected_amount?: number
          fixed_amount?: number | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          paid_amount?: number
          paid_date?: string | null
          partner_id?: string | null
          property_id?: string | null
          receipt_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agreement_terms?: string | null
          commission_pct?: number | null
          created_at?: string
          deal_value?: number | null
          enquiry_id?: string | null
          expected_amount?: number
          fixed_amount?: number | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          paid_amount?: number
          paid_date?: string | null
          partner_id?: string | null
          property_id?: string | null
          receipt_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      enquiries: {
        Row: {
          admin_notes: string | null
          assigned_consultant: string | null
          bedrooms: number | null
          budget: number | null
          consent: boolean
          created_at: string
          email: string | null
          enquiry_type: string
          id: string
          message: string | null
          name: string
          next_follow_up: string | null
          phone: string
          preferred_locations: string[]
          preferred_visit_date: string | null
          property_id: string | null
          property_types: string[]
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_consultant?: string | null
          bedrooms?: number | null
          budget?: number | null
          consent: boolean
          created_at?: string
          email?: string | null
          enquiry_type: string
          id?: string
          message?: string | null
          name: string
          next_follow_up?: string | null
          phone: string
          preferred_locations?: string[]
          preferred_visit_date?: string | null
          property_id?: string | null
          property_types?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          assigned_consultant?: string | null
          bedrooms?: number | null
          budget?: number | null
          consent?: boolean
          created_at?: string
          email?: string | null
          enquiry_type?: string
          id?: string
          message?: string | null
          name?: string
          next_follow_up?: string | null
          phone?: string
          preferred_locations?: string[]
          preferred_visit_date?: string | null
          property_id?: string | null
          property_types?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enquiries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      infrastructure_projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          last_checked: string | null
          location: string
          name: string
          progress_status: string
          source_url: string | null
          verified: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          last_checked?: string | null
          location: string
          name: string
          progress_status?: string
          source_url?: string | null
          verified?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          last_checked?: string | null
          location?: string
          name?: string
          progress_status?: string
          source_url?: string | null
          verified?: boolean
        }
        Relationships: []
      }
      nearby_places: {
        Row: {
          category: string
          created_at: string
          distance_km: number | null
          id: string
          name: string
          property_id: string
          source: string | null
          verified: boolean
        }
        Insert: {
          category: string
          created_at?: string
          distance_km?: number | null
          id?: string
          name: string
          property_id: string
          source?: string | null
          verified?: boolean
        }
        Update: {
          category?: string
          created_at?: string
          distance_km?: number | null
          id?: string
          name?: string
          property_id?: string
          source?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "nearby_places_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          agreement_status: string
          created_at: string
          email: string | null
          id: string
          kind: string
          name: string
          notes: string | null
          phone: string | null
          rera_number: string | null
        }
        Insert: {
          agreement_status?: string
          created_at?: string
          email?: string | null
          id?: string
          kind?: string
          name: string
          notes?: string | null
          phone?: string | null
          rera_number?: string | null
        }
        Update: {
          agreement_status?: string
          created_at?: string
          email?: string | null
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          phone?: string | null
          rera_number?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          amenities: string[]
          approval_details: string | null
          approvals: string[]
          asking_price: number
          availability: string
          bedrooms: number | null
          built_area_sqft: number | null
          created_at: string
          description: string | null
          doc_approved_plan: boolean
          doc_building_permit: boolean
          doc_encumbrance: boolean
          doc_patta: boolean
          doc_title_deed: boolean
          guideline_value: number | null
          id: string
          is_demo: boolean
          land_area_sqft: number | null
          latitude: number | null
          listing_permission: boolean
          location: string
          longitude: number | null
          partner_id: string | null
          permission_evidence: string | null
          photos: string[]
          property_type: string
          rera_number: string | null
          source: string | null
          status: string
          survey_number: string | null
          title: string
          updated_at: string
          verification_date: string | null
          verification_evidence: string | null
          verification_expiry: string | null
          verification_status: string
        }
        Insert: {
          address?: string | null
          amenities?: string[]
          approval_details?: string | null
          approvals?: string[]
          asking_price: number
          availability?: string
          bedrooms?: number | null
          built_area_sqft?: number | null
          created_at?: string
          description?: string | null
          doc_approved_plan?: boolean
          doc_building_permit?: boolean
          doc_encumbrance?: boolean
          doc_patta?: boolean
          doc_title_deed?: boolean
          guideline_value?: number | null
          id?: string
          is_demo?: boolean
          land_area_sqft?: number | null
          latitude?: number | null
          listing_permission?: boolean
          location: string
          longitude?: number | null
          partner_id?: string | null
          permission_evidence?: string | null
          photos?: string[]
          property_type: string
          rera_number?: string | null
          source?: string | null
          status?: string
          survey_number?: string | null
          title: string
          updated_at?: string
          verification_date?: string | null
          verification_evidence?: string | null
          verification_expiry?: string | null
          verification_status?: string
        }
        Update: {
          address?: string | null
          amenities?: string[]
          approval_details?: string | null
          approvals?: string[]
          asking_price?: number
          availability?: string
          bedrooms?: number | null
          built_area_sqft?: number | null
          created_at?: string
          description?: string | null
          doc_approved_plan?: boolean
          doc_building_permit?: boolean
          doc_encumbrance?: boolean
          doc_patta?: boolean
          doc_title_deed?: boolean
          guideline_value?: number | null
          id?: string
          is_demo?: boolean
          land_area_sqft?: number | null
          latitude?: number | null
          listing_permission?: boolean
          location?: string
          longitude?: number | null
          partner_id?: string | null
          permission_evidence?: string | null
          photos?: string[]
          property_type?: string
          rera_number?: string | null
          source?: string | null
          status?: string
          survey_number?: string | null
          title?: string
          updated_at?: string
          verification_date?: string | null
          verification_evidence?: string | null
          verification_expiry?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visits: {
        Row: {
          created_at: string
          enquiry_id: string | null
          id: string
          notes: string | null
          property_id: string | null
          status: string
          updated_at: string
          visit_at: string
        }
        Insert: {
          created_at?: string
          enquiry_id?: string | null
          id?: string
          notes?: string | null
          property_id?: string | null
          status?: string
          updated_at?: string
          visit_at: string
        }
        Update: {
          created_at?: string
          enquiry_id?: string | null
          id?: string
          notes?: string | null
          property_id?: string | null
          status?: string
          updated_at?: string
          visit_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_visits_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
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
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
